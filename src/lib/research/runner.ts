// Uitvoering van een onderzoek: stappen in volgorde, status per stap, los opnieuw uitvoerbaar.
import type { DatabaseSync } from "node:sqlite";
import { json, nu } from "../db";
import { aanbiederStatus, ramingUsd } from "../ai";
import { leesInstellingen } from "../settings";
import {
  MODUS_CONFIG, bewaarBeweringen, stapVUitvoeren, nieuwOnderzoekId, stapA, stapB, stapC, stapD, stapE, stapF, stapG, stapUitvoer,
  type RunCtx, type UitvoerA, type UitvoerB, type UitvoerC, type UitvoerD, type UitvoerE, type UitvoerF,
} from "./stappen";
import type { UitvoerV } from "./verdieping";
import { STAPPEN, type Modus, type OnderzoeksOpties, type StapId } from "./types";

export interface Raming {
  aanroepen: { stap: string; maxTokens: number; invoerTekens: number; maxUsd: number | null }[];
  totaalMaxUsd: number | null;
  budgetUsd: number;
  aiActief: boolean;
  reden: string | null;
  model: string | null;
  toelichting: string;
}

/** Bovengrens van de AI-kosten vóór de start (slechtste geval: volledige max_tokens per aanroep). */
export function raming(d: DatabaseSync, modus: Modus): Raming {
  const i = leesInstellingen(d);
  const st = aanbiederStatus(i);
  const cfg = MODUS_CONFIG[modus];
  const aanroepen: Raming["aanroepen"] = [];
  const voeg = (stap: string, maxTokens: number, invoerTekens: number) => aanroepen.push({ stap, maxTokens, invoerTekens, maxUsd: ramingUsd(i, invoerTekens, maxTokens) });
  if (cfg.ai.includes("A")) voeg("A — vraag begrijpen", 3000, 6000);
  if (cfg.ai.includes("B")) voeg("B — zoekvragen", 2500, 7000);
  if (cfg.ai.includes("D")) voeg("D — bronbeoordeling", 3500, 40000);
  if (modus === "kritisch") {
    for (const p of ["exegeet", "bijbels theoloog", "dogmaticus", "homileticus"]) voeg(`E — ${p}`, 8000, cfg.bewijsTekens + 8000);
    voeg("E — vergelijking", 14000, cfg.bewijsTekens + 30000);
  } else voeg("E — analyse", modus === "verkennen" ? 7000 : 16000, cfg.bewijsTekens + 8000);
  if (cfg.ai.includes("V")) voeg("V — verdiepingsronde", modus === "kritisch" ? 9000 : 7000, 60_000);
  if (cfg.ai.includes("G")) voeg("G — tegenlezing", modus === "kritisch" ? 9000 : 6000, cfg.bewijsTekens + 20000);
  const som = aanroepen.every((a) => a.maxUsd !== null) ? aanroepen.reduce((s, a) => s + (a.maxUsd ?? 0), 0) : null;
  return {
    aanroepen: st.actief ? aanroepen : [],
    totaalMaxUsd: st.actief ? som : 0,
    budgetUsd: i.budgetPerOnderzoekUsd,
    aiActief: st.actief,
    reden: st.reden,
    model: st.model,
    toelichting: st.actief
      ? "Bovengrens: alle invoer (1 token per 2 tekens) plus het volledige uitvoermaximum per aanroep. Werkelijke kosten zijn meestal lager en worden per stap vastgelegd."
      : "Zonder AI-aanbieder: geen AI-kosten. Tekstanalyse, bronzoeken en dossier werken wel; interpretatiestappen worden overgeslagen.",
  };
}

export function maakOnderzoek(d: DatabaseSync, vraag: string, modus: Modus, opties: OnderzoeksOpties, project: string | null): string {
  const i = leesInstellingen(d);
  const id = nieuwOnderzoekId();
  const budget = Math.max(0, Math.min(opties.budgetUsd ?? i.budgetPerOnderzoekUsd, 50));
  d.prepare("INSERT INTO onderzoeken (id, project, vraag, opties, modus, status, budget_usd, raming, gemaakt, gewijzigd) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    id, project, vraag.slice(0, 8000), JSON.stringify(opties), modus, "wachtrij", budget, JSON.stringify(raming(d, modus)), nu(), nu(),
  );
  for (const s of STAPPEN) d.prepare("INSERT INTO onderzoek_stappen (onderzoek, stap, status) VALUES (?,?, 'wacht')").run(id, s.id);
  return id;
}

const lopend = new Set<string>();

export function isLopend(id: string) {
  return lopend.has(id);
}

function ctxVoor(d: DatabaseSync, id: string, extra?: string): RunCtx {
  const o = d.prepare("SELECT * FROM onderzoeken WHERE id = ?").get(id) as { vraag: string; modus: Modus; opties: string; budget_usd: number };
  return { d, id, vraag: o.vraag, modus: o.modus, opties: json<OnderzoeksOpties>(o.opties, {}), instellingen: leesInstellingen(d), budgetUsd: o.budget_usd, extra };
}

