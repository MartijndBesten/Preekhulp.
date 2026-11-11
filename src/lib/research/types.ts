import { z } from "zod";
import { NIVEAUS } from "../verification/claims";

export type Modus = "verkennen" | "verdiepen" | "kritisch";

export const MODUS_UITLEG: Record<Modus, string> = {
  verkennen: "Snelle oriëntatie: tekst, grondtaal, verbanden, oudere uitleg, eerste lijnen.",
  verdiepen: "Grondig: plus gerichte zoekvragen, bronbeoordeling, perspectiefvergelijking en kritische tegenlezing.",
  kritisch: "Maximaal: elk perspectief apart onderzocht, aparte vergelijking en zware tegenlezing (meer AI-kosten).",
};

export interface OnderzoeksOpties {
  bijbelgedeelte?: string;
  thema?: string;
  dienst?: string;
  traditie?: string;
  doelgroep?: string;
  preekgedachte?: string;
  voorkeursauteurs?: string;
  talen?: ("nl" | "en")[];
  budgetUsd?: number;
  zonderExtern?: boolean; // alleen lokale bronnen
}

export const STAPPEN = [
  { id: "A", naam: "Onderzoeksvraag begrijpen" },
  { id: "B", naam: "Zoekvragen ontwikkelen" },
  { id: "C", naam: "Bronnen verzamelen" },
  { id: "D", naam: "Bronnen beoordelen" },
  { id: "E", naam: "Exegese en vergelijking" },
  { id: "V", naam: "Verdiepingsronde" },
  { id: "F", naam: "Nieuwe onderzoekslijnen" },
  { id: "G", naam: "Kritische tegenlezing" },
  { id: "H", naam: "Onderzoeksdossier" },
] as const;
export type StapId = (typeof STAPPEN)[number]["id"];

// ---------------------------------------------------------------- AI-uitvoerschema's
export const Verwijzing = z.object({
  label: z.string().describe("Label van een bewijsstuk, bv. E12"),
  citaat: z.string().nullable().describe("Kort letterlijk citaat uit dat bewijsstuk (max. 25 woorden) of null"),
});

export const Bewering = z.object({
  tekst: z.string(),
  niveau: z.enum(NIVEAUS),
  verwijzingen: z.array(Verwijzing).describe("Bewijsstukken die de bewering ondersteunen"),
  interpretatieve_stap: z.string().nullable().describe("Welke uitlegstap zet je van tekst/bron naar deze bewering? null als het letterlijk in de bron staat"),
  tegenverwijzingen: z.array(Verwijzing).describe("Bewijsstukken die de bewering mogelijk tegenspreken of nuanceren (leeg als je die niet vond)"),
  onzekerheid: z.string().nullable().describe("Wat is hier onzeker of omstreden? null als niets"),
});
export type BeweringT = z.infer<typeof Bewering>;

export const SchemaVraag = z.object({
  kernvraag: z.string(),
  afbakening_wel: z.array(z.string()),
  afbakening_niet: z.array(z.string()),
  aannames: z.array(z.object({ aanname: z.string(), expliciet: z.boolean(), waarom_toetsen: z.string() })),
  onderscheid: z.object({ exegese: z.string(), dogmatiek: z.string(), homiletiek: z.string() }),
  te_verifieren: z.array(z.string()),
  plan: z.array(z.string()),
  extra_bijbelgedeelten: z.array(z.string()).describe("Verwante gedeelten die onderzocht moeten worden, als verwijzing (bv. 'Genesis 28:10-22')"),
});

export const SchemaZoekvragen = z.object({
  zoekvragen: z.array(
    z.object({
      tekst: z.string(),
      taal: z.enum(["nl", "en"]),
      doel: z.enum(["academisch", "boeken", "video", "algemeen"]),
      waarom: z.string(),
    }),
  ),
});

