// De onderzoeksworkflow A–H. Elke stap bewaart zijn uitvoer; stappen kunnen los opnieuw draaien.
// Deterministische lagen (tekst, grondtaal, motieven, commentaren, bronzoeken) werken zonder AI;
// AI-stappen krijgen alleen gelabeld bewijsmateriaal en hun beweringen worden daarna gecontroleerd.
import type { DatabaseSync } from "node:sqlite";
import type { z } from "zod";
import { json, nieuweId, nu } from "../db";
import { AiFout, aanbiederStatus, DATA_NIET_INSTRUCTIE, promptBronnen, vraagJson } from "../ai";
import { leesInstellingen, type Instellingen } from "../settings";
import { commentaren, kruisverwijzingen, verzen, woorden, labelReeks } from "../scripture/data";
import { motiefanalyse, type Motiefanalyse } from "../scripture/motieven";
import { ontdubbel, ontleedVerwijzing, vindVerwijzingenInTekst, grenzen, type BijbelRef } from "../scripture/reference";
import { ontleedVkey, vkey } from "../scripture/books";
import { actieveConnectors } from "../sources/registry";
import { verwijzingenVoorRef, verwijzingenVoorZoekterm } from "../sources/connectors/verwijzingen";
import { youtubeZoeklink } from "../videos/youtube";
import type { BronRecord, Zoekvraag } from "../sources/types";
import { controleer, type Niveau, type Verwijzing as VerwijzingT } from "../verification/claims";
import { ANALYSE_BRON, bewijsMap, bewijsRijen, registreer, type BewijsRij } from "./bewijs";
import {
  SchemaAnalyse, SchemaBeoordeling, SchemaPerspectief, SchemaTegenlezing, SchemaVraag, SchemaZoekvragen,
  type Analyse, type BeweringT, type Modus, type OnderzoeksOpties, type StapId,
} from "./types";

export interface RunCtx {
  d: DatabaseSync;
  id: string;
  vraag: string;
  modus: Modus;
  opties: OnderzoeksOpties;
  instellingen: Instellingen;
  budgetUsd: number;
  extra?: string; // verdiepingsvraag bij het opnieuw uitvoeren van één stap
}

export const MODUS_CONFIG: Record<Modus, { externeZoekvragen: number; perConnector: number; bewijsTekens: number; inspanning: Instellingen["inspanning"] | null; ai: StapId[] }> = {
  verkennen: { externeZoekvragen: 3, perConnector: 5, bewijsTekens: 30_000, inspanning: "low", ai: ["A", "E"] },
  verdiepen: { externeZoekvragen: 8, perConnector: 8, bewijsTekens: 80_000, inspanning: null, ai: ["A", "B", "D", "E", "G"] },
  kritisch: { externeZoekvragen: 14, perConnector: 10, bewijsTekens: 140_000, inspanning: "high", ai: ["A", "B", "D", "E", "G"] },
};

export function stapUitvoer<T>(d: DatabaseSync, id: string, stap: StapId): T | null {
  const r = d.prepare("SELECT uitvoer FROM onderzoek_stappen WHERE onderzoek = ? AND stap = ?").get(id, stap) as { uitvoer: string } | undefined;
  return r ? json<T | null>(r.uitvoer, null) : null;
}

function besteed(c: RunCtx): number {
  return (c.d.prepare("SELECT COALESCE(SUM(kosten_usd),0) s FROM ai_gebruik WHERE onderzoek = ?").get(c.id) as { s: number }).s;
}

function aiBeschikbaar(c: RunCtx, stap: StapId): boolean {
  return MODUS_CONFIG[c.modus].ai.includes(stap) && aanbiederStatus(c.instellingen).actief;
}

async function ai<T extends z.ZodType>(c: RunCtx, stap: string, systeem: string, invoer: string, schema: T, maxTokens: number) {
  return vraagJson(
    c.d,
    { stap, systeem, invoer, schema, maxTokens, inspanning: MODUS_CONFIG[c.modus].inspanning ?? c.instellingen.inspanning },
    { onderzoek: c.id, resterendBudgetUsd: Math.max(0, c.budgetUsd - besteed(c)) },
  );
}

const BASIS_SYSTEEM = `Je bent een kritische, wetenschappelijk geschoolde onderzoeksassistent voor een predikant in de Protestantse Kerk in Nederland (PKN). Je schrijft geen preek; je helpt grondig, eerlijk en controleerbaar onderzoek doen.

Werkregels:
1. Feitelijke beweringen over teksten, auteurs en bronnen baseer je uitsluitend op het aangeleverde bewijsmateriaal (labels E1, E2, …). Verzin nooit boeken, auteurs, publicaties, DOI's, paginanummers, citaten of videotijdstippen.
2. Elke bewering krijgt verwijzingen naar bewijslabels. Een citaat geef je alleen als het letterlijk in dat bewijsstuk staat (kort, hooguit 25 woorden); anders citaat = null.
3. Kies per bewering eerlijk een niveau: direct_aangetoond (letterlijk in Bijbeltekst/grondtekstdata), onderbouwde_interpretatie, mogelijke_onderzoekslijn, omstreden, niet_geverifieerd. Je niveau wordt automatisch gecontroleerd en zo nodig verlaagd.
4. Onderscheid steeds: wat de tekst zelf zegt, wat latere theologie (dogmatiek, confessie, typologie) ervan maakt, en wat homiletische toepassing is.
5. Eigen analyse zonder bron mag, maar dan als mogelijke_onderzoekslijn of niet_geverifieerd, zonder te doen alsof een bron het zegt.
6. Wees kritisch, ook op de vraagsteller. Bevestig een preekgedachte niet zomaar; benoem aannames, sprongen en alternatieven.
7. Grondtaal: geen etymologische of theologische conclusies op basis van alleen een Strong-nummer; betekenissen alleen zoals in de lexicondata of met bron.
8. Bronnen met alleen een abstract of catalogusgegevens: zeg dat je alleen dat hebt gezien.
9. Schrijf in helder, zakelijk Nederlands. Hebreeuwse en Griekse woorden met transliteratie.

${DATA_NIET_INSTRUCTIE}`;

// ================================================================= A — vraag begrijpen
export interface UitvoerA {
  refs: BijbelRef[];
  focus: BijbelRef | null;
  context: BijbelRef | null;
  thema: string | null;
  dienst: string | null;
  ai: z.infer<typeof SchemaVraag> | null;
  aiFout: string | null;
  plan: string[];
}

