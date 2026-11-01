// Canonieke boekenlijst (66 boeken, protestantse canon) met Nederlandse en Engelse namen.
// Versnummering: Engelse/KJV-traditie als ruggengraat (zoals de gebruikte open datasets).
// Afwijkingen in de Hebreeuwse versnummering worden per woord bewaard (zie woorden.bron_ref).

export interface Boek {
  nr: number;
  osis: string; // OSIS-id, bv. "Gen", "John"
  usfm: string; // USFM-code, bv. "GEN", "JHN"
  nl: string;
  en: string;
  testament: "OT" | "NT";
  hoofdstukken: number;
  aliassen: string[]; // extra schrijfwijzen/afkortingen (worden genormaliseerd)
}

type Rij = [osis: string, usfm: string, nl: string, en: string, hoofdstukken: number, aliassen: string[]];

const RIJEN: Rij[] = [
  ["Gen", "GEN", "Genesis", "Genesis", 50, ["gn", "ge"]],
  ["Exod", "EXO", "Exodus", "Exodus", 40, ["ex", "exo"]],
  ["Lev", "LEV", "Leviticus", "Leviticus", 27, ["lv"]],
  ["Num", "NUM", "Numeri", "Numbers", 36, ["nu", "nm"]],
  ["Deut", "DEU", "Deuteronomium", "Deuteronomy", 34, ["dt", "deu"]],
  ["Josh", "JOS", "Jozua", "Joshua", 24, ["joz", "jos"]],
  ["Judg", "JDG", "Richteren", "Judges", 21, ["re", "ri", "richt", "rechters", "jdg", "jdgs"]],
  ["Ruth", "RUT", "Ruth", "Ruth", 4, ["rt", "rut"]],
  ["1Sam", "1SA", "1 Samuël", "1 Samuel", 31, ["1sa", "1sm"]],
  ["2Sam", "2SA", "2 Samuël", "2 Samuel", 24, ["2sa", "2sm"]],
  ["1Kgs", "1KI", "1 Koningen", "1 Kings", 22, ["1kon", "1ki", "1kgs"]],
  ["2Kgs", "2KI", "2 Koningen", "2 Kings", 25, ["2kon", "2ki", "2kgs"]],
  ["1Chr", "1CH", "1 Kronieken", "1 Chronicles", 29, ["1kr", "1kron", "1ch", "1chr"]],
  ["2Chr", "2CH", "2 Kronieken", "2 Chronicles", 36, ["2kr", "2kron", "2ch", "2chr"]],
  ["Ezra", "EZR", "Ezra", "Ezra", 10, ["ezr"]],
  ["Neh", "NEH", "Nehemia", "Nehemiah", 13, ["ne"]],
  ["Esth", "EST", "Ester", "Esther", 10, ["est", "esth"]],
  ["Job", "JOB", "Job", "Job", 42, ["jb"]],
  ["Ps", "PSA", "Psalmen", "Psalms", 150, ["ps", "psa", "psalm", "pss"]],
  ["Prov", "PRO", "Spreuken", "Proverbs", 31, ["spr", "prv", "pro"]],
  ["Eccl", "ECC", "Prediker", "Ecclesiastes", 12, ["pred", "pr", "ecc", "qoh", "kohelet"]],
  ["Song", "SNG", "Hooglied", "Song of Songs", 8, ["hl", "hgl", "hoogl", "sng", "song", "songofsolomon", "canticles"]],
  ["Isa", "ISA", "Jesaja", "Isaiah", 66, ["jes", "is"]],
  ["Jer", "JER", "Jeremia", "Jeremiah", 52, ["jr"]],
  ["Lam", "LAM", "Klaagliederen", "Lamentations", 5, ["kl", "klgl", "klaagl"]],
  ["Ezek", "EZK", "Ezechiël", "Ezekiel", 48, ["ez", "ezech", "ezk", "eze"]],
  ["Dan", "DAN", "Daniël", "Daniel", 12, ["da", "dn"]],
  ["Hos", "HOS", "Hosea", "Hosea", 14, ["ho"]],
  ["Joel", "JOL", "Joël", "Joel", 3, ["jl", "jol"]],
  ["Amos", "AMO", "Amos", "Amos", 9, ["am", "amo"]],
  ["Obad", "OBA", "Obadja", "Obadiah", 1, ["ob", "obd", "oba"]],
  ["Jonah", "JON", "Jona", "Jonah", 4, ["jon"]],
  ["Mic", "MIC", "Micha", "Micah", 7, ["mi", "mch"]],
  ["Nah", "NAM", "Nahum", "Nahum", 3, ["na", "nam"]],
  ["Hab", "HAB", "Habakuk", "Habakkuk", 3, ["hb"]],
  ["Zeph", "ZEP", "Sefanja", "Zephaniah", 3, ["sef", "zef", "zep", "zeph", "zefanja"]],
  ["Hag", "HAG", "Haggai", "Haggai", 2, ["hg"]],
  ["Zech", "ZEC", "Zacharia", "Zechariah", 14, ["zach", "za", "zec", "zech"]],
  ["Mal", "MAL", "Maleachi", "Malachi", 4, ["ml"]],
  ["Matt", "MAT", "Matteüs", "Matthew", 28, ["mt", "mat", "matth", "mattheus"]],
  ["Mark", "MRK", "Marcus", "Mark", 16, ["mc", "mk", "mr", "mrk", "markus"]],
  ["Luke", "LUK", "Lucas", "Luke", 24, ["lc", "lk", "luk", "lukas"]],
  ["John", "JHN", "Johannes", "John", 21, ["joh", "jh", "jhn", "jn"]],
  ["Acts", "ACT", "Handelingen", "Acts", 28, ["hand", "hd", "han", "act"]],
  ["Rom", "ROM", "Romeinen", "Romans", 16, ["rm", "ro"]],
  ["1Cor", "1CO", "1 Korintiërs", "1 Corinthians", 16, ["1kor", "1cor", "1co", "1korinthe", "1korintiers", "1korinthiers"]],
  ["2Cor", "2CO", "2 Korintiërs", "2 Corinthians", 13, ["2kor", "2cor", "2co", "2korinthe", "2korintiers", "2korinthiers"]],
  ["Gal", "GAL", "Galaten", "Galatians", 6, ["ga"]],
  ["Eph", "EPH", "Efeziërs", "Ephesians", 6, ["ef", "efe", "eph"]],
  ["Phil", "PHP", "Filippenzen", "Philippians", 4, ["fil", "flp", "php", "phil"]],
  ["Col", "COL", "Kolossenzen", "Colossians", 4, ["kol", "col"]],
  ["1Thess", "1TH", "1 Tessalonicenzen", "1 Thessalonians", 5, ["1tes", "1tess", "1th", "1thess", "1thessalonicenzen"]],
  ["2Thess", "2TH", "2 Tessalonicenzen", "2 Thessalonians", 3, ["2tes", "2tess", "2th", "2thess", "2thessalonicenzen"]],
  ["1Tim", "1TI", "1 Timoteüs", "1 Timothy", 6, ["1tm", "1ti", "1tim", "1timotheus"]],
  ["2Tim", "2TI", "2 Timoteüs", "2 Timothy", 4, ["2tm", "2ti", "2tim", "2timotheus"]],
  ["Titus", "TIT", "Titus", "Titus", 3, ["tit", "tt"]],
  ["Phlm", "PHM", "Filemon", "Philemon", 1, ["filem", "flm", "phm", "phlm"]],
  ["Heb", "HEB", "Hebreeën", "Hebrews", 13, ["hebr", "hbr"]],
  ["Jas", "JAS", "Jakobus", "James", 5, ["jak", "jas", "jac", "jacobus"]],
  ["1Pet", "1PE", "1 Petrus", "1 Peter", 5, ["1pe", "1pt", "1petr", "1pet"]],
  ["2Pet", "2PE", "2 Petrus", "2 Peter", 3, ["2pe", "2pt", "2petr", "2pet"]],
  ["1John", "1JN", "1 Johannes", "1 John", 5, ["1joh", "1jn", "1jh"]],
  ["2John", "2JN", "2 Johannes", "2 John", 1, ["2joh", "2jn", "2jh"]],
  ["3John", "3JN", "3 Johannes", "3 John", 1, ["3joh", "3jn", "3jh"]],
  ["Jude", "JUD", "Judas", "Jude", 1, ["jud", "jd"]],
  ["Rev", "REV", "Openbaring", "Revelation", 22, ["opb", "openb", "op", "rev", "apk", "apocalyps"]],
];

