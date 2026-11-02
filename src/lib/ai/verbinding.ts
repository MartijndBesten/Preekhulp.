// AI-verbindingsstatus voor de instellingenpagina. Zeven toestanden (opdracht §2):
// sleutel ontbreekt · aanwezig, niet getest · getest en werkend · authenticatiefout · quotum of budget bereikt ·
// model niet beschikbaar · netwerk niet bereikbaar.
// De verbindingstest is GRATIS: hij vraagt alleen modelinformatie op (Anthropic GET /v1/models/{id}, OpenAI
// GET /v1/models/{id}, Ollama GET /api/tags) en voert geen tekstgeneratie uit.
// Opgeslagen wordt alleen een korte vingerafdruk van de sleutel (om te zien dat hij is vervangen), nooit de sleutel.
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import Anthropic from "@anthropic-ai/sdk";
import { json, nu } from "../db";
import { geheim, leesInstellingen, type Instellingen } from "../settings";
import { bestedingDezeMaand } from "./index";

export type Toestand = "geen_aanbieder" | "sleutel_ontbreekt" | "niet_getest" | "werkt" | "authenticatiefout" | "quotum_of_budget" | "model_niet_beschikbaar" | "netwerk";

export const TOESTAND_TEKST: Record<Toestand, string> = {
  geen_aanbieder: "Geen AI gekozen — bronnen, tekstanalyse en dossiers werken gewoon.",
  sleutel_ontbreekt: "Sleutel ontbreekt",
  niet_getest: "Sleutel aanwezig, nog niet getest",
  werkt: "Getest en werkend",
  authenticatiefout: "Authenticatiefout (sleutel ongeldig of ingetrokken)",
  quotum_of_budget: "Quotum of budget bereikt",
  model_niet_beschikbaar: "Model niet beschikbaar voor deze sleutel",
  netwerk: "Netwerk niet bereikbaar",
};

interface Opgeslagen {
  toestand: Toestand;
  aanbieder: string;
  model: string | null;
  vingerafdruk: string | null;
  moment: string;
  melding: string | null;
}

export interface VerbindingStatus {
  toestand: Toestand;
  tekst: string;
  melding: string | null;
  getestOp: string | null;
  model: string | null;
  maandBestedingUsd: number;
  maandbudgetUsd: number;
}

function sleutelVoor(i: Instellingen): string | null {
  if (i.aiAanbieder === "anthropic") return geheim("anthropic");
  if (i.aiAanbieder === "openai") return geheim("openai");
  if (i.aiAanbieder === "ollama") return geheim("ollamaUrl") ?? "http://127.0.0.1:11434";
  return null;
}

function vingerafdruk(i: Instellingen): string | null {
  const s = sleutelVoor(i);
  return s ? createHash("sha256").update(`${i.aiAanbieder}:${s}`).digest("hex").slice(0, 12) : null;
}

function modelVan(i: Instellingen): string | null {
  return i.aiAanbieder === "anthropic" ? i.anthropicModel : i.aiAanbieder === "openai" ? i.openaiModel || null : i.aiAanbieder === "ollama" ? i.ollamaModel || null : null;
}

function lees(d: DatabaseSync): Opgeslagen | null {
  const r = d.prepare("SELECT waarde FROM meta WHERE sleutel = 'ai_verbinding'").get() as { waarde: string } | undefined;
  return json<Opgeslagen | null>(r?.waarde, null);
}

/** Leg de uitkomst van een test of van een echte aanroep vast (alleen toestand, nooit inhoud of sleutel). */
export function registreerToestand(d: DatabaseSync, toestand: Toestand, melding: string | null = null) {
  const i = leesInstellingen(d);
  const o: Opgeslagen = { toestand, aanbieder: i.aiAanbieder, model: modelVan(i), vingerafdruk: vingerafdruk(i), moment: nu(), melding: melding?.slice(0, 300) ?? null };
  d.prepare("INSERT OR REPLACE INTO meta (sleutel, waarde) VALUES ('ai_verbinding', ?)").run(JSON.stringify(o));
}