export async function stapA(c: RunCtx): Promise<UitvoerA> {
  const refs = ontdubbel([
    ...(c.opties.bijbelgedeelte ? ontleedVerwijzing(c.opties.bijbelgedeelte).concat(vindVerwijzingenInTekst(c.opties.bijbelgedeelte)) : []),
    ...vindVerwijzingenInTekst(c.vraag),
  ]);
  const focus = refs[0] ?? null;
  let context: BijbelRef | null = null;
  if (focus) {
    const a = ontleedVkey(grenzen(focus)[0]);
    context = { boek: a.boek.osis, start: vkey(a.boek.nr, a.hoofdstuk, 1), eind: vkey(a.boek.nr, a.hoofdstuk, 999), label: `${a.boek.nl} ${a.hoofdstuk}` };
  }
  const thema = c.opties.thema || (/[‘'"“](.+?)[’'"”]/.exec(c.vraag)?.[1] ?? null);
  const dienst = c.opties.dienst || (/doopdienst|doop|avondmaal|rouwdienst|huwelijk|belijdenis|kerst|pasen|pinksteren/i.exec(c.vraag)?.[0] ?? null);
  const plan = [
    focus ? `Tekst en context van ${focus.label} (${context?.label}) lezen in SV en BSB, met grondtekst.` : "Geen Bijbelgedeelte herkend: onderzoek start vanuit het thema.",
    "Herhaalde woorden, motieven en tekstverbanden berekenen uit de grondtekstdata.",
    "Historische uitleg ophalen (Kanttekeningen, Calvijn, Matthew Henry; optioneel meer).",
    "Academische literatuur, boeken en preken/lezingen zoeken (metadata, abstracts, open access).",
    "Interpretaties vergelijken, nieuwe lijnen formuleren en kritisch tegenlezen.",
  ];
  let aiUit: UitvoerA["ai"] = null;
  let aiFout: string | null = null;
  if (aiBeschikbaar(c, "A")) {
    try {
      const r = await ai(
        c,
        "A-vraag",
        BASIS_SYSTEEM,
        `Analyseer deze onderzoeksvraag van de predikant. Leg aannames bloot (ook impliciete), onderscheid exegese/dogmatiek/homiletiek, en maak een concreet onderzoeksplan. Noem verwante Bijbelgedeelten die zeker onderzocht moeten worden.\n\nVraag: """${c.vraag}"""\nOpgegeven: ${JSON.stringify({ ...c.opties, budgetUsd: undefined })}\nHerkende gedeelten: ${refs.map((r) => r.label).join("; ") || "geen"}${c.extra ? `\nExtra verdiepingsvraag: ${c.extra}` : ""}`,
        SchemaVraag,
        3000,
      );
      aiUit = r.data;
      // Door AI voorgestelde gedeelten alleen overnemen als ze als geldige verwijzing te ontleden zijn.
      for (const s of aiUit.extra_bijbelgedeelten.slice(0, 8)) for (const r2 of ontleedVerwijzing(s)) refs.push(r2);
    } catch (e) {
      aiFout = (e as Error).message;
    }
  }
  return { refs: ontdubbel(refs), focus, context, thema, dienst, ai: aiUit, aiFout, plan: aiUit?.plan?.length ? aiUit.plan : plan };
}

// ================================================================= B — zoekvragen
export interface Zoekopdracht {
  tekst: string;
  taal: "nl" | "en";
  doel: "academisch" | "boeken" | "video" | "algemeen";
  waarom: string;
  herkomst: "regel" | "ai";
}
export interface UitvoerB {
  zoekvragen: Zoekopdracht[];
  doorverwijzingen: { bron: string; label: string; url: string; toelichting: string }[];
  aiFout: string | null;
}

function lijktOp(a: string, b: string): boolean {
  const t = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  const x = t(a);
  const y = t(b);
  const doorsnede = [...x].filter((w) => y.has(w)).length;
  return doorsnede / Math.max(1, Math.min(x.size, y.size)) >= 0.8;
}

export async function stapB(c: RunCtx, a: UitvoerA, m: Motiefanalyse | null): Promise<UitvoerB> {
  const z: Zoekopdracht[] = [];
  const voeg = (q: Zoekopdracht) => {
    if (q.tekst.trim().length < 3) return;
    if (!z.some((x) => x.taal === q.taal && x.doel === q.doel && lijktOp(x.tekst, q.tekst))) z.push(q);
  };
  if (a.focus) {
    const f = ontleedVkey(grenzen(a.focus)[0]);
    const enRef = `${f.boek.en} ${f.hoofdstuk}`;
    const kern = m?.eigennamen.map((e) => e.glosse).slice(0, 2).join(" ") ?? "";
    voeg({ tekst: `${enRef} ${kern}`.trim(), taal: "en", doel: "academisch", waarom: "Wetenschappelijke literatuur bij het hoofdstuk", herkomst: "regel" });
    voeg({ tekst: `${f.boek.en} ${f.hoofdstuk} commentary`, taal: "en", doel: "boeken", waarom: "Commentaren/boeken", herkomst: "regel" });
    voeg({ tekst: `${f.boek.en} ${f.hoofdstuk} sermon ${a.thema ?? kern}`.trim(), taal: "en", doel: "video", waarom: "Engelstalige preken", herkomst: "regel" });
    voeg({ tekst: `preek ${f.boek.nl} ${f.hoofdstuk} ${a.thema ?? ""}`.trim(), taal: "nl", doel: "video", waarom: "Nederlandstalige preken", herkomst: "regel" });
    if (m?.motieven[0]) voeg({ tekst: `${m.motieven[0].lemma.glosse} ${f.boek.en} ${kern}`, taal: "en", doel: "academisch", waarom: `Motief '${m.motieven[0].lemma.glosse}'`, herkomst: "regel" });
  }
  if (a.thema) {
    voeg({ tekst: a.thema, taal: "nl", doel: "academisch", waarom: "Thema (NL)", herkomst: "regel" });
  }
  let aiFout: string | null = null;
  if (aiBeschikbaar(c, "B")) {
    try {
      const r = await ai(
        c,
        "B-zoekvragen",
        BASIS_SYSTEEM,
        `Ontwikkel ${MODUS_CONFIG[c.modus].externeZoekvragen + 4} gevarieerde, gerichte zoekvragen voor academische databanken (OpenAlex/Crossref/DOAJ), boekcatalogi en YouTube. Geen bijna-identieke varianten. Mix: Nederlands en Engels, Bijbelverwijzingen, historische auteurs, vakterminologie (ook Hebreeuws/Grieks getranslitereerd), alternatieve benamingen, verwante teksten, kritische tegenperspectieven (andere tradities, historisch-kritisch, joodse uitleg), en preken/lezingen.\n\nOnderzoeksvraag: """${c.vraag}"""\nGedeelten: ${a.refs.map((r) => r.label).join("; ")}\nKernwoorden uit de grondtekst: ${m?.motieven.slice(0, 8).map((x) => `${x.lemma.lemma} (${x.lemma.glosse})`).join(", ") ?? "-"}\nTekstverbanden: ${m?.interteksten.slice(0, 5).map((x) => x.label).join(", ") ?? "-"}`,
        SchemaZoekvragen,
        2500,
      );
      for (const q of r.data.zoekvragen) voeg({ ...q, herkomst: "ai" });
    } catch (e) {
      aiFout = (e as Error).message;
    }
  }
  const doorverwijzingen = [
    ...(a.focus ? verwijzingenVoorRef(a.focus) : []),
    ...verwijzingenVoorZoekterm(z.find((x) => x.doel === "academisch")?.tekst ?? a.thema ?? c.vraag.slice(0, 80)),
  ];
  for (const q of z.filter((x) => x.doel === "video").slice(0, 3)) doorverwijzingen.push({ bron: "YouTube", label: `YouTube: “${q.tekst}”`, url: youtubeZoeklink(q.tekst), toelichting: "Zoeklink (zonder API-sleutel)" });
  return { zoekvragen: z, doorverwijzingen, aiFout };
}

// ================================================================= C — bronnen verzamelen
export interface UitvoerC {
  motieven: Motiefanalyse | null;
  motievenContext: Motiefanalyse | null;
  connectors: { id: string; naam: string; status: "ok" | "fout" | "overgeslagen"; resultaten: number; melding: string | null }[];
  externeBronnen: string[]; // bron-id's
  dataBeweringen: { tekst: string; labels: string[] }[];
}

export async function stapC(c: RunCtx, a: UitvoerA, b: UitvoerB): Promise<UitvoerC> {
  const { d, id } = c;
  const cfg = MODUS_CONFIG[c.modus];
  const uit: UitvoerC = { motieven: null, motievenContext: null, connectors: [], externeBronnen: [], dataBeweringen: [] };
  const lokaalRecord = (vt: string, naam: string, licentie: string, url: string): BronRecord => ({
    connector: "lokaal-bijbel", extern_id: vt, brontype: "bijbeltekst", titel: naam, auteurs: [], url, toegang: "volledige tekst",
    rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: "ja", licentie },
  });
  const vertaalMeta: Record<string, [string, string, string]> = {
    SV: ["Statenvertaling (1637; spelling 1888)", "CC0/publiek domein", "https://github.com/Isidore-Guild/statenvertaling"],
    BSB: ["Berean Standard Bible", "Publiek domein", "https://berean.bible/"],
  };
  const registreerVerzen = (start: number, eind: number, herkomst: string, vertalingen = ["SV", "BSB"]) => {
    for (const v of verzen(d, start, eind, 80))
      for (const vt of vertalingen)
        if (v.teksten[vt]) registreer(d, id, lokaalRecord(vt, ...vertaalMeta[vt]), { soort: "bijbeltekst", locatie: `${v.label} (${vt})`, tekst: v.teksten[vt] }, herkomst);
  };

  if (a.focus) {
    // 1. Tekst: focus (SV+BSB), context-hoofdstuk (BSB), grondtekst focus
    registreerVerzen(a.focus.start, a.focus.eind, "tekst:focus");
    if (a.context) registreerVerzen(a.context.start, a.context.eind, "tekst:context", ["BSB"]);
    const ws = woorden(d, a.focus.start, Math.min(a.focus.eind, grenzen(a.focus)[0] + 30));
    const perVers = new Map<number, typeof ws>();
    for (const w of ws) (perVers.get(w.vkey) ?? perVers.set(w.vkey, []).get(w.vkey)!).push(w);
    for (const [k, lijst] of perVers)
      registreer(d, id, { ...ANALYSE_BRON, extern_id: "step-woorden", titel: "STEPBible TAHOT/TAGNT — grondtekst met lemma en morfologie", connector: "lokaal-grondtekst" }, {
        soort: "grondtekst", locatie: `${labelReeks(k, k)} (grondtekst)`,
        tekst: lijst.map((w) => `${w.vorm} = ${w.translit ?? ""} | lemma ${w.lemma ?? "-"} (${w.strong ?? "-"}) | ${w.morf_uitleg ? w.morf_uitleg.replace(/Function=/, "").slice(0, 90) : w.morf ?? "-"} | glosse: ${w.glosse ?? ""}${w.lex_glosse ? ` | lexicon: ${w.lex_glosse}` : ""}`).join("\n"),
      }, "grondtekst:focus");

    // 2. Motiefanalyse (focus en heel hoofdstuk) → databeweringen (direct aangetoond, berekend)
    uit.motieven = motiefanalyse(d, a.focus.start, a.focus.eind);
    if (a.context && (a.context.start !== a.focus.start || a.context.eind !== a.focus.eind)) uit.motievenContext = motiefanalyse(d, a.context.start, a.context.eind, { maxInterteksten: 10 });
    const boekNl = ontleedVkey(grenzen(a.focus)[0]).boek.nl;
    for (const mo of uit.motieven.motieven.filter((x) => x.zeldzaamheid !== "gewoon").slice(0, 10)) {
      const plaatsen = Object.entries(mo.perHoofdstuk).map(([h, ks]) => `${h}:${ks.map((k) => k % 1000).join(",")}`).join("; ");
      const tekst = `Het ${mo.lemma.taal === "he" ? "Hebreeuwse" : "Griekse"} lemma ${mo.lemma.lemma} (${mo.lemma.strong}, ‘${mo.lemma.glosse}’) staat in ${a.focus.label} en komt elders in ${boekNl} voor in ${plaatsen}. In de hele Bijbel: ${mo.lemma.verzenTotaal} verzen (${mo.zeldzaamheid}).`;
      const label = registreer(d, id, ANALYSE_BRON, { soort: "data", locatie: `concordantie ${mo.lemma.strong}`, tekst }, "analyse:motief");
      uit.dataBeweringen.push({ tekst, labels: [label] });
    }
    for (const it of uit.motieven.interteksten.slice(0, 8)) {
      const tekst = `${it.label} deelt met ${a.focus.label} de zeldzame lemma's: ${it.gedeeld.map((g) => `${g.lemma} (‘${g.glosse}’)`).join(", ")}. Nieuw in ${it.label} t.o.v. de focus: ${it.nieuweWoorden.map((n) => `‘${n.glosse}’`).join(", ") || "—"}.`;
      const label = registreer(d, id, ANALYSE_BRON, { soort: "data", locatie: `intertekst ${it.label}`, tekst }, "analyse:intertekst");
      uit.dataBeweringen.push({ tekst, labels: [label] });
    }
    for (const nt of uit.motieven.ntVerbanden.slice(0, 8)) {
      const tekst = `Kruisverwijzing ${labelReeks(nt.van, nt.van)} → ${nt.label} (${nt.stemmen} stemmen in OpenBible.info; populariteit, geen exegetisch oordeel)${nt.via !== "direct" ? `, gevonden via ${nt.via}` : ""}.`;
      registreer(d, id, ANALYSE_BRON, { soort: "kruisverwijzing", locatie: `kruisverwijzing ${labelReeks(nt.van, nt.van)}`, tekst }, "analyse:nt");
    }
    for (const w of uit.motieven.waarschuwingen) registreer(d, id, ANALYSE_BRON, { soort: "data", locatie: "versnummering", tekst: w }, "analyse:versnummering");

    // 3. Teksten van de sterkste tekstverbanden (SV+BSB), zodat de analyse ze kan lezen
    for (const it of uit.motieven.interteksten.filter((x) => x.zelfdeBoek).slice(0, 4)) registreerVerzen(it.start, it.eind, `tekst:intertekst`);
    for (const it of uit.motieven.interteksten.filter((x) => !x.zelfdeBoek).slice(0, 2)) registreerVerzen(it.start, it.eind, `tekst:intertekst`, ["BSB"]);
    for (const nt of uit.motieven.ntVerbanden.slice(0, 3)) registreerVerzen(nt.naar_start, nt.naar_eind, "tekst:nt", ["SV", "BSB"]);
    // Ook de bron van een tweestaps-NT-verband (bv. Gen 28:12 bij Joh 1:51)
    for (const nt of uit.motieven.ntVerbanden.slice(0, 3)) registreerVerzen(nt.van, nt.van, "tekst:nt-bron", ["SV", "BSB"]);

    // 3b. Tussenliggende hoofdstukken (verhaalverloop/chronologie tussen focus en latere tekstverbanden in hetzelfde boek)
    const f0 = ontleedVkey(grenzen(a.focus)[0]);
    // Het eerstvolgende sterke tekstverband verderop in het boek (bv. Gen 35 na Gen 31) bepaalt het eindpunt.
    const later = uit.motieven.interteksten.filter((x) => x.zelfdeBoek && ontleedVkey(x.start).hoofdstuk > f0.hoofdstuk + 1).slice(0, 3);
    const tot = later.length ? Math.min(...later.map((x) => ontleedVkey(x.start).hoofdstuk), f0.hoofdstuk + 6) : 0;
    if (tot > f0.hoofdstuk + 1) {
      const overzicht: string[] = [];
      for (let h = f0.hoofdstuk + 1; h < tot; h++) {
        const kop = c.d.prepare("SELECT DISTINCT sectie FROM commentaar WHERE werk = 'matthew-henry' AND vkey_start BETWEEN ? AND ? AND sectie IS NOT NULL ORDER BY vkey_start").all(vkey(f0.boek.nr, h, 1), vkey(f0.boek.nr, h, 999)) as { sectie: string }[];
        overzicht.push(`${f0.boek.nl} ${h}: ${kop.map((k) => k.sectie).join("; ") || "(geen kopjes)"}`);
        registreerVerzen(vkey(f0.boek.nr, h, 1), vkey(f0.boek.nr, h, 999), "tekst:tussen", ["BSB"]);
      }
      const tekst = `Tussen ${a.focus.label} en ${later.filter((x) => ontleedVkey(x.start).hoofdstuk === tot).map((x) => x.label).join(", ")} liggen ${f0.boek.nl} ${f0.hoofdstuk + 1}–${tot - 1}. Perikoopkopjes (Matthew Henry-editie; redactionele kopjes met traditionele jaartallen): ${overzicht.join(" | ")}.`;
      const label = registreer(d, id, ANALYSE_BRON, { soort: "data", locatie: `verhaalverloop ${f0.boek.nl} ${f0.hoofdstuk + 1}–${tot - 1}`, tekst }, "analyse:verloop");
      uit.dataBeweringen.push({ tekst, labels: [label] });
    }

    // 4. Kruisverwijzingen direct vanuit de focus
    for (const kv of kruisverwijzingen(d, a.focus.start, a.focus.eind, 5, 15)) {
      registreer(d, id, ANALYSE_BRON, { soort: "kruisverwijzing", locatie: `kruisverwijzing ${labelReeks(kv.van, kv.van)}`, tekst: `${labelReeks(kv.van, kv.van)} → ${kv.label} (${kv.stemmen} stemmen)` }, "kruisverwijzing:focus");
    }
  }

  // 5. Historische commentaren (lokaal): focus, context-perikoop, en de sterkste tekstverbanden in hetzelfde boek
  const commentaarRefs: [number, number, string][] = [];
  if (a.focus) commentaarRefs.push([a.focus.start, a.focus.eind, "commentaar:focus"]);
  for (const it of uit.motieven?.interteksten.filter((x) => x.zelfdeBoek).slice(0, 3) ?? []) commentaarRefs.push([it.start, it.eind, "commentaar:intertekst"]);
  for (const r of a.refs.slice(1, 5)) commentaarRefs.push([r.start, r.eind, "commentaar:gedeelte"]);
  for (const [s, e, herkomst] of commentaarRefs) {
    for (const cm of commentaren(d, s, e, { zonderOnzeker: !c.instellingen.kerkvadersGebruiken, max: 40 })) {
      registreer(d, id, {
        connector: "lokaal-commentaren", extern_id: cm.werk, brontype: cm.brontype as BronRecord["brontype"], titel: `${cm.auteur} — ${cm.titel}`, auteurs: [cm.auteur],
        jaar: cm.jaar, taal: cm.taal, traditie: cm.traditie, url: cm.bron_url, toegang: "volledige tekst",
        rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: cm.rechtenstatus.startsWith("rechten onzeker") ? "onbekend" : "ja", licentie: cm.licentie, toelichting: cm.rechtenstatus },
      }, { soort: "commentaar", locatie: labelReeks(cm.vkey_start, cm.vkey_eind) + (cm.sectie ? ` — ${cm.sectie}` : ""), tekst: cm.tekst, url: cm.bron_url }, herkomst);
    }
  }
  uit.connectors.push({ id: "lokaal", naam: "Lokale tekst, grondtekst, kruisverwijzingen en commentaren", status: "ok", resultaten: commentaarRefs.length, melding: null });

  // 6. Externe en overige connectors
  const ctx = { db: d, onderzoek: id, instellingen: c.instellingen };
  const extern = c.opties.zonderExtern ? [] : actieveConnectors(ctx, (k) => k.ondersteunt.netwerk);
  const alle = actieveConnectors({ ...ctx, instellingen: { ...c.instellingen, uitgeschakeldeConnectors: [] } }, () => true);
  for (const k of [...alle.filter((x) => x.ondersteunt.netwerk && !extern.includes(x))]) {
    uit.connectors.push({ id: k.kaart.id, naam: k.kaart.naam, status: "overgeslagen", resultaten: 0, melding: c.opties.zonderExtern ? "Alleen lokale bronnen gekozen" : "Uitgeschakeld in Instellingen" });
  }
  const { CONNECTORS } = await import("../sources/registry");
  for (const k of CONNECTORS.filter((x) => x.ondersteunt.netwerk && x.nietBeschikbaar(ctx))) {
    uit.connectors.push({ id: k.kaart.id, naam: k.kaart.naam, status: "overgeslagen", resultaten: 0, melding: k.nietBeschikbaar(ctx) });
  }

  const zoekvragen = b.zoekvragen.slice(0, cfg.externeZoekvragen + 2);
  const taken: Promise<void>[] = [];
  for (const k of extern) {
    const relevant = k.kaart.id === "helloao"
      ? [{ tekst: a.focus?.label ?? "", taal: "en" as const, doel: "boeken" as const, waarom: "", herkomst: "regel" as const }]
      : zoekvragen.filter((q) =>
          k.kaart.categorie === "Video en preken" ? q.doel === "video"
          : k.kaart.categorie === "Academisch" ? q.doel === "academisch" || q.doel === "algemeen"
          : k.kaart.categorie === "Historische commentaren en boeken" ? q.doel === "boeken" || q.doel === "algemeen"
          : false,
        ).slice(0, Math.max(1, Math.ceil(cfg.externeZoekvragen / 2)));
    if (!relevant.length || (k.kaart.id === "helloao" && !a.focus)) continue;
    taken.push(
      (async () => {
        let n = 0;
        let melding: string | null = null;
        for (const q of relevant) {
          try {
            const zv: Zoekvraag = { tekst: q.tekst, taal: q.taal, refs: a.focus ? [a.focus] : [], max: cfg.perConnector };
            const res = await k.zoek(zv, ctx);
            for (const r of res) {
              for (const p of r.passages.slice(0, 6)) registreer(d, id, r.record, p, `${k.kaart.id}:${q.tekst}`);
              n++;
            }
          } catch (e) {
            melding = (e as Error).message;
          }
        }
        uit.connectors.push({ id: k.kaart.id, naam: k.kaart.naam, status: melding && !n ? "fout" : "ok", resultaten: n, melding });
      })(),
    );
  }
  await Promise.all(taken);

  // 7. Eigen documenten (FTS) — privé: wel in het dossier, alleen naar AI als dat is toegestaan
  const docZoek = [a.thema, ...(a.refs.map((r) => r.label)), c.vraag.slice(0, 120)].filter(Boolean).join(" ");
  const { eigenDocumenten } = await import("../sources/connectors/lokaal");
  try {
    const res = await eigenDocumenten.zoek({ tekst: docZoek, max: 10 }, ctx);
    for (const r of res) for (const p of r.passages) registreer(d, id, r.record, p, "eigen-documenten");
    uit.connectors.push({ id: "eigen-documenten", naam: "Eigen bibliotheek", status: "ok", resultaten: res.length, melding: null });
  } catch (e) {
    uit.connectors.push({ id: "eigen-documenten", naam: "Eigen bibliotheek", status: "fout", resultaten: 0, melding: (e as Error).message });
  }

  uit.externeBronnen = (d.prepare("SELECT DISTINCT b.id FROM onderzoek_bronnen ob JOIN bronnen b ON b.id = ob.bron WHERE ob.onderzoek = ? AND b.connector NOT IN ('lokaal-bijbel','lokaal-grondtekst','lokaal-commentaren','analyse','eigen-documenten')").all(id) as { id: string }[]).map((r) => r.id);
  return uit;
}

