// Instellingen: gewone voorkeuren in de database; sleutels in een lokaal bestand buiten Git
// (.data/geheimen.local.json, alleen leesbaar voor de eigenaar) of in omgevingsvariabelen.
// Sleutels gaan nooit naar de browser: de interface ziet alleen óf een sleutel aanwezig is.
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { dataDir, json } from "./db";

export type AiAanbieder = "geen" | "anthropic" | "openai" | "ollama";

export interface Instellingen {
  aiAanbieder: AiAanbieder;
  anthropicModel: string;
  openaiModel: string;
  ollamaModel: string;
  openaiPrijsInvoer?: number; // USD per miljoen tokens, door gebruiker in te vullen
  openaiPrijsUitvoer?: number;
  inspanning: "low" | "medium" | "high" | "xhigh" | "max";
  budgetPerOnderzoekUsd: number;
  maandbudgetUsd: number;
  voorkeursauteurs: string[];
  tradities: string[];
  uitgeschakeldeConnectors: string[];
  eigenDocumentenNaarAi: "nooit" | "fragmenten";
  kerkvadersGebruiken: boolean; // rechten onzeker → standaard uit
}

export const STANDAARD: Instellingen = {
  aiAanbieder: "geen",
  anthropicModel: "claude-sonnet-5-5", // goedkoper; Opus is een bewuste keuze per instelling
  openaiModel: "",
  ollamaModel: "",
  inspanning: "medium",
  budgetPerOnderzoekUsd: 1.5,
  maandbudgetUsd: 10, // voorgestelde limiet; geen toestemming om kosten te maken
  voorkeursauteurs: [],
  tradities: ["gereformeerd", "protestants"],
  uitgeschakeldeConnectors: [],
  eigenDocumentenNaarAi: "nooit",
  kerkvadersGebruiken: false,
};

export function leesInstellingen(d: DatabaseSync): Instellingen {
  const rij = d.prepare("SELECT waarde FROM instellingen WHERE sleutel = 'algemeen'").get() as { waarde: string } | undefined;
  return { ...STANDAARD, ...json<Partial<Instellingen>>(rij?.waarde, {}) };
}

export function bewaarInstellingen(d: DatabaseSync, i: Partial<Instellingen>): Instellingen {
  const nieuw = { ...leesInstellingen(d), ...i };
  d.prepare("INSERT OR REPLACE INTO instellingen (sleutel, waarde) VALUES ('algemeen', ?)").run(JSON.stringify(nieuw));
  return nieuw;
}

// ---------------------------------------------------------------- Geheimen
export const GEHEIM_NAMEN = {
  anthropic: "PREEKHULP_ANTHROPIC_KEY",
  openai: "PREEKHULP_OPENAI_KEY",
  ollamaUrl: "PREEKHULP_OLLAMA_URL",
  youtube: "PREEKHULP_YOUTUBE_KEY",
  core: "PREEKHULP_CORE_KEY",
  openalex: "PREEKHULP_OPENALEX_KEY",
  semanticScholar: "PREEKHULP_SEMANTIC_SCHOLAR_KEY",
  googleBooks: "PREEKHULP_GOOGLE_BOOKS_KEY",
  contactEmail: "PREEKHULP_CONTACT_EMAIL",
} as const;
export type GeheimNaam = keyof typeof GEHEIM_NAMEN;

function geheimBestand() {
  return path.join(dataDir(), "geheimen.local.json");
}

function leesBestand(): Partial<Record<GeheimNaam, string>> {
  try {
    return JSON.parse(fs.readFileSync(geheimBestand(), "utf8"));
  } catch {
    return {};
  }
}

export function geheim(naam: GeheimNaam): string | null {
  const env = process.env[GEHEIM_NAMEN[naam]];
  if (env && env.trim()) return env.trim();
  const v = leesBestand()[naam];
  return v && v.trim() ? v.trim() : null;
}

export function bewaarGeheim(naam: GeheimNaam, waarde: string | null) {
  const huidig = leesBestand();
  if (waarde && waarde.trim()) huidig[naam] = waarde.trim();
  else delete huidig[naam];
  fs.writeFileSync(geheimBestand(), JSON.stringify(huidig, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(geheimBestand(), 0o600);
  } catch {
    /* Windows */
  }
}

/** Alleen aanwezig/afwezig — veilig om naar de interface te sturen. */
export function geheimStatus(): Record<GeheimNaam, { aanwezig: boolean; via: "omgeving" | "bestand" | null }> {
  const bestand = leesBestand();
  const uit = {} as Record<GeheimNaam, { aanwezig: boolean; via: "omgeving" | "bestand" | null }>;
  for (const k of Object.keys(GEHEIM_NAMEN) as GeheimNaam[]) {
    const env = process.env[GEHEIM_NAMEN[k]];
    uit[k] = env && env.trim() ? { aanwezig: true, via: "omgeving" } : bestand[k] ? { aanwezig: true, via: "bestand" } : { aanwezig: false, via: null };
  }
  return uit;
}
