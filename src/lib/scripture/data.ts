// Leesfuncties op de lokale tekstdata: verzen, grondtekst, concordantie, kruisverwijzingen, commentaren.
// Alles hier is deterministisch en werkt zonder AI of internet.
import type { DatabaseSync } from "node:sqlite";
import { BOEK_PER_NR, ontleedVkey, vkey } from "./books";
import { grenzen, vkeyLabel } from "./reference";

export interface Vers {
  vkey: number;
  label: string;
  teksten: Record<string, string>; // vertaling → tekst
}

export interface Woord {
  vkey: number;
  pos: number;
  taal: "he" | "gr";
  vorm: string;
  translit: string | null;
  glosse: string | null;
  strong: string | null;
  strong_basis: string | null;
  lemma: string | null;
  morf: string | null;
  morf_uitleg?: string | null;
  bron_ref: string | null;
  eigennaam: number;
  lex_glosse?: string | null;
  lex_definitie?: string | null;
  lex_translit?: string | null;
}

export interface Vertaling {
  id: string;
  naam: string;
  taal: string;
  licentie: string;
  attributie: string;
  bron_url: string;
}

export function dataBeschikbaar(d: DatabaseSync): { verzen: number; woorden: number; kruisverwijzingen: number; commentaren: number } {
  const n = (sql: string) => (d.prepare(sql).get() as { n: number }).n;
  return {
    verzen: n("SELECT COUNT(*) n FROM verzen"),
    woorden: n("SELECT COUNT(*) n FROM woorden"),
    kruisverwijzingen: n("SELECT COUNT(*) n FROM kruisverwijzingen"),
    commentaren: n("SELECT COUNT(*) n FROM commentaar"),
  };
}

export function vertalingen(d: DatabaseSync): Vertaling[] {
  return d.prepare("SELECT id, naam, taal, licentie, attributie, bron_url FROM vertalingen ORDER BY taal DESC, id").all() as unknown as Vertaling[];
}

export function verzen(d: DatabaseSync, start: number, eind: number, max = 400): Vers[] {
  const [a, b] = grenzen({ start, eind });
  const rijen = d
    .prepare("SELECT vertaling, vkey, tekst FROM verzen WHERE vkey BETWEEN ? AND ? ORDER BY vkey")
    .all(a, b) as { vertaling: string; vkey: number; tekst: string }[];
  const per = new Map<number, Vers>();
  for (const r of rijen) {
    if (!per.has(r.vkey)) {
      if (per.size >= max) break;
      per.set(r.vkey, { vkey: r.vkey, label: vkeyLabel(r.vkey), teksten: {} });
    }
    per.get(r.vkey)!.teksten[r.vertaling] = r.tekst;
  }
  return [...per.values()];
}

export function woorden(d: DatabaseSync, start: number, eind: number): Woord[] {
  const [a, b] = grenzen({ start, eind });
  return d
    .prepare(
      `SELECT w.*, m.uitleg AS morf_uitleg, l.glosse AS lex_glosse, l.definitie AS lex_definitie, l.translit AS lex_translit
       FROM woorden w
       LEFT JOIN morfologie m ON m.code = w.morf
       LEFT JOIN lexicon l ON l.strong = COALESCE(w.strong, w.strong_basis)
       WHERE w.vkey BETWEEN ? AND ? ORDER BY w.vkey, w.pos`,
    )
    .all(a, b) as unknown as Woord[];
}

export function lexicon(d: DatabaseSync, strong: string) {
  return (
    (d.prepare("SELECT * FROM lexicon WHERE strong = ?").get(strong) as Record<string, string> | undefined) ??
    (d.prepare("SELECT * FROM lexicon WHERE strong = ?").get(strong.replace(/[A-Za-z]$/, "")) as Record<string, string> | undefined) ??
    null
  );
}