// ================================================================= D — bronnen beoordelen
export interface UitvoerD {
  beoordelingen: Record<string, { relevantie: number | null; perspectief: string; waarom: string; door: "ai" | "regel" }>;
  verdeling: { brontypes: Record<string, number>; tradities: Record<string, number>; talen: Record<string, number>; perioden: Record<string, number>; toegang: Record<string, number> };
  waarschuwingen: string[];
  aiFout: string | null;
}

export async function stapD(c: RunCtx, cUit: UitvoerC): Promise<UitvoerD> {
  const bronnen = c.d
    .prepare(`SELECT DISTINCT b.id, b.titel, b.brontype, b.traditie, b.taal, b.jaar, b.toegang, b.samenvatting, b.auteurs, b.connector
              FROM onderzoek_bronnen ob JOIN bronnen b ON b.id = ob.bron WHERE ob.onderzoek = ?`)
    .all(c.id) as { id: string; titel: string; brontype: string; traditie: string | null; taal: string | null; jaar: string | null; toegang: string; samenvatting: string | null; auteurs: string; connector: string }[];
  const tel = (f: (b: (typeof bronnen)[number]) => string) => bronnen.reduce<Record<string, number>>((acc, b) => ((acc[f(b)] = (acc[f(b)] ?? 0) + 1), acc), {});
  const periode = (j: string | null) => {
    const n = Number(String(j ?? "").slice(0, 4));
    if (!n) return "onbekend";
    if (n < 1500) return "vóór 1500";
    if (n < 1800) return "1500–1800";
    if (n < 1950) return "1800–1950";
    if (n < 2000) return "1950–2000";
    return "na 2000";
  };
  const verdeling = {
    brontypes: tel((b) => b.brontype),
    tradities: tel((b) => b.traditie ?? "onbekend"),
    talen: tel((b) => b.taal ?? "onbekend"),
    perioden: tel((b) => periode(b.jaar)),
    toegang: tel((b) => b.toegang),
  };
  const waarschuwingen: string[] = [];
  const extern = bronnen.filter((b) => cUit.externeBronnen.includes(b.id));
  if (!extern.length) waarschuwingen.push("Geen externe (academische/moderne) bronnen gevonden of geraadpleegd: de uitleg leunt op historische commentaren en tekstdata. Moderne wetenschappelijke discussie ontbreekt.");
  if (extern.length && extern.every((b) => b.toegang !== "volledige tekst")) waarschuwingen.push("Van de moderne bronnen zijn alleen metadata/abstracts gezien; hun inhoud is niet gelezen.");
  const trad = Object.keys(verdeling.tradities).filter((t) => t !== "onbekend");
  if (trad.length && trad.every((t) => /gereformeerd|puriteins|presbyter|protestant/i.test(t))) waarschuwingen.push("Alle commentaren met bekende traditie zijn protestants/gereformeerd. Katholieke, orthodoxe, joodse en historisch-kritische perspectieven zijn niet vertegenwoordigd.");
  if (!bronnen.some((b) => b.brontype === "preek/lezing (video)")) waarschuwingen.push("Geen preken of lezingen met inhoud beschikbaar (YouTube-sleutel of aangeleverd transcript nodig).");

  const beoordelingen: UitvoerD["beoordelingen"] = {};
  for (const b of extern) beoordelingen[b.id] = { relevantie: null, perspectief: b.traditie ?? "onbekend", waarom: "Nog niet beoordeeld", door: "regel" };

  let aiFout: string | null = null;
  if (extern.length && aiBeschikbaar(c, "D")) {
    const lijst = extern.slice(0, 40);
    try {
      const r = await ai(
        c,
        "D-beoordeling",
        BASIS_SYSTEEM,
        `Beoordeel de relevantie (0 = niet, 3 = zeer) van deze gevonden bronnen voor de onderzoeksvraag, uitsluitend op basis van titel/abstract/beschrijving. Een academische bron is niet automatisch juist; een confessionele niet automatisch onbetrouwbaar. Geef het perspectief alleen als het uit de gegevens blijkt.\n\nOnderzoeksvraag: """${c.vraag}"""\n\n${promptBronnen(lijst.map((b, i) => ({ label: `B${i + 1}`, type: b.brontype, herkomst: b.connector, tekst: `${b.titel} — ${JSON.parse(b.auteurs).join(", ")} (${b.jaar ?? "?"})\n${(b.samenvatting ?? "[geen abstract]").slice(0, 1200)}` })))}`,
        SchemaBeoordeling,
        3500,
      );
      for (const x of r.data.beoordelingen) {
        const b = lijst[Number(x.bron.replace(/\D/g, "")) - 1];
        if (b) beoordelingen[b.id] = { relevantie: x.relevantie, perspectief: x.perspectief, waarom: x.waarom, door: "ai" };
      }
    } catch (e) {
      aiFout = (e as Error).message;
    }
  }
  for (const [bid, v] of Object.entries(beoordelingen)) c.d.prepare("UPDATE onderzoek_bronnen SET beoordeling = ? WHERE onderzoek = ? AND bron = ?").run(JSON.stringify(v), c.id, bid);
  return { beoordelingen, verdeling, waarschuwingen, aiFout };
}

