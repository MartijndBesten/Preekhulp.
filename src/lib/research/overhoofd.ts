// "Wat zie ik over het hoofd?" — een controle op blinde vlekken in een afgerond dossier.
// Deel 1 (gratis, altijd): deterministische controles op het dossier zelf. Elke bevinding wijst naar concrete
//   verzen, verbanden of bronnen; niets wordt verzonnen. Het zijn signalen om te toetsen, geen oordelen.
// Deel 2 (optioneel, betaald): één AI-ronde op de gevonden signalen en het bewijsmateriaal, alleen na een expliciete
//   klik, met raming vooraf en binnen het onderzoeksbudget. Verwijzingen worden gecontroleerd zoals elke bewering.
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { json, nu } from "../db";
import { aanbiederStatus, ramingUsd } from "../ai";
import { labelReeks, verzen } from "../scripture/data";
import { laadDossier, type Dossier } from "../reports/dossier";
import { bewijsMap, bewijsRijen } from "./bewijs";
import { ctxVoor } from "./runner";
import { ai, BASIS_SYSTEEM, bewijsVoorLabels } from "./stappen";
import { Verwijzing } from "./types";
import { controleer, NIVEAUS, type Niveau } from "../verification/claims";
import { DATA_NIET_INSTRUCTIE } from "../ai";
import { vindVerwijzingenInTekst } from "../scripture/reference";
import { BOEKEN } from "../scripture/books";

const BOEKNAMEN = new Set(BOEKEN.flatMap((b) => [b.nl, b.en, ...b.aliassen]).map((n) => n.toLowerCase()));

export type Soort = "tekst" | "verband" | "thema" | "perspectief" | "bewijs" | "bronnen" | "aanname";

export interface Signaal {
  soort: Soort;
  ernst: "hoog" | "middel" | "laag";
  titel: string;
  toelichting: string;
  actie: string;
  verzen?: string[];
}

export const VLEK_SOORTEN = ["ontbrekende_context", "niet_genoemd_gedeelte", "alternatieve_interpretatie", "mogelijke_fout", "wetenschappelijk_tegenargument", "homiletische_mogelijkheid"] as const;
export const VLEK_LABEL: Record<(typeof VLEK_SOORTEN)[number], string> = {
  ontbrekende_context: "Ontbrekende context", niet_genoemd_gedeelte: "Niet genoemd Bijbelgedeelte", alternatieve_interpretatie: "Alternatieve interpretatie",
  mogelijke_fout: "Mogelijke fout", wetenschappelijk_tegenargument: "Wetenschappelijk tegenargument", homiletische_mogelijkheid: "Homiletische mogelijkheid",
};

export interface AiBlindeVlek {
  soort: (typeof VLEK_SOORTEN)[number];
  titel: string;
  waarom: string;
  wat_te_onderzoeken: string;
  niveau: Niveau;
  verwijzingen: { label: string; citaat: string | null }[];
  aangepast: string | null;
}

export interface OverHetHoofd {
  signalen: Signaal[];
  gedachte: string | null;
  ai: { moment: string; gedachte: string | null; vlekken: AiBlindeVlek[]; kostenUsd: number } | null;
  aiMogelijk: { kan: boolean; reden: string | null; ramingUsd: number | null };
}

const GEWOON = new Set(["eigenlijk", "daarom", "waarin", "waarbij", "omdat", "zodat", "terwijl", "wanneer", "andere", "anderen", "steeds", "telkens", "gemeente", "preek", "prediking", "vandaag", "mensen", "worden", "werden", "hebben", "kunnen", "moeten", "zullen", "zouden", "tekst", "verhaal", "betekent", "betekenis", "laten", "bijvoorbeeld"]);
const STOP = new Set(["terug", "naar", "voor", "over", "door", "deze", "die", "dat", "een", "het", "van", "met", "zijn", "haar", "zich", "naar", "thema"]);
const schoon = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}]/gu, "");
const stam = (w: string) => schoon(w).slice(0, 6);
/** Staat het woord (of een verbogen vorm ervan) in de tekst? Zelfde begin van 6 letters, of de ene vorm is de andere
 *  plus hooguit twee letters (ver/verre, dal/dalen). Bewust grof: een signaal, geen taalkundige analyse. */
