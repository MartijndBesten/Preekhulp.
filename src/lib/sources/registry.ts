// Bronnenregister: alle connectors + bronkaarten voor bronnen zonder (toegestane) koppeling.
import { crossref, core, doaj, openAlex, pthu, semanticScholar } from "./connectors/academisch";
import { googleBooks, gutendex, helloAo, internetArchive, openLibrary } from "./connectors/boeken";
import { eigenDocumenten, lokaalBijbel, lokaalCommentaren, lokaalGrondtekst, lokaalKruisverwijzingen } from "./connectors/lokaal";
import { youtube } from "../videos/youtube";
import type { Bronkaart, Connector, ConnectorContext } from "./types";

export const CONNECTORS: Connector[] = [
  lokaalBijbel, lokaalGrondtekst, lokaalKruisverwijzingen, lokaalCommentaren, eigenDocumenten,
  helloAo, openAlex, pthu, crossref, doaj, semanticScholar, core,
  internetArchive, openLibrary, gutendex, googleBooks, youtube,
];

export function connector(id: string): Connector | undefined {
  return CONNECTORS.find((c) => c.kaart.id === id);
}

export function actieveConnectors(ctx: ConnectorContext, filter?: (c: Connector) => boolean): Connector[] {
  return CONNECTORS.filter((c) => !ctx.instellingen.uitgeschakeldeConnectors.includes(c.kaart.id) && (!filter || filter(c)) && !c.nietBeschikbaar(ctx));
}

const basis = { kosten: "—", actualiteit: "—", uitvoerbaarheid: "—" };