// ================================================================= E/F — analyse en nieuwe lijnen
function bewijsVoorPrompt(c: RunCtx, rijen: BewijsRij[], d: UitvoerD | null): string {
  const max = MODUS_CONFIG[c.modus].bewijsTekens;
  const prioriteit = (r: BewijsRij) => {
    if (r.herkomst === "tekst:focus" || r.herkomst === "grondtekst:focus") return 0;
    if (r.herkomst.startsWith("analyse:")) return 1;
    if (r.herkomst === "commentaar:focus") return 2;
    if (r.herkomst === "tekst:tussen") return 6;
    if (r.herkomst.startsWith("tekst:")) return 3;
    if (r.herkomst.startsWith("commentaar:")) return 4;
    if (r.herkomst.startsWith("kruisverwijzing")) return 5;
    if (r.connector === "eigen-documenten") return c.instellingen.eigenDocumentenNaarAi === "fragmenten" ? 6 : 99;
    const rel = d?.beoordelingen[r.bron]?.relevantie;
    return rel === 0 ? 99 : rel != null ? 9 - rel : 7;
  };
  const gesorteerd = [...rijen].filter((r) => prioriteit(r) < 99).sort((x, y) => prioriteit(x) - prioriteit(y));
  const gekozen: { label: string; type: string; herkomst: string; tekst: string }[] = [];
  let totaal = 0;
  for (const r of gesorteerd) {
    const t = r.tekst.length > 2600 ? r.tekst.slice(0, 2600) + " […ingekort]" : r.tekst;
    if (totaal + t.length > max) continue;
    totaal += t.length;
    gekozen.push({ label: r.label, type: `${r.soort}; ${r.brontype}; toegang: ${r.toegang}`, herkomst: `${r.bron_titel} — ${r.locatie}`, tekst: t });
  }
  return promptBronnen(gekozen);
}

