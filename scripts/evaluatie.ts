// Reproduceerbare evaluatie: Genesis 31 (opdracht §14).
// 1. Voert een onderzoek uit met de minimale invoer (zonder preeksamenvatting).
// 2. Leest pas daarna de afgeschermde referentie en de criteria.
// 3. Schrijft een rapport: per kritische vraag de automatische signalen, welke preeklijnen terugkomen,
//    wat de toepassing zelfstandig vond buiten de preek, en een beoordelingstabel voor de predikant.
// Gebruik: npm run evaluatie [-- --modus verkennen|verdiepen|kritisch] [-- --zonder-ai] [-- --zonder-extern]
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../src/lib/db";
import { leesInstellingen, bewaarInstellingen } from "../src/lib/settings";
import { maakOnderzoek, voerUit } from "../src/lib/research/runner";
import { laadDossier, naarMarkdown, type Dossier } from "../src/lib/reports/dossier";
import { ontleedVerwijzing } from "../src/lib/scripture/reference";
import { NIVEAU_LABEL } from "../src/lib/verification/claims";
import type { Modus } from "../src/lib/research/types";

const arg = (n: string) => process.argv.includes(n);
const waarde = (n: string) => process.argv[process.argv.indexOf(n) + 1];
const modus = (["verkennen", "verdiepen", "kritisch"].includes(waarde("--modus")) ? waarde("--modus") : "verdiepen") as Modus;
const zonderAi = arg("--zonder-ai");
const MAP = path.join(process.cwd(), "evaluatie");

interface Vraag { nr: number; vraag: string; refs: string[]; woorden: string[]; lemmas: string[]; nieuweLijnen?: boolean }
interface Lijn { id: string; lijn: string; refs: string[]; woorden: string[] }

