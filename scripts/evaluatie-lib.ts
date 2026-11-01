// Gedeelde hulpfuncties voor de Genesis 31-evaluatie. Alleen grove, uitlegbare signalen (verwijzingen en trefwoorden):
// ze zeggen dát een onderwerp aan bod komt, niet of het goed is uitgewerkt.
import type { Dossier } from "../src/lib/reports/dossier";
import { ontleedVerwijzing, vindVerwijzingenInTekst } from "../src/lib/scripture/reference";

export interface Punt {
  nr: number;
  punt: string;
  refs: string[];
  woorden: string[];
  lemmas: string[];
  soort?: "bronnen" | "tegengeluid" | "openVragen" | "nieuweLijnen";
}

export interface Signaal {
  signaal: "behandeld + bewijs" | "behandeld" | "alleen gegevens" | "genoemd" | "niet gevonden";
  details: string;
}

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const woordRe = (w: string[]) => (w.length ? new RegExp(w.map(esc).join("|"), "i") : null);

function refOverlap(tekstRefs: { start: number; eind: number }[], ref: string): boolean {
  const r = ontleedVerwijzing(ref)[0];
  return !!r && tekstRefs.some((q) => q.start <= r.eind && q.eind >= r.start);
}

/** Signaal voor een Preekhulp-dossier: bewijs (gegevens) én AI-beweringen apart geteld. */
export function signaalDossier(x: Dossier, p: Punt): Signaal {
  const ai = x.beweringen.filter((b) => b.herkomst === "ai");
  const re = woordRe(p.woorden);
  if (p.soort === "nieuweLijnen") {
    const lijnen = x.beweringen.filter((b) => b.sectie === "lijnen" || b.sectie === "verdieping");
    const geldig = lijnen.filter((b) => b.herkomst === "ai" && b.niveau !== "niet_geverifieerd");
    return { signaal: geldig.length ? "behandeld + bewijs" : lijnen.length ? "alleen gegevens" : "niet gevonden", details: `${lijnen.length} lijnen/verdiepingen (${lijnen.filter((b) => b.herkomst === "data").length} berekend, ${geldig.length} AI met geldig bewijs)` };
  }
  if (p.soort === "openVragen") {
    const n = (x.e?.analyse?.open_vragen.length ?? 0) + (x.g?.ai?.zoekvragen_tegenperspectief.length ?? 0) + (x.v?.ai?.onderwerpen.reduce((s, o) => s + o.wat_de_tekst_niet_zegt.length, 0) ?? 0);
    return { signaal: n ? "behandeld" : "niet gevonden", details: `${n} open vragen / ‘wat de tekst niet zegt’ / tegenzoekvragen` };
  }
  if (p.soort === "bronnen") {
    const comm = new Set(x.bewijs.filter((r) => r.soort === "commentaar").map((r) => r.bron_titel));
    const acad = x.bronnen.filter((b) => /artikel|proefschrift/.test(b.brontype));
    const gelezen = acad.filter((b) => b.ladder.niveau >= 4).length;
    const besproken = ai.filter((b) => b.sectie === "historisch" || b.sectie === "hedendaags").length;
    return { signaal: comm.size && besproken ? "behandeld + bewijs" : comm.size ? "alleen gegevens" : "niet gevonden", details: `${comm.size} commentaarwerken met tekst; ${acad.length} academische vermeldingen (${gelezen} met volledige tekst); ${besproken} AI-beweringen over uitleg` };
  }
  if (p.soort === "tegengeluid") {
    const tegen = x.matrix.filter((m) => m.tegenverwijzingen.length).length;
    const omstreden = x.beweringen.filter((b) => b.niveau === "omstreden").length;
    const tl = x.g?.ai?.punten.length ?? 0;
    const w = re ? ai.filter((b) => re.test(b.tekst)).length : 0;
    return { signaal: tegen + omstreden + w ? "behandeld" : tl ? "genoemd" : "niet gevonden", details: `${tegen} claims met tegenverwijzing, ${omstreden} omstreden, ${tl} punten in tegenlezing, ${w} trefwoordtreffers` };
  }
  const bewijs = new Set<string>();
  for (const ref of p.refs) {
    for (const b of x.bewijs) {
      if (!/bijbeltekst|commentaar|grondtekst|data|kruisverwijzing|transcript/.test(b.soort)) continue;
      const refs = vindVerwijzingenInTekst(b.locatie).concat(ontleedVerwijzing(b.locatie.replace(/\s*\(.*$/, "").split(" — ")[0]));
      if (refOverlap(refs, ref)) bewijs.add(b.label);
    }
  }
  for (const l of p.lemmas) x.bewijs.filter((b) => b.tekst.includes(l)).forEach((b) => bewijs.add(b.label));
  const bew = new Set<string>();
  for (const b of ai) {
    if (re && re.test(b.tekst)) bew.add(b.id);
    if (p.refs.some((r) => refOverlap(vindVerwijzingenInTekst(b.tekst), r))) bew.add(b.id);
    if (b.verwijzingen.some((v) => bewijs.has(v.label))) bew.add(b.id);
  }
  const signaal = bew.size && bewijs.size ? "behandeld + bewijs" : bew.size ? "genoemd" : bewijs.size ? "alleen gegevens" : "niet gevonden";
  return { signaal, details: `bewijs ${bewijs.size ? [...bewijs].slice(0, 6).join(", ") + (bewijs.size > 6 ? " …" : "") : "—"}; beweringen ${bew.size ? [...bew].slice(0, 6).join(", ") + (bew.size > 6 ? " …" : "") : "—"}` };
}

/** Signaal voor vrije tekst (rechtstreeks Claude-antwoord): verwijzingen en trefwoorden, zonder bewijsregister. */
export function signaalTekst(tekst: string, p: Punt): Signaal {
  const re = woordRe(p.woorden);
  const refs = vindVerwijzingenInTekst(tekst);
  const refTreffers = p.refs.filter((r) => refOverlap(refs, r));
  const woordTreffers = re ? [...new Set((tekst.match(new RegExp(re.source, "gi")) ?? []).map((w) => w.toLowerCase()))] : [];
  if (p.soort === "nieuweLijnen") return { signaal: "genoemd", details: "alleen handmatig te beoordelen (geen bewijsregister)" };
  const n = refTreffers.length + woordTreffers.length;
  return { signaal: n ? "genoemd" : "niet gevonden", details: `${refTreffers.length ? `verwijzingen: ${refTreffers.join(", ")}; ` : ""}${woordTreffers.length ? `trefwoorden: ${woordTreffers.slice(0, 6).join(", ")}` : n ? "" : "—"}` };
}

/** Deterministische pseudo-willekeur (zaad = datum), zodat de steekproef reproduceerbaar en niet uitgekozen is. */
export function steekproef<T>(lijst: T[], n: number, zaad: string): T[] {
  let h = 2166136261;
  for (const ch of zaad) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h ^= h >>> 13), (h >>> 0) / 4294967296);
  const kopie = [...lijst];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie.slice(0, n);
}

/** Zinnen in vrije tekst die een bron of vindplaats claimen (auteur, jaartal, citaat of Bijbelverwijzing). */
export function bronclaimsInTekst(tekst: string): string[] {
  const zinnen = tekst.replace(/\n+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z“"‘(])/);
  const re = /\b(volgens|according to|schrijft|writes|stelt|argues|commentaar|commentary|Calvijn|Calvin|Henry|Keil|Delitzsch|Wenham|Westermann|Hamilton|Waltke|von Rad|Sarna|Brueggemann|Gunkel|Rasji|Rashi|Midrasj|Midrash|Targum)\b|\(\d{4}\)|[“"][^”"]{8,}[”"]|\b[1-3]?\s?[A-Z][a-zë]+\.?\s\d+:\d+/;
  return zinnen.filter((z) => z.length > 30 && z.length < 600 && re.test(z));
}