export function verbindingStatus(d: DatabaseSync): VerbindingStatus {
  const i = leesInstellingen(d);
  const besteed = bestedingDezeMaand(d);
  const basis = { maandBestedingUsd: besteed, maandbudgetUsd: i.maandbudgetUsd, model: modelVan(i) };
  const maak = (toestand: Toestand, melding: string | null = null, getestOp: string | null = null): VerbindingStatus => ({ ...basis, toestand, tekst: TOESTAND_TEKST[toestand], melding, getestOp });
  if (i.aiAanbieder === "geen") return maak("geen_aanbieder");
  if (!sleutelVoor(i)) return maak("sleutel_ontbreekt", i.aiAanbieder === "anthropic" ? "Vul de Anthropic API-sleutel in onder Sleutels. Preekhulp gebruikt nooit het Claude Code-abonnement." : null);
  if (besteed >= i.maandbudgetUsd) return maak("quotum_of_budget", `Maandbudget van $${i.maandbudgetUsd} is bereikt ($${besteed.toFixed(2)} besteed). Verhoog het budget bewust of wacht tot volgende maand.`);
  const o = lees(d);
  // Andere sleutel, aanbieder of model dan bij de laatste test? Dan geldt de oude uitslag niet meer.
  if (!o || o.vingerafdruk !== vingerafdruk(i) || o.aanbieder !== i.aiAanbieder || o.model !== modelVan(i)) return maak("niet_getest");
  return maak(o.toestand, o.melding, o.moment);
}

/** Gratis verbindingstest: alleen modelinformatie opvragen, geen tekstgeneratie. */
export async function testVerbinding(d: DatabaseSync, fetchFn: typeof fetch = fetch): Promise<VerbindingStatus> {
  const i = leesInstellingen(d);
  const sleutel = sleutelVoor(i);
  if (i.aiAanbieder === "geen" || !sleutel) return verbindingStatus(d);
  let toestand: Toestand = "werkt";
  let melding: string | null = null;
  try {
    if (i.aiAanbieder === "anthropic") {
      const client = new Anthropic({ apiKey: sleutel, baseURL: "https://api.anthropic.com", maxRetries: 0, timeout: 15_000, fetch: fetchFn });
      const m = await client.models.retrieve(i.anthropicModel);
      melding = `Model gevonden: ${m.display_name ?? m.id}. (Test kost niets: er is geen tekst gegenereerd.)`;
    } else if (i.aiAanbieder === "openai") {
      if (!i.openaiModel) return verbindingStatus(d);
      const r = await fetchFn(`https://api.openai.com/v1/models/${encodeURIComponent(i.openaiModel)}`, { headers: { Authorization: `Bearer ${sleutel}` }, signal: AbortSignal.timeout(15_000) });
      if (r.status === 401 || r.status === 403) toestand = "authenticatiefout";
      else if (r.status === 404) toestand = "model_niet_beschikbaar";
      else if (r.status === 429) toestand = "quotum_of_budget";
      else if (!r.ok) [toestand, melding] = ["netwerk", `HTTP ${r.status}`];
    } else {
      const basis = sleutel.replace(/\/$/, "");
      if (!["127.0.0.1", "localhost", "::1"].includes(new URL(basis).hostname)) [toestand, melding] = ["netwerk", "Ollama mag alleen lokaal draaien."];
      else {
        const r = await fetchFn(`${basis}/api/tags`, { signal: AbortSignal.timeout(5_000) });
        const j = (await r.json()) as { models?: { name: string }[] };
        if (!j.models?.some((m) => m.name === i.ollamaModel || m.name.split(":")[0] === i.ollamaModel)) [toestand, melding] = ["model_niet_beschikbaar", `Lokaal aanwezig: ${(j.models ?? []).map((m) => m.name).join(", ") || "geen modellen"}`];
      }
    }
  } catch (e) {
    toestand = toestandUitFout(e);
    melding = (e as Error).message?.slice(0, 200) ?? null;
  }
  registreerToestand(d, toestand, melding);
  return verbindingStatus(d);
}

export function toestandUitFout(e: unknown): Toestand {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "authenticatiefout";
  if (e instanceof Anthropic.NotFoundError) return "model_niet_beschikbaar";
  if (e instanceof Anthropic.RateLimitError) return "quotum_of_budget";
  if (e instanceof Anthropic.APIConnectionError) return "netwerk";
  if (e instanceof Anthropic.APIError) return e.status === 402 ? "quotum_of_budget" : "netwerk";
  return "netwerk";
}