function overlapt(x: Dossier, ref: string): { inBewijs: string[]; inBeweringen: string[] } {
  const r = ontleedVerwijzing(ref)[0];
  if (!r) return { inBewijs: [], inBeweringen: [] };
  const a = r.start % 1000 === 0 ? r.start + 1 : r.start;
  const naam = r.label.split(" ")[0];
  const inBewijs = x.bewijs.filter((b) => {
    if (!b.soort.match(/bijbeltekst|commentaar|grondtekst|data|kruisverwijzing/)) return false;
    const refs = ontleedVerwijzing(b.locatie.replace(/\s*\(.*$/, "").replace(/^(concordantie|intertekst|kruisverwijzing)\s+/, "").split(" — ")[0]);
    return refs.some((q) => q.start <= r.eind && q.eind >= a) || (b.soort === "data" && b.tekst.includes(r.label));
  }).map((b) => b.label);
  const inBeweringen = x.beweringen.filter((b) => b.tekst.includes(r.label) || b.tekst.includes(r.label.replace(naam, naam.slice(0, 3))) || b.verwijzingen.some((v) => inBewijs.includes(v.label))).map((b) => b.id);
  return { inBewijs, inBeweringen };
}

function woordTreffers(x: Dossier, woorden: string[], alleenAi = false): string[] {
  const re = woorden.length ? new RegExp(woorden.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : null;
  if (!re) return [];
  return x.beweringen.filter((b) => (!alleenAi || b.herkomst === "ai") && re.test(b.tekst)).map((b) => b.id);
}

async function main() {
  const d = openDb();
  const invoer = JSON.parse(fs.readFileSync(path.join(MAP, "genesis31", "invoer.json"), "utf8"));
  const oud = leesInstellingen(d);
  if (zonderAi) bewaarInstellingen(d, { aiAanbieder: "geen" });
  const t0 = Date.now();
  let id: string;
  try {
    id = maakOnderzoek(d, invoer.vraag, modus, { ...invoer.opties, zonderExtern: arg("--zonder-extern") }, null);
    console.log(`Onderzoek ${id} (${modus}${zonderAi ? ", zonder AI" : ""}) gestart…`);
    await voerUit(d, id);
  } finally {
    if (zonderAi) bewaarInstellingen(d, { aiAanbieder: oud.aiAanbieder });
  }
  const x = laadDossier(d, id)!;
  const duur = ((Date.now() - t0) / 1000).toFixed(1);

  // Pas NU de referentie lezen.
  const criteria = JSON.parse(fs.readFileSync(path.join(MAP, "genesis31", "criteria.json"), "utf8")) as { vragen: Vraag[]; preeklijnen: Lijn[]; preekGedeelten: string[] };
  const referentie = fs.readFileSync(path.join(MAP, "referentie", "genesis31-preek.md"), "utf8");

  const md: string[] = [];
  md.push(`# Evaluatie Genesis 31 — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, "");
  md.push(`- Modus: **${modus}** · AI: **${zonderAi ? "uit (alleen deterministische lagen)" : x.stappen.some((s) => s.status === "klaar_zonder_ai") ? "niet beschikbaar tijdens run" : "aan"}** · status: ${x.status} · duur ${duur}s · AI-kosten $${x.kostenUsd.toFixed(3)}`);
  md.push(`- Invoer (bewust minimaal): “${invoer.vraag}”`);
  md.push(`- Onderzoeks-id: \`${id}\` · bewijsstukken: ${x.bewijs.length} · beweringen: ${x.beweringen.length} (AI: ${x.beweringen.filter((b) => b.herkomst === "ai").length}, berekend: ${x.beweringen.filter((b) => b.herkomst === "data").length}) · bronnen: ${x.bronnen.length}`);
  md.push(`- Externe bronnen: ${(x.c?.connectors ?? []).filter((c) => c.status === "ok" && c.id !== "lokaal" && c.id !== "eigen-documenten").map((c) => c.naam.split(" (")[0]).join(", ") || "geen bereikbaar"}`);
  const verlaagd = x.beweringen.filter((b) => b.controle?.aangepast).length;
  md.push(`- Claimcontrole: ${verlaagd} niveaus verlaagd · ${x.beweringen.reduce((s, b) => s + (b.controle?.onbekend?.length ?? 0), 0)} niet-bestaande verwijzingen · ${x.beweringen.reduce((s, b) => s + (b.controle?.citatenNietGevonden?.length ?? 0), 0)} niet-teruggevonden citaten`, "");
  md.push(`> Automatische signalen zijn grof (verwijzingen en trefwoorden). Ze zeggen dat een onderwerp aan bod komt, niet dat het goed is uitgewerkt. Het eindoordeel staat in de beoordelingstabel en hoort bij de predikant.`, "");

  md.push(`## 1. Verplichte kritische vragen`, "", `| # | Vraag | Gegevens in bewijs | Besproken in beweringen | Signaal |`, `|---|---|---|---|---|`);
  for (const v of criteria.vragen) {
    if (v.nieuweLijnen) {
      const lijnen = x.beweringen.filter((b) => b.sectie === "lijnen");
      const ai = lijnen.filter((b) => b.herkomst === "ai");
      md.push(`| ${v.nr} | ${v.vraag} | ${lijnen.length} lijnen (${lijnen.filter((b) => b.herkomst === "data").length} berekend) | ${ai.length} AI-lijnen, waarvan ${ai.filter((b) => b.niveau !== "niet_geverifieerd").length} met geldig bewijs | ${lijnen.length ? "zie §3" : "—"} |`);
      continue;
    }
    const bewijs = new Set<string>();
    const bew = new Set<string>();
    for (const r of v.refs) {
      const o = overlapt(x, r);
      o.inBewijs.forEach((l) => bewijs.add(l));
      o.inBeweringen.forEach((l) => bew.add(l));
    }
    for (const l of v.lemmas) x.bewijs.filter((b) => b.tekst.includes(l)).forEach((b) => bewijs.add(b.label));
    // 'Besproken' telt alleen AI-beweringen: berekende data noemt een woord, maar beantwoordt de vraag niet.
    for (const l of [...bew]) if (x.beweringen.find((b) => b.id === l)?.herkomst !== "ai") bew.delete(l);
    woordTreffers(x, v.woorden, true).forEach((l) => bew.add(l));
    const signaal = bew.size && bewijs.size ? "behandeld + bewijs" : bewijs.size ? "alleen gegevens aanwezig" : bew.size ? "genoemd, zonder passend bewijs" : "niet gevonden";
    md.push(`| ${v.nr} | ${v.vraag} | ${bewijs.size ? [...bewijs].slice(0, 8).join(", ") + (bewijs.size > 8 ? " …" : "") : "—"} | ${bew.size ? [...bew].slice(0, 8).join(", ") + (bew.size > 8 ? " …" : "") : "—"} | ${signaal} |`);
  }
  md.push("");

  md.push(`## 2. Lijnen uit de gehouden preek: zelfstandig teruggevonden?`, "", `| Preeklijn | In bewijs/beweringen | Toelichting |`, `|---|---|---|`);
  for (const l of criteria.preeklijnen) {
    const b = new Set<string>();
    for (const r of l.refs) overlapt(x, r).inBewijs.forEach((q) => b.add(q));
    const w = woordTreffers(x, l.woorden);
    md.push(`| ${l.lijn} | ${b.size || w.length ? `ja (${[...b].slice(0, 5).join(", ")}${w.length ? `; beweringen ${w.slice(0, 5).join(", ")}` : ""})` : "nee"} | ${l.refs.length ? `refs: ${l.refs.join("; ")}` : "homiletisch/dogmatisch — alleen via AI-analyse te verwachten"} |`);
  }
  md.push("");

  md.push(`## 3. Zelfstandig gevonden lijnen (niet in de preeksamenvatting)`, "");
  void referentie; // de samenvatting zelf staat ter vergelijking in evaluatie/referentie/
  const preekRefs = criteria.preekGedeelten.flatMap((g) => ontleedVerwijzing(g));
  const refPatroon = /(?:[1-3]\s)?[A-Z][a-zëï]+ \d+(?::\d+(?:–\d+)?)?/g;
  const nieuw = x.beweringen.filter((b) => b.sectie === "lijnen" || (b.herkomst === "ai" && ["exegese", "context", "grondtaal", "vergelijking", "perspectieven"].includes(b.sectie)));
  for (const b of nieuw) {
    const refs = [...b.tekst.matchAll(refPatroon)].flatMap((m) => ontleedVerwijzing(m[0]));
    const buiten = refs.filter((r) => !preekRefs.some((p) => r.start >= p.start && r.eind <= p.eind));
    const label = !refs.length ? "(geen tekstverwijzing)" : buiten.length ? `**nieuw t.o.v. preek** (${buiten.map((r) => r.label).join(", ")})` : "(binnen preekgedeelten)";
    md.push(`- ${label} · *${NIVEAU_LABEL[b.niveau]}* · ${b.herkomst === "data" ? "berekend" : "AI"} · ${b.id}: ${b.tekst.slice(0, 400)}${b.tekst.length > 400 ? " …" : ""}`);
  }
  md.push("");

  md.push(`## 4. Beoordelingstabel voor de predikant (handmatig invullen)`, "", `Score 0–3. *Relevant*: helpt voor deze preek/dit thema. *Onderbouwd*: het bewijs draagt de bewering. *Nieuw*: ik had dit nog niet. *Vervolg*: ik wil dit verder onderzoeken.`, "", `| Id | Bewering/lijn (kort) | Relevant | Onderbouwd | Nieuw | Vervolg | Opmerking |`, `|---|---|---|---|---|---|---|`);
  for (const b of nieuw.slice(0, 40)) md.push(`| ${b.id} | ${b.tekst.slice(0, 90).replace(/\|/g, "/")}… | | | | | |`);
  md.push("", `## 5. Volledig dossier`, "", naarMarkdown(x).replace(/^# /m, "### "));

  const naam = `${new Date().toISOString().slice(0, 10)}-${modus}${zonderAi || x.stappen.some((s) => s.status === "klaar_zonder_ai") ? "-zonder-ai" : ""}.md`;
  fs.writeFileSync(path.join(MAP, "resultaten", naam), md.join("\n"));
  console.log(`Rapport: evaluatie/resultaten/${naam}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
