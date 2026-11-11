// Blinde Genesis 31-evaluatie (opdracht 01-11-2026 §12) — één variant per run.
//
//   npm run evaluatie -- --raming                              kostenraming van alle varianten (gratis, geen sleutel nodig)
//   npm run evaluatie -- --variant zonder-ai                   Preekhulp zonder AI (gratis; controle van de opzet)
//   npm run evaluatie -- --variant sonnet --akkoord            Preekhulp met Claude Sonnet 5.5   (BETAALD)
//   npm run evaluatie -- --variant opus --akkoord              Preekhulp met Claude Opus 5.5     (BETAALD)
//   npm run evaluatie -- --variant direct --akkoord            rechtstreeks Claude, dezelfde vraag (BETAALD)
//   extra: --modus verkennen|verdiepen|kritisch (standaard verdiepen) · --budget <USD> · --model <id> (alleen direct) · --zonder-extern
//
// Blindheid: dit script leest de referentiepreek NIET. Alleen `npm run evaluatie:vergelijk` leest die, en pas nadat alle
// ruwe resultaten zijn bewaard. Betaalde varianten draaien alleen met een ingestelde sleutel én --akkoord (expliciete
// toestemming van Martijn), en nooit boven het opgegeven budget of het maandbudget.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../src/lib/db";
import { geheim, leesInstellingen, bewaarInstellingen } from "../src/lib/settings";
import { raming, maakOnderzoek, voerUit } from "../src/lib/research/runner";
import { laadDossier, naarMarkdown } from "../src/lib/reports/dossier";
import { MODUS_CONFIG } from "../src/lib/research/stappen";
import type { Modus } from "../src/lib/research/types";
import { ANTHROPIC_PRIJZEN, kosten, schatTokens } from "../src/lib/ai/prijzen";
import { vraagTekst } from "../src/lib/ai";
import { DATASETS } from "../src/lib/sources/datasets";

const arg = (n: string) => process.argv.includes(n);
const waarde = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const VARIANTEN = ["zonder-ai", "sonnet", "opus", "direct"] as const;
type Variant = (typeof VARIANTEN)[number];
const variant = (VARIANTEN.includes(waarde("--variant") as Variant) ? waarde("--variant") : "zonder-ai") as Variant;
const modus = (["verkennen", "verdiepen", "kritisch"].includes(waarde("--modus") ?? "") ? waarde("--modus") : "verdiepen") as Modus;
const MODEL: Record<"sonnet" | "opus", string> = { sonnet: "claude-sonnet-5-5", opus: "claude-opus-5-5" };
const directModel = waarde("--model") ?? "claude-opus-5-5"; // sterkste basislijn: geen stroman
const DIRECT_MAX_TOKENS = 12_000;
const MAP = path.join(process.cwd(), "evaluatie");