export const BOEKEN: Boek[] = RIJEN.map(([osis, usfm, nl, en, hoofdstukken, aliassen], i) => ({
  nr: i + 1,
  osis,
  usfm,
  nl,
  en,
  testament: i < 39 ? "OT" : "NT",
  hoofdstukken,
  aliassen,
}));

export const BOEK_PER_OSIS = new Map(BOEKEN.map((b) => [b.osis, b]));
export const BOEK_PER_NR = new Map(BOEKEN.map((b) => [b.nr, b]));
export const BOEK_PER_USFM = new Map(BOEKEN.map((b) => [b.usfm, b]));

/** STEP gebruikt USFM-codes met hoofdletter + kleine letters: GEN→Gen, 1SA→1Sa, JHN→Jhn. */
export function stepCode(b: Boek): string {
  const i = b.usfm.search(/[A-Z]/);
  return b.usfm.slice(0, i + 1) + b.usfm.slice(i + 1).toLowerCase();
}
export const BOEK_PER_STEP = new Map(BOEKEN.map((b) => [stepCode(b), b]));

export function normaliseer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^(iii|ii|i)\s+(?=\p{L})/u, (m) => String(m.trim().length))
    .replace(/^(eerste|first)\s+/, "1")
    .replace(/^(tweede|second)\s+/, "2")
    .replace(/^(derde|third)\s+/, "3")
    .replace(/[\s.]/g, "");
}