export interface Beweringuitvoer {
  sectie: string;
  perspectief: string | null;
  tekst: string;
  voorgesteld: Niveau;
  verwijzingen: VerwijzingT[];
}

export interface UitvoerE {
  analyse: Analyse | null;
  perspectieven: Record<string, z.infer<typeof SchemaPerspectief>> | null;
  aiFout: string | null;
}

const PERSPECTIEVEN: Record<string, string> = {
  exegeet: "Je bent de EXEGEET: literaire en historische context, grondtekst, structuur, vertaalverschillen, herhaalde woorden, narratieve ontwikkeling, canonieke verbanden en historische uitleggingen. Toets ook de chronologie van het verhaal.",
  bijbels_theoloog: "Je bent de BIJBELS THEOLOOG: thema's binnen het boek, verbanden tussen Bijbelboeken, verbond, belofte en vervulling, Gods handelen en menselijke verantwoordelijkheid, de plaats van Christus in de canon. Vermijd geforceerde typologie en ongefundeerde christologische verbanden; benoem de grenzen van elk verband.",
  dogmaticus: "Je bent de DOGMATICUS: relevante leerstellige thema's (verbond, doop, genade, verkiezing, geloof, bekering, heiliging, kerk, sacramenten, christologie). Maak duidelijk waar confessionele standpunten verschillen (gereformeerd, luthers, rooms-katholiek, baptistisch/evangelisch, oosters-orthodox) en voorkom dat de tekst iets moet zeggen wat er niet staat.",
  homileticus: "Je bent de HOMILETICUS: mogelijke hoofdgedachten, spanning in de tekst, pastorale relevantie, verbinding met de gemeente, illustratierichtingen, toepassing op verschillende levenssituaties. Schrijf GEEN preek. Toets bij elke toepassing of de tekst die draagt.",
};