async function voerStapUit<T>(d: DatabaseSync, id: string, stap: StapId, fn: () => Promise<T> | T): Promise<T> {
  d.prepare("INSERT OR IGNORE INTO onderzoek_stappen (onderzoek, stap, status) VALUES (?,?, 'wacht')").run(id, stap);
  d.prepare("UPDATE onderzoek_stappen SET status = 'bezig', gestart = ?, fout = NULL WHERE onderzoek = ? AND stap = ?").run(nu(), id, stap);
  d.prepare("UPDATE onderzoeken SET status = ?, gewijzigd = ? WHERE id = ?").run(`bezig:${stap}`, nu(), id);
  try {
    const uit = await fn();
    const fout = (uit as { aiFout?: string | null })?.aiFout ?? null;
    d.prepare("UPDATE onderzoek_stappen SET status = ?, uitvoer = ?, klaar = ?, fout = ?, versie = versie + 1 WHERE onderzoek = ? AND stap = ?").run(
      fout ? "klaar_zonder_ai" : "klaar", JSON.stringify(uit), nu(), fout, id, stap,
    );
    return uit;
  } catch (e) {
    d.prepare("UPDATE onderzoek_stappen SET status = 'fout', fout = ?, klaar = ? WHERE onderzoek = ? AND stap = ?").run((e as Error).message, nu(), id, stap);
    throw e;
  } finally {
    const kosten = (d.prepare("SELECT COALESCE(SUM(kosten_usd),0) s FROM ai_gebruik WHERE onderzoek = ?").get(id) as { s: number }).s;
    d.prepare("UPDATE onderzoeken SET kosten_usd = ? WHERE id = ?").run(kosten, id);
  }
}

export async function voerUit(d: DatabaseSync, id: string): Promise<void> {
  if (lopend.has(id)) return;
  lopend.add(id);
  try {
    const c = ctxVoor(d, id);
    const a = await voerStapUit(d, id, "A", () => stapA(c));
    let motieven: UitvoerC["motieven"] = null;
    if (a.focus) {
      const { motiefanalyse } = await import("../scripture/motieven");
      motieven = motiefanalyse(d, a.focus.start, a.focus.eind);
    }
    const b = await voerStapUit(d, id, "B", () => stapB(c, a, motieven));
    const cU = await voerStapUit(d, id, "C", () => stapC(c, a, b));
    const dU = await voerStapUit(d, id, "D", () => stapD(c, cU, a));
    const e = await voerStapUit(d, id, "E", () => stapE(c, a, dU));
    const v = await voerStapUit(d, id, "V", () => stapVUitvoeren(c, a, cU, e));
    const f = await voerStapUit(d, id, "F", () => stapF(c, a, cU, e));
    bewaarBeweringen(c, e, f, cU, v);
    await voerStapUit(d, id, "G", () => stapG(c, a, dU, cU));
    await voerStapUit(d, id, "H", () => ({ samengesteld: nu() }));
    d.prepare("UPDATE onderzoeken SET status = 'klaar', gewijzigd = ? WHERE id = ?").run(nu(), id);
  } catch (e) {
    d.prepare("UPDATE onderzoeken SET status = 'fout', fout = ?, gewijzigd = ? WHERE id = ?").run((e as Error).message, nu(), id);
  } finally {
    lopend.delete(id);
  }
}

/** Eén stap opnieuw uitvoeren (eventueel met een verdiepingsvraag), plus de stappen die ervan afhangen. */
export async function herhaalStap(d: DatabaseSync, id: string, stap: StapId, extra?: string): Promise<void> {
  if (lopend.has(id)) throw new Error("Dit onderzoek loopt nog.");
  lopend.add(id);
  try {
    const c = ctxVoor(d, id, extra);
    const a = stap === "A" ? await voerStapUit(d, id, "A", () => stapA(c)) : stapUitvoer<UitvoerA>(d, id, "A")!;
    let b = stapUitvoer<UitvoerB>(d, id, "B")!;
    let cU = stapUitvoer<UitvoerC>(d, id, "C")!;
    let dU = stapUitvoer<UitvoerD>(d, id, "D");
    let e = stapUitvoer<UitvoerE>(d, id, "E")!;
    const volgorde: StapId[] = ["A", "B", "C", "D", "E", "V", "F", "G", "H"];
    const vanaf = volgorde.indexOf(stap);
    if (vanaf <= 1) b = await voerStapUit(d, id, "B", () => stapB(c, a, cU?.motieven ?? null));
    if (vanaf <= 2) cU = await voerStapUit(d, id, "C", () => stapC(c, a, b));
    if (vanaf <= 3) dU = await voerStapUit(d, id, "D", () => stapD(c, cU, a));
    if (vanaf <= 4) e = await voerStapUit(d, id, "E", () => stapE(c, a, dU));
    const v = vanaf <= 5 ? await voerStapUit(d, id, "V", () => stapVUitvoeren(c, a, cU, e)) : stapUitvoer<UitvoerV>(d, id, "V");
    const f = vanaf <= 6 ? await voerStapUit(d, id, "F", () => stapF(c, a, cU, e)) : stapUitvoer<UitvoerF>(d, id, "F")!;
    if (vanaf <= 6) bewaarBeweringen(c, e, f, cU, v);
    await voerStapUit(d, id, "G", () => stapG(c, a, dU, cU));
    await voerStapUit(d, id, "H", () => ({ samengesteld: nu() }));
    d.prepare("UPDATE onderzoeken SET status = 'klaar', gewijzigd = ? WHERE id = ?").run(nu(), id);
  } catch (e) {
    d.prepare("UPDATE onderzoeken SET status = 'fout', fout = ?, gewijzigd = ? WHERE id = ?").run((e as Error).message, nu(), id);
  } finally {
    lopend.delete(id);
  }
}

export function verwijderOnderzoek(d: DatabaseSync, id: string) {
  d.prepare("DELETE FROM onderzoeken WHERE id = ?").run(id);
}