export function inTekst(woord: string, tekstWoorden: Set<string>, tekstStammen: Set<string>): boolean {
  const w = schoon(woord);
  if (tekstStammen.has(w.slice(0, 6))) return true;
  for (const t of tekstWoorden) if (Math.min(t.length, w.length) >= 3 && Math.abs(t.length - w.length) <= 2 && (t.startsWith(w) || w.startsWith(t))) return true;
  return false;
}

/** Deterministische controles. Kost niets en raakt geen netwerk. */
export function signalen(x: Dossier, gedachte?: string | null, d?: DatabaseSync): Signaal[] {
  const uit: Signaal[] = [];
  const bewijsPer = new Map(x.bewijs.map((r) => [r.label, r]));
  // Wat het dossier in beweringen werkelijk gebruikt (vindplaatsen + teksten)
  const gebruikteLocaties = x.beweringen.flatMap((b) => b.verwijzingen.map((v) => bewijsPer.get(v.label)?.locatie ?? "")).join(" | ");
  const beweringTekst = x.beweringen.map((b) => b.tekst).join(" ");
  const verdiepingVerzen = new Set((x.v?.onderwerpen ?? []).flatMap((o) => o.verzen));
  const genoemd = (label: string) => gebruikteLocaties.includes(label) || beweringTekst.includes(label.replace(/^[^ ]+ /, ""));
  const focusLemmas = new Set(x.c?.motieven?.lemmas.map((l) => l.strong) ?? []);

  // 1. Verhaalelementen: zeldzame woorden die in het hoofdstuk terugkomen maar in het dossier niet worden besproken
  const kandidaten = (x.c?.motievenContext?.lemmas ?? [])
    .filter((l) => !focusLemmas.has(l.strong) && !l.eigennaam && l.verzenTotaal <= 80 && l.inFocus.length >= 2)
    .sort((a, b) => b.idf * b.inFocus.length - a.idf * a.inFocus.length);
  // Woorden die in precies dezelfde verzen staan (bv. 'gestreept' en 'gespikkeld') vormen één verhaalelement.
  const groepen = new Map<string, typeof kandidaten>();
  for (const l of kandidaten.slice(0, 10)) {
    if (l.inFocus.some((k) => verdiepingVerzen.has(k))) continue;
    const sleutel = [...l.inFocus].sort().join(",");
    (groepen.get(sleutel) ?? groepen.set(sleutel, []).get(sleutel)!).push(l);
  }
  for (const [, ls] of groepen) {
    const labels = ls[0].inFocus.map((k) => labelReeks(k, k));
    if (labels.some(genoemd)) continue;
    const woorden = ls.map((l) => `${l.lemma} ‘${l.glosse.replace(/^to /, "").split(/[:;,]/)[0].trim()}’`);
    uit.push({
      soort: "tekst", ernst: "middel",
      titel: `${woorden.join(" en ")} ${ls.length > 1 ? "komen" : "komt"} ${ls[0].inFocus.length}× terug in het hoofdstuk`,
      toelichting: `${ls.length > 1 ? "Zeldzame woorden" : "Een zeldzaam woord"} (${ls.map((l) => l.verzenTotaal).join("/")} verzen in de hele Bijbel) die het verhaal herhaalt in ${labels.join(", ")}. Geen enkele bewering in je dossier gaat erop in.`,
      actie: "Lees deze verzen in hun samenhang: draagt dit element bij aan de betekenis van je focustekst, of juist niet?",
      verzen: labels,
    });
    if (uit.filter((s) => s.soort === "tekst").length >= 3) break;
  }

  // 2. Sterke tekstverbanden (gedeelde zeldzame woorden) die nergens gebruikt worden
  for (const it of (x.c?.motieven?.interteksten ?? []).slice(0, 6)) {
    if (genoemd(it.label) || beweringTekst.includes(it.label)) continue;
    uit.push({
      soort: "verband", ernst: it.zelfdeBoek ? "hoog" : "middel",
      titel: `Onbenut tekstverband: ${it.label}`,
      toelichting: `Deelt zeldzame woorden met je tekst (${it.gedeeld.slice(0, 4).map((g) => `${g.lemma} ‘${g.glosse.split(/[:;,]/)[0]}’`).join(", ")}), maar wordt in geen bewering gebruikt.`,
      actie: "Ga na of het verband inhoudelijk is (zelfde gebeurtenis, belofte, plaats) of toevallig woordgebruik.",
      verzen: [it.label],
    });
    if (uit.filter((s) => s.soort === "verband").length >= 3) break;
  }
  const nt = (x.c?.motieven?.ntVerbanden ?? []).filter((n) => !genoemd(n.label)).sort((a, b) => b.stemmen - a.stemmen)[0];
  if (nt && nt.stemmen >= 10) uit.push({ soort: "verband", ernst: "laag", titel: `NT-verband niet besproken: ${nt.label}`, toelichting: `Vaak genoemd als kruisverwijzing (${nt.stemmen} stemmen bij OpenBible.info, ${nt.via === "direct" ? "direct" : `via ${nt.via}`}). Stemmen zijn een vindplaats, geen bewijs.`, actie: "Bekijk of het NT deze tekst werkelijk citeert of er alleen aan doet denken.", verzen: [nt.label] });

  // 3. Themawoorden die niet in de Bijbeltekst zelf staan
  // Woordcontrole op de volledige focus- én contexttekst in SV en BSB (het dossier bewaart de context alleen in BSB).
  const bereik = x.a?.context ?? x.a?.focus ?? null;
  const tekst = [
    ...x.bewijs.filter((r) => r.soort === "bijbeltekst" && /^tekst:/.test(r.herkomst)).map((r) => r.tekst),
    ...(d && bereik ? verzen(d, bereik.start, bereik.eind, 200).flatMap((v) => [v.teksten.SV ?? "", v.teksten.BSB ?? ""]) : []),
  ].join(" ");
  const tekstWoorden = new Set(tekst.split(/[^\p{L}]+/u).filter(Boolean).map(schoon));
  const tekstStammen = new Set([...tekstWoorden].map((t) => t.slice(0, 6)));
  const themaWoorden = [...new Set([...(x.a?.thema ?? "").split(/\s+/), ...(/doop/i.test(`${x.vraag} ${x.a?.dienst ?? ""}`) ? ["doop"] : [])].map((w) => w.replace(/[^\p{L}]/gu, "")).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase())))];
  const ontbrekend = themaWoorden.filter((w) => !inTekst(w, tekstWoorden, tekstStammen));
  if (ontbrekend.length && tekst) {
    uit.push({
      soort: "thema", ernst: "hoog",
      titel: `Themawoord${ontbrekend.length > 1 ? "en" : ""} niet in de tekst: ${ontbrekend.map((w) => `‘${w}’`).join(", ")}`,
      toelichting: `${ontbrekend.join(", ")} komt niet letterlijk voor in de focus- en contexttekst (Statenvertaling/BSB) van je dossier. Dat kan prima, maar dan is de verbinding een interpretatieve stap (bijbels-theologisch, dogmatisch of homiletisch).`,
      actie: "Benoem welke tekstgegevens die stap dragen, en of het thema de tekst volgt of erop wordt gelegd. Vergelijk bijvoorbeeld wie in de tekst belooft en wat er beloofd wordt.",
    });
  }

  // 3b. De voorlopige gedachte van de predikant naast de tekst en de tekstverbanden leggen
  if (gedachte?.trim()) {
    const genoemdeRefs = vindVerwijzingenInTekst(gedachte);
    const raakt = (label: string) => vindVerwijzingenInTekst(label).some((r) => genoemdeRefs.some((g) => g.start <= r.eind && g.eind >= r.start));
    const kandidaten = [
      ...(x.c?.motieven?.interteksten ?? []).slice(0, 5).map((it) => ({ label: it.label, waarom: `deelt zeldzame woorden met je tekst (${it.gedeeld.slice(0, 3).map((g) => g.glosse.split(/[:;,]/)[0]).join(", ")})` })),
      ...(x.c?.motieven?.ntVerbanden ?? []).filter((n) => n.stemmen >= 10).slice(0, 2).map((n) => ({ label: n.label, waarom: `vaak genoemde kruisverwijzing (${n.stemmen} stemmen)` })),
      ...(x.v?.onderwerpen ?? []).map((o) => ({ label: o.verzen.length ? labelReeks(o.verzen[0], o.verzen[o.verzen.length - 1]) : "", waarom: `verdiepingsonderwerp: ${o.titel}` })).filter((k) => k.label),
    ].filter((k) => !raakt(k.label));
    if (kandidaten.length) uit.push({ soort: "verband", ernst: "middel", titel: `Je gedachte noemt ${Math.min(5, kandidaten.length)} mogelijk relevante gedeelten niet`, toelichting: `${kandidaten.slice(0, 5).map((k) => `${k.label} — ${k.waarom}`).join("; ")}. Gevonden via gedeelde zeldzame woorden en kruisverwijzingen: sommige zijn inhoudelijk sterk, andere toevallig woordgebruik.`, actie: "Ga na of deze gedeelten je gedachte bevestigen, nuanceren of tegenspreken — en welke alleen een woord delen.", verzen: kandidaten.slice(0, 5).map((k) => k.label) });
    const woorden = [...new Set(gedachte.split(/[^\p{L}-]+/u).filter((w) => w.length >= 6 && !GEWOON.has(w.toLowerCase()) && !BOEKNAMEN.has(w.toLowerCase())))];
    const buiten = woorden.filter((w) => !inTekst(w, tekstWoorden, tekstStammen) && !ontbrekend.includes(w)).slice(0, 6);
    if (buiten.length && tekst) uit.push({ soort: "thema", ernst: "middel", titel: `Begrippen uit je gedachte die niet in de tekst staan`, toelichting: `${buiten.map((w) => `‘${w}’`).join(", ")} komen niet voor in de focus- en contexttekst (SV/BSB). Soms is dat een vertaalkwestie of een synoniem; soms leg je er een eigen kader op.`, actie: "Ga per begrip na: staat het (met een ander woord) in de tekst, of komt het uit je eigen theologische kader?" });
    const omstreden = x.beweringen.filter((b) => b.niveau === "omstreden");
    if (omstreden.length) uit.push({ soort: "bewijs", ernst: "middel", titel: `${omstreden.length} punten in je dossier zijn omstreden`, toelichting: omstreden.slice(0, 3).map((b) => `${b.id}: ${b.tekst.slice(0, 140)}`).join(" · "), actie: "Kijk of je gedachte op een van deze punten leunt; zo ja, benoem de keuze en het alternatief." });
  }

  // 4. Perspectieven en soorten bronnen
  const gelezen = x.bronnen.filter((b) => b.ladder.niveau >= 4);
  const academischGelezen = gelezen.filter((b) => /artikel|proefschrift/.test(b.brontype));
  if (!academischGelezen.length) uit.push({ soort: "perspectief", ernst: "hoog", titel: "Geen hedendaagse wetenschappelijke uitleg met volledige tekst gelezen", toelichting: `Academische bronnen in dit dossier zijn alleen als catalogus of abstract gevonden (${x.bronnen.filter((b) => /artikel|proefschrift/.test(b.brontype)).length} stuks). Moderne exegese (bv. over de redactie van de Jakobverhalen of het oud-oosterse achtergrondmateriaal) ontbreekt daardoor inhoudelijk.`, actie: "Raadpleeg een recent wetenschappelijk commentaar op Genesis (bibliotheek/PThU) en voeg relevante passages toe aan je eigen bibliotheek." });
  const alleTitels = x.bronnen.map((b) => `${b.titel} ${b.traditie ?? ""}`).join(" ");
  if (!/joods|jewish|rabbi|midrash|targum|rashi|talmud/i.test(alleTitels)) uit.push({ soort: "perspectief", ernst: "middel", titel: "Geen joodse uitlegtraditie in het dossier", toelichting: "Er is geen bron uit de joodse uitleg (Targum, Midrasj, Rasji, moderne joodse exegese) gevonden. Juist bij de aartsvaderverhalen levert die vaak andere vragen op.", actie: "Zoek gericht naar joodse uitleg van dit gedeelte; let op rechten bij vertalingen." });
  const tradities = new Set(x.bronnen.filter((b) => b.traditie).map((b) => b.traditie!.toLowerCase()));
  if (tradities.size && [...tradities].every((t) => /gereformeerd|protestant|reformed|puritein|calvin/.test(t))) uit.push({ soort: "perspectief", ernst: "middel", titel: "Alle uitleggers uit één traditie", toelichting: `Tradities in je bronnen: ${[...tradities].join(", ")}. Andere stemmen (rooms-katholiek, oosters, historisch-kritisch, joods) ontbreken.`, actie: "Leg minstens één tegenstem naast je hoofdlijn voordat je conclusies trekt." });

  // 5. Bewijskwaliteit
  const zonderTegen = x.matrix.filter((m) => ["direct_aangetoond", "onderbouwde_interpretatie"].includes(m.niveau) && !m.tegenverwijzingen.length);
  if (zonderTegen.length >= 3) uit.push({ soort: "bewijs", ernst: "middel", titel: `${zonderTegen.length} interpretaties zonder gevonden tegenargument`, toelichting: `Bijvoorbeeld ${zonderTegen.slice(0, 3).map((m) => m.claim).join(", ")}. Dat er geen tegenargument is gevonden, betekent niet dat het er niet is.`, actie: "Vraag bij de belangrijkste lijn bewust: wie leest dit anders, en waarom?" });
  const verlaagd = x.beweringen.filter((b) => b.controle?.aangepast);
  if (verlaagd.length) uit.push({ soort: "bewijs", ernst: "middel", titel: `${verlaagd.length} beweringen zijn bij controle afgewaardeerd`, toelichting: `Onder andere ${verlaagd.slice(0, 3).map((b) => `${b.id} (${b.controle.aangepast!.reden})`).join("; ")}.`, actie: "Gebruik deze beweringen niet als vaststaand; zoek eerst het ontbrekende bewijs." });
  const alleenCatalogus = x.beweringen.filter((b) => b.controle?.alleenAbstractOfMetadata);
  if (alleenCatalogus.length) uit.push({ soort: "bewijs", ernst: "hoog", titel: `${alleenCatalogus.length} beweringen steunen alleen op een abstract of catalogusgegevens`, toelichting: alleenCatalogus.slice(0, 3).map((b) => b.id).join(", "), actie: "Lees de publicatie zelf voordat je de bewering gebruikt." });

  // 6. Niet doorzochte bronnen
  const niet = (x.c?.connectors ?? []).filter((k) => ["quotum", "fout"].includes(k.status));
  if (niet.length) uit.push({ soort: "bronnen", ernst: "laag", titel: `Niet doorzocht: ${niet.map((k) => k.naam.split(" (")[0].split(" — ")[0]).join(", ")}`, toelichting: niet.map((k) => `${k.naam.split(" (")[0]}: ${k.status}${k.melding ? ` — ${k.melding.slice(0, 120)}` : ""}`).join("; "), actie: "Herhaal stap C later (of stel een gratis sleutel in) als deze bronnen voor je vraag belangrijk zijn." });

  // 7. Impliciete aannames uit de vraaganalyse
  for (const a of (x.a?.ai?.aannames ?? []).filter((a) => !a.expliciet).slice(0, 3)) uit.push({ soort: "aanname", ernst: "middel", titel: `Impliciete aanname: ${a.aanname}`, toelichting: a.waarom_toetsen, actie: "Toets deze aanname aan de tekst voordat je verder bouwt." });

  // 8. Geen tekstfocus
  if (!x.a?.focus) uit.push({ soort: "tekst", ernst: "hoog", titel: "Geen Bijbelgedeelte herkend", toelichting: "Zonder gedeelte kan Preekhulp geen tekst-, grondtaal- of contextcontrole doen.", actie: "Noem het gedeelte expliciet, bijvoorbeeld ‘Genesis 31:13’." });

  const orde = { hoog: 0, middel: 1, laag: 2 };
  return uit.sort((a, b) => orde[a.ernst] - orde[b.ernst]);
}

