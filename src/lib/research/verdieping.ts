// Stap V — verdiepingsronde: een tweede, gerichte zoekronde op onverwachte maar relevante onderwerpen
// (bijv. Rachel en de terafim in Genesis 31). Per onderwerp: de verzen zelf, concordantie, kruisverwijzingen (ook naar
// latere hoofdstukken), historische uitleg en — als die er zijn — academische treffers. Met AI daarna één gerichte
// analyse per onderwerp. Begrensd door een vast aantal onderwerpen en zoekvragen per modus en door het AI-budget.
import type { z } from "zod";
import { ontleedVerwijzing, type BijbelRef } from "../scripture/reference";
import { commentaren, kruisverwijzingen, labelReeks, verzen } from "../scripture/data";
import { ontleedVkey } from "../scripture/books";
import { actieveConnectors } from "../sources/registry";
import type { BronRecord } from "../sources/types";
import { ANALYSE_BRON, bewijsRijen, registreer } from "./bewijs";
import { SchemaVerdieping } from "./types";
import { relevantie, kenmerken } from "./selectie";
import type { RunCtx, UitvoerA, UitvoerC, UitvoerE } from "./stappen";

export interface Onderwerp {
  titel: string;
  herkomst: "ai" | "data";
  waarom: string;
  verzen: number[];
  zoekterm: string | null;
  labels: string[];
}

export interface UitvoerV {
  onderwerpen: Onderwerp[];
  ai: z.infer<typeof SchemaVerdieping> | null;
  aiFout: string | null;
  externeZoekvragen: number;
}

export const VERDIEPING_CONFIG = {
  verkennen: { onderwerpen: 1, externeZoekvragen: 0 },
  verdiepen: { onderwerpen: 2, externeZoekvragen: 2 },
  kritisch: { onderwerpen: 3, externeZoekvragen: 3 },
} as const;

/** Kies onderwerpen: eerst die de AI-analyse voorstelt (mits met geldige Bijbelverwijzing), aangevuld met datagedreven kandidaten. */
export function kiesOnderwerpen(c: RunCtx, a: UitvoerA, cUit: UitvoerC, e: UitvoerE | null): Onderwerp[] {
  const max = VERDIEPING_CONFIG[c.modus].onderwerpen;
  const uit: Onderwerp[] = [];
  for (const v of e?.analyse?.verdieping_voorstellen ?? []) {
    const refs = v.bijbelgedeelten.flatMap((g) => ontleedVerwijzing(g)).slice(0, 4);
    if (!refs.length) continue; // zonder controleerbaar gedeelte geen zoekronde
    const vk = refs.flatMap((r) => verzen(c.d, r.start, r.eind, 12).map((x) => x.vkey));
    uit.push({ titel: v.onderwerp, herkomst: "ai", waarom: v.waarom, verzen: vk, zoekterm: v.zoektermen[0] ?? null, labels: [] });
    if (uit.length >= max) return uit;
  }
  // Datagedreven: zeldzame woorden die in het hoofdstuk herhaald worden maar níet in de focusverzen staan
  // (bv. terafim in Gen 31:19, 34, 35). Herhaling binnen het verhaal wijst op narratief gewicht.
  const focusLemmas = new Set(cUit.motieven?.lemmas.map((l) => l.strong) ?? []);
  const kandidaten = (cUit.motievenContext?.lemmas ?? [])
    .filter((l) => !focusLemmas.has(l.strong) && !l.eigennaam && l.verzenTotaal <= 60 && l.inFocus.length >= 2)
    .sort((x, y) => y.idf * y.inFocus.length - x.idf * x.inFocus.length);
  const boek = a.focus ? ontleedVkey(a.focus.start).boek : null;
  for (const l of kandidaten) {
    if (uit.length >= max) break;
    if (uit.some((o) => o.verzen.some((k) => l.inFocus.includes(k)))) continue;
    const glosse = l.glosse.replace(/^to /, "").split(/[:;,]/)[0].trim();
    uit.push({
      titel: `${l.lemma} ‘${glosse}’ (${l.inFocus.map((k) => labelReeks(k, k).split(" ").pop()).join(", ")})`,
      herkomst: "data",
      waarom: `Zeldzaam woord (${l.verzenTotaal} verzen in de hele Bijbel) dat in ${boek?.nl ?? ""} ${a.context ? ontleedVkey(a.context.start).hoofdstuk : ""} ${l.inFocus.length}× terugkomt, maar niet in de focusverzen staat.`,
      verzen: l.inFocus,
      zoekterm: boek ? `${glosse} ${boek.en} ${ontleedVkey(l.inFocus[0]).hoofdstuk}` : glosse,
      labels: [],
    });
  }
  return uit;
}

