// AI-verbindingsstatus: alle toestanden met nagebootste HTTP-antwoorden. Er gaat geen verzoek naar Anthropic.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { maakTestDataMap } from "./helpers";

let db: import("node:sqlite").DatabaseSync;
let v: typeof import("../src/lib/ai/verbinding");
let s: typeof import("../src/lib/settings");
const urls: string[] = [];
const nep = (status: number, body: unknown = {}) => (async (url: string | URL | Request) => {
  urls.push(String(url instanceof Request ? url.url : url));
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}) as typeof fetch;

beforeAll(async () => {
  maakTestDataMap();
  db = (await import("../src/lib/db")).nieuweDb();
  v = await import("../src/lib/ai/verbinding");
  s = await import("../src/lib/settings");
});
afterAll(() => {
  delete process.env.PREEKHULP_ANTHROPIC_KEY;
});

describe("AI-verbindingsstatus", () => {
  it("zonder aanbieder: geen AI, overige functies blijven werken", () => {
    expect(v.verbindingStatus(db).toestand).toBe("geen_aanbieder");
  });
  it("Anthropic zonder sleutel: sleutel ontbreekt (blokkeert niets anders)", () => {
    s.bewaarInstellingen(db, { aiAanbieder: "anthropic" });
    expect(v.verbindingStatus(db).toestand).toBe("sleutel_ontbreekt");
    expect(s.STANDAARD.anthropicModel).toBe("claude-sonnet-5-5");
  });
  it("sleutel aanwezig maar niet getest", () => {
    process.env.PREEKHULP_ANTHROPIC_KEY = "sk-ant-test-niet-echt";
    expect(v.verbindingStatus(db).toestand).toBe("niet_getest");
  });
  it("test werkt: alleen modelinformatie opgevraagd (gratis), sleutel niet opgeslagen", async () => {
    urls.length = 0;
    const r = await v.testVerbinding(db, nep(200, { id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5", type: "model", created_at: "2026-01-01T00:00:00Z" }));
    expect(r.toestand).toBe("werkt");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/models\/claude-sonnet-5-5/);
    expect(urls[0]).not.toMatch(/messages/);
    const opgeslagen = (db.prepare("SELECT waarde FROM meta WHERE sleutel = 'ai_verbinding'").get() as { waarde: string }).waarde;
    expect(opgeslagen).not.toContain("sk-ant");
  });
  it("andere sleutel of model: uitslag vervalt naar 'niet getest'", () => {
    s.bewaarInstellingen(db, { anthropicModel: "claude-opus-5-5" });
    expect(v.verbindingStatus(db).toestand).toBe("niet_getest");
    s.bewaarInstellingen(db, { anthropicModel: "claude-sonnet-5-5" });
    expect(v.verbindingStatus(db).toestand).toBe("werkt");
    process.env.PREEKHULP_ANTHROPIC_KEY = "sk-ant-andere";
    expect(v.verbindingStatus(db).toestand).toBe("niet_getest");
  });
  it.each([
    [401, "authenticatiefout"],
    [403, "authenticatiefout"],
    [404, "model_niet_beschikbaar"],
    [429, "quotum_of_budget"],
  ] as const)("HTTP %i → %s", async (status, toestand) => {
    expect((await v.testVerbinding(db, nep(status, { type: "error", error: { type: "x", message: "x" } }))).toestand).toBe(toestand);
  });
  it("netwerk niet bereikbaar", async () => {
    const weg = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect((await v.testVerbinding(db, weg)).toestand).toBe("netwerk");
  });
  it("maandbudget bereikt gaat vóór de laatste testuitslag", async () => {
    await v.testVerbinding(db, nep(200, { id: "claude-sonnet-5-5", type: "model" }));
    s.bewaarInstellingen(db, { maandbudgetUsd: 1 });
    db.prepare("INSERT INTO ai_gebruik (onderzoek, aanbieder, model, stap, kosten_usd, status, gemaakt) VALUES (NULL,'anthropic','claude-sonnet-5-5','test',1.2,'ok',?)").run(new Date().toISOString());
    expect(v.verbindingStatus(db).toestand).toBe("quotum_of_budget");
  });
});