/** Bronnen die onderzocht zijn maar (nog) geen koppeling krijgen. */
export const EXTRA_KAARTEN: Bronkaart[] = [
  {
    id: "logos", naam: "Logos Bible Software / Biblia API", website: "https://www.logos.com/", categorie: "Bibliotheek (extern)",
    zoekmogelijkheden: "In Logos zelf", api: "Biblia API (bibliaapi.com) — volgens opdrachtgever en eerdere documentatie gesloten voor nieuwe registraties",
    toegangsvoorwaarden: "Eigen Logos-licentie geeft geen recht om teksten in een andere applicatie te gebruiken; Biblia-voorwaarden beperken opslag in een andere database",
    licentie: "Commercieel, per boek", volledigeTekst: "Nee (niet voor externe apps)", ...basis, kosten: "Betaald (eigen bibliotheek)",
    geschiktheidPilot: "Alleen doorverwijzing (ref.ly-links) en import van eigen notities/exports waarvoor de gebruiker rechten heeft",
    status: "alleen doorverwijzing", statusToelichting: "LogosConnector = doorverwijzing per vers; geen cookies, geen database-uitlezing, geen DRM-omzeiling. Actuele Biblia-status niet live gecontroleerd (site geblokkeerd in ontwikkelomgeving).",
    getest: "Linkvorm opgebouwd; niet live gecontroleerd.",
  },
  {
    id: "biblehub", naam: "BibleHub", website: "https://biblehub.com/", categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Per vers: vertalingen, interlineair, commentaren", api: "Geen officiële API bekend", toegangsvoorwaarden: "Geen toestemming voor scraping vastgesteld",
    licentie: "Gemengd (veel PD-teksten, maar site-inhoud/presentatie eigen)", volledigeTekst: "Alleen op de site", ...basis, kosten: "Gratis",
    geschiktheidPilot: "Doorverwijzing", status: "alleen doorverwijzing", statusToelichting: "Links per vers (interlineair, commentaren).", getest: "Linkvorm niet live gecontroleerd.",
  },
  {
    id: "blueletterbible", naam: "Blue Letter Bible", website: "https://www.blueletterbible.org/", categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Lexica, concordantie, commentaren", api: "Geen open API vastgesteld", toegangsvoorwaarden: "Gebruiksvoorwaarden beperken overname",
    licentie: "Gemengd", volledigeTekst: "Alleen op de site", ...basis, kosten: "Gratis", geschiktheidPilot: "Doorverwijzing",
    status: "alleen doorverwijzing", statusToelichting: "Zoeklink per vers.", getest: "Linkvorm niet live gecontroleerd.",
  },
  {
    id: "netbible", naam: "NET Bible (met vertaalnotities)", website: "https://netbible.org/", categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Tekst + ±60.000 vertaalnotities", api: "labs.bible.org-API bestond; huidige status niet geverifieerd", toegangsvoorwaarden: "NET-licentie: tekst beperkt vrij citeerbaar; notities beschermd",
    licentie: "© Biblical Studies Press; beperkt gebruik", volledigeTekst: "Op de site", ...basis, kosten: "Gratis lezen",
    geschiktheidPilot: "Doorverwijzing — waardevol voor vertaalkeuzes", status: "alleen doorverwijzing", statusToelichting: "Link per hoofdstuk.", getest: "Niet live gecontroleerd.",
  },
  {
    id: "apibible", naam: "API.Bible (American Bible Society)", website: "https://scripture.api.bible/", categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Veel vertalingen via API", api: "REST met sleutel", toegangsvoorwaarden: "Registratie; per vertaling eigen voorwaarden, caching beperkt, attributie verplicht",
    licentie: "Per vertaling (veel beschermd)", volledigeTekst: "Per vertaling", ...basis, kosten: "Gratis tier (voorwaarden controleren)",
    geschiktheidPilot: "Later — bv. voor een moderne NL-vertaling als die daar onder een passende licentie beschikbaar is",
    status: "niet beschikbaar", statusToelichting: "Niet gekoppeld in v0.1; vereist sleutel en controle per vertaling.", getest: "Niet getest.",
  },
  {
    id: "crosswire", naam: "CrossWire / SWORD-modules", website: "https://crosswire.org/", categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Lokale modules (Bijbels, commentaren)", api: "SWORD-bibliotheek / modulebestanden", toegangsvoorwaarden: "Per module 'DistributionLicense'",
    licentie: "Per module (PD, CC, of 'Copyrighted; permission to distribute')", volledigeTekst: "Ja (lokaal)", ...basis, kosten: "Gratis",
    geschiktheidPilot: "Middel — de SV en Calvijn komen al uit SWORD-afgeleide open bronnen",
    status: "gedeeltelijk", statusToelichting: "Indirect gebruikt (Statenvertaling-OSIS, Calvijn via CrossWire→Pillar). Geen eigen SWORD-lezer in v0.1.", getest: "Indirect via datasets.",
  },
  {
    id: "moderne-nl-vertalingen", naam: "HSV, NBV21, NBG51, BGT (moderne Nederlandse vertalingen)", website: "https://www.debijbel.nl/", categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Op debijbel.nl / in eigen software", api: "Geen open API voor hergebruik vastgesteld", toegangsvoorwaarden: "Auteursrecht NBG / Stichting HSV",
    licentie: "Beschermd", volledigeTekst: "Nee", ...basis, kosten: "Licentie nodig",
    geschiktheidPilot: "Niet opnemen. Gebruiker kan zelf een vers plakken; Preekhulp linkt naar debijbel.nl.",
    status: "niet beschikbaar", statusToelichting: "Bewust niet geïntegreerd (rechten).", getest: "n.v.t.",
  },
  {
    id: "google-scholar", naam: "Google Scholar", website: "https://scholar.google.com/", categorie: "Academisch",
    zoekmogelijkheden: "Breed", api: "Geen", toegangsvoorwaarden: "Automatisch bevragen niet toegestaan", licentie: "—", volledigeTekst: "Nee", ...basis, kosten: "Gratis",
    geschiktheidPilot: "Alleen als zoeklink", status: "alleen doorverwijzing", statusToelichting: "Zoeklink met de gegenereerde zoekvragen.", getest: "n.v.t.",
  },
  {
    id: "ccel", naam: "Christian Classics Ethereal Library (CCEL)", website: "https://www.ccel.org/", categorie: "Historische commentaren en boeken",
    zoekmogelijkheden: "Klassieke christelijke teksten", api: "Geen gedocumenteerde API vastgesteld", toegangsvoorwaarden: "Teksten vaak PD, site-edities met eigen voorwaarden",
    licentie: "Gemengd", volledigeTekst: "Op de site", ...basis, kosten: "Gratis lezen", geschiktheidPilot: "Doorverwijzing; PD-teksten via andere open datasets (Calvijn)",
    status: "alleen doorverwijzing", statusToelichting: "Site was niet bereikbaar in ontwikkelomgeving.", getest: "Niet getest.",
  },
  {
    id: "nl-tijdschriften", naam: "Open-access tijdschriften (Handelingen, Int. Journal of Homiletics, Religie & Samenleving, Ecclesial Futures)", website: "—", categorie: "Academisch",
    zoekmogelijkheden: "Via DOAJ/OpenAlex/Crossref voor zover geïndexeerd", api: "Indirect", toegangsvoorwaarden: "Per tijdschrift", licentie: "Per tijdschrift (vaak CC BY)",
    volledigeTekst: "Via links", ...basis, kosten: "Gratis", geschiktheidPilot: "Hoog voor homiletiek/praktische theologie",
    status: "gedeeltelijk", statusToelichting: "Geen aparte connectors; indexering per tijdschrift in DOAJ/OpenAlex nog live te controleren.", getest: "Niet getest.",
  },
];

export function alleBronkaarten(): Bronkaart[] {
  return [...CONNECTORS.map((c) => c.kaart), ...EXTRA_KAARTEN];
}