const SchemaOverHetHoofd = z.object({
  blinde_vlekken: z
    .array(z.object({ soort: z.enum(VLEK_SOORTEN), titel: z.string(), waarom: z.string(), wat_te_onderzoeken: z.string(), niveau: z.enum(NIVEAUS), verwijzingen: z.array(Verwijzing) }))
    .describe("Hooguit 8 werkelijk ontbrekende invalshoeken, verdeeld over de soorten; geen herhaling van wat het dossier al behandelt"),
});

const MAX_TOKENS = 4000;

function invoerVoorAi(x: Dossier, s: Signaal[], gedachte?: string | null): string {
  return `Onderzoeksvraag van de predikant: """${x.vraag}"""
${gedachte?.trim() ? `\nVoorlopige gedachte van de predikant (toets deze kritisch, bevestig haar niet automatisch): """${gedachte.trim().slice(0, 3000)}"""\n` : ""}
Het dossier behandelt nu deze beweringen (kort):
${x.beweringen.slice(0, 60).map((b) => `- ${b.id} [${b.niveau}] ${b.tekst.slice(0, 200)}`).join("\n")}

Automatisch gevonden signalen van mogelijke blinde vlekken:
${s.map((g) => `- (${g.soort}) ${g.titel}: ${g.toelichting}`).join("\n") || "- geen"}

Opdracht: wat ziet deze predikant over het hoofd${gedachte?.trim() ? " in zijn of haar voorlopige gedachte en in het dossier" : ""}? Zoek naar: ontbrekende context (literair, historisch, oud-oosters), relevante maar niet genoemde Bijbelgedeelten, alternatieve interpretaties (ook joodse en vroegchristelijke receptie), mogelijke fouten of te snelle conclusies, wetenschappelijke tegenargumenten, en nieuwe homiletische mogelijkheden die de tekst zelf aanreikt. Alleen wat ontbreekt; elk punt met verwijzing naar bewijslabels als je iets over de tekst of bronnen beweert. Zeg het eerlijk als de gedachte de tekst geweld aandoet. Geen preek.`;
}

