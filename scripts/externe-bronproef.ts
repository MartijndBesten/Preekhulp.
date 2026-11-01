// Echte HTTP-proef van álle netwerkconnectors (GitHub Actions of de eigen computer).
// Meet per bron de statusladder 1–4: API bereikbaar → zoekopdracht gelukt → relevante bron gevonden → volledige
// inhoud toegankelijk. Niveaus 5 (inhoud geanalyseerd) en 6 (conclusie geverifieerd) kan alleen een onderzoek met
// AI en handcontrole aantonen; die meet deze proef bewust níet.
// Gebruikt geen betaalde sleutels (wel optioneel gratis sleutels uit de omgeving) en bewaart geen broninhoud.
// Uitvoer: console + bronnenproef.json (wordt in CI als artefact bewaard).
import fs from "node:fs";
import { nieuweDb } from "../src/lib/db";
import { STANDAARD } from "../src/lib/settings";
import { ontleedVerwijzing } from "../src/lib/scripture/reference";
import { CONNECTORS } from "../src/lib/sources/registry";

const d = nieuweDb();
const ctx = { db: d, instellingen: STANDAARD, onderzoek: null };
const refs = ontleedVerwijzing("Genesis 31:13");
const RELEVANT = /genesis|jacob|jakob|bethel|betel|laban|rachel|patriarch|aartsvader|vow|gelofte/i;
const VRAAG: Record<string, string> = {
  youtube: "Genesis 31 Bethel sermon",
  googlebooks: "Genesis commentary Jacob Bethel",
  internetarchive: "Genesis commentary",
  openlibrary: "Genesis commentary",
  gutenberg: "Genesis",
};

interface Uitkomst {
  bron: string;
  ladder: { "1_api_bereikbaar": boolean; "2_zoekopdracht_gelukt": boolean; "3_relevante_bron": boolean; "4_volledige_inhoud": boolean };
  status: string;
  treffers: number;
  voorbeeld: string | null;
  melding: string | null;
  ms: number;
}

const uitkomsten: Uitkomst[] = [];
try {
  for (const c of CONNECTORS.filter((x) => x.ondersteunt.netwerk)) {
    const t0 = Date.now();
    const reden = c.nietBeschikbaar(ctx);
    if (reden) {
      uitkomsten.push({ bron: c.kaart.id, ladder: { "1_api_bereikbaar": false, "2_zoekopdracht_gelukt": false, "3_relevante_bron": false, "4_volledige_inhoud": false }, status: "niet geconfigureerd", treffers: 0, voorbeeld: null, melding: reden, ms: 0 });
      continue;
    }
    try {
      const r = await c.zoek({ tekst: VRAAG[c.kaart.id] ?? "Genesis Jacob Bethel", taal: "en", refs, max: 5 }, ctx);
      const ongeldig = r.filter((x) => !x.record.titel || !x.record.connector || !x.record.extern_id || !x.record.rechten);
      if (ongeldig.length) throw new Error(`onvolledige metadata in ${ongeldig.length} resultaten`);
      const relevant = r.filter((x) => RELEVANT.test(`${x.record.titel} ${x.record.samenvatting ?? ""} ${x.passages.map((p) => p.locatie).join(" ")}`));
      const vol = r.filter((x) => x.record.toegang === "volledige tekst" && x.passages.some((p) => p.soort === "commentaar" && p.tekst.length > 40));
      uitkomsten.push({
        bron: c.kaart.id,
        ladder: { "1_api_bereikbaar": true, "2_zoekopdracht_gelukt": true, "3_relevante_bron": relevant.length > 0, "4_volledige_inhoud": vol.length > 0 },
        status: r.length ? "bereikbaar-met-treffers" : "bereikbaar-zonder-treffers",
        treffers: r.length,
        voorbeeld: (relevant[0] ?? r[0])?.record.titel?.slice(0, 120) ?? null,
        melding: null,
        ms: Date.now() - t0,
      });
    } catch (e) {
      const soort = (e as { soort?: string }).soort;
      const status = (e as { status?: number }).status;
      const bereikt = soort === "quotum" || soort === "http" || soort === "ongeldig";
      uitkomsten.push({ bron: c.kaart.id, ladder: { "1_api_bereikbaar": bereikt, "2_zoekopdracht_gelukt": false, "3_relevante_bron": false, "4_volledige_inhoud": false }, status: soort === "quotum" ? "quotum (HTTP 429)" : `fout${status ? ` (HTTP ${status})` : ""}`, treffers: 0, voorbeeld: null, melding: String((e as Error).message).slice(0, 200), ms: Date.now() - t0 });
    }
  }
} finally {
  d.close();
}

for (const u of uitkomsten) console.log(JSON.stringify(u));
try {
  const { helloAoIds } = await import("../src/lib/sources/connectors/boeken");
  const d2 = nieuweDb();
  console.log("HelloAO-commentaren gekoppeld:", JSON.stringify(Object.entries(await helloAoIds({ db: d2, instellingen: STANDAARD })).map(([id, m]) => `${id} = ${m.naam}`)));
  d2.close();
} catch (e) {
  console.log("HelloAO-lijst niet opgehaald:", (e as Error).message);
}
const bereikt = uitkomsten.filter((u) => u.ladder["1_api_bereikbaar"]).length;
const geprobeerd = uitkomsten.filter((u) => u.status !== "niet geconfigureerd").length;
console.log(`\nResultaat: ${bereikt}/${geprobeerd} geprobeerde API's bereikbaar; ${uitkomsten.filter((u) => u.ladder["3_relevante_bron"]).length} met relevante treffer; ${uitkomsten.filter((u) => u.ladder["4_volledige_inhoud"]).length} met volledige inhoud. Geen beoordeling van exegetische inhoud.`);
fs.writeFileSync("bronnenproef.json", JSON.stringify({ moment: new Date().toISOString(), uitkomsten }, null, 2));
if (bereikt < 2) process.exitCode = 1;
