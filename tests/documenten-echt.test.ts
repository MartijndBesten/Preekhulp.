// Echte bestanden (gegenereerd door tests/fixtures/maak-documenten.py): PDF met tekstlaag, meerdere pagina's,
// voetnoten, twee kolommen, scan zonder tekstlaag; DOCX met koppen, tabel en voetnoot.
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDataMap } from "./helpers";

let mod: typeof import("../src/lib/documents/import");
let db: import("node:sqlite").DatabaseSync;
let zoek: typeof import("../src/lib/sources/connectors/lokaal").eigenDocumenten.zoek;
let dataDir: () => string;
const MAP = path.join(__dirname, "fixtures", "documenten");
const lees = (n: string) => fs.readFileSync(path.join(MAP, n));
const delen = (id: string) => db.prepare("SELECT locatie, pagina, tekst FROM document_delen WHERE document = ? ORDER BY volgorde").all(id) as { locatie: string; pagina: number | null; tekst: string }[];

beforeAll(async () => {
  maakTestDataMap();
  const dbm = await import("../src/lib/db");
  db = dbm.nieuweDb();
  dataDir = dbm.dataDir;
  mod = await import("../src/lib/documents/import");
  const l = await import("../src/lib/sources/connectors/lokaal");
  zoek = l.eigenDocumenten.zoek;
});

const ctx = () => ({ db, instellingen: {} as never, onderzoek: null });

describe("PDF (echte bestanden)", () => {
  it("tekst-PDF: gelezen, doorzoekbaar, origineel bewaard", async () => {
    const r = await mod.importeerDocument(db, "tekst.pdf", lees("tekst.pdf"), {});
    expect(r.delen).toBe(1);
    expect(delen(r.id)[0].pagina).toBe(1);
    expect(delen(r.id)[0].tekst).toMatch(/Betel/);
    expect(fs.existsSync(path.join(dataDir(), "uploads", `${r.id}.pdf`))).toBe(true);
    expect(r.waarschuwingen?.some((w) => /gedrukte paginanummering/.test(w))).toBe(true);
  });
  it("meerdere pagina's: zoekterm vindt de juiste pagina en link opent die pagina", async () => {
    const r = await mod.importeerDocument(db, "meerdere-paginas.pdf", lees("meerdere-paginas.pdf"), {});
    expect(r.delen).toBe(3);
    const res = await zoek({ tekst: "huisgoden", taal: "nl", refs: [], max: 5 }, ctx());
    const p = res.find((x) => x.record.extern_id === r.id)!.passages[0];
    expect(p.locatie).toBe("p. 2");
    expect(p.url).toBe(`/api/documenten/${r.id}/bestand#page=2`);
    const p3 = (await zoek({ tekst: "Pniël", taal: "nl", refs: [], max: 5 }, ctx())).find((x) => x.record.extern_id === r.id)!.passages[0];
    expect(p3.locatie).toBe("p. 3");
  });
  it("voetnoten: voetnoottekst is doorzoekbaar en er staat een waarschuwing bij", async () => {
    const r = await mod.importeerDocument(db, "voetnoten.pdf", lees("voetnoten.pdf"), {});
    const t = delen(r.id).map((d) => d.tekst).join("\n");
    expect(t).toMatch(/vreemde goden worden weggedaan/);
    expect(r.waarschuwingen?.some((w) => /Voetnoten/.test(w))).toBe(true);
  });
  it("twee kolommen: kolommen worden niet door elkaar gehaald", async () => {
    const r = await mod.importeerDocument(db, "twee-kolommen.pdf", lees("twee-kolommen.pdf"), {});
    const t = delen(r.id)[0].tekst;
    const a = [...t.matchAll(/Linkerkolom/g)].map((m) => m.index!);
    const b = [...t.matchAll(/Rechterkolom/g)].map((m) => m.index!);
    expect(a.length).toBeGreaterThan(1);
    expect(b.length).toBeGreaterThan(1);
    expect(Math.max(...a)).toBeLessThan(Math.min(...b));
  });
  it("scan zonder tekstlaag: duidelijke melding, niets opgeslagen", async () => {
    const voor = (db.prepare("SELECT COUNT(*) n FROM documenten").get() as { n: number }).n;
    await expect(mod.importeerDocument(db, "scan.pdf", lees("scan.pdf"), {})).rejects.toThrow(/geen tekstlaag.*OCR/);
    expect((db.prepare("SELECT COUNT(*) n FROM documenten").get() as { n: number }).n).toBe(voor);
  });
});

describe("DOCX (echte bestanden)", () => {
  it("koppen worden secties met kop-pad; bibliografie blijft vindbaar", async () => {
    const r = await mod.importeerDocument(db, "koppen.docx", lees("koppen.docx"), {});
    const locs = delen(r.id).map((d) => d.locatie);
    expect(locs.some((l) => / › /.test(l))).toBe(true);
    const res = await zoek({ tekst: "Calvijn", taal: "nl", refs: [], max: 5 }, ctx());
    expect(res.find((x) => x.record.extern_id === r.id)?.passages[0].locatie).toMatch(/Bibliografie/);
  });
  it("tabel: elke rij één regel 'cel | cel'", async () => {
    const r = await mod.importeerDocument(db, "tabel.docx", lees("tabel.docx"), {});
    const t = delen(r.id)[0].tekst;
    expect(t).toContain("Vers | Onderwerp");
    expect(t).toContain("Gen 31:19 | Terafim gestolen");
    expect(r.waarschuwingen?.some((w) => /Tabellen/.test(w))).toBe(true);
  });
  it("voetnoot komt in een aparte sectie 'voetnoten'", async () => {
    const r = await mod.importeerDocument(db, "voetnoten.docx", lees("voetnoten.docx"), {});
    const vn = delen(r.id).find((d) => d.locatie === "voetnoten");
    expect(vn?.tekst).toMatch(/massebah keert terug in Genesis 35:14/);
    expect(delen(r.id).find((d) => d.locatie !== "voetnoten")?.tekst).not.toMatch(/massebah/);
  });
});

describe("Verwijderen", () => {
  it("verwijdert document, zoekindex en origineel bestand", async () => {
    const r = await mod.importeerDocument(db, "x.pdf", lees("meerdere-paginas.pdf"), {});
    const id = r.id;
    expect(mod.verwijderDocument(db, id)).toBe(true);
    expect(fs.existsSync(path.join(dataDir(), "uploads", `${id}.pdf`))).toBe(false);
    expect((await zoek({ tekst: "huisgoden", taal: "nl", refs: [], max: 5 }, ctx())).some((x) => x.record.extern_id === id)).toBe(false);
  });
});
