// Genereert docs/BRONKAARTEN.md uit het bronnenregister (één bron van waarheid): npx tsx scripts/bronkaarten.ts
import fs from "node:fs";
import { alleBronkaarten } from "../src/lib/sources/registry";
import { DATASETS } from "../src/lib/sources/datasets";

const r: string[] = ["# Bronkaarten", "", "_Gegenereerd uit `src/lib/sources/registry.ts` en `datasets.ts` — niet met de hand bewerken._", "", "Statussen: **werkend** = gebouwd én getest · **gedeeltelijk** = gebouwd, (nog) niet live getest of met beperkingen · **alleen doorverwijzing** = link, geen koppeling · **niet beschikbaar** = bewust niet gekoppeld.", "", "Statusladder per gevonden bron in een onderzoek: 1 API bereikbaar · 2 zoekopdracht gelukt · 3 relevante bron gevonden · 4 volledige inhoud toegankelijk · 5 inhoud geanalyseerd (fragment ging naar de AI) · 6 conclusie geverifieerd (letterlijk citaat in de brontekst teruggevonden). Niveaus 1–4 meet `npm run bronnen:proef`; 5–6 alleen een echt onderzoek. Een catalogusvermelding komt nooit verder dan 3 en is nooit basis voor een inhoudelijke samenvatting.", "", "| Bron | Categorie | Status | Volledige tekst | Licentie |", "|---|---|---|---|---|"];
for (const k of alleBronkaarten()) r.push(`| ${k.naam} | ${k.categorie} | ${k.status} | ${k.volledigeTekst} | ${k.licentie} |`);
r.push("", "## Lokale datasets (vastgepind)", "", "| Dataset | Repository @ commit | Licentie | Attributie |", "|---|---|---|---|");
for (const d of DATASETS) r.push(`| ${d.naam}${d.optioneel ? " (optioneel)" : ""} | ${d.repo} @ \`${d.commit.slice(0, 10)}\` | ${d.licentie} | ${d.attributie} |`);
r.push("", "## Details per bron", "");
for (const k of alleBronkaarten()) {
  r.push(`### ${k.naam}`, "");
  for (const [a, b] of [["Officiële website", k.website], ["Zoekmogelijkheden", k.zoekmogelijkheden], ["API's of datasets", k.api], ["Toegangsvoorwaarden", k.toegangsvoorwaarden], ["Licentievoorwaarden", k.licentie], ["Full-textgebruik", k.volledigeTekst], ["Actualiteit", k.actualiteit], ["Kosten", k.kosten], ["Technische uitvoerbaarheid", k.uitvoerbaarheid], ["Geschiktheid pilot", k.geschiktheidPilot], ["Status", `${k.status} — ${k.statusToelichting}`], ["Getest", k.getest]]) r.push(`- **${a}:** ${b}`);
  r.push("");
}
fs.writeFileSync("docs/BRONKAARTEN.md", r.join("\n"));
console.log("docs/BRONKAARTEN.md geschreven");