function bewaarde(d: DatabaseSync, id: string): OverHetHoofd["ai"] {
  const r = d.prepare("SELECT uitvoer FROM onderzoek_stappen WHERE onderzoek = ? AND stap = 'W'").get(id) as { uitvoer: string } | undefined;
  return json<OverHetHoofd["ai"]>(r?.uitvoer, null);
}

export function overHetHoofd(d: DatabaseSync, id: string, gedachte: string | null = null): OverHetHoofd | null {
  const x = laadDossier(d, id);
  if (!x) return null;
  const s = signalen(x, gedachte, d);
  const c = ctxVoor(d, id);
  const st = aanbiederStatus(c.instellingen);
  const raming = st.actief ? ramingUsd(c.instellingen, BASIS_SYSTEEM.length + invoerVoorAi(x, s, gedachte).length + Math.min(60_000, 30_000), MAX_TOKENS) : null;
  return { signalen: s, gedachte, ai: bewaarde(d, id), aiMogelijk: { kan: st.actief, reden: st.reden, ramingUsd: raming } };
}

/** Optionele AI-ronde. Alleen aanroepen na een expliciete keuze van de gebruiker. */
export async function overHetHoofdMetAi(d: DatabaseSync, id: string, gedachte: string | null = null): Promise<OverHetHoofd> {
  const x = laadDossier(d, id);
  if (!x) throw new Error("Onderzoek niet gevonden");
  const s = signalen(x, gedachte, d);
  const c = ctxVoor(d, id);
  // Bewijs: de focustekst plus wat de signalen aanwijzen (verzen) en het verdiepingsmateriaal
  const verzenUitSignalen = new Set(s.flatMap((g) => g.verzen ?? []));
  const labels = bewijsRijen(d, id).filter((r) => [...verzenUitSignalen].some((v) => r.locatie.startsWith(v)) || r.herkomst.startsWith("verdieping:")).map((r) => r.label);
  // Ontbrekende verzen uit de signalen eerst als bewijs registreren, zodat de AI ze kan lezen en citeren
  const extra: string[] = [];
  for (const v of verzenUitSignalen) {
    if (labels.some((l) => bewijsRijen(d, id).find((r) => r.label === l)?.locatie.startsWith(v))) continue;
    extra.push(v);
  }
  const { registreer } = await import("./bewijs");
  const { ontleedVerwijzing } = await import("../scripture/reference");
  for (const v of extra.slice(0, 10)) for (const ref of ontleedVerwijzing(v).slice(0, 1)) for (const vs of verzen(d, ref.start, Math.min(ref.eind, ref.start + 6), 7)) if (vs.teksten.BSB) labels.push(registreer(d, id, { connector: "lokaal-bijbel", extern_id: "BSB", brontype: "bijbeltekst", titel: "Berean Standard Bible", auteurs: [], url: "https://berean.bible/", toegang: "volledige tekst", rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: "ja", licentie: "Publiek domein" } }, { soort: "bijbeltekst", locatie: `${vs.label} (BSB)`, tekst: vs.teksten.BSB }, "overhoofd"));
  const r = await ai(c, "W-over-het-hoofd", `${BASIS_SYSTEEM}\n\n${DATA_NIET_INSTRUCTIE}`, `${invoerVoorAi(x, s, gedachte)}\n\n${bewijsVoorLabels(c, labels)}`, SchemaOverHetHoofd, MAX_TOKENS);
  const bm = bewijsMap(bewijsRijen(d, id));
  const vlekken: AiBlindeVlek[] = r.data.blinde_vlekken.slice(0, 6).map((v) => {
    const k = controleer(v.niveau, v.verwijzingen, bm, v.titel);
    return { soort: v.soort, titel: v.titel, waarom: v.waarom, wat_te_onderzoeken: v.wat_te_onderzoeken, niveau: k.niveau, verwijzingen: k.verwijzingen.map((w) => ({ label: w.label, citaat: w.citaat ?? null })), aangepast: k.controle.aangepast?.reden ?? null };
  });
  const uit = { moment: nu(), gedachte, vlekken, kostenUsd: r.kostenUsd };
  d.prepare("INSERT OR REPLACE INTO onderzoek_stappen (onderzoek, stap, status, uitvoer, klaar) VALUES (?, 'W', 'klaar', ?, ?)").run(id, JSON.stringify(uit), nu());
  d.prepare("UPDATE onderzoeken SET kosten_usd = (SELECT COALESCE(SUM(kosten_usd),0) FROM ai_gebruik WHERE onderzoek = ?) WHERE id = ?").run(id, id);
  return { signalen: s, gedachte, ai: uit, aiMogelijk: { kan: true, reden: null, ramingUsd: null } };
}

