// Onderzoeksdossier: de 13 onderdelen uit de opdracht, opgebouwd uit stapuitvoer, gecontroleerde
// beweringen en het bewijsregister. Plus Markdown-export.
import type { DatabaseSync } from "node:sqlite";
import { json } from "../db";
import { bewijsRijen, type BewijsRij } from "../research/bewijs";
import { stapUitvoer, type UitvoerA, type UitvoerB, type UitvoerC, type UitvoerD, type UitvoerE, type UitvoerG } from "../research/stappen";
import { STAPPEN, type Modus } from "../research/types";
import type { UitvoerV } from "../research/verdieping";
import { verzen, woorden } from "../scripture/data";
import { NIVEAU_LABEL, type Controle, type Niveau, type Verwijzing } from "../verification/claims";

export interface DossierBewering {
  id: string;
  sectie: string;
  tekst: string;
  niveau: Niveau;
  voorgesteld: Niveau | null;
  verwijzingen: Verwijzing[];
  controle: Controle;
  herkomst: "ai" | "data";
  perspectief: string | null;
}

export interface DossierBron {
  id: string;
  titel: string;
  auteurs: string[];
  jaar: string | null;
  uitgever: string | null;
  brontype: string;
  url: string | null;
  doi: string | null;
  toegang: string;
  rechten: Record<string, string>;
  geraadpleegd: string;
  connector: string;
  labels: string[];
  beoordeling: { relevantie: number | null; perspectief: string; waarom: string } | null;
  traditie: string | null;
  ladder: Ladder;
}

/** Statusladder per bron (1 bereikbaar · 2 zoekopdracht gelukt · 3 relevant · 4 volledige inhoud · 5 geanalyseerd · 6 geverifieerd). */
export interface Ladder {
  niveau: 1 | 2 | 3 | 4 | 5 | 6;
  tekst: string;
}
export const LADDER_TEKST = ["", "API bereikbaar", "zoekopdracht gelukt", "relevante bron", "volledige inhoud", "inhoud geanalyseerd", "citaat geverifieerd"] as const;

/** Eén rij van de claim-bronmatrix: wat beweert de AI, op welk bewijs, met welke tussenstap en welke tegenargumenten. */
export interface MatrixRij {
  claim: string;
  sectie: string;
  tekst: string;
  niveau: Niveau;
  voorgesteld: Niveau | null;
  bewijs: { label: string; bron: string; locatie: string; soort: string; citaat: string | null; citaatGeverifieerd: boolean }[];
  interpretatieveStap: string | null;
  tegenverwijzingen: { label: string; bron: string; locatie: string }[];
  onzekerheid: string | null;
  steuncontrole: { oordeel: string; toelichting: string } | null;
  aanpassing: string | null;
}

export interface Dossier {
  id: string;
  vraag: string;
  modus: Modus;
  status: string;
  fout: string | null;
  gemaakt: string;
  kostenUsd: number;
  budgetUsd: number;
  stappen: { id: string; naam: string; status: string; fout: string | null }[];
  a: UitvoerA | null;
  b: UitvoerB | null;
  c: UitvoerC | null;
  d: UitvoerD | null;
  e: UitvoerE | null;
  g: UitvoerG | null;
  v: UitvoerV | null;
  beweringen: DossierBewering[];
  matrix: MatrixRij[];
  bewijs: BewijsRij[];
  bronnen: DossierBron[];
  focusTekst: { label: string; teksten: Record<string, string> }[];
  sleutelwoorden: { vorm: string; translit: string | null; lemma: string | null; strong: string | null; glosse: string | null; morf: string | null; lex: string | null }[];
}