export async function stapV(c: RunCtx, a: UitvoerA, cUit: UitvoerC, e: UitvoerE | null, ai: boolean, aiAanroep: <T extends z.ZodType>(stap: string, invoer: string, schema: T, maxTokens: number) => Promise<z.infer<T>>, bewijsTekst: (labels: string[]) => string): Promise<UitvoerV> {
  const onderwerpen = kiesOnderwerpen(c, a, cUit, e);
  const { d, id } = c;
  let externeZoekvragen = 0;
  const maxExtern = c.opties.zonderExtern ? 0 : VERDIEPING_CONFIG[c.modus].externeZoekvragen;
  const ctx = { db: d, onderzoek: id, instellingen: c.instellingen };
  const academisch = actieveConnectors(ctx, (k) => k.ondersteunt.netwerk && k.kaart.categorie === "Academisch").slice(0, 2);
  const kmk = kenmerken(a.focus, a.thema, cUit.motieven);

  for (const o of onderwerpen) {
    const herkomst = `verdieping:${o.titel}`;
    const lijst = [...new Set(o.verzen)].sort((x, y) => x - y).slice(0, 8);
    // 1. de verzen zelf
    for (const v of verzen(d, lijst[0] ?? 0, lijst[lijst.length - 1] ?? 0, 40).filter((x) => lijst.includes(x.vkey))) {
      for (const vt of ["SV", "BSB"]) {
        if (!v.teksten[vt]) continue;
        o.labels.push(registreer(d, id, { connector: "lokaal-bijbel", extern_id: vt, brontype: "bijbeltekst", titel: vt === "SV" ? "Statenvertaling (1637; spelling 1888)" : "Berean Standard Bible", auteurs: [], url: null, toegang: "volledige tekst", rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: "ja" } }, { soort: "bijbeltekst", locatie: `${v.label} (${vt})`, tekst: v.teksten[vt] }, herkomst));
      }
    }
    // 2. kruisverwijzingen vanuit deze verzen (o.a. naar latere hoofdstukken) en de tekst van de sterkste twee
    const kv = lijst.flatMap((k) => kruisverwijzingen(d, k, k, 4, 6)).sort((x, y) => y.stemmen - x.stemmen).slice(0, 6);
    if (kv.length) {
      const tekst = `Kruisverwijzingen bij ${o.titel}: ${kv.map((k) => `${labelReeks(k.van, k.van)} → ${k.label} (${k.stemmen})`).join("; ")}. (OpenBible.info-stemmen: vindplaats, geen bewijs.)`;
      o.labels.push(registreer(d, id, ANALYSE_BRON, { soort: "kruisverwijzing", locatie: `kruisverwijzingen ${o.titel}`, tekst }, herkomst));
      for (const k of kv.slice(0, 2)) for (const v of verzen(d, k.naar_start, Math.min(k.naar_eind, k.naar_start + 4), 5)) {
        if (v.teksten.BSB) o.labels.push(registreer(d, id, { connector: "lokaal-bijbel", extern_id: "BSB", brontype: "bijbeltekst", titel: "Berean Standard Bible", auteurs: [], url: "https://berean.bible/", toegang: "volledige tekst", rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: "ja", licentie: "Publiek domein" } }, { soort: "bijbeltekst", locatie: `${v.label} (BSB)`, tekst: v.teksten.BSB }, herkomst));
      }
    }
    // 3. historische uitleg bij deze verzen
    for (const k of lijst) {
      for (const cm of commentaren(d, k, k, { zonderOnzeker: !c.instellingen.kerkvadersGebruiken, max: 12 })) {
        const record: BronRecord = {
          connector: "lokaal-commentaren", extern_id: cm.werk, brontype: cm.brontype as BronRecord["brontype"], titel: `${cm.auteur} — ${cm.titel}`, auteurs: [cm.auteur], jaar: cm.jaar, taal: cm.taal, traditie: cm.traditie, url: cm.bron_url, toegang: "volledige tekst",
          rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: cm.rechtenstatus.startsWith("rechten onzeker") ? "onbekend" : "ja", licentie: cm.licentie, toelichting: cm.rechtenstatus },
        };
        o.labels.push(registreer(d, id, record, { soort: "commentaar", locatie: labelReeks(cm.vkey_start, cm.vkey_eind) + (cm.sectie ? ` — ${cm.sectie}` : ""), tekst: cm.tekst, url: cm.bron_url }, herkomst));
      }
    }
    // 4. één gerichte academische zoekvraag per onderwerp (binnen het zoekbudget); alleen relevante treffers tellen
    if (o.zoekterm && externeZoekvragen < maxExtern) {
      for (const k of academisch) {
        if (externeZoekvragen >= maxExtern) break;
        externeZoekvragen++;
        try {
          const res = await k.zoek({ tekst: o.zoekterm, taal: "en", max: 5 }, ctx);
          for (const r of res) if (relevantie(r.record, kmk).niveau > 0) for (const p of r.passages.slice(0, 2)) o.labels.push(registreer(d, id, r.record, p, herkomst));
        } catch {
          /* bron tijdelijk niet beschikbaar: verdieping gaat door met lokale bronnen */
        }
      }
    }
    o.labels = [...new Set(o.labels)];
  }

  if (!ai || !onderwerpen.length) return { onderwerpen, ai: null, aiFout: ai ? null : "Zonder AI: verdiepingsronde verzamelt alleen bronnen (geen analyse).", externeZoekvragen };
  try {
    const labels = [...new Set(onderwerpen.flatMap((o) => o.labels))];
    const data = await aiAanroep(
      "V-verdieping",
      `Tijdens het onderzoek kwamen deze onderwerpen naar voren die een gerichte tweede ronde verdienen:\n${onderwerpen.map((o, i) => `${i + 1}. ${o.titel} — ${o.waarom}`).join("\n")}\n\nOnderzoek per onderwerp: waarom het in de tekst staat, wat uitleggers zeggen (met hun eigen woorden uit het bewijs), hoe het samenhangt met andere gedeelten (ook latere hoofdstukken), welke alternatieve verklaringen er zijn, en vooral: wat de tekst NIET duidelijk maakt (bijv. motieven van personen die niet worden genoemd). Onderzoeksvraag van de predikant: """${c.vraag}"""\n\n${bewijsTekst(labels)}`,
      SchemaVerdieping,
      c.modus === "kritisch" ? 9000 : 7000,
    );
    return { onderwerpen, ai: data, aiFout: null, externeZoekvragen };
  } catch (err) {
    return { onderwerpen, ai: null, aiFout: (err as Error).message, externeZoekvragen };
  }
}

export function verdiepingBewijsLabels(c: RunCtx): string[] {
  return bewijsRijen(c.d, c.id).filter((r) => r.herkomst.startsWith("verdieping:")).map((r) => r.label);
}

export type { BijbelRef };
