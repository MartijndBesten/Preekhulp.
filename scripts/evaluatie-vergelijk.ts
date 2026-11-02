// Vergelijking van de Genesis 31-varianten (opdracht 01-11-2026 §12). Leest de laatst bewaarde ruwe resultaten per
// variant, maakt een signaaltabel voor de 15 beoordelingspunten, een lege scorekaart, een reproduceerbare steekproef
// van 5 bronclaims per variant voor handcontrole, en pas DAARNA de vergelijking met de gehouden preek (referentie).
// Gebruik: npm run evaluatie:vergelijk            (kost niets: geen AI, geen netwerk)
import fs from "node:fs";
import path from "node:path";
import type { Dossier } from "../src/lib/reports/dossier";
import { NIVEAU_LABEL } from "../src/lib/verification/claims";
import { bronclaimsInTekst, signaalDossier, signaalTekst, steekproef, type Punt } from "./evaluatie-lib";

const MAP = path.join(process.cwd(), "evaluatie");
const RES = path.join(MAP, "resultaten");
const VOLGORDE = ["sonnet", "opus", "direct", "zonder-ai"] as const;
type V = (typeof VOLGORDE)[number];
const NAAM: Record<V, string> = { sonnet: "Preekhulp · Sonnet", opus: "Preekhulp · Opus", direct: "Rechtstreeks Claude", "zonder-ai": "Preekhulp zonder AI" };

interface Run { variant: V; map: string; instellingen: Record<string, unknown>; dossier: Dossier | null; antwoord: string | null }

function laatsteRuns(): Run[] {
  if (!fs.existsSync(RES)) return [];
  const mappen = fs.readdirSync(RES).filter((m) => fs.existsSync(path.join(RES, m, "instellingen.json"))).sort();
  const uit: Run[] = [];
  for (const v of VOLGORDE) {
    const m = mappen.filter((x) => x.slice(11).startsWith(`${v}-`)).pop();
    if (!m) continue;
    const p = path.join(RES, m);
    uit.push({
      variant: v, map: m, instellingen: JSON.parse(fs.readFileSync(path.join(p, "instellingen.json"), "utf8")),
      dossier: fs.existsSync(path.join(p, "dossier.json")) ? JSON.parse(fs.readFileSync(path.join(p, "dossier.json"), "utf8")) : null,
      antwoord: fs.existsSync(path.join(p, "antwoord.md")) ? fs.readFileSync(path.join(p, "antwoord.md"), "utf8") : null,
    });
  }
  return uit;
}

const cel = (s: string) => s.replace(/\|/g, "/").replace(/\n+/g, " ");