export function laadDossier(d: DatabaseSync, id: string): Dossier | null {
  const o = d.prepare("SELECT * FROM onderzoeken WHERE id = ?").get(id) as
    | { id: string; vraag: string; modus: Modus; status: string; fout: string | null; gemaakt: string; kosten_usd: number; budget_usd: number }
    | undefined;
  if (!o) return null;
  const st = d.prepare("SELECT stap, status, fout FROM onderzoek_stappen WHERE onderzoek = ?").all(id) as { stap: string; status: string; fout: string | null }[];
  const a = stapUitvoer<UitvoerA>(d, id, "A");
  const beweringen = (d.prepare("SELECT * FROM beweringen WHERE onderzoek = ? ORDER BY volgorde").all(id) as Record<string, string>[]).map((b) => ({
    id: b.id, sectie: b.sectie, tekst: b.tekst, niveau: b.niveau as Niveau, voorgesteld: (b.voorgesteld_niveau as Niveau) ?? null,
    verwijzingen: json<Verwijzing[]>(b.verwijzingen, []), controle: json<Controle>(b.controle, {} as Controle), herkomst: b.herkomst as "ai" | "data", perspectief: b.perspectief ?? null,
  }));
  const bewijs = bewijsRijen(d, id);
  // Labels die met een letterlijk, in de brontekst teruggevonden citaat in een bewering worden gebruikt
  // (niet-teruggevonden citaten zijn bij de controle al op null gezet).
  const geverifieerd = new Set(beweringen.flatMap((b) => b.verwijzingen.filter((v) => v.citaat).map((v) => v.label)));
  const bronRijen = d
    .prepare(`SELECT b.*, ob.beoordeling FROM onderzoek_bronnen ob JOIN bronnen b ON b.id = ob.bron WHERE ob.onderzoek = ? ORDER BY b.connector, b.titel`)
    .all(id) as Record<string, string>[];
  const bronnen: DossierBron[] = bronRijen.map((b) => {
    const beo = json<{ relevantie: number | null; perspectief: string; waarom: string } | null>(b.beoordeling, null);
    const rijen = bewijs.filter((x) => x.bron === b.id);
    const lokaal = /^lokaal|^eigen-documenten/.test(b.connector);
    const inhoud = rijen.some((x) => !["metadata", "abstract"].includes(x.soort)) && ["volledige tekst", "transcript"].includes(b.toegang);
    const relevant = lokaal || (beo?.relevantie ?? 0) > 0;
    let niveau: Ladder["niveau"] = 2;
    if (relevant) niveau = 3;
    if (relevant && inhoud) niveau = 4;
    if (niveau === 4 && rijen.some((x) => x.naar_ai)) niveau = 5;
    if (niveau === 5 && rijen.some((x) => geverifieerd.has(x.label))) niveau = 6;
    const ladder: Ladder = { niveau, tekst: `${niveau}/6 — ${LADDER_TEKST[niveau]}${!inhoud && relevant ? " (alleen catalogus/abstract: nooit basis voor een inhoudelijke samenvatting)" : ""}` };
    return {
      ladder,
      id: b.id, titel: b.titel, auteurs: json<string[]>(b.auteurs, []), jaar: b.jaar ?? null, uitgever: b.uitgever ?? null, brontype: b.brontype, url: b.url ?? null,
      doi: b.doi ?? null, toegang: b.toegang, rechten: json<Record<string, string>>(b.rechten, {}), geraadpleegd: b.geraadpleegd, connector: b.connector,
      labels: bewijs.filter((x) => x.bron === b.id).map((x) => x.label), beoordeling: beo && Object.keys(beo).length ? beo : null, traditie: b.traditie ?? null,
    };
  });
  const focusTekst = a?.focus ? verzen(d, a.focus.start, a.focus.eind, 40).map((v) => ({ label: v.label, teksten: v.teksten })) : [];
  const sleutelwoorden = a?.focus
    ? woorden(d, a.focus.start, Math.min(a.focus.eind, a.focus.start + 3)).filter((w) => w.strong_basis && !/^H9/.test(w.strong_basis)).map((w) => ({ vorm: w.vorm, translit: w.translit, lemma: w.lemma, strong: w.strong, glosse: w.glosse, morf: w.morf_uitleg ?? w.morf, lex: w.lex_glosse ?? null }))
    : [];
  return {
    id, vraag: o.vraag, modus: o.modus, status: o.status, fout: o.fout, gemaakt: o.gemaakt, kostenUsd: o.kosten_usd, budgetUsd: o.budget_usd,
    stappen: STAPPEN.map((s) => ({ id: s.id, naam: s.naam, status: st.find((x) => x.stap === s.id)?.status ?? "wacht", fout: st.find((x) => x.stap === s.id)?.fout ?? null })),
    a, b: stapUitvoer(d, id, "B"), c: stapUitvoer(d, id, "C"), d: stapUitvoer(d, id, "D"), e: stapUitvoer(d, id, "E"), g: stapUitvoer(d, id, "G"), v: stapUitvoer(d, id, "V"),
    beweringen, matrix: maakMatrix(beweringen, bewijs), bewijs, bronnen, focusTekst, sleutelwoorden,
  };
}

