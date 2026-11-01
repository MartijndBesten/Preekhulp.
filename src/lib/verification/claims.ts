// Controle van beweringen: bestaan de aangehaalde bewijsstukken, staan citaten er letterlijk in,
// en past het voorgestelde bewijsniveau bij het soort bron? Niveaus worden alleen verlaagd, nooit verhoogd.

export const NIVEAUS = ["direct_aangetoond", "onderbouwde_interpretatie", "mogelijke_onderzoekslijn", "omstreden", "niet_geverifieerd"] as const;
export type Niveau = (typeof NIVEAUS)[number];

export const NIVEAU_LABEL: Record<Niveau, string> = {
  direct_aangetoond: "Direct aangetoond",
  onderbouwde_interpretatie: "Onderbouwde interpretatie",
  mogelijke_onderzoekslijn: "Mogelijke onderzoekslijn",
  omstreden: "Omstreden",
  niet_geverifieerd: "Niet geverifieerd",
};

export const NIVEAU_UITLEG: Record<Niveau, string> = {
  direct_aangetoond: "Gecontroleerd in een toegankelijke primaire bron (Bijbeltekst/grondtekstdata), met letterlijk teruggevonden citaat of rechtstreeks uit de data berekend.",
  onderbouwde_interpretatie: "Meerdere relevante gegevens ondersteunen de uitleg, maar interpretatie blijft nodig.",
  mogelijke_onderzoekslijn: "Interessant en verdedigbaar als vraag, niet voldoende bewezen.",
  omstreden: "Er bestaan relevante concurrerende interpretaties.",
  niet_geverifieerd: "De beschikbare gegevens zijn onvoldoende (of de verwijzingen konden niet worden gecontroleerd).",
};

export interface Bewijs {
  label: string;
  soort: string; // passages.soort
  tekst: string;
  brontype: string;
  bronTitel: string;
}

export interface Verwijzing {
  label: string;
  citaat?: string | null;
}

export interface Controle {
  geldig: string[];
  onbekend: string[];
  citatenGevonden: number;
  citatenNietGevonden: string[];
  alleenAbstractOfMetadata: boolean;
  primair: boolean;
  aangepast: { van: Niveau; naar: Niveau; reden: string } | null;
}

const PRIMAIR = new Set(["bijbeltekst", "grondtekst", "data", "kruisverwijzing"]);
const SECUNDAIR_VOL = new Set(["commentaar", "document", "transcript"]);

export function normaliseerVoorVergelijking(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebreeuwse accenten/vocalen: vergelijk op consonanten
    .replace(/\p{M}/gu, "")
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function citaatInTekst(citaat: string, tekst: string): boolean {
  const c = normaliseerVoorVergelijking(citaat).replace(/^["'…. ]+|["'…. ]+$/g, "");
  if (c.length < 4) return false;
  const t = normaliseerVoorVergelijking(tekst);
  if (t.includes(c)) return true;
  // Toegestaan: weglatingsteken binnen een citaat ("a … b") — elk deel moet letterlijk voorkomen, in volgorde.
  const delen = c.split(/\s*(?:\.\.\.|…)\s*/).filter((x) => x.length >= 4);
  if (delen.length < 2) return false;
  let vanaf = 0;
  for (const d of delen) {
    const i = t.indexOf(d, vanaf);
    if (i < 0) return false;
    vanaf = i + d.length;
  }
  return true;
}

export function controleer(voorgesteld: Niveau, verwijzingen: Verwijzing[], bewijs: Map<string, Bewijs>): { niveau: Niveau; controle: Controle; verwijzingen: Verwijzing[] } {
  const geldig: string[] = [];
  const onbekend: string[] = [];
  const nietGevonden: string[] = [];
  let gevonden = 0;
  let primairMetCitaat = false;
  let primair = false;
  const schoon: Verwijzing[] = [];

  for (const v of verwijzingen) {
    const label = v.label.trim().replace(/^\[|\]$/g, "");
    const b = bewijs.get(label);
    if (!b) {
      onbekend.push(label);
      continue;
    }
    geldig.push(label);
    let citaat = v.citaat?.trim() || null;
    if (citaat) {
      if (citaatInTekst(citaat, b.tekst)) {
        gevonden++;
        if (PRIMAIR.has(b.soort)) primairMetCitaat = true;
      } else {
        nietGevonden.push(`${label}: “${citaat.slice(0, 120)}”`);
        citaat = null; // niet-teruggevonden citaat wordt niet getoond als citaat
      }
    }
    if (PRIMAIR.has(b.soort)) primair = true;
    schoon.push({ label, citaat });
  }

  const soorten = geldig.map((l) => bewijs.get(l)!.soort);
  const alleenAbstract = soorten.length > 0 && soorten.every((s) => s === "abstract" || s === "metadata");
  const heeftVolleTekst = soorten.some((s) => PRIMAIR.has(s) || SECUNDAIR_VOL.has(s));

  let niveau: Niveau = voorgesteld;
  let reden = "";
  if (!geldig.length) {
    niveau = "niet_geverifieerd";
    reden = onbekend.length ? "Verwijzingen bestaan niet in het bewijsmateriaal" : "Geen verwijzingen";
  } else if (voorgesteld === "direct_aangetoond" && !(primairMetCitaat || soorten.includes("data"))) {
    niveau = heeftVolleTekst && geldig.length >= 2 ? "onderbouwde_interpretatie" : "mogelijke_onderzoekslijn";
    reden = "'Direct aangetoond' vereist een letterlijk teruggevonden citaat uit een primaire bron of berekende tekstdata";
  } else if (voorgesteld === "onderbouwde_interpretatie" && !heeftVolleTekst) {
    niveau = "mogelijke_onderzoekslijn";
    reden = "Alleen gebaseerd op abstracts/catalogusgegevens";
  } else if (voorgesteld === "onderbouwde_interpretatie" && geldig.length < 2 && !primair) {
    niveau = "mogelijke_onderzoekslijn";
    reden = "Eén secundaire bron is onvoldoende voor 'onderbouwde interpretatie'";
  }

  return {
    niveau,
    verwijzingen: schoon,
    controle: {
      geldig,
      onbekend,
      citatenGevonden: gevonden,
      citatenNietGevonden: nietGevonden,
      alleenAbstractOfMetadata: alleenAbstract,
      primair,
      aangepast: niveau !== voorgesteld ? { van: voorgesteld, naar: niveau, reden } : null,
    },
  };
}
