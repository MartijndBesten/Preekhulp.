// Datagedreven tekstverbanden: herhaalde woorden/motieven, intertekstuele kandidaten op basis van
// gedeelde zeldzame lemma's, eigennamen, versnummeringsverschillen en (tweestaps) NT-kruisverwijzingen.
// Dit levert controleerbare feiten ("komt voor in …") — de interpretatie blijft aan de exegeet.
import type { DatabaseSync } from "node:sqlite";
import { BOEK_PER_NR, ontleedVkey } from "./books";
import { grenzen, vkeyLabel } from "./reference";
import { isInhoudswoord, kruisverwijzingen, labelReeks } from "./data";

export interface LemmaInfo {
  strong: string;
  lemma: string;
  glosse: string;
  taal: "he" | "gr";
  eigennaam: boolean;
  verzenTotaal: number;
  idf: number;
  inFocus: number[];
}

export interface Motief {
  lemma: LemmaInfo;
  inBoek: number[]; // vkeys buiten focus, zelfde boek
  perHoofdstuk: Record<string, number[]>; // "28" → verzen
  zeldzaamheid: "zeer zeldzaam" | "zeldzaam" | "gewoon";
  score: number;
}

export interface Intertekst {
  start: number;
  eind: number;
  label: string;
  gedeeld: { strong: string; lemma: string; glosse: string }[];
  score: number;
  zelfdeBoek: boolean;
  nieuweWoorden: { strong: string; lemma: string; glosse: string }[]; // zeldzame lemma's in de kandidaat die in de focus ontbreken
}

export interface NtVerband {
  via: string; // "direct" of label van tussenschakel
  van: number;
  naar_start: number;
  naar_eind: number;
  label: string;
  stemmen: number;
}

export interface Motiefanalyse {
  focus: { start: number; eind: number; label: string };
  lemmas: LemmaInfo[];
  motieven: Motief[];
  interteksten: Intertekst[];
  eigennamen: { lemma: string; glosse: string; strong: string; inBoek: number; inHoofdstuk: number }[];
  versnummering: { vkey: number; label: string; bron_ref: string }[];
  ntVerbanden: NtVerband[];
  waarschuwingen: string[];
}

const TOTAAL_VERZEN = { he: 23145, gr: 7957 }; // benadering; alleen gebruikt voor de idf-schaal