function main() {
  const runs = laatsteRuns();
  if (!runs.length) {
    console.error("Geen resultaten gevonden in evaluatie/resultaten/. Voer eerst `npm run evaluatie -- --variant …` uit.");
    process.exitCode = 1;
    return;
  }
  const criteria = JSON.parse(fs.readFileSync(path.join(MAP, "genesis31", "criteria.json"), "utf8")) as { punten: Punt[]; scorekaart: { id: string; naam: string; vraag: string }[]; preeklijnen: { lijn: string; refs: string[]; woorden: string[] }[] };
  const zaad = new Date().toISOString().slice(0, 10);
  const md: string[] = [];
  const ontbreekt = (["sonnet", "opus", "direct"] as V[]).filter((v) => !runs.some((r) => r.variant === v));
  md.push(`# Genesis 31 — vergelijking van onderzoeksresultaten (${zaad})`, "");
  if (ontbreekt.length) md.push(`> **Onvolledig:** nog geen resultaat voor ${ontbreekt.map((v) => NAAM[v]).join(", ")}. Betaalde runs vereisen expliciete toestemming (zie VRAGEN.md V-001). Conclusies hieronder gelden alleen voor de aanwezige varianten.`, "");
  md.push(`> Automatische signalen zijn grof (verwijzingen en trefwoorden). Ze zeggen dát iets aan bod komt, niet dat het juist of diep is. Het oordeel staat in de scorekaart en hoort bij de predikant. Geen variant krijgt vooraf het voordeel van de twijfel.`, "");

  md.push(`## Runs`, "", `| Variant | Map | Model | Modus | Status | Duur | Kosten | Raming (max) |`, `|---|---|---|---|---|---|---|---|`);
  for (const r of runs) {
    const i = r.instellingen as { model?: string; modus?: string; status?: string; duurSec?: number; kostenUsd?: number; ramingUsd?: number };
    md.push(`| ${NAAM[r.variant]} | \`${r.map}\` | ${i.model ?? "—"} | ${i.modus ?? "—"} | ${i.status ?? (r.antwoord ? "antwoord" : "—")} | ${i.duurSec?.toFixed(0) ?? "?"} s | $${(i.kostenUsd ?? 0).toFixed(3)} | $${(i.ramingUsd ?? 0).toFixed(2)} |`);
  }
  md.push("");

  md.push(`## 1. Vijftien beoordelingspunten — automatische signalen`, "", `| # | Punt | ${runs.map((r) => NAAM[r.variant]).join(" | ")} |`, `|---|---|${runs.map(() => "---").join("|")}|`);
  for (const p of criteria.punten) md.push(`| ${p.nr} | ${p.punt} | ${runs.map((r) => { const s = r.dossier ? signaalDossier(r.dossier, p) : signaalTekst(r.antwoord ?? "", p); return `**${s.signaal}** — ${cel(s.details)}`; }).join(" | ")} |`);
  md.push("", `_‘behandeld + bewijs’ = AI-bewering én passend bewijsstuk in het register; ‘genoemd’ = in de tekst, zonder controleerbaar bewijs; ‘alleen gegevens’ = bewijs aanwezig, niet besproken._`, "");

  md.push(`## 2. Controleerbaarheid (automatisch geteld)`, "", `| Maat | ${runs.map((r) => NAAM[r.variant]).join(" | ")} |`, `|---|${runs.map(() => "---").join("|")}|`);
  const maat = (f: (x: Dossier) => string, t: (a: string) => string) => runs.map((r) => (r.dossier ? f(r.dossier) : t(r.antwoord ?? ""))).join(" | ");
  md.push(`| AI-beweringen | ${maat((x) => String(x.beweringen.filter((b) => b.herkomst === "ai").length), () => "n.v.t.")} |`);
  md.push(`| …met geldig bewijslabel | ${maat((x) => String(x.beweringen.filter((b) => b.herkomst === "ai" && b.verwijzingen.length).length), () => "geen bewijsregister")} |`);
  md.push(`| Letterlijk teruggevonden citaten | ${maat((x) => String(x.beweringen.reduce((s, b) => s + (b.controle?.citatenGevonden ?? 0), 0)), () => "niet automatisch te controleren")} |`);
  md.push(`| Niet-bestaande verwijzingen verwijderd | ${maat((x) => String(x.beweringen.reduce((s, b) => s + (b.controle?.onbekend?.length ?? 0), 0)), () => "—")} |`);
  md.push(`| Niveaus verlaagd bij controle | ${maat((x) => String(x.beweringen.filter((b) => b.controle?.aangepast).length), () => "—")} |`);
  md.push(`| Bronnen met gelezen inhoud (ladder ≥ 4) | ${maat((x) => String(x.bronnen.filter((b) => b.ladder.niveau >= 4).length), () => "—")} |`);
  md.push(`| Zinnen met bron-/vindplaatsclaim | ${maat(() => "zie register", (a) => String(bronclaimsInTekst(a).length))} |`, "");

  md.push(`## 3. Steekproef: 5 willekeurige bronclaims per variant (handmatig controleren)`, "", `Zaad: \`${zaad}\` (reproduceerbaar; niet uitgekozen). Controleer per claim: bestaat de bron, staat de passage er, en **draagt de passage de bewering**?`, "");
  for (const r of runs) {
    md.push(`### ${NAAM[r.variant]}`, "", `| # | Claim | Opgegeven bron / passage | Bron bestaat? | Passage klopt? | Draagt de claim? (ja/deels/nee) |`, `|---|---|---|---|---|---|`);
    if (r.dossier) {
      const x = r.dossier;
      const kandidaten = x.beweringen.filter((b) => b.herkomst === "ai" && b.verwijzingen.length);
      steekproef(kandidaten, 5, zaad + r.variant).forEach((b, i) => {
        const v = b.verwijzingen[0];
        const bw = x.bewijs.find((q) => q.label === v.label);
        md.push(`| ${i + 1} | ${b.id} (${NIVEAU_LABEL[b.niveau]}): ${cel(b.tekst.slice(0, 220))} | ${v.label}: ${cel(bw ? `${bw.bron_titel}, ${bw.locatie}${bw.url ? ` <${bw.url}>` : ""} — “${bw.tekst.slice(0, 220)}…”` : "onbekend")}${v.citaat ? ` · citaat: “${cel(v.citaat)}”` : ""} | | | |`);
      });
      if (!kandidaten.length) md.push(`| – | Geen AI-beweringen met bewijs (variant zonder AI of AI niet beschikbaar) | | | | |`);
    } else {
      const claims = bronclaimsInTekst(r.antwoord ?? "");
      steekproef(claims, 5, zaad + r.variant).forEach((z, i) => md.push(`| ${i + 1} | ${cel(z.slice(0, 300))} | (geen vindplaats opgegeven; zelf opzoeken) | | | |`));
      if (!claims.length) md.push(`| – | Geen zinnen met een bron- of vindplaatsclaim gevonden | | | | |`);
    }
    md.push("");
  }

  md.push(`## 4. Scorekaart (handmatig invullen, 0–5)`, "", `| Criterium | Wat beoordeel je | ${runs.map((r) => NAAM[r.variant]).join(" | ")} |`, `|---|---|${runs.map(() => "---").join("|")}|`);
  for (const k of criteria.scorekaart) md.push(`| ${k.naam} | ${k.vraag} | ${runs.map((r) => (k.id === "kosten" ? `$${(((r.instellingen as { kostenUsd?: number }).kostenUsd) ?? 0).toFixed(3)}` : "")).join(" | ")} |`);
  md.push("", `### Waar is Preekhulp aantoonbaar beter, en waar niet?`, "", `- Beter (met bewijs uit tabel 1–3): `, `- Niet beter / slechter: `, `- Onbeslist: `, "");

  // Pas nu: de referentiepreek (afzonderlijke beoordelingsreferentie, nooit invoer voor de runs).
  const referentie = fs.readFileSync(path.join(MAP, "referentie", "genesis31-preek.md"), "utf8");
  md.push(`## 5. Vergelijking met de gehouden preek (referentie — pas na de runs gelezen)`, "", `Referentie: \`evaluatie/referentie/genesis31-preek.md\` (${referentie.length} tekens). Kolom = lijn teruggevonden (verwijzing of trefwoord).`, "", `| Preeklijn | ${runs.map((r) => NAAM[r.variant]).join(" | ")} |`, `|---|${runs.map(() => "---").join("|")}|`);
  for (const l of criteria.preeklijnen) {
    const p: Punt = { nr: 0, punt: l.lijn, refs: l.refs, woorden: l.woorden, lemmas: [] };
    md.push(`| ${l.lijn} | ${runs.map((r) => (r.dossier ? signaalDossier(r.dossier, p) : signaalTekst(r.antwoord ?? "", p)).signaal).join(" | ")} |`);
  }
  md.push("", `Let op: een preeklijn die een variant níet vindt, is niet automatisch een tekort (de preek is één keuze); een lijn die een variant vindt maar de preek niet, is pas winst als die exegetisch klopt (zie scorekaart).`);

  const uit = path.join(RES, `${zaad}-vergelijking.md`);
  fs.writeFileSync(uit, md.join("\n"));
  console.log(`Vergelijking: ${path.relative(process.cwd(), uit)} (${runs.map((r) => r.variant).join(", ")})`);
}

main();
