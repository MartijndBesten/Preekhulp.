// Vormtests: controleren de vertaling van API-antwoorden naar BronRecords met vaste voorbeeldantwoorden
// in de bekende API-vorm. Dit bewijst NIET dat de live API werkt — daarvoor: npm run bronnen:controleren.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { maakTestDataMap } from "./helpers";

let ctx: import("../src/lib/sources/types").ConnectorContext;
beforeAll(async () => {
  maakTestDataMap();
  const { nieuweDb } = await import("../src/lib/db");
  const { STANDAARD } = await import("../src/lib/settings");
  ctx = { db: nieuweDb(), instellingen: STANDAARD };
});
afterEach(() => vi.unstubAllGlobals());

const antwoord = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("Academische connectors (vorm)", () => {
  it("OpenAlex: abstract uit inverted index, OA-status en rechten", async () => {
    vi.stubGlobal("fetch", antwoord({ results: [{ id: "https://openalex.org/W1", doi: "https://doi.org/10.1234/abc", display_name: "Bethel in Genesis", publication_year: 2019, type: "article", authorships: [{ author: { display_name: "A. Auteur" } }], primary_location: { source: { display_name: "Vetus Testamentum" } }, open_access: { is_oa: true, oa_status: "gold" }, best_oa_location: { license: "cc-by", pdf_url: "https://x/y.pdf" }, abstract_inverted_index: { Jacob: [0], returns: [1], home: [2] } }] }));
    const { openAlex } = await import("../src/lib/sources/connectors/academisch");
    const r = await openAlex.zoek({ tekst: "Bethel" }, ctx);
    expect(r[0].record.samenvatting).toBe("Jacob returns home");
    expect(r[0].record.toegang).toBe("abstract");
    expect(r[0].record.brontype).toBe("academisch artikel (peer review niet vastgesteld)");
    expect(r[0].record.rechten.herbruikbaar).toBe("ja");
    expect(r[0].passages[0].soort).toBe("abstract");
  });
  it("Crossref: metadata zonder abstract blijft 'alleen metadata'", async () => {
    vi.stubGlobal("fetch", antwoord({ message: { items: [{ DOI: "10.1/xyz", title: ["Jacob's vow"], author: [{ given: "B.", family: "Schrijver" }], issued: { "date-parts": [[2001]] }, type: "journal-article" }] } }));
    const { crossref } = await import("../src/lib/sources/connectors/academisch");
    const r = await crossref.zoek({ tekst: "Jacob vow" }, ctx);
    expect(r[0].record.toegang).toBe("alleen metadata");
    expect(r[0].record.brontype).toBe("academisch artikel (peer review niet vastgesteld)");
    expect(r[0].passages[0].soort).toBe("metadata");
    expect(r[0].record.auteurs).toEqual(["B. Schrijver"]);
    const aangeroepenUrl = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(new URL(aangeroepenUrl).searchParams.get("select")).not.toContain("language");
  });
  it("HTTP-fouten worden een nette fout, geen verzonnen resultaat", async () => {
    vi.stubGlobal("fetch", antwoord({ error: "x" }, 503));
    const { doaj } = await import("../src/lib/sources/connectors/academisch");
    await expect(doaj.zoek({ tekst: "Bethel" }, ctx)).rejects.toThrow(/HTTP 503/);
  });
  it("YouTube: zonder sleutel niet beschikbaar; met sleutel alleen metadata", async () => {
    const { youtube } = await import("../src/lib/videos/youtube");
    expect(youtube.nietBeschikbaar(ctx)).toMatch(/sleutel/);
    process.env.PREEKHULP_YOUTUBE_KEY = "test";
    vi.stubGlobal("fetch", vi.fn(async (u: string | URL) => new Response(JSON.stringify(String(u).includes("/search") ? { items: [{ id: { videoId: "dQw4w9WgXcQ" }, snippet: { title: "Genesis 31 &amp; Bethel", channelTitle: "Kerk", publishedAt: "2020-01-01T00:00:00Z", description: "Preek" } }] } : { items: [{ id: "dQw4w9WgXcQ", contentDetails: { duration: "PT40M" } }] }), { status: 200 })));
    const r = await youtube.zoek({ tekst: "Genesis 31 sermon" }, ctx);
    delete process.env.PREEKHULP_YOUTUBE_KEY;
    expect(r[0].record.titel).toBe("Genesis 31 & Bethel");
    expect(r[0].record.toegang).toBe("alleen metadata");
    expect(r[0].record.extra?.duurSec).toBe(2400);
  });
});

describe("Bronnen ontdubbelen", () => {
  it("zelfde DOI via twee connectors wordt één bron", async () => {
    const { bewaarBron } = await import("../src/lib/sources/opslag");
    const basis = { brontype: "peer-reviewed artikel" as const, titel: "X", auteurs: [], toegang: "alleen metadata" as const, rechten: { vindbaar: "ja" as const, leesbaar: "onbekend" as const, downloadbaar: "onbekend" as const, herbruikbaar: "onbekend" as const } };
    const a = bewaarBron(ctx.db, { ...basis, connector: "openalex", extern_id: "W1", doi: "https://doi.org/10.5555/ABC" });
    const b = bewaarBron(ctx.db, { ...basis, connector: "crossref", extern_id: "10.5555/abc", doi: "10.5555/abc" });
    expect(a).toBe(b);
  });
});