/** Functiewoorden en affixen: STEP gebruikt H9000+ voor voorvoegsels/achtervoegsels; plus zeer frequente lemma's. */
export function isInhoudswoord(strongBasis: string | null, freqVerzen: number, taal: "he" | "gr", morf?: string | null): boolean {
  if (!strongBasis) return false;
  if (morf && isFunctiewoordMorf(morf, taal)) return false;
  const nr = Number(strongBasis.slice(1));
  if (taal === "he" && nr >= 9000) return false;
  const drempel = taal === "he" ? 1500 : 1200; // verzen; filtert 'en', 'zeggen', 'God' e.d. niet weg maar wel lidwoorden/partikels
  return freqVerzen < drempel;
}

/** Voornaamwoorden, partikels, voorzetsels, voegwoorden en bijwoorden tellen niet als motief. */
export function isFunctiewoordMorf(morf: string, taal: "he" | "gr"): boolean {
  if (taal === "he") return /^H(P|T|R|C|D)/.test(morf);
  return /^(P-|R-|C-|D-|F-|S-|Q-|X-|I-|K-|T-|CONJ|PREP|ADV|PRT|COND|INJ|ARAM|HEB)/.test(morf);
}

export interface Voorkomen {
  strong_basis: string;
  lemma: string | null;
  glosse: string | null;
  taal: "he" | "gr";
  totaalVerzen: number; // hele Bijbel (in die taal)
  inBoek: number[]; // vkeys in hetzelfde boek
  elders: number; // aantal verzen buiten het boek
}

export function concordantie(d: DatabaseSync, strongBasis: string, boekNr?: number): Voorkomen | null {
  const f = d.prepare("SELECT verzen FROM lemma_freq WHERE strong_basis = ?").get(strongBasis) as { verzen: number } | undefined;
  if (!f) return null;
  const voorbeeld = d
    .prepare("SELECT w.lemma, w.taal, COALESCE(l.glosse, w.glosse) glosse FROM woorden w LEFT JOIN lexicon l ON l.strong = w.strong WHERE w.strong_basis = ? LIMIT 1")
    .get(strongBasis) as { lemma: string; taal: "he" | "gr"; glosse: string };
  const inBoek = boekNr
    ? (d
        .prepare("SELECT DISTINCT vkey FROM woorden WHERE strong_basis = ? AND vkey BETWEEN ? AND ? ORDER BY vkey")
        .all(strongBasis, boekNr * 1_000_000, boekNr * 1_000_000 + 999_999) as { vkey: number }[]).map((r) => r.vkey)
    : [];
  return { strong_basis: strongBasis, lemma: voorbeeld?.lemma ?? null, glosse: voorbeeld?.glosse ?? null, taal: voorbeeld?.taal ?? "he", totaalVerzen: f.verzen, inBoek, elders: f.verzen - inBoek.length };
}

export interface Kruisverwijzing {
  van: number;
  naar_start: number;
  naar_eind: number;
  stemmen: number;
  label: string;
}

export function kruisverwijzingen(d: DatabaseSync, start: number, eind: number, minStemmen = 1, max = 200): Kruisverwijzing[] {
  const [a, b] = grenzen({ start, eind });
  const rijen = d
    .prepare("SELECT van, naar_start, naar_eind, stemmen FROM kruisverwijzingen WHERE van BETWEEN ? AND ? AND stemmen >= ? ORDER BY stemmen DESC LIMIT ?")
    .all(a, b, minStemmen, max) as unknown as Kruisverwijzing[];
  return rijen.map((r) => ({ ...r, label: labelReeks(r.naar_start, r.naar_eind) }));
}

/** Verwijzingen die naar dit gedeelte wijzen (omgekeerde richting). */
export function inkomendeVerwijzingen(d: DatabaseSync, start: number, eind: number, minStemmen = 1, max = 100): Kruisverwijzing[] {
  const [a, b] = grenzen({ start, eind });
  const rijen = d
    .prepare(
      "SELECT van, naar_start, naar_eind, stemmen FROM kruisverwijzingen WHERE naar_start <= ? AND naar_eind >= ? AND stemmen >= ? ORDER BY stemmen DESC LIMIT ?",
    )
    .all(b, a, minStemmen, max) as unknown as Kruisverwijzing[];
  return rijen.map((r) => ({ ...r, label: vkeyLabel(r.van) }));
}