export async function stapE(c: RunCtx, a: UitvoerA, d: UitvoerD | null): Promise<UitvoerE> {
  if (!aiBeschikbaar(c, "E")) return { analyse: null, perspectieven: null, aiFout: aanbiederStatus(c.instellingen).reden };
  const rijen = bewijsRijen(c.d, c.id);
  const bewijs = bewijsVoorPrompt(c, rijen, d);
  const kader = `Onderzoeksvraag: """${c.vraag}"""\nBijbelgedeelten: ${a.refs.map((r) => r.label).join("; ") || "-"}\nThema: ${a.thema ?? "-"} · Dienst: ${a.dienst ?? "-"} · Traditie gebruiker: ${c.opties.traditie ?? "PKN"} · Doelgroep: ${c.opties.doelgroep ?? "-"}\n${a.ai ? `Aannames uit stap A: ${a.ai.aannames.map((x) => x.aanname).join(" | ")}` : ""}${c.opties.preekgedachte ? `\nVoorlopige preekgedachte van de predikant (kritisch toetsen, niet bevestigen): ${c.opties.preekgedachte}` : ""}${c.extra ? `\nVerdiepingsvraag van de predikant voor deze stap: ${c.extra}` : ""}`;
  try {
    if (c.modus === "kritisch") {
      const perspectieven: Record<string, z.infer<typeof SchemaPerspectief>> = {};
      for (const [naam, rol] of Object.entries(PERSPECTIEVEN)) {
        const r = await ai(c, `E-${naam}`, `${BASIS_SYSTEEM}\n\n${rol}`, `${kader}\n\nOnderzoek vanuit jouw perspectief. Lever beweringen met bewijslabels, nieuwe onderzoekslijnen (met exegetische sterkte) en open vragen.\n\n${bewijs}`, SchemaPerspectief, 8000);
        perspectieven[naam] = r.data;
      }
      const samen = Object.entries(perspectieven).map(([n, p]) => `## ${n}\n${p.beweringen.map((b) => `- [${b.niveau}] ${b.tekst} (${b.verwijzingen.map((v) => v.label).join(", ")})`).join("\n")}`).join("\n\n");
      const r = await ai(c, "E-vergelijking", BASIS_SYSTEEM, `${kader}\n\nHieronder de bevindingen van vier afzonderlijke perspectieven. Vergelijk ze met het bewijsmateriaal: waar is overeenstemming, waar verschillen uitleggers (met argumenten), welke grondtekstgegevens zijn doorslaggevend, wat zegt de tekst zelf versus later ontwikkelde theologie, en welke vragen blijven open. Vul alle velden; neem de sterkste beweringen per perspectief over in de juiste velden.\n\n${samen}\n\n${bewijs}`, SchemaAnalyse, 14000);
      return { analyse: r.data, perspectieven, aiFout: null };
    }
    const r = await ai(
      c,
      "E-analyse",
      `${BASIS_SYSTEEM}\n\nWerk de rollen exegeet, bijbels theoloog, dogmaticus en homileticus gescheiden uit in de bijbehorende velden.\n${Object.values(PERSPECTIEVEN).join("\n")}`,
      `${kader}\n\nVoer een ${c.modus === "verkennen" ? "beknopte" : "grondige"} analyse uit op basis van het bewijsmateriaal. Zoek actief naar wat de predikant mogelijk over het hoofd ziet: minder opvallende figuren, herhaalde woorden, verschuivingen tussen hoofdstukken, vertaalkeuzes, achtergrond, spanning tussen Gods en menselijk handelen, NT-hernemingen en uitleg uit andere tradities. Elke nieuwe lijn krijgt een eerlijke exegetische sterkte.\n\n${bewijs}`,
      SchemaAnalyse,
      c.modus === "verkennen" ? 7000 : 16000,
    );
    return { analyse: r.data, perspectieven: null, aiFout: null };
  } catch (e) {
    return { analyse: null, perspectieven: null, aiFout: e instanceof AiFout ? e.message : `Fout: ${(e as Error).message}` };
  }
}