function git(cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function ramingen(d: ReturnType<typeof openDb>, vraag: string) {
  const r = (m: string) => raming(d, modus, { aiAanbieder: "anthropic", anthropicModel: m }).totaalMaxUsd ?? 0;
  const p = ANTHROPIC_PRIJZEN[directModel];
  return { sonnet: r(MODEL.sonnet), opus: r(MODEL.opus), direct: p ? kosten(p, schatTokens(vraag.length), DIRECT_MAX_TOKENS) : null };
}

async function main() {
  const d = openDb();
  const invoer = JSON.parse(fs.readFileSync(path.join(MAP, "genesis31", "invoer.json"), "utf8")) as { vraag: string; context: string; opties: Record<string, string> };
  const r = ramingen(d, invoer.vraag);
  const totaal = r.sonnet + r.opus + (r.direct ?? 0);
  console.log(`Raming (bovengrens, modus ${modus}): Preekhulp-Sonnet $${r.sonnet.toFixed(2)} · Preekhulp-Opus $${r.opus.toFixed(2)} · direct ${directModel} $${(r.direct ?? NaN).toFixed(2)} · samen $${totaal.toFixed(2)}`);
  console.log("Bovengrens = alle invoer (1 token per 2 tekens) + volledig uitvoermaximum per aanroep; werkelijke kosten zijn meestal lager.");
  if (arg("--raming")) return;

  const betaald = variant !== "zonder-ai";
  if (betaald && !arg("--akkoord")) {
    console.error(`\nGestopt: variant '${variant}' maakt betaalde AI-aanroepen. Voer pas uit na expliciete toestemming van Martijn, met --akkoord.`);
    process.exitCode = 2;
    return;
  }
  if (betaald && !geheim("anthropic")) {
    console.error("\nGestopt: geen Anthropic-sleutel ingesteld (Instellingen of PREEKHULP_ANTHROPIC_KEY).");
    process.exitCode = 2;
    return;
  }

  const datum = new Date().toISOString();
  const naam = `${datum.slice(0, 10)}-${variant}${variant === "direct" ? `-${directModel}` : `-${modus}`}`;
  const uitMap = path.join(MAP, "resultaten", naam);
  fs.mkdirSync(uitMap, { recursive: true });
  const oud = leesInstellingen(d);
  const meta = {
    variant, datum, invoer, gitCommit: git("rev-parse HEAD"), gitBranch: git("rev-parse --abbrev-ref HEAD"), node: process.version,
    datasets: DATASETS.map((x) => ({ naam: x.naam, commit: x.commit })), ramingUsd: variant === "direct" ? r.direct : variant === "zonder-ai" ? 0 : r[variant],
  };
  const t0 = Date.now();

  if (variant === "direct") {
    // Exact dezelfde vraag, geen systeemprompt, geen bronnen, geen hulpmiddelen: de rechtstreekse basislijn.
    const budget = Number(waarde("--budget") ?? Math.max(1, (r.direct ?? 0) * 1.1));
    const a = await vraagTekst(d, { stap: "EVAL-direct", systeem: "", invoer: invoer.vraag, maxTokens: DIRECT_MAX_TOKENS, model: directModel }, { resterendBudgetUsd: budget });
    fs.writeFileSync(path.join(uitMap, "antwoord.md"), a.tekst);
    fs.writeFileSync(path.join(uitMap, "instellingen.json"), JSON.stringify({ ...meta, model: a.model, maxTokens: DIRECT_MAX_TOKENS, systeemprompt: null, hulpmiddelen: "geen (geen webzoekfunctie, geen bronnen)", budgetUsd: budget, duurSec: (Date.now() - t0) / 1000, invoerTokens: a.invoerTokens, uitvoerTokens: a.uitvoerTokens, kostenUsd: a.kostenUsd, stopReden: a.stopReden }, null, 2));
    console.log(`Klaar: ${path.relative(process.cwd(), uitMap)} · $${a.kostenUsd.toFixed(3)}`);
    return;
  }

  let id: string;
  try {
    bewaarInstellingen(d, variant === "zonder-ai" ? { aiAanbieder: "geen" } : { aiAanbieder: "anthropic", anthropicModel: MODEL[variant] });
    const budget = waarde("--budget") ? Number(waarde("--budget")) : variant === "zonder-ai" ? 0 : Math.max(oud.budgetPerOnderzoekUsd, r[variant] * 1.05);
    id = maakOnderzoek(d, invoer.vraag, modus, { ...invoer.opties, budgetUsd: budget, zonderExtern: arg("--zonder-extern") }, null);
    console.log(`Onderzoek ${id} (${variant}, ${modus}) gestart…`);
    await voerUit(d, id);
  } finally {
    bewaarInstellingen(d, { aiAanbieder: oud.aiAanbieder, anthropicModel: oud.anthropicModel });
  }
  const x = laadDossier(d, id)!;
  fs.writeFileSync(path.join(uitMap, "dossier.json"), JSON.stringify(x, null, 1));
  fs.writeFileSync(path.join(uitMap, "dossier.md"), naarMarkdown(x));
  fs.writeFileSync(path.join(uitMap, "ai_gebruik.json"), JSON.stringify(d.prepare("SELECT stap, model, invoer_tokens, uitvoer_tokens, kosten_usd, raming_max_usd, status, gemaakt FROM ai_gebruik WHERE onderzoek = ? ORDER BY gemaakt").all(id), null, 1));
  fs.writeFileSync(path.join(uitMap, "instellingen.json"), JSON.stringify({
    ...meta, onderzoek: id, modus, model: variant === "zonder-ai" ? null : MODEL[variant], modusConfig: MODUS_CONFIG[modus], budgetUsd: x.budgetUsd,
    zonderExtern: arg("--zonder-extern"), duurSec: (Date.now() - t0) / 1000, kostenUsd: x.kostenUsd, status: x.status,
    bronstatus: x.c?.connectors ?? [], stappen: x.stappen,
  }, null, 2));
  console.log(`Klaar: ${path.relative(process.cwd(), uitMap)} · status ${x.status} · $${x.kostenUsd.toFixed(3)} · ${x.beweringen.length} beweringen · ${x.bewijs.length} bewijsstukken`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