export function labelReeks(a: number, b: number): string {
  if (a === b) return vkeyLabel(a);
  const x = ontleedVkey(a);
  const y = ontleedVkey(b);
  if (x.boek.nr === y.boek.nr && x.hoofdstuk === y.hoofdstuk) return `${vkeyLabel(a)}–${y.vers}`;
  if (x.boek.nr === y.boek.nr) return `${vkeyLabel(a)}–${y.hoofdstuk}:${y.vers}`;
  return `${vkeyLabel(a)} – ${vkeyLabel(b)}`;
}

export interface CommentaarItem {
  id: number;
  werk: string;
  titel: string;
  auteur: string;
  jaar: string | null;
  taal: string;
  traditie: string | null;
  brontype: string;
  rechtenstatus: string;
  licentie: string;
  attributie: string;
  vkey_start: number;
  vkey_eind: number;
  label: string;
  sectie: string | null;
  tekst: string;
  bron_url: string | null;
}

export function commentaren(d: DatabaseSync, start: number, eind: number, opties: { zonderOnzeker?: boolean; max?: number } = {}): CommentaarItem[] {
  const [a, b] = grenzen({ start, eind });
  const rijen = d
    .prepare(
      `SELECT c.id, c.werk, w.titel, w.auteur, w.jaar, w.taal, w.traditie, w.brontype, w.rechtenstatus, w.licentie, w.attributie,
              c.vkey_start, c.vkey_eind, c.label, c.sectie, c.tekst, COALESCE(c.bron_url, w.bron_url) AS bron_url
       FROM commentaar c JOIN werken w ON w.id = c.werk
       WHERE c.vkey_start <= ? AND c.vkey_eind >= ?
       ORDER BY c.vkey_start, CASE w.id WHEN 'kanttekeningen' THEN 0 WHEN 'calvijn' THEN 1 WHEN 'matthew-henry' THEN 2 ELSE 3 END, c.id
       LIMIT ?`,
    )
    .all(b, a, opties.max ?? 500) as unknown as CommentaarItem[];
  return opties.zonderOnzeker ? rijen.filter((r) => !r.rechtenstatus.startsWith("rechten onzeker")) : rijen;
}

export function zoekBijbeltekst(d: DatabaseSync, fts: string, vertaling?: string, max = 50) {
  if (!fts) return [];
  const sql = vertaling
    ? "SELECT vertaling, vkey, snippet(verzen_fts, 2, '[', ']', '…', 16) fragment FROM verzen_fts WHERE verzen_fts MATCH ? AND vertaling = ? ORDER BY rank LIMIT ?"
    : "SELECT vertaling, vkey, snippet(verzen_fts, 2, '[', ']', '…', 16) fragment FROM verzen_fts WHERE verzen_fts MATCH ? ORDER BY rank LIMIT ?";
  const rijen = (vertaling ? d.prepare(sql).all(fts, vertaling, max) : d.prepare(sql).all(fts, max)) as { vertaling: string; vkey: number; fragment: string }[];
  return rijen.map((r) => ({ ...r, label: vkeyLabel(r.vkey) }));
}

export function zoekCommentaren(d: DatabaseSync, fts: string, max = 40) {
  if (!fts) return [];
  return (
    d
      .prepare(
        `SELECT c.id, c.werk, w.auteur, w.titel, w.rechtenstatus, c.vkey_start, c.vkey_eind, snippet(commentaar_fts, 0, '[', ']', '…', 24) fragment
         FROM commentaar_fts JOIN commentaar c ON c.id = commentaar_fts.rowid JOIN werken w ON w.id = c.werk
         WHERE commentaar_fts MATCH ? ORDER BY rank LIMIT ?`,
      )
      .all(fts, max) as { id: number; werk: string; auteur: string; titel: string; rechtenstatus: string; vkey_start: number; vkey_eind: number; fragment: string }[]
  ).map((r) => ({ ...r, label: labelReeks(r.vkey_start, r.vkey_eind) }));
}

export function hoofdstukGrenzen(boekNr: number, hoofdstuk: number): [number, number] {
  return [vkey(boekNr, hoofdstuk, 1), vkey(boekNr, hoofdstuk, 999)];
}

export function boekNaam(nr: number): string {
  return BOEK_PER_NR.get(nr)?.nl ?? "?";
}