// ================================================================= F — nieuwe onderzoekslijnen (data + AI)
export interface LijnUit {
  titel: string;
  onderbouwing: string;
  verwijzingen: VerwijzingT[];
  sterkte: "sterk" | "matig" | "zwak";
  niveau: Niveau;
  herkomst: "data" | "ai";
}
export interface UitvoerF {
  lijnen: LijnUit[];
}

export function stapF(c: RunCtx, a: UitvoerA, cUit: UitvoerC, e: UitvoerE): UitvoerF {
  const lijnen: LijnUit[] = [];
  const rijen = bewijsRijen(c.d, c.id);
  const labelVoor = (locatie: string) => rijen.find((r) => r.locatie === locatie)?.label;
  const m = cUit.motieven;
  if (m && a.focus) {
    for (const mo of m.motieven.filter((x) => x.zeldzaamheid !== "gewoon").slice(0, 4)) {
      const l = labelVoor(`concordantie ${mo.lemma.strong}`);
      lijnen.push({
        titel: `Herhaald woord: ${mo.lemma.lemma} ‘${mo.lemma.glosse}’`,
        onderbouwing: `Dit woord (${mo.zeldzaamheid}: ${mo.lemma.verzenTotaal} verzen in de hele Bijbel) verbindt ${a.focus.label} met ${Object.keys(mo.perHoofdstuk).map((h) => `hoofdstuk ${h}`).join(", ")}. Onderzoeksvraag: functioneert het als bewust motief in de vertelling, en wat verschuift er tussen de voorkomens?`,
        verwijzingen: l ? [{ label: l, citaat: null }] : [],
        sterkte: Object.keys(mo.perHoofdstuk).length <= 3 && mo.zeldzaamheid === "zeer zeldzaam" ? "sterk" : "matig",
        niveau: "mogelijke_onderzoekslijn",
        herkomst: "data",
      });
    }
    for (const it of m.interteksten.slice(0, 5)) {
      const l = labelVoor(`intertekst ${it.label}`);
      lijnen.push({
        titel: `Tekstverband: ${it.label}`,
        onderbouwing: `Gedeelde zeldzame woorden (${it.gedeeld.map((g) => g.glosse).join(", ")}). ${it.nieuweWoorden.length ? `Wat ${it.label} toevoegt: ${it.nieuweWoorden.map((n) => n.glosse).join(", ")}.` : ""} Onderzoeksvraag: is dit een bewuste terugverwijzing of toevallige woordovereenkomst?`,
        verwijzingen: l ? [{ label: l, citaat: null }] : [],
        sterkte: it.zelfdeBoek && it.gedeeld.length >= 3 ? "sterk" : it.gedeeld.length >= 3 ? "matig" : "zwak",
        niveau: "mogelijke_onderzoekslijn",
        herkomst: "data",
      });
    }
    const nt = m.ntVerbanden[0];
    if (nt) {
      const l = labelVoor(`kruisverwijzing ${labelReeks(nt.van, nt.van)}`);
      lijnen.push({
        titel: `NT-herneming: ${labelReeks(nt.van, nt.van)} → ${nt.label}`,
        onderbouwing: `Vaak gelegd verband (${nt.stemmen} stemmen)${nt.via !== "direct" ? `, indirect via ${nt.via}` : ""}. Onderzoeksvraag: welk element wordt hernomen en waar liggen de grenzen van de vergelijking?`,
        verwijzingen: l ? [{ label: l, citaat: null }] : [],
        sterkte: "matig",
        niveau: "mogelijke_onderzoekslijn",
        herkomst: "data",
      });
    }
  }
  const aiLijnen = [...(e.analyse?.nieuwe_lijnen ?? []), ...Object.values(e.perspectieven ?? {}).flatMap((p) => p.nieuwe_lijnen)];
  for (const l of aiLijnen) lijnen.push({ ...l, verwijzingen: l.verwijzingen, herkomst: "ai" });
  return { lijnen };
}

