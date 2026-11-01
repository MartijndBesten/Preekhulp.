// Een echte HTTP-proef vanaf GitHub Actions of de ontwikkelcomputer.
// Bepaalt bereikbaarheid én hoeveelheid treffers; vervangt geen inhoudelijke broncontrole.
// Gebruikt géén betaalde API-sleutels en slaat geen opgehaalde tekst persistent op.
import { nieuweDb } from "../src/lib/db";
import { STANDAARD } from "../src/lib/settings";
import { crossref, doaj, openAlex, pthu } from "../src/lib/sources/connectors/academisch";

const d = nieuweDb();
const ctx = { db: d, instellingen: STANDAARD, onderzoek: null };
const vraag = { tekst: "Genesis Jacob", taal: "en" as const, max: 3 };
const bronnen = [openAlex, crossref, pthu, doaj];
let bereikt = 0;
let metTreffers = 0;
try {
  for (const bron of bronnen) {
    const start = Date.now();
    try {
      const r = await bron.zoek(vraag, ctx);
      bereikt++;
      if (r.length) metTreffers++;
      const ongeldig = r.filter((x) => !x.record.titel || !x.record.connector || !x.record.extern_id || !x.record.rechten);
      if (ongeldig.length) throw new Error(`onvolledige metadata: ${ongeldig.length}`);
      console.log(JSON.stringify({ bron: bron.kaart.id, status: r.length ? "bereikbaar-met-treffers" : "bereikbaar-zonder-treffers", treffers: r.length, ms: Date.now() - start }));
    } catch (e) {
      console.log(JSON.stringify({ bron: bron.kaart.id, status: "fout", melding: String((e as Error).message).slice(0, 180), ms: Date.now() - start }));
    }
  }
  console.log(`Resultaat: ${bereikt}/${bronnen.length} API's bereikbaar, ${metTreffers} met treffers. Geen beoordeling van exegetische inhoud.`);
  if (bereikt < 2) process.exitCode = 1;
} finally {
  d.close();
}
