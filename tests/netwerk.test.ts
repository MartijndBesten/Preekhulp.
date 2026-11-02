// HTTP-laag: quotum (429) met Retry-After, afkoelperiode, terugval op verlopen cache en herhalingen bij 5xx.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nieuweDb } from "../src/lib/db";
import { haal, hostAfkoelen, resetAfkoeling } from "../src/lib/http/veilig";

const db = nieuweDb();
beforeEach(() => resetAfkoeling());
afterEach(() => vi.unstubAllGlobals());

describe("Externe aanroepen", () => {
  it("HTTP 429 → nette quotumfout, afkoelperiode en geen tweede aanroep tijdens afkoelen", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 429, headers: { "retry-after": "120" } }));
    vi.stubGlobal("fetch", f);
    await expect(haal("https://api.voorbeeld.test/a", { dienst: "proef", db, herhalingen: 0, cacheSeconden: 0 })).rejects.toMatchObject({ soort: "quotum", status: 429 });
    expect(hostAfkoelen("api.voorbeeld.test")).toBeGreaterThan(100_000);
    await expect(haal("https://api.voorbeeld.test/b", { dienst: "proef", db, herhalingen: 0, cacheSeconden: 0 })).rejects.toMatchObject({ soort: "quotum" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("korte Retry-After → wacht en probeert opnieuw", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (++n === 1 ? new Response("", { status: 429, headers: { "retry-after": "0" } }) : new Response('{"ok":1}', { status: 200 }))));
    const r = await haal("https://api.tweede.test/x", { dienst: "proef", db, herhalingen: 1, cacheSeconden: 0 });
    expect(r.status).toBe(200);
    expect(n).toBe(2);
  });

  it("valt terug op verlopen cache wanneer de bron (tijdelijk) faalt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"v":1}', { status: 200 })));
    await haal("https://api.derde.test/q", { dienst: "proef", db, cacheSeconden: 3600 });
    db.prepare("UPDATE http_cache SET verloopt = '2000-01-01T00:00:00Z'").run();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    const r = await haal("https://api.derde.test/q", { dienst: "proef", db, herhalingen: 0, cacheSeconden: 3600 });
    expect(r.verouderd).toBe(true);
    expect(r.tekst).toBe('{"v":1}');
  });

  it("5xx wordt herhaald en daarna als fout gemeld", async () => {
    const f = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", f);
    await expect(haal("https://api.vierde.test/q", { dienst: "proef", db, herhalingen: 1, cacheSeconden: 0 })).rejects.toThrow(/HTTP 503/);
    expect(f).toHaveBeenCalledTimes(2);
  }, 10_000);
});