// ================================================================= G — kritische tegenlezing
export interface UitvoerG {
  regels: string[];
  ai: z.infer<typeof SchemaTegenlezing> | null;
  aiFout: string | null;
}

export async function stapG(c: RunCtx, a: UitvoerA, dUit: UitvoerD | null, cUit: UitvoerC | null): Promise<UitvoerG> {
  const regels = [...(dUit?.waarschuwingen ?? [])];
  if (cUit?.motieven?.waarschuwingen.length) regels.push(...cUit.motieven.waarschuwingen);
  regels.push("Kruisverwijzingen en NT-verbanden zijn gebaseerd op stemmen van gebruikers (OpenBible.info): een vindplaats, geen bewijs van een bedoeld verband.");
  regels.push("Historische commentaren in deze versie zijn grotendeels Engelstalig en protestants (Calvijn, Henry) of Nederlands-gereformeerd (Kanttekeningen); hun uitleg is waardevol maar perspectiefgebonden.");
  if (a.focus && /doop/i.test(`${c.vraag} ${a.dienst ?? ""}`)) regels.push("Een doopverbinding is een dogmatische/homiletische stap: controleer welke tekstgegevens die dragen en welke traditie (kinderdoop/geloofsdoop) de verbinding legt.");

  if (!aiBeschikbaar(c, "G")) return { regels, ai: null, aiFout: aanbiederStatus(c.instellingen).reden };
  const beweringen = c.d.prepare("SELECT id, sectie, tekst, niveau, verwijzingen FROM beweringen WHERE onderzoek = ? AND herkomst = 'ai' ORDER BY sectie, volgorde").all(c.id) as { id: string; sectie: string; tekst: string; niveau: string; verwijzingen: string }[];
  if (!beweringen.length) return { regels, ai: null, aiFout: "Geen AI-beweringen om tegen te lezen." };
  const rijen = bewijsRijen(c.d, c.id);
  try {
    const r = await ai(
      c,
      "G-tegenlezing",
      `${BASIS_SYSTEEM}\n\nJe bent nu de KRITISCHE TEGENLEZER. Je zoekt interpretatiesprongen, te snelle toepassingen, onvoldoende onderbouwde dogmatische verbindingen, eenzijdige bronselectie, onjuiste citaten, verwarde chronologie, onterechte historische claims, ontbrekende tegenargumenten en bevestigingsbias. Je bent eerlijk: als iets goed onderbouwd is, zeg je dat ook.`,
      `Welke conclusies uit dit onderzoeksdossier zijn onvoldoende onderbouwd, welke relevante interpretaties ontbreken, en waar bestaat het risico dat een aantrekkelijke preekgedachte de uitleg van de Bijbeltekst bepaalt? Kijk ook naar eenzijdigheid in de bronselectie (verdeling hieronder). Verwijs naar bewerings-id's en bewijslabels.\n\nOnderzoeksvraag: """${c.vraag}"""${c.opties.preekgedachte ? `\nPreekgedachte: ${c.opties.preekgedachte}` : ""}\nBronverdeling: ${JSON.stringify(dUit?.verdeling ?? {})}\nAutomatische signalen: ${regels.join(" | ")}\n\nBeweringen:\n${beweringen.map((b) => `${b.id} [${b.sectie}; ${b.niveau}] ${b.tekst} — bewijs: ${json<{ label: string }[]>(b.verwijzingen, []).map((v) => v.label).join(", ") || "geen"}`).join("\n")}\n\n${bewijsVoorPrompt(c, rijen.filter((x) => !x.herkomst.startsWith("tekst:context")), dUit)}`,
      SchemaTegenlezing,
      c.modus === "kritisch" ? 9000 : 6000,
    );
    return { regels, ai: r.data, aiFout: null };
  } catch (e) {
    return { regels, ai: null, aiFout: (e as Error).message };
  }
}

// ================================================================= Beweringen opslaan + controleren
export function bewaarBeweringen(c: RunCtx, e: UitvoerE, f: UitvoerF, cUit: UitvoerC | null) {
  c.d.prepare("DELETE FROM beweringen WHERE onderzoek = ?").run(c.id);
  const bewijs = bewijsMap(bewijsRijen(c.d, c.id));
  let volgorde = 0;
  const ins = c.d.prepare("INSERT INTO beweringen (id, onderzoek, sectie, tekst, niveau, voorgesteld_niveau, verwijzingen, controle, herkomst, perspectief, volgorde) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  let teller = 0;
  const voeg = (sectie: string, b: BeweringT, herkomst: "ai" | "data", perspectief: string | null = null) => {
    const k = controleer(b.niveau, b.verwijzingen, bewijs);
    teller++;
    ins.run(`C${teller}`, c.id, sectie, b.tekst, k.niveau, b.niveau, JSON.stringify(k.verwijzingen), JSON.stringify(k.controle), herkomst, perspectief, volgorde++);
  };
  for (const db of cUit?.dataBeweringen ?? []) voeg(db.tekst.startsWith("Tussen ") ? "context" : "grondtaal", { tekst: db.tekst, niveau: "direct_aangetoond", verwijzingen: db.labels.map((l) => ({ label: l, citaat: null })) }, "data");
  const an = e.analyse;
  if (an) {
    const secties: [keyof Analyse, string][] = [
      ["context", "context"], ["grondtaal", "grondtaal"], ["exegese", "exegese"], ["historische_uitleg", "historisch"], ["hedendaagse_uitleg", "hedendaags"],
      ["bijbelse_theologie", "perspectieven"], ["dogmatiek", "perspectieven"], ["homiletiek", "homiletiek"], ["overeenstemming", "vergelijking"], ["tekst_vs_later", "vergelijking"],
    ];
    for (const [veld, sectie] of secties) for (const b of an[veld] as BeweringT[]) voeg(sectie, b, "ai", veld === "bijbelse_theologie" ? "bijbels theoloog" : veld === "dogmatiek" ? "dogmaticus" : null);
  }
  for (const [naam, p] of Object.entries(e.perspectieven ?? {})) for (const b of p.beweringen) voeg(naam === "homileticus" ? "homiletiek" : naam === "exegeet" ? "exegese" : "perspectieven", b, "ai", naam.replace("_", " "));
  for (const l of f.lijnen) voeg("lijnen", { tekst: `${l.titel} — ${l.onderbouwing} (exegetische sterkte: ${l.sterkte})`, niveau: l.niveau, verwijzingen: l.verwijzingen.map((v) => ({ label: v.label, citaat: v.citaat ?? null })) }, l.herkomst, null);
}

export function nieuwOnderzoekId() {
  return nieuweId("o");
}
export { nu };
export { leesInstellingen };