const NAAM_INDEX: Map<string, Boek> = (() => {
  const m = new Map<string, Boek>();
  for (const b of BOEKEN) {
    for (const n of [b.nl, b.en, b.osis, b.usfm, stepCode(b), ...b.aliassen]) m.set(normaliseer(n), b);
  }
  return m;
})();

/** Zoekt een boek op naam, afkorting of unieke beginletters (minimaal 3 tekens). */
export function vindBoek(invoer: string): Boek | null {
  const n = normaliseer(invoer);
  if (!n) return null;
  const exact = NAAM_INDEX.get(n);
  if (exact) return exact;
  if (n.replace(/^\d/, "").length < 3) return null;
  const kandidaten = new Set<Boek>();
  for (const b of BOEKEN) {
    for (const naam of [b.nl, b.en]) if (normaliseer(naam).startsWith(n)) kandidaten.add(b);
  }
  return kandidaten.size === 1 ? [...kandidaten][0] : null;
}

export function vkey(boekNr: number, hoofdstuk: number, vers: number): number {
  return boekNr * 1_000_000 + hoofdstuk * 1_000 + vers;
}

export function ontleedVkey(k: number): { boek: Boek; hoofdstuk: number; vers: number } {
  const boek = BOEK_PER_NR.get(Math.floor(k / 1_000_000));
  if (!boek) throw new Error(`Ongeldige verssleutel ${k}`);
  return { boek, hoofdstuk: Math.floor((k % 1_000_000) / 1000), vers: k % 1000 };
}

export function osisRef(k: number): string {
  const { boek, hoofdstuk, vers } = ontleedVkey(k);
  return `${boek.osis}.${hoofdstuk}.${vers}`;
}

/** OSIS-verwijzing zoals "Gen.31.13" → vkey. */
export function vkeyUitOsis(ref: string): number | null {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const b = BOEK_PER_OSIS.get(m[1]);
  return b ? vkey(b.nr, Number(m[2]), Number(m[3])) : null;
}
