// Bronselectie: een uitlegbare relevantiescore per gevonden bron, zodat de analyse de júiste bronnen krijgt.
// Uitgangspunten (opdracht §6): een echte passage weegt zwaarder dan een catalogusvermelding; een artikel dat werkelijk
// over het gedeelte gaat, weegt zwaarder dan een algemeen artikel; zonder aantoonbaar verband met het gedeelte telt een
// bron niet mee in de analyse (wel zichtbaar in de bronnenlijst).
import { BOEK_PER_NR, ontleedVkey } from "../scripture/books";
import { grenzen, type BijbelRef } from "../scripture/reference";
import type { Motiefanalyse } from "../scripture/motieven";

export interface Kenmerken {
  boekNamen: string[]; // NL + EN
  hoofdstuk: number | null;
  verwanteHoofdstukken: number[];
  termen: string[]; // eigennamen, motieven, thema (genormaliseerd)
}

export interface Relevantie {
  score: number; // 0..1
  niveau: 0 | 1 | 2 | 3;
  redenen: string[];
  verbandMetGedeelte: boolean;
}

const STOP = new Set(["terug", "naar", "voor", "over", "ik", "de", "het", "een", "van", "met", "die", "dat", "and", "the", "with", "from", "into", "this", "that", "doopdienst", "preek", "dienst", "thema", "welke", "zijn", "relevant"]);

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function kenmerken(focus: BijbelRef | null, thema: string | null, m: Motiefanalyse | null): Kenmerken {
  if (!focus) return { boekNamen: [], hoofdstuk: null, verwanteHoofdstukken: [], termen: (thema ?? "").split(/\s+/).map(norm).filter((w) => w.length > 3 && !STOP.has(w)) };
  const a = ontleedVkey(grenzen(focus)[0]);
  const termen = new Set<string>();
  for (const e of m?.eigennamen ?? []) for (const w of e.glosse.split(/[\s/,;:]+/)) if (w.length > 2) termen.add(norm(w));
  for (const mo of m?.motieven.filter((x) => x.zeldzaamheid !== "gewoon").slice(0, 6) ?? []) {
    const g = norm(mo.lemma.glosse.replace(/^to /, "").split(/[:;,]/)[0]).trim();
    if (g.length > 3) termen.add(g);
  }
  for (const w of (thema ?? "").split(/\s+/).map(norm)) if (w.length > 3 && !STOP.has(w)) termen.add(w.replace(/[^\p{L}]/gu, ""));
  // Nederlandse spelling van de belangrijkste namen
  const nl: Record<string, string> = { jacob: "jakob", bethel: "betel", leah: "lea", esau: "ezau" };
  for (const t of [...termen]) if (nl[t]) termen.add(nl[t]);
  const verwant = [...new Set((m?.interteksten ?? []).filter((x) => x.zelfdeBoek).map((x) => ontleedVkey(x.start).hoofdstuk))];
  return { boekNamen: [a.boek.nl, a.boek.en].map(norm), hoofdstuk: a.hoofdstuk, verwanteHoofdstukken: verwant, termen: [...termen].filter(Boolean) };
}

export function relevantie(
  b: { titel: string; samenvatting?: string | null; brontype: string; toegang: string },
  k: Kenmerken,
): Relevantie {
  const tekst = norm(`${b.titel} ${b.samenvatting ?? ""}`);
  const redenen: string[] = [];
  let score = 0;
  let verband = false;

  const boekGenoemd = k.boekNamen.some((n) => tekst.includes(n));
  if (boekGenoemd && k.hoofdstuk) {
    const hfst = new RegExp(`(${k.boekNamen.join("|")})\\.?\\s*${k.hoofdstuk}\\b`);
    if (hfst.test(tekst)) {
      score += 0.4;
      redenen.push(`noemt het gedeelte zelf (hoofdstuk ${k.hoofdstuk})`);
      verband = true;
    } else if (k.verwanteHoofdstukken.some((h) => new RegExp(`(${k.boekNamen.join("|")})\\.?\\s*${h}\\b`).test(tekst))) {
      score += 0.25;
      redenen.push("noemt een verwant hoofdstuk");
      verband = true;
    } else {
      score += 0.1;
      redenen.push("noemt het Bijbelboek");
    }
  }
  const treffers = k.termen.filter((t) => t.length > 2 && new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(tekst));
  if (treffers.length) {
    score += Math.min(0.35, 0.12 * treffers.length);
    redenen.push(`kernwoorden: ${treffers.slice(0, 5).join(", ")}`);
    if (treffers.length >= 2 || boekGenoemd) verband = true;
  }
  if (b.toegang === "volledige tekst" || b.toegang === "transcript") {
    score += 0.15;
    redenen.push("inhoud beschikbaar");
  } else if (b.toegang === "abstract") {
    score += 0.05;
    redenen.push("alleen abstract");
  } else redenen.push("alleen catalogusgegevens");
  if (/commentaar|proefschrift|kanttekening/.test(b.brontype)) score += 0.1;
  else if (/artikel/.test(b.brontype)) score += 0.05;

  if (!verband) {
    score = Math.min(score, 0.15);
    redenen.unshift("geen aantoonbaar verband met het gedeelte");
  }
  score = Math.round(Math.min(1, score) * 100) / 100;
  const niveau = (score >= 0.6 ? 3 : score >= 0.4 ? 2 : score >= 0.2 ? 1 : 0) as Relevantie["niveau"];
  return { score, niveau, redenen, verbandMetGedeelte: verband };
}

/** Kies bronnen voor de analyse: hoogste score eerst, maar afwisselend per bron/type zodat niet één perspectief domineert. */
export function diverseVolgorde<T extends { score: number; groep: string }>(items: T[]): T[] {
  const perGroep = new Map<string, T[]>();
  for (const i of [...items].sort((a, b) => b.score - a.score)) (perGroep.get(i.groep) ?? perGroep.set(i.groep, []).get(i.groep)!).push(i);
  const uit: T[] = [];
  while ([...perGroep.values()].some((l) => l.length)) for (const l of perGroep.values()) if (l.length) uit.push(l.shift()!);
  return uit;
}

export function boekLabel(focus: BijbelRef | null): string {
  if (!focus) return "";
  return BOEK_PER_NR.get(Math.floor(focus.start / 1_000_000))?.nl ?? "";
}
