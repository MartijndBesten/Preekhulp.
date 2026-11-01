// Bijbelverwijzingen ontleden en opmaken (NL en EN), inclusief reeksen en meerdere delen.
import { BOEK_PER_NR, type Boek, ontleedVkey, vindBoek, vkey } from "./books";

export interface BijbelRef {
  boek: string; // OSIS
  start: number; // vkey; vers 0 = heel hoofdstuk-begin
  eind: number; // vkey (inclusief); vers 999 = tot einde hoofdstuk
  label: string; // opgemaakt in het Nederlands
}

const STREEP = "[-–—]";

/**
 * Ontleedt een losse verwijzing of een reeks delen voor één boek:
 * "Genesis 31:13", "Gen. 31:1-16", "Gen 31,13", "Gen 31", "Gen 31-32", "Gen 31:55-32:2",
 * "Gen 28:10-22; 35:1-15", "Joh 1:51", "1 Kor 13:4-7".
 */
export function ontleedVerwijzing(invoer: string): BijbelRef[] {
  const s = invoer.trim().replace(/\s+/g, " ");
  const m = /^((?:[1-3]|i{1,3})\s?)?(\p{L}[\p{L} ]*?)\.?\s*(\d.*)$/iu.exec(s);
  if (!m) return [];
  const boek = vindBoek(`${m[1] ?? ""}${m[2]}`);
  if (!boek) return [];
  return ontleedDelen(boek, m[3]);
}

export function ontleedDelen(boek: Boek, spec: string): BijbelRef[] {
  const refs: BijbelRef[] = [];
  const heeftDubbelePunt = spec.includes(":");
  let hoofdstuk: number | null = null;
  for (const deelRuw of spec.split(/\s*;\s*/)) {
    const deel = deelRuw.trim().replace(/[.)]+$/, "");
    if (!deel) continue;
    // Binnen een deel: komma's scheiden verzen (als er een dubbele punt is) of hoofdstuk,vers.
    const stukken = heeftDubbelePunt ? deel.split(/\s*,\s*/) : [deel];
    for (const stukRuw of stukken) {
      const stuk = heeftDubbelePunt ? stukRuw : stukRuw.replace(/^(\d+)\s*,\s*(\d+)/, "$1:$2");
      let r: RegExpExecArray | null;
      if ((r = new RegExp(`^(\\d+)\\s*:\\s*(\\d+)\\s*${STREEP}\\s*(\\d+)\\s*:\\s*(\\d+)$`).exec(stuk))) {
        hoofdstuk = Number(r[3]);
        refs.push(maak(boek, Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4])));
      } else if ((r = new RegExp(`^(\\d+)\\s*:\\s*(\\d+)(?:\\s*${STREEP}\\s*(\\d+))?[a-c]?$`).exec(stuk))) {
        hoofdstuk = Number(r[1]);
        const v1 = Number(r[2]);
        refs.push(maak(boek, hoofdstuk, v1, hoofdstuk, r[3] ? Number(r[3]) : v1));
      } else if ((r = new RegExp(`^(\\d+)(?:\\s*${STREEP}\\s*(\\d+))?[a-c]?$`).exec(stuk))) {
        if (hoofdstuk !== null && heeftDubbelePunt && stukken.length > 1 && stuk !== stukken[0]) {
          // "31:13, 19" → vers 19 in hetzelfde hoofdstuk
          const v1 = Number(r[1]);
          refs.push(maak(boek, hoofdstuk, v1, hoofdstuk, r[2] ? Number(r[2]) : v1));
        } else {
          const h1 = Number(r[1]);
          const h2 = r[2] ? Number(r[2]) : h1;
          hoofdstuk = h2;
          refs.push(maak(boek, h1, 0, h2, 999));
        }
      }
    }
  }
  return refs.filter((x) => geldig(boek, x));
}

