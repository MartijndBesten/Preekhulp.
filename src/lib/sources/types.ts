// Het uniforme bronconnector-contract.
// Kernregel: een connector die alleen metadata levert, mag nooit als 'volledige inhoud' worden behandeld.
import type { DatabaseSync } from "node:sqlite";
import type { Instellingen } from "../settings";
import type { BijbelRef } from "../scripture/reference";

export type Brontype =
  | "bijbeltekst"
  | "grondtekst"
  | "peer-reviewed artikel"
  | "academisch artikel (peer review niet vastgesteld)"
  | "wetenschappelijk boek/commentaar"
  | "historisch commentaar"
  | "historische kanttekeningen"
  | "kerkvader/historische uitleg"
  | "confessionele/kerkelijke uitleg"
  | "proefschrift"
  | "preek/lezing (video)"
  | "populair/pastoraal artikel"
  | "boek (catalogus)"
  | "eigen document"
  | "niet-gecontroleerde internetbron"
  | "onbekend";

export type JaNeeOnbekend = "ja" | "nee" | "beperkt" | "onbekend";

/** Onderscheid tussen vindbaar, leesbaar, downloadbaar en herbruikbaar (zie opdracht §4). */
export interface Rechten {
  vindbaar: JaNeeOnbekend;
  leesbaar: JaNeeOnbekend;
  downloadbaar: JaNeeOnbekend;
  herbruikbaar: JaNeeOnbekend;
  licentie?: string | null;
  toelichting?: string;
}

export type Toegang = "volledige tekst" | "abstract" | "alleen metadata" | "fragmenten" | "transcript" | "onbekend";

export interface BronRecord {
  connector: string;
  extern_id: string; // stabiel binnen de connector (DOI, OpenAlex-id, archive-id …)
  brontype: Brontype;
  titel: string;
  auteurs: string[];
  jaar?: string | null;
  datum?: string | null;
  uitgever?: string | null;
  url?: string | null;
  doi?: string | null;
  taal?: string | null;
  samenvatting?: string | null; // alleen als de bron die zelf levert (abstract/beschrijving)
  bijbelgedeelten?: string[];
  toegang: Toegang;
  volledigeTekstUrl?: string | null;
  rechten: Rechten;
  traditie?: string | null;
  extra?: Record<string, unknown>;
}

export interface Passage {
  soort: "bijbeltekst" | "grondtekst" | "commentaar" | "abstract" | "metadata" | "document" | "transcript" | "kruisverwijzing" | "data";
  locatie: string; // vers, pagina, sectie, tijdstip
  tekst: string;
  url?: string | null;
  start_sec?: number | null;
  eind_sec?: number | null;
}

export interface Zoekvraag {
  tekst: string;
  taal?: "nl" | "en";
  refs?: BijbelRef[];
  soort?: "academisch" | "boeken" | "video" | "algemeen";
  max?: number;
}

export interface ConnectorContext {
  db: DatabaseSync;
  onderzoek?: string | null;
  instellingen: Instellingen;
}

export type ConnectorStatus = "werkend" | "gedeeltelijk" | "alleen doorverwijzing" | "niet beschikbaar";

export interface Bronkaart {
  id: string;
  naam: string;
  website: string;
  categorie: "Bijbel en grondtaal" | "Academisch" | "Historische commentaren en boeken" | "Video en preken" | "Bibliotheek (extern)" | "Eigen bibliotheek";
  zoekmogelijkheden: string;
  api: string;
  toegangsvoorwaarden: string;
  licentie: string;
  volledigeTekst: string;
  actualiteit: string;
  kosten: string;
  uitvoerbaarheid: string;
  geschiktheidPilot: string;
  status: ConnectorStatus;
  statusToelichting: string;
  getest: string; // wat is daadwerkelijk getest, wanneer
}

export interface Connector {
  kaart: Bronkaart;
  ondersteunt: { zoeken: boolean; metadata: boolean; inhoud: "volledig" | "fragmenten" | "abstract" | "nee"; verificatie: boolean; netwerk: boolean };
  /** Waarom de connector nu niet bruikbaar is (bv. sleutel ontbreekt), of null. */
  nietBeschikbaar(ctx: ConnectorContext): string | null;
  zoek(v: Zoekvraag, ctx: ConnectorContext): Promise<{ record: BronRecord; passages: Passage[] }[]>;
  /** Controleer of een tekstfragment werkelijk in de bron staat (alleen waar de inhoud rechtmatig beschikbaar is). */
  verifieer?(record: BronRecord, fragment: string, ctx: ConnectorContext): Promise<boolean | null>;
}
