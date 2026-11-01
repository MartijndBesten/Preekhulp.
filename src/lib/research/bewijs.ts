// Bewijsregister per onderzoek: elk gebruikt fragment krijgt een vast label (E1, E2, …).
import type { DatabaseSync } from "node:sqlite";
import { bewaarBron, bewaarPassage } from "../sources/opslag";
import type { BronRecord, Passage } from "../sources/types";
import type { Bewijs } from "../verification/claims";

export interface BewijsRij {
  label: string;
  passage: string;
  herkomst: string;
  soort: string;
  locatie: string;
  tekst: string;
  url: string | null;
  start_sec: number | null;
  bron: string;
  bron_titel: string;
  brontype: string;
  connector: string;
  auteurs: string;
  jaar: string | null;
  toegang: string;
  rechten: string;
}

export function registreer(d: DatabaseSync, onderzoek: string, record: BronRecord, passage: Passage, herkomst: string): string {
  const bron = bewaarBron(d, record);
  const pid = bewaarPassage(d, bron, passage);
  const bestaand = d.prepare("SELECT label FROM onderzoek_bewijs WHERE onderzoek = ? AND passage = ?").get(onderzoek, pid) as { label: string } | undefined;
  if (bestaand) return bestaand.label;
  const n = (d.prepare("SELECT COUNT(*) n FROM onderzoek_bewijs WHERE onderzoek = ?").get(onderzoek) as { n: number }).n;
  const label = `E${n + 1}`;
  d.prepare("INSERT INTO onderzoek_bewijs (onderzoek, label, passage, herkomst) VALUES (?,?,?,?)").run(onderzoek, label, pid, herkomst);
  d.prepare("INSERT OR IGNORE INTO onderzoek_bronnen (onderzoek, bron, zoekvraag, rang) VALUES (?,?,?,?)").run(onderzoek, bron, herkomst, 0);
  return label;
}

export function bewijsRijen(d: DatabaseSync, onderzoek: string): BewijsRij[] {
  return d
    .prepare(
      `SELECT ob.label, ob.passage, ob.herkomst, p.soort, p.locatie, p.tekst, p.url, p.start_sec, b.id AS bron, b.titel AS bron_titel, b.brontype,
              b.connector, b.auteurs, b.jaar, b.toegang, b.rechten
       FROM onderzoek_bewijs ob JOIN passages p ON p.id = ob.passage JOIN bronnen b ON b.id = p.bron
       WHERE ob.onderzoek = ? ORDER BY CAST(substr(ob.label, 2) AS INTEGER)`,
    )
    .all(onderzoek) as unknown as BewijsRij[];
}

export function bewijsMap(rijen: BewijsRij[]): Map<string, Bewijs> {
  return new Map(rijen.map((r) => [r.label, { label: r.label, soort: r.soort, tekst: r.tekst, brontype: r.brontype, bronTitel: r.bron_titel }]));
}

/** Bron voor door Preekhulp zelf berekende tekstgegevens (motiefanalyse, concordantie). */
export const ANALYSE_BRON: BronRecord = {
  connector: "analyse",
  extern_id: "tekstanalyse-step",
  brontype: "grondtekst",
  titel: "Preekhulp-tekstanalyse op STEPBible-data (concordantie, motieven, kruisverwijzingen)",
  auteurs: ["Preekhulp (berekend)", "STEP Bible (data)"],
  url: "https://github.com/STEPBible/STEPBible-Data",
  toegang: "volledige tekst",
  rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: "ja", licentie: "CC BY 4.0 (data)", toelichting: "Berekend uit open data; reproduceerbaar" },
};
