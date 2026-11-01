// Live controle van alle connectors op de eigen computer: npm run bronnen:controleren
import { openDb } from "../src/lib/db";
import { controleerBronnen } from "../src/lib/sources/controle";

const r = await controleerBronnen(openDb());
for (const u of r.uitkomsten) console.log(`${u.uitkomst.padEnd(20)} ${u.naam}${u.melding ? ` — ${u.melding}` : ""} (${u.resultaten} resultaten, ${u.ms} ms)`);
console.log(`\nVastgelegd op ${r.moment}. Zie ook Instellingen → Bronnen.`);
