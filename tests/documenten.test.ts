import { beforeAll, describe, expect, it } from "vitest";
import { maakTestDataMap } from "./helpers";

let mod: typeof import("../src/lib/documents/import");
let db: import("node:sqlite").DatabaseSync;

beforeAll(async () => {
  maakTestDataMap();
  const { nieuweDb } = await import("../src/lib/db");
  db = nieuweDb();
  mod = await import("../src/lib/documents/import");
});

const SRT = `1
00:00:01,000 --> 00:00:04,000
Vandaag lezen we Genesis 31.

2
00:00:04,500 --> 00:00:09,000
God zegt: Ik ben de God van Betel.

3
00:01:10,000 --> 00:01:15,000
Rachel nam de huisgoden mee.
`;

describe("Eigen documenten", () => {
  it("leest SRT met tijdstempels en groepeert per ±45 seconden", () => {
    const delen = mod.parseOndertitels(SRT);
    expect(delen.length).toBe(2);
    expect(delen[0].start_sec).toBe(1);
    expect(delen[1].start_sec).toBe(70);
    expect(delen[1].locatie).toBe("1:10–1:15");
  });
  it("leest WEBVTT", () => {
    const delen = mod.parseOndertitels("WEBVTT\n\n00:00:02.000 --> 00:00:05.000\n<c>Betel</c> betekent huis van God\n");
    expect(delen[0].tekst).toBe("Betel betekent huis van God");
  });
  it("importeert, vindt via de zoekindex, herkent duplicaten en verwijdert alles", async () => {
    const r = await mod.importeerDocument(db, "preek.srt", Buffer.from(SRT), { titel: "Testpreek", videoUrl: "https://youtu.be/dQw4w9WgXcQ", transcriptSoort: "automatisch" });
    expect(r.duplicaat).toBe(false);
    const hits = db.prepare("SELECT rowid FROM document_delen_fts WHERE document_delen_fts MATCH 'huisgoden'").all();
    expect(hits.length).toBe(1);
    const dubbel = await mod.importeerDocument(db, "andere-naam.srt", Buffer.from(SRT), {});
    expect(dubbel.duplicaat).toBe(true);
    expect(mod.verwijderDocument(db, r.id)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) n FROM document_delen").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT rowid FROM document_delen_fts WHERE document_delen_fts MATCH 'huisgoden'").all().length).toBe(0);
  });
  it("markdown wordt per kop opgesplitst", async () => {
    const r = await mod.importeerDocument(db, "notities.md", Buffer.from("# Inleiding\nTekst a\n\n# Betel\nTekst over Betel"), {});
    const delen = db.prepare("SELECT locatie FROM document_delen WHERE document = ? ORDER BY volgorde").all(r.id) as { locatie: string }[];
    expect(delen.map((x) => x.locatie)).toEqual(["Inleiding", "Betel"]);
  });
  it("weigert onbekende of vervalste bestandstypen", async () => {
    await expect(mod.importeerDocument(db, "virus.exe", Buffer.from("MZ"), {})).rejects.toThrow(/niet ondersteund/);
    await expect(mod.importeerDocument(db, "nep.pdf", Buffer.from("geen pdf"), {})).rejects.toThrow(/geen geldige PDF/);
    await expect(mod.importeerDocument(db, "x.txt", Buffer.from([0x61, 0, 0x62]), {})).rejects.toThrow(/binaire/);
  });
});