function maakMatrix(beweringen: DossierBewering[], bewijs: BewijsRij[]): MatrixRij[] {
  const per = new Map(bewijs.map((r) => [r.label, r]));
  const kort = (l: string) => ({ label: l, bron: per.get(l)?.bron_titel ?? "?", locatie: per.get(l)?.locatie ?? "?", soort: per.get(l)?.soort ?? "?" });
  return beweringen
    .filter((b) => b.herkomst === "ai")
    .map((b) => {
      const c = b.controle as Controle & { matrix?: { interpretatieve_stap: string | null; onzekerheid: string | null; tegenverwijzingen: Verwijzing[] }; steuncontrole?: { oordeel: string; toelichting: string } };
      return {
        claim: b.id, sectie: b.sectie, tekst: b.tekst, niveau: b.niveau, voorgesteld: b.voorgesteld,
        bewijs: b.verwijzingen.map((v) => ({ ...kort(v.label), citaat: v.citaat ?? null, citaatGeverifieerd: !!v.citaat })),
        interpretatieveStap: c.matrix?.interpretatieve_stap ?? null,
        tegenverwijzingen: (c.matrix?.tegenverwijzingen ?? []).map((v) => kort(v.label)),
        onzekerheid: c.matrix?.onzekerheid ?? null,
        steuncontrole: c.steuncontrole ? { oordeel: c.steuncontrole.oordeel, toelichting: c.steuncontrole.toelichting } : null,
        aanpassing: c.aangepast ? `${NIVEAU_LABEL[c.aangepast.van]} → ${NIVEAU_LABEL[c.aangepast.naar]}: ${c.aangepast.reden}` : null,
      };
    });
}

export const MATRIX_WAARSCHUWING =
  "Automatische controle vergelijkt tekst: bestaat het bewijsstuk, staat het citaat er letterlijk in, is het een primaire bron. Dat zegt níet dat de uitleg juist is. De steuncontrole is een AI-oordeel en kan een bewering alleen afwaarderen. Lees bij twijfel de bron zelf.";

export const SECTIES = [
  { nr: 1, id: "vraag", titel: "Onderzoeksvraag en afbakening" },
  { nr: 2, id: "context", titel: "Bijbeltekst en context" },
  { nr: 3, id: "grondtaal", titel: "Grondtaal en vertaling" },
  { nr: 4, id: "exegese", titel: "Belangrijkste exegetische inzichten" },
  { nr: 5, id: "historisch", titel: "Historische commentaren" },
  { nr: 6, id: "hedendaags", titel: "Hedendaagse wetenschappelijke uitleg" },
  { nr: 7, id: "perspectieven", titel: "Verschillende theologische perspectieven" },
  { nr: 8, id: "preken", titel: "Preken en lezingen" },
  { nr: 9, id: "lijnen", titel: "Nieuwe of onverwachte onderzoekslijnen" },
  { nr: 10, id: "kritisch", titel: "Kritische aandachtspunten" },
  { nr: 11, id: "homiletiek", titel: "Mogelijke homiletische verbindingen" },
  { nr: 12, id: "vervolg", titel: "Openstaande vervolgvragen" },
  { nr: 13, id: "bronnen", titel: "Bronnenlijst" },
] as const;

