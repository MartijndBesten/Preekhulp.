// Testdatabase: een kleine kopie (Genesis + Johannes) van de lokaal geïmporteerde data, in een tijdelijke map.
// Zonder geïmporteerde data worden de integratietests overgeslagen.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const BRON_DB = path.join(process.cwd(), ".data", "preekhulp.sqlite");
export const heeftData = fs.existsSync(BRON_DB) && (() => {
  try {
    const d = new DatabaseSync(BRON_DB, { readOnly: true });
    return (d.prepare("SELECT COUNT(*) n FROM woorden").get() as { n: number }).n > 0;
  } catch {
    return false;
  }
})();

export function maakTestDataMap(): string {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), "preekhulp-test-"));
  process.env.PREEKHULP_DATA_DIR = map;
  return map;
}

/** Kopieert Genesis (boek 1) en Johannes (boek 43) naar een nieuwe testdatabase. */
export async function vulTestDb(doel: string) {
  const { openDb } = await import("../src/lib/db");
  const d = openDb(path.join(doel, "preekhulp.sqlite"));
  d.exec(`ATTACH DATABASE '${BRON_DB.replace(/'/g, "''")}' AS bron`);
  const inBoeken = (k: string) => `((${k} BETWEEN 1000000 AND 1999999) OR (${k} BETWEEN 43000000 AND 43999999))`;
  d.exec(`
    INSERT INTO vertalingen SELECT * FROM bron.vertalingen;
    INSERT INTO verzen SELECT * FROM bron.verzen WHERE ${inBoeken("vkey")};
    INSERT INTO verzen_fts (vertaling, vkey, tekst) SELECT vertaling, vkey, tekst FROM verzen;
    INSERT INTO woorden SELECT * FROM bron.woorden WHERE ${inBoeken("vkey")};
    INSERT INTO lexicon SELECT * FROM bron.lexicon;
    INSERT INTO morfologie SELECT * FROM bron.morfologie;
    INSERT INTO lemma_freq SELECT * FROM bron.lemma_freq;
    INSERT INTO kruisverwijzingen SELECT * FROM bron.kruisverwijzingen WHERE ${inBoeken("van")};
    INSERT INTO werken SELECT * FROM bron.werken WHERE id IN ('calvijn','matthew-henry','kanttekeningen');
    INSERT INTO commentaar SELECT * FROM bron.commentaar WHERE werk IN ('calvijn','matthew-henry','kanttekeningen') AND ${inBoeken("vkey_start")};
    INSERT INTO commentaar_fts(commentaar_fts) VALUES('rebuild');
  `);
  d.exec("DETACH DATABASE bron");
  return d;
}