export function motiefanalyse(d: DatabaseSync, start: number, eind: number, opties: { maxInterteksten?: number } = {}): Motiefanalyse {
  const [a, b] = grenzen({ start, eind });
  const boekNr = Math.floor(a / 1_000_000);
  const boek = BOEK_PER_NR.get(boekNr)!;
  const waarschuwingen: string[] = [];

  const rijen = d
    .prepare(
      `SELECT w.vkey, w.strong_basis, w.lemma, w.taal, w.eigennaam, w.morf, COALESCE(l.glosse, w.glosse) glosse, f.verzen
       FROM woorden w JOIN lemma_freq f ON f.strong_basis = w.strong_basis
       LEFT JOIN lexicon l ON l.strong = w.strong
       WHERE w.vkey BETWEEN ? AND ?`,
    )
    .all(a, b) as { vkey: number; strong_basis: string; lemma: string; taal: "he" | "gr"; eigennaam: number; morf: string | null; glosse: string; verzen: number }[];

  if (!rijen.length) {
    waarschuwingen.push("Geen grondtekstdata voor dit gedeelte gevonden (is de data geïmporteerd?).");
  }

  const lemmas = new Map<string, LemmaInfo>();
  for (const r of rijen) {
    if (!isInhoudswoord(r.strong_basis, r.verzen, r.taal, r.morf)) continue;
    const l = lemmas.get(r.strong_basis) ?? {
      strong: r.strong_basis,
      lemma: r.lemma,
      glosse: r.glosse,
      taal: r.taal,
      eigennaam: !!r.eigennaam,
      verzenTotaal: r.verzen,
      idf: Math.log(TOTAAL_VERZEN[r.taal] / Math.max(1, r.verzen)),
      inFocus: [],
    };
    if (!l.inFocus.includes(r.vkey)) l.inFocus.push(r.vkey);
    lemmas.set(r.strong_basis, l);
  }
  const lijst = [...lemmas.values()].sort((x, y) => y.idf - x.idf);

  // Herhaalde woorden in hetzelfde boek
  const motieven: Motief[] = [];
  const stmtBoek = d.prepare("SELECT DISTINCT vkey FROM woorden WHERE strong_basis = ? AND vkey BETWEEN ? AND ? ORDER BY vkey");
  for (const l of lijst) {
    const alle = (stmtBoek.all(l.strong, boekNr * 1_000_000, boekNr * 1_000_000 + 999_999) as { vkey: number }[]).map((r) => r.vkey);
    const buiten = alle.filter((k) => k < a || k > b);
    if (!buiten.length || buiten.length > 40) continue;
    const perHoofdstuk: Record<string, number[]> = {};
    for (const k of buiten) (perHoofdstuk[String(ontleedVkey(k).hoofdstuk)] ??= []).push(k);
    const zeldzaamheid = l.verzenTotaal <= 25 ? "zeer zeldzaam" : l.verzenTotaal <= 120 ? "zeldzaam" : "gewoon";
    // Concentratie in het boek t.o.v. de hele Bijbel weegt mee: een woord dat vooral hier voorkomt is een sterker motief.
    const concentratie = alle.length / l.verzenTotaal;
    motieven.push({ lemma: l, inBoek: buiten, perHoofdstuk, zeldzaamheid, score: l.idf * (0.5 + concentratie) * Math.min(buiten.length, 8) ** 0.5 });
  }
  motieven.sort((x, y) => y.score - x.score);

  // Intertekstuele kandidaten: verzen die ≥2 zeldzame focus-lemma's delen
  const kandidaatLemmas = lijst.filter((l) => l.verzenTotaal <= 700).slice(0, 30);
  const scorePerVers = new Map<number, Set<string>>();
  if (kandidaatLemmas.length >= 2) {
    const plaats = kandidaatLemmas.map(() => "?").join(",");
    const hits = d
      .prepare(`SELECT DISTINCT vkey, strong_basis FROM woorden WHERE strong_basis IN (${plaats}) AND (vkey < ? OR vkey > ?)`)
      .all(...kandidaatLemmas.map((l) => l.strong), a, b) as { vkey: number; strong_basis: string }[];
    for (const h of hits) {
      const s = scorePerVers.get(h.vkey) ?? new Set<string>();
      s.add(h.strong_basis);
      scorePerVers.set(h.vkey, s);
    }
  }
  const idf = new Map(lijst.map((l) => [l.strong, l]));
  const versen = [...scorePerVers.entries()].map(([k, set]) => ({ k, set })).sort((x, y) => x.k - y.k);
  // Aaneengesloten verzen samenvoegen (zelfde hoofdstuk, gat ≤ 2, hooguit 8 verzen): zo telt een scène als geheel.
  const groepen: { start: number; eind: number; set: Set<string>; score: number }[] = [];
  for (const v of versen) {
    const g = groepen[groepen.length - 1];
    if (g && Math.floor(g.eind / 1000) === Math.floor(v.k / 1000) && v.k - g.eind <= 2 && v.k - g.start < 8) {
      g.eind = v.k;
      v.set.forEach((x) => g.set.add(x));
    } else groepen.push({ start: v.k, eind: v.k, set: new Set(v.set), score: 0 });
  }
  for (const g of groepen) {
    const basis = [...g.set].reduce((s, x) => s + (idf.get(x)?.idf ?? 0), 0);
    const naam = [...g.set].some((x) => idf.get(x)?.eigennaam) ? 1.15 : 1;
    const zelfdeBoek = Math.floor(g.start / 1_000_000) === boekNr ? 1.3 : 1;
    g.score = basis * naam * zelfdeBoek;
  }
  const focusSet = new Set(lijst.map((l) => l.strong));
  const stmtGroep = d.prepare(
    `SELECT DISTINCT w.strong_basis, w.lemma, COALESCE(l.glosse, w.glosse) glosse, f.verzen, w.taal, w.morf
     FROM woorden w JOIN lemma_freq f ON f.strong_basis = w.strong_basis LEFT JOIN lexicon l ON l.strong = w.strong
     WHERE w.vkey BETWEEN ? AND ?`,
  );
  const interteksten: Intertekst[] = groepen
    .filter((g) => g.set.size >= 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, opties.maxInterteksten ?? 15)
    .map((g) => {
      const inGroep = stmtGroep.all(g.start, g.eind) as { strong_basis: string; lemma: string; glosse: string; verzen: number; taal: "he" | "gr"; morf: string | null }[];
      const nieuw = inGroep
        .filter((w) => !focusSet.has(w.strong_basis) && isInhoudswoord(w.strong_basis, w.verzen, w.taal, w.morf) && w.verzen <= 150)
        .sort((x, y) => x.verzen - y.verzen)
        .filter((w, i, arr) => arr.findIndex((z) => z.strong_basis === w.strong_basis) === i)
        .slice(0, 8)
        .map((w) => ({ strong: w.strong_basis, lemma: w.lemma, glosse: w.glosse }));
      return {
        start: g.start,
        eind: g.eind,
        label: labelReeks(g.start, g.eind),
        gedeeld: [...g.set].map((s) => ({ strong: s, lemma: idf.get(s)?.lemma ?? s, glosse: idf.get(s)?.glosse ?? "" })),
        score: Math.round(g.score * 10) / 10,
        zelfdeBoek: Math.floor(g.start / 1_000_000) === boekNr,
        nieuweWoorden: nieuw,
      };
    });

  // Eigennamen
  const eigennamen = lijst
    .filter((l) => l.eigennaam)
    .map((l) => {
      const inBoek = (d.prepare("SELECT COUNT(DISTINCT vkey) n FROM woorden WHERE strong_basis = ? AND vkey BETWEEN ? AND ?").get(l.strong, boekNr * 1_000_000, boekNr * 1_000_000 + 999_999) as { n: number }).n;
      const h = ontleedVkey(a).hoofdstuk;
      const inHoofdstuk = (d.prepare("SELECT COUNT(DISTINCT vkey) n FROM woorden WHERE strong_basis = ? AND vkey BETWEEN ? AND ?").get(l.strong, boekNr * 1_000_000 + h * 1000, boekNr * 1_000_000 + h * 1000 + 999) as { n: number }).n;
      return { lemma: l.lemma, glosse: l.glosse, strong: l.strong, inBoek, inHoofdstuk };
    });

  // Versnummering
  const versnummering = (d
    .prepare("SELECT DISTINCT vkey, bron_ref FROM woorden WHERE vkey BETWEEN ? AND ? AND bron_ref IS NOT NULL")
    .all(a, b) as { vkey: number; bron_ref: string }[]).map((r) => ({ ...r, label: vkeyLabel(r.vkey) }));
  if (versnummering.length) {
    waarschuwingen.push(
      `Versnummering wijkt af in de Hebreeuwse tekst (${versnummering.map((v) => `${v.label} = Hebr. ${v.bron_ref.split(".").slice(1).join(":")}`).join("; ")}).`,
    );
  }

  // NT-verbanden: direct vanuit de focus en via de sterkste OT-interteksten (twee stappen)
  const ntVerbanden: NtVerband[] = [];
  const isNt = (k: number) => (BOEK_PER_NR.get(Math.floor(k / 1_000_000))?.testament ?? "OT") === "NT";
  if (boek.testament === "OT") {
    for (const kv of kruisverwijzingen(d, a, b, 5)) if (isNt(kv.naar_start)) ntVerbanden.push({ via: "direct", ...kv });
    for (const it of interteksten.filter((x) => !isNt(x.start)).slice(0, 5)) {
      for (const kv of kruisverwijzingen(d, it.start, it.eind, 10)) if (isNt(kv.naar_start)) ntVerbanden.push({ via: it.label, ...kv });
    }
    // Het verhaal rond de sterkste interteksten in hetzelfde boek (bv. de hele Betel-scène)
    for (const it of interteksten.filter((x) => x.zelfdeBoek).slice(0, 3)) {
      const p = ontleedVkey(it.start);
      const hs = p.boek.nr * 1_000_000 + p.hoofdstuk * 1000;
      for (const kv of kruisverwijzingen(d, hs, hs + 999, 15)) {
        if (isNt(kv.naar_start)) ntVerbanden.push({ via: `${p.boek.nl} ${p.hoofdstuk} (context van ${it.label})`, ...kv });
      }
    }
    // Ook de rest van het hoofdstuk (het verhaal waar de focus in staat)
    const h = ontleedVkey(a);
    for (const kv of kruisverwijzingen(d, h.boek.nr * 1_000_000 + h.hoofdstuk * 1000, h.boek.nr * 1_000_000 + h.hoofdstuk * 1000 + 999, 15)) {
      if (isNt(kv.naar_start) && (kv.van < a || kv.van > b)) ntVerbanden.push({ via: `elders in ${h.boek.nl} ${h.hoofdstuk}`, ...kv });
    }
  }
  const gezienNt = new Set<string>();
  const ntUniek = ntVerbanden
    .sort((x, y) => y.stemmen - x.stemmen)
    .filter((v) => {
      const k = `${v.van}-${v.naar_start}`;
      if (gezienNt.has(k)) return false;
      gezienNt.add(k);
      return true;
    })
    .slice(0, 20);

  return {
    focus: { start: a, eind: b, label: labelReeks(a, b) },
    lemmas: lijst,
    motieven: motieven.slice(0, 20),
    interteksten,
    eigennamen,
    versnummering,
    ntVerbanden: ntUniek,
    waarschuwingen,
  };
}
