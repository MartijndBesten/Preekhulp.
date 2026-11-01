// Vastgepinde open datasets (commit-SHA's) die lokaal worden opgeslagen.
// Alleen materiaal waarvan de licentie lokale opslag en hergebruik toestaat (zie docs/BRONKAARTEN.md).

export interface Dataset {
  id: string;
  naam: string;
  repo: string; // owner/naam op GitHub
  commit: string;
  licentie: string;
  attributie: string;
  bestanden?: string[]; // losse bestanden (raw.githubusercontent.com)
  map?: string[]; // mappen uit de repository (git sparse checkout of tarball)
  optioneel?: boolean;
  toelichting: string;
}

export const DATASETS: Dataset[] = [
  {
    id: "step",
    naam: "STEPBible-Data (TAHOT, TAGNT, TBESH, TBESG, morfologie)",
    repo: "STEPBible/STEPBible-Data",
    commit: "be4191f0082aeedddb0eff0c02c966292b2bd641",
    licentie: "CC BY 4.0",
    attributie: "Grondtekstdata: STEP Bible (www.STEPBible.org), Tyndale House Cambridge — CC BY 4.0",
    bestanden: [
      "Translators Amalgamated OT+NT/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
      "Translators Amalgamated OT+NT/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
      "Translators Amalgamated OT+NT/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
      "Translators Amalgamated OT+NT/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt",
      "Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
      "Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
      "Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt",
      "Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt",
      "Morphology codes/TEHMC - Translators Expansion of Hebrew Morphology Codes - STEPBible.org CC BY.txt",
      "Morphology codes/TEGMC - Translators Expansion of Greek Morphhology Codes - STEPBible.org CC BY.txt",
    ],
    toelichting: "Hebreeuwse (Leningradensis) en Griekse tekst met lemma, morfologie, Strong-nummers en korte lexica.",
  },
  {
    id: "statenvertaling",
    naam: "Statenvertaling met Strong-nummers en Kanttekeningen (OSIS)",
    repo: "Isidore-Guild/statenvertaling",
    commit: "d39d8ee01ca51f27e3e9c50291a96fc32f49b4d2",
    licentie: "CC0 1.0 (tekst publiek domein; transcriptie naar de editie van 1888)",
    attributie: "Statenvertaling en Kanttekeningen, digitale editie Isidore-Guild (CC0)",
    bestanden: ["STV.xml"],
    toelichting: "Bijbeltekst en de historische Kanttekeningen (1637) in één bestand.",
  },
  {
    id: "bsb-kruisverwijzingen",
    naam: "Berean Standard Bible + OpenBible.info-kruisverwijzingen",
    repo: "trekhleb/bible-cross-references",
    commit: "2abb53a56a38be023201463b95afaf7d6420ebbd",
    licentie: "BSB: publiek domein; kruisverwijzingen: CC BY 4.0 (OpenBible.info)",
    attributie: "Berean Standard Bible (publiek domein); kruisverwijzingen: OpenBible.info (CC BY), grotendeels uit de Treasury of Scripture Knowledge",
    bestanden: ["data/raw/bsb.txt", "data/raw/openbible-cross-references.zip"],
    toelichting: "Moderne Engelse vertaling en ±345.000 kruisverwijzingen met stemmen.",
  },
  {
    id: "calvijn",
    naam: "Calvijn, commentaren (Engelse vertaling, Calvin Translation Society)",
    repo: "thefrenchpressed/pillar-commentary-data",
    commit: "ba1587984c5325c0974577f43cba7e7ed10f3274",
    licentie: "Tekst publiek domein (via CrossWire/CCEL); conversie MIT",
    attributie: "John Calvin's Commentaries (publiek domein), conversie Pillar Commentary Data",
    map: ["c/calvin"],
    toelichting: "Per vers; 47 Bijbelboeken.",
  },
  {
    id: "matthew-henry",
    naam: "Matthew Henry, Complete Commentary (1706–1714)",
    repo: "lyteword/mhenry-complete",
    commit: "fff64e68c59ee4597a2b451cbe4e207adc77148d",
    licentie: "CC0 1.0 (tekst publiek domein)",
    attributie: "Matthew Henry, Commentary on the Whole Bible (publiek domein), Markdown-editie lyteword (CC0)",
    map: ["volume-1", "volume-2", "volume-3", "volume-4", "volume-5", "volume-6"],
    toelichting: "Per perikoop (versgroepen).",
  },
  {
    id: "kerkvaders",
    naam: "Historical Christian Faith — Commentaries Database (kerkvaders en latere uitleggers)",
    repo: "HistoricalChristianFaith/Commentaries-Database",
    commit: "bbf63b2b1fcdbfa193f595548c45191d42c67117",
    licentie: "Gemengd: compilatie publiek domein; een deel betreft citaten onder Amerikaanse 'fair use'",
    attributie: "HistoricalChristianFaith/Commentaries-Database",
    map: ["."],
    optioneel: true,
    toelichting:
      "Optioneel. Alleen auteurs vóór 1900 worden geïmporteerd. Vertalingen kunnen nog beschermd zijn; daarom gelabeld als 'rechten onzeker' en alleen voor eigen studie.",
  },
];