function maak(boek: Boek, h1: number, v1: number, h2: number, v2: number): BijbelRef {
  const start = vkey(boek.nr, h1, v1);
  const eind = vkey(boek.nr, h2, v2);
  return { boek: boek.osis, start: Math.min(start, eind), eind: Math.max(start, eind), label: "" };
}

function geldig(boek: Boek, r: BijbelRef): boolean {
  const a = ontleedVkey(r.start);
  const b = ontleedVkey(r.eind);
  const ok = a.hoofdstuk >= 1 && b.hoofdstuk <= boek.hoofdstukken && (a.vers <= 200 || a.vers === 999) && (b.vers <= 200 || b.vers === 999);
  if (ok) r.label = formatteer(r);
  return ok;
}

export function formatteer(r: Pick<BijbelRef, "start" | "eind">, taal: "nl" | "en" = "nl"): string {
  const a = ontleedVkey(r.start);
  const b = ontleedVkey(r.eind);
  const naam = taal === "nl" ? a.boek.nl : a.boek.en;
  const heelHfst = (v: { vers: number }, eind: boolean) => (eind ? v.vers === 999 : v.vers === 0);
  if (heelHfst(a, false) && heelHfst(b, true)) {
    return a.hoofdstuk === b.hoofdstuk ? `${naam} ${a.hoofdstuk}` : `${naam} ${a.hoofdstuk}–${b.hoofdstuk}`;
  }
  const va = a.vers === 0 ? 1 : a.vers;
  if (a.hoofdstuk === b.hoofdstuk) {
    return va === b.vers ? `${naam} ${a.hoofdstuk}:${va}` : `${naam} ${a.hoofdstuk}:${va}–${b.vers === 999 ? "eind" : b.vers}`;
  }
  return `${naam} ${a.hoofdstuk}:${va}–${b.hoofdstuk}:${b.vers === 999 ? "eind" : b.vers}`;
}

export function vkeyLabel(k: number, taal: "nl" | "en" = "nl"): string {
  return formatteer({ start: k, eind: k }, taal);
}

/**
 * Zoekt Bijbelverwijzingen in vrije tekst ("Ik preek over Genesis 31:13 en Joh. 1:51").
 * Boeknamen moeten met een hoofdletter beginnen, zodat gewone woorden niet als boek tellen.
 */
export function vindVerwijzingenInTekst(tekst: string): BijbelRef[] {
  const resultaat: BijbelRef[] = [];
  const patroon = /(?<![\p{L}\d])((?:[1-3]|I{1,3})\s?)?(\p{Lu}[\p{L}]{1,20})\.?\s?(\d{1,3}(?:\s*[:,]\s*\d{1,3}[a-c]?)?(?:\s*[-–—]\s*\d{1,3}(?:\s*:\s*\d{1,3})?)?(?:\s*[;,]\s*\d{1,3}(?:\s*:\s*\d{1,3})?(?:\s*[-–—]\s*\d{1,3})?)*)/gu;
  for (const m of tekst.matchAll(patroon)) {
    const boek = vindBoek(`${m[1] ?? ""}${m[2]}`);
    if (!boek) continue;
    // Een los getal na een gewoon woord (bv. "Psalm 23" is wél goed, "Maart 2026" niet) — vindBoek filtert dat.
    for (const r of ontleedDelen(boek, m[3])) resultaat.push(r);
  }
  return ontdubbel(resultaat);
}

export function ontdubbel(refs: BijbelRef[]): BijbelRef[] {
  const gezien = new Set<string>();
  return refs.filter((r) => {
    const k = `${r.start}-${r.eind}`;
    if (gezien.has(k)) return false;
    gezien.add(k);
    return true;
  });
}

/** Normaliseer een reeks naar concrete verssleutels-grenzen (vers 0 → 1). */
export function grenzen(r: Pick<BijbelRef, "start" | "eind">): [number, number] {
  const a = r.start % 1000 === 0 ? r.start + 1 : r.start;
  return [a, r.eind];
}

export function boekVan(r: BijbelRef): Boek {
  return BOEK_PER_NR.get(Math.floor(r.start / 1_000_000))!;
}
