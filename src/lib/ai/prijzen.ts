// Prijzen in USD per miljoen tokens (Anthropic-tabel, gecontroleerd 01-11-2026 op platform.claude.com; zie bibliotheek B86).
// OpenAI: prijzen verschillen per model en zijn hier bewust NIET ingevuld — vul ze in bij Instellingen,
// anders weigert Preekhulp live aanroepen (geen budgetbewaking zonder prijs).
export interface Prijs {
  invoer: number;
  uitvoer: number;
  cacheLezen?: number;
}

export const ANTHROPIC_PRIJZEN: Record<string, Prijs> = {
  "claude-opus-5-5": { invoer: 4, uitvoer: 20, cacheLezen: 0.2 },
  "claude-sonnet-5-5": { invoer: 2, uitvoer: 10, cacheLezen: 0.2 },
  "claude-haiku-5-5": { invoer: 0.1, uitvoer: 0.5 }, // tot 100K invoertokens
  "claude-fable-5-1": { invoer: 10, uitvoer: 50, cacheLezen: 0.25 },
};

/** Keuze in de interface: alleen Sonnet en Opus (opdracht 01-11-2026). Geen automatische overstap naar een duurder model. */
export const ANTHROPIC_MODELLEN = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — standaard ($2 / $10 per miljoen tokens in/uit)" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 — diepgaander, 2× zo duur ($4 / $20 per miljoen tokens)" },
];

/** Bovengrens van het aantal invoertokens: 1 token per 2 tekens (bewust ruim; B86). */
export function schatTokens(tekens: number): number {
  return Math.ceil(tekens / 2);
}

export function kosten(p: Prijs, invoer: number, uitvoer: number, cacheLezen = 0): number {
  return ((invoer - cacheLezen) * p.invoer + cacheLezen * (p.cacheLezen ?? p.invoer) + uitvoer * p.uitvoer) / 1_000_000;
}