// ---------------------------------------------------------------- Markdown
function verw(b: DossierBewering, dossier: Dossier): string {
  if (!b.verwijzingen.length) return "";
  return " " + b.verwijzingen.map((v) => {
    const r = dossier.bewijs.find((x) => x.label === v.label);
    return `[${v.label}${r ? `: ${r.bron_titel.split(" — ")[0]}, ${r.locatie}` : ""}]${v.citaat ? ` (“${v.citaat}”)` : ""}`;
  }).join(" ");
}

function beweringMd(b: DossierBewering, dossier: Dossier): string {
  const aangepast = b.controle?.aangepast ? ` _(niveau verlaagd van ${NIVEAU_LABEL[b.controle.aangepast.van]}: ${b.controle.aangepast.reden})_` : "";
  const onbekend = b.controle?.onbekend?.length ? ` _(verwijderde niet-bestaande verwijzingen: ${b.controle.onbekend.join(", ")})_` : "";
  const nietGevonden = b.controle?.citatenNietGevonden?.length ? ` _(citaat niet teruggevonden en weggelaten)_` : "";
  const abs = b.controle?.alleenAbstractOfMetadata ? " _(alleen op abstract/catalogus gebaseerd)_" : "";
  return `- **${NIVEAU_LABEL[b.niveau]}** · ${b.herkomst === "data" ? "berekend uit tekstdata" : `AI-analyse${b.perspectief ? ` (${b.perspectief})` : ""}`} — ${b.tekst}${verw(b, dossier)}${aangepast}${onbekend}${nietGevonden}${abs}`;
}