export const SchemaBeoordeling = z.object({
  beoordelingen: z.array(
    z.object({
      bron: z.string().describe("Bronlabel, bv. B3"),
      relevantie: z.number().int().min(0).max(3),
      perspectief: z.string().describe("Traditie/perspectief voor zover uit de gegevens af te leiden, anders 'onbekend'"),
      waarom: z.string(),
    }),
  ),
});

export const Lijn = z.object({
  titel: z.string(),
  onderbouwing: z.string(),
  verwijzingen: z.array(Verwijzing),
  sterkte: z.enum(["sterk", "matig", "zwak"]).describe("Exegetische sterkte"),
  niveau: z.enum(NIVEAUS),
});

export const SchemaAnalyse = z.object({
  context: z.array(Bewering).describe("Literaire en historische context, verhaalverloop, chronologie"),
  grondtaal: z.array(Bewering),
  exegese: z.array(Bewering),
  historische_uitleg: z.array(Bewering).describe("Wat oudere uitleggers zeggen, met verwijzing naar hun tekst"),
  hedendaagse_uitleg: z.array(Bewering).describe("Wat moderne/wetenschappelijke bronnen toevoegen (let op: vaak alleen abstract)"),
  bijbelse_theologie: z.array(Bewering),
  dogmatiek: z.array(Bewering),
  homiletiek: z.array(Bewering).describe("Aanknopingspunten, geen preek"),
  overeenstemming: z.array(Bewering),
  verschillen: z.array(
    z.object({
      punt: z.string(),
      posities: z.array(z.object({ wie: z.string(), standpunt: z.string(), verwijzingen: z.array(Verwijzing) })),
      beoordeling: z.string(),
    }),
  ),
  tekst_vs_later: z.array(Bewering).describe("Wat de tekst zelf zegt versus later theologisch ontwikkelde uitleg"),
  nieuwe_lijnen: z.array(Lijn),
  open_vragen: z.array(z.string()),
  verdieping_voorstellen: z
    .array(z.object({ onderwerp: z.string(), waarom: z.string(), bijbelgedeelten: z.array(z.string()).describe("Verwijzingen zoals 'Genesis 31:19'"), zoektermen: z.array(z.string()) }))
    .describe("Hooguit 3 onverwachte maar relevante onderwerpen die een tweede, gerichte zoekronde verdienen"),
});
export type Analyse = z.infer<typeof SchemaAnalyse>;

export const SchemaPerspectief = z.object({
  beweringen: z.array(Bewering),
  nieuwe_lijnen: z.array(Lijn),
  open_vragen: z.array(z.string()),
});

export const SchemaTegenlezing = z.object({
  punten: z.array(
    z.object({
      soort: z.enum([
        "zwakke_bewering", "ontbrekende_interpretatie", "eenzijdige_bronselectie", "preekgedachte_stuurt_uitleg",
        "anachronisme", "chronologie", "ontbrekend_tegenargument", "citaat_of_bron", "te_snelle_toepassing", "dogmatische_sprong",
      ]),
      bewering: z.string().nullable().describe("Id van de betreffende bewering (bv. C7) of null"),
      toelichting: z.string(),
      advies: z.string(),
      verwijzingen: z.array(Verwijzing),
    }),
  ),
  zoekvragen_tegenperspectief: z.array(z.string()),
  steuncontrole: z
    .array(
      z.object({
        bewering: z.string().describe("Id, bv. C7"),
        oordeel: z.enum(["ondersteunt", "deels", "ondersteunt_niet", "niet_te_beoordelen"]),
        toelichting: z.string(),
      }),
    )
    .describe("Per AI-bewering: draagt het aangehaalde bewijs deze concrete bewering werkelijk?"),
  eindoordeel: z.string(),
});

export const SchemaVerdieping = z.object({
  onderwerpen: z.array(
    z.object({
      onderwerp: z.string(),
      waarom_in_de_tekst: z.array(Bewering),
      wat_uitleggers_zeggen: z.array(Bewering),
      samenhang_elders: z.array(Bewering),
      alternatieve_verklaringen: z.array(Bewering),
      wat_de_tekst_niet_zegt: z.array(z.string()),
    }),
  ),
});
