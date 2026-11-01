// Live controle van externe connectors: één kleine proefzoekopdracht per bron, met eerlijke uitkomst.
// Gebruik: knop in Instellingen of `npm run bronnen:controleren` op de eigen computer.
import type { DatabaseSync } from "node:sqlite";
import { nu } from "../db";
import { leesInstellingen } from "../settings";
import { CONNECTORS } from "./registry";
import { ontleedVerwijzing } from "../scripture/reference";

export interface ControleUitkomst {
  id: string;
  naam: string;
  uitkomst: "werkt" | "geen treffers" | "fout" | "niet geconfigureerd" | "lokaal";
  resultaten: number;
  melding: string | null;
  ms: number;
}

export async function controleerBronnen(d: DatabaseSync): Promise<{ moment: string; uitkomsten: ControleUitkomst[] }> {
  const ctx = { db: d, instellingen: leesInstellingen(d), onderzoek: null };
  const refs = ontleedVerwijzing("Genesis 31:13");
  const uitkomsten: ControleUitkomst[] = [];
  for (const c of CONNECTORS) {
    const t0 = Date.now();
    const reden = c.nietBeschikbaar(ctx);
    if (reden) {
      uitkomsten.push({ id: c.kaart.id, naam: c.kaart.naam, uitkomst: "niet geconfigureerd", resultaten: 0, melding: reden, ms: 0 });
      continue;
    }
    try {
      const r = await c.zoek({ tekst: c.kaart.id === "youtube" ? "Genesis 31 sermon Bethel" : "Bethel Jacob vow Genesis", refs, max: 3 }, ctx);
      uitkomsten.push({ id: c.kaart.id, naam: c.kaart.naam, uitkomst: c.ondersteunt.netwerk ? (r.length ? "werkt" : "geen treffers") : "lokaal", resultaten: r.length, melding: r.length ? null : "API-aanroep gelukt, maar de proefvraag gaf geen treffers; broninhoud niet bewezen", ms: Date.now() - t0 });
    } catch (e) {
      uitkomsten.push({ id: c.kaart.id, naam: c.kaart.naam, uitkomst: "fout", resultaten: 0, melding: (e as Error).message, ms: Date.now() - t0 });
    }
  }
  const moment = nu();
  d.prepare("INSERT OR REPLACE INTO meta (sleutel, waarde) VALUES ('bronnencontrole', ?)").run(JSON.stringify({ moment, uitkomsten }));
  return { moment, uitkomsten };
}