export function naarMarkdown(x: Dossier): string {
  const md: string[] = [];
  const bw = (sectie: string) => x.beweringen.filter((b) => b.sectie === sectie);
  md.push(`# Onderzoeksdossier`, ``, `> ${x.vraag.replace(/\n/g, "\n> ")}`, ``);
  md.push(`- Modus: **${x.modus}** · gemaakt ${x.gemaakt.slice(0, 16).replace("T", " ")} UTC · AI-kosten $${x.kostenUsd.toFixed(3)} (budget $${x.budgetUsd.toFixed(2)})`);
  md.push(`- Dit is geen preek. Bewijsniveaus: Direct aangetoond · Onderbouwde interpretatie · Mogelijke onderzoekslijn · Omstreden · Niet geverifieerd. Labels [E…] verwijzen naar het bewijsregister onderaan.`);
  const zonderAi = x.stappen.filter((s) => s.status === "klaar_zonder_ai").map((s) => `${s.id} (${s.fout})`);
  if (zonderAi.length) md.push(`- Stappen zonder AI-interpretatie: ${zonderAi.join("; ")}`);
  md.push("");

  md.push(`## 1. Onderzoeksvraag en afbakening`);
  if (x.a) {
    md.push(`- Herkende Bijbelgedeelten: ${x.a.refs.map((r) => r.label).join("; ") || "geen"}`);
    if (x.a.thema) md.push(`- Thema: ${x.a.thema}`);
    if (x.a.dienst) md.push(`- Dienst: ${x.a.dienst}`);
    if (x.a.ai) {
      md.push(`- Kernvraag: ${x.a.ai.kernvraag}`, `- Wel: ${x.a.ai.afbakening_wel.join("; ")}`, `- Niet: ${x.a.ai.afbakening_niet.join("; ")}`);
      md.push(`- Aannames om te toetsen:`, ...x.a.ai.aannames.map((a) => `  - ${a.aanname} (${a.expliciet ? "expliciet" : "impliciet"}) — ${a.waarom_toetsen}`));
      md.push(`- Exegese / dogmatiek / homiletiek: ${x.a.ai.onderscheid.exegese} / ${x.a.ai.onderscheid.dogmatiek} / ${x.a.ai.onderscheid.homiletiek}`);
    }
    md.push(`- Onderzoeksplan:`, ...x.a.plan.map((p) => `  1. ${p}`));
  }
  md.push("");

  md.push(`## 2. Bijbeltekst en context`);
  for (const v of x.focusTekst) md.push(`- **${v.label}** — SV: ${v.teksten.SV ?? "–"}  `, `  BSB: ${v.teksten.BSB ?? "–"}`);
  for (const w of x.c?.motieven?.waarschuwingen ?? []) md.push(`- ⚠ ${w}`);
  md.push(...bw("context").map((b) => beweringMd(b, x)), "");

  md.push(`## 3. Grondtaal en vertaling`);
  if (x.sleutelwoorden.length) {
    md.push(`| Vorm | Translit. | Lemma | Strong | Glosse (STEP) | Morfologie |`, `|---|---|---|---|---|---|`);
    for (const w of x.sleutelwoorden.slice(0, 40)) md.push(`| ${w.vorm} | ${w.translit ?? ""} | ${w.lemma ?? ""} | ${w.strong ?? ""} | ${w.glosse ?? ""} | ${(w.morf ?? "").replace(/\|/g, "/").slice(0, 80)} |`);
    md.push(`_Bron: STEPBible TAHOT/TAGNT (CC BY 4.0). Betekenissen uit TBESH/TBESG; geen conclusies op alleen een Strong-nummer._`);
  }
  md.push(...bw("grondtaal").map((b) => beweringMd(b, x)), "");

  md.push(`## 4. Belangrijkste exegetische inzichten`, ...(bw("exegese").length ? bw("exegese").map((b) => beweringMd(b, x)) : ["_Geen AI-analyse uitgevoerd; zie de tekstdata (3) en commentaren (5)._"]), "");

  md.push(`## 5. Historische commentaren`);
  const comm = x.bewijs.filter((r) => r.soort === "commentaar");
  const perWerk = new Map<string, BewijsRij[]>();
  for (const r of comm) (perWerk.get(r.bron_titel) ?? perWerk.set(r.bron_titel, []).get(r.bron_titel)!).push(r);
  for (const [titel, rs] of perWerk) {
    md.push(`### ${titel}`);
    for (const r of rs.slice(0, 6)) md.push(`- [${r.label}] ${r.locatie}: ${r.tekst.slice(0, 600).replace(/\n+/g, " ")}${r.tekst.length > 600 ? " …" : ""}${r.url ? ` ([bron](${r.url}))` : ""}`);
  }
  md.push(...bw("historisch").map((b) => beweringMd(b, x)), "");

  md.push(`## 6. Hedendaagse wetenschappelijke uitleg`);
  const academisch = x.bronnen.filter((b) => ["openalex", "crossref", "doaj", "semanticscholar", "core", "pthu"].includes(b.connector));
  if (!academisch.length) md.push(`_Geen academische bronnen gevonden of geraadpleegd (zie bronstatus in stap C)._`);
  for (const b of academisch.slice(0, 20)) md.push(`- ${b.auteurs.slice(0, 3).join(", ")}${b.auteurs.length > 3 ? " e.a." : ""} (${b.jaar ?? "z.j."}). *${b.titel}*. ${b.uitgever ?? ""} ${b.url ? `<${b.url}>` : ""} — toegang: ${b.toegang}${b.beoordeling?.relevantie != null ? ` · relevantie ${b.beoordeling.relevantie}/3 (${b.beoordeling.waarom})` : ""}`);
  md.push(...bw("hedendaags").map((b) => beweringMd(b, x)), "");

  md.push(`## 7. Verschillende theologische perspectieven`, ...bw("perspectieven").map((b) => beweringMd(b, x)));
  for (const v of x.e?.analyse?.verschillen ?? []) {
    md.push(`- **Verschilpunt:** ${v.punt}`);
    for (const p of v.posities) md.push(`  - ${p.wie}: ${p.standpunt} ${p.verwijzingen.map((r) => `[${r.label}]`).join(" ")}`);
    md.push(`  - Beoordeling: ${v.beoordeling}`);
  }
  md.push(...bw("vergelijking").map((b) => beweringMd(b, x)), "");

  md.push(`## 8. Preken en lezingen`);
  for (const v of x.c?.videos ?? []) md.push(`- Video uit de vraag <${v.url}>: ${v.transcript ? `transcript “${v.transcript}” (${v.labels.length} delen). ` : ""}${v.melding}`);
  const video = x.bronnen.filter((b) => b.brontype === "preek/lezing (video)");
  if (!video.length) md.push(`_Geen video's met gegevens (YouTube-sleutel ontbreekt of geen resultaten)._`);
  for (const b of video) md.push(`- ${b.titel} — ${b.auteurs.join(", ")} (${b.jaar ?? "?"}) <${b.url}> — **${b.toegang === "transcript" ? "transcript beschikbaar" : "alleen metadata; inhoud niet geverifieerd"}**`);
  for (const r of x.bewijs.filter((r) => r.soort === "transcript").slice(0, 10)) md.push(`  - [${r.label}] ${r.locatie}: ${r.tekst.slice(0, 300)} ${r.url ? `<${r.url}>` : ""}`);
  for (const l of x.b?.doorverwijzingen.filter((y) => y.bron === "YouTube") ?? []) md.push(`- Zoeklink: [${l.label}](${l.url})`);
  md.push("");

  md.push(`## 9. Nieuwe of onverwachte onderzoekslijnen`, ...bw("lijnen").map((b) => beweringMd(b, x)), "");
  if (x.v?.onderwerpen.length) {
    md.push(`### Verdiepingsronde (tweede, gerichte zoekronde)`);
    for (const o of x.v.onderwerpen) md.push(`- **${o.titel}** (${o.herkomst === "ai" ? "voorgesteld door de analyse" : "datagedreven"}): ${o.waarom} — bewijs ${o.labels.slice(0, 12).join(", ") || "geen"}`);
    for (const o of x.v.ai?.onderwerpen ?? []) if (o.wat_de_tekst_niet_zegt.length) md.push(`- _Wat de tekst niet zegt (${o.onderwerp}):_ ${o.wat_de_tekst_niet_zegt.join("; ")}`);
    if (x.v.aiFout) md.push(`- _${x.v.aiFout}_`);
    md.push(...bw("verdieping").map((b) => beweringMd(b, x)), "");
  }

  md.push(`## 10. Kritische aandachtspunten`);
  for (const r of x.g?.regels ?? []) md.push(`- ${r}`);
  for (const p of x.g?.ai?.punten ?? []) md.push(`- **${p.soort.replace(/_/g, " ")}**${p.bewering ? ` (${p.bewering})` : ""}: ${p.toelichting} → _${p.advies}_ ${p.verwijzingen.map((v) => `[${v.label}]`).join(" ")}`);
  if (x.g?.ai?.eindoordeel) md.push(``, `**Eindoordeel tegenlezing:** ${x.g.ai.eindoordeel}`);
  const verlaagd = x.beweringen.filter((b) => b.controle?.aangepast).length;
  const verzonnen = x.beweringen.reduce((s, b) => s + (b.controle?.onbekend?.length ?? 0), 0);
  const citaatWeg = x.beweringen.reduce((s, b) => s + (b.controle?.citatenNietGevonden?.length ?? 0), 0);
  md.push(`- Automatische controle: ${verlaagd} beweringen in niveau verlaagd, ${verzonnen} niet-bestaande verwijzingen verwijderd, ${citaatWeg} niet-teruggevonden citaten weggelaten.`, "");

  if (x.matrix.length) {
    md.push(`### Claim-bronmatrix`, ``, `_${MATRIX_WAARSCHUWING}_`, ``, `| Claim | Niveau | Bewijs (vindplaats) | Interpretatieve stap | Tegenargumenten | Onzekerheid | Steuncontrole |`, `|---|---|---|---|---|---|---|`);
    const cel = (t: string | null | undefined) => (t ?? "–").replace(/\|/g, "/").replace(/\n+/g, " ");
    for (const r of x.matrix) md.push(`| ${r.claim}: ${cel(r.tekst.slice(0, 160))} | ${NIVEAU_LABEL[r.niveau]}${r.aanpassing ? ` (${cel(r.aanpassing)})` : ""} | ${cel(r.bewijs.map((b) => `${b.label} ${b.bron.split(" — ")[0]}, ${b.locatie}${b.citaatGeverifieerd ? " ✓citaat" : ""}`).join("; ") || "geen")} | ${cel(r.interpretatieveStap)} | ${cel(r.tegenverwijzingen.map((t) => `${t.label} ${t.locatie}`).join("; ") || null)} | ${cel(r.onzekerheid)} | ${cel(r.steuncontrole ? `${r.steuncontrole.oordeel}: ${r.steuncontrole.toelichting}` : null)} |`);
    md.push("");
  }

  md.push(`## 11. Mogelijke homiletische verbindingen`, ...(bw("homiletiek").length ? bw("homiletiek").map((b) => beweringMd(b, x)) : ["_Geen AI-analyse uitgevoerd._"]), "");

  md.push(`## 12. Openstaande vervolgvragen`);
  const open = [...(x.e?.analyse?.open_vragen ?? []), ...Object.values(x.e?.perspectieven ?? {}).flatMap((p) => p.open_vragen), ...(x.g?.ai?.zoekvragen_tegenperspectief.map((q) => `Zoek tegenperspectief: ${q}`) ?? [])];
  md.push(...(open.length ? open.map((q) => `- ${q}`) : ["_Zie de onderzoekslijnen (9)._"]), "");

  md.push(`## 13. Bronnenlijst`);
  for (const b of x.bronnen) {
    md.push(`- ${b.auteurs.join(", ") || "—"}${b.jaar ? ` (${b.jaar})` : ""}. *${b.titel}*.${b.uitgever ? ` ${b.uitgever}.` : ""}${b.doi ? ` DOI ${b.doi}.` : ""}${b.url ? ` <${b.url}>` : ""} — ${b.brontype}; toegang: ${b.toegang}; herbruikbaar: ${b.rechten.herbruikbaar ?? "onbekend"}${b.rechten.licentie ? ` (${b.rechten.licentie})` : ""}; geraadpleegd ${b.geraadpleegd.slice(0, 10)}; ladder ${b.ladder.tekst}${b.labels.length ? `; passages ${b.labels.slice(0, 12).join(", ")}${b.labels.length > 12 ? "…" : ""}` : ""}`);
  }
  md.push("", `### Bronstatus`);
  for (const k of x.c?.connectors ?? []) md.push(`- ${k.naam}: ${k.status}${k.resultaten ? ` (${k.resultaten})` : ""}${k.melding ? ` — ${k.melding}` : ""}`);
  md.push("", `### Doorverwijzingen (niet automatisch geraadpleegd)`);
  for (const l of x.b?.doorverwijzingen ?? []) md.push(`- [${l.label}](${l.url}) — ${l.toelichting}`);
  md.push("", `### Bewijsregister`);
  for (const r of x.bewijs) md.push(`- **${r.label}** · ${r.soort} · ${r.bron_titel} · ${r.locatie}`);
  md.push("", `---`, `_Attributie: grondtekstdata STEP Bible (www.STEPBible.org, CC BY 4.0); kruisverwijzingen OpenBible.info (CC BY); Statenvertaling en Kanttekeningen (CC0, Isidore-Guild); Berean Standard Bible (publiek domein)._`);
  return md.join("\n");
}
