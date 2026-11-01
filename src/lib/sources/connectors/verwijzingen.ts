// Doorverwijzingen: bronnen waarvoor geen toegestane automatische koppeling is vastgesteld.
// De app opent alleen een zoek- of leespagina bij de aanbieder; er wordt niets opgehaald of opgeslagen.
import { ontleedVkey } from "../../scripture/books";
import type { BijbelRef } from "../../scripture/reference";

export interface Doorverwijzing {
  bron: string;
  label: string;
  url: string;
  toelichting: string;
}

const BH_SLUG = (en: string) => en.toLowerCase().replace(/ /g, "_").replace("song_of_songs", "songs");

export function verwijzingenVoorRef(r: BijbelRef): Doorverwijzing[] {
  const a = ontleedVkey(r.start);
  const vers = a.vers || 1;
  const osisVers = `${a.boek.osis}.${a.hoofdstuk}.${vers}`;
  const zoekterm = `${a.boek.en} ${a.hoofdstuk}:${vers}`;
  return [
    { bron: "STEP Bible", label: "STEP Bible (grondtekst, lexica)", url: `https://www.stepbible.org/?q=reference=${osisVers}`, toelichting: "Open website van Tyndale House; zelfde data als lokaal, met uitgebreidere weergave." },
    { bron: "BibleHub", label: "BibleHub — interlineair", url: `https://biblehub.com/interlinear/${BH_SLUG(a.boek.en)}/${a.hoofdstuk}-${vers}.htm`, toelichting: "Alleen doorverwijzing: geen officiële API; scrapen niet toegestaan zonder toestemming." },
    { bron: "BibleHub", label: "BibleHub — commentaren bij dit vers", url: `https://biblehub.com/commentaries/${BH_SLUG(a.boek.en)}/${a.hoofdstuk}-${vers}.htm`, toelichting: "Verzameling (deels publiek-domein) commentaren; lezen bij BibleHub." },
    { bron: "Blue Letter Bible", label: "Blue Letter Bible", url: `https://www.blueletterbible.org/search/preSearch.cfm?Criteria=${encodeURIComponent(zoekterm)}`, toelichting: "Alleen doorverwijzing; gebruiksvoorwaarden staan geen automatische overname toe." },
    { bron: "NET Bible", label: "NET Bible met vertaalnotities", url: `https://netbible.org/bible/${encodeURIComponent(a.boek.en)}+${a.hoofdstuk}`, toelichting: "Notities zijn auteursrechtelijk beschermd; lezen bij netbible.org." },
    { bron: "Logos", label: "Openen in Logos (Reftagger-link)", url: `https://ref.ly/${a.boek.osis}${a.hoofdstuk}.${vers}`, toelichting: "Opent de passage in Logos/Biblia als je dat hebt. Geen toegang tot je Logos-bibliotheek vanuit Preekhulp (geen officiële API voor nieuwe gebruikers). Link-vorm niet live gecontroleerd." },
  ];
}

export function verwijzingenVoorZoekterm(q: string): Doorverwijzing[] {
  const e = encodeURIComponent(q);
  return [
    { bron: "Google Scholar", label: "Google Scholar", url: `https://scholar.google.com/scholar?q=${e}`, toelichting: "Geen API; automatisch zoeken is niet toegestaan. Alleen als zoeklink." },
    { bron: "PThU", label: "PThU-website (research portal / repository)", url: `https://www.google.com/search?q=${encodeURIComponent(`site:pthu.nl ${q}`)}`, toelichting: "Zoeklink binnen pthu.nl; directe repository-koppeling nog niet geverifieerd." },
    { bron: "Theologische Universiteit Utrecht", label: "TUU (site-zoeklink)", url: `https://www.google.com/search?q=${encodeURIComponent(`site:tuu.nl ${q}`)}`, toelichting: "Zoeklink." },
    { bron: "VU Research Portal", label: "VU Research Portal (site-zoeklink)", url: `https://www.google.com/search?q=${encodeURIComponent(`site:research.vu.nl ${q}`)}`, toelichting: "Zoeklink; Pure-portal, API niet geverifieerd." },
    { bron: "Radboud Repository", label: "Radboud Repository (site-zoeklink)", url: `https://www.google.com/search?q=${encodeURIComponent(`site:repository.ubn.ru.nl ${q}`)}`, toelichting: "Zoeklink." },
    { bron: "CCEL", label: "Christian Classics Ethereal Library", url: `https://www.google.com/search?q=${encodeURIComponent(`site:ccel.org ${q}`)}`, toelichting: "Lezen bij CCEL; hun site-inhoud kent eigen voorwaarden. Calvijn (PD) zit al lokaal." },
    { bron: "YouTube", label: "YouTube (zoeken zonder API-sleutel)", url: `https://www.youtube.com/results?search_query=${e}`, toelichting: "Zoeklink; Preekhulp analyseert geen video zonder transcript." },
  ];
}
