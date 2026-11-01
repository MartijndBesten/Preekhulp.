# Bronkaarten

_Gegenereerd uit `src/lib/sources/registry.ts` en `datasets.ts` — niet met de hand bewerken._

Statussen: **werkend** = gebouwd én getest · **gedeeltelijk** = gebouwd, (nog) niet live getest of met beperkingen · **alleen doorverwijzing** = link, geen koppeling · **niet beschikbaar** = bewust niet gekoppeld.

| Bron | Categorie | Status | Volledige tekst | Licentie |
|---|---|---|---|---|
| Bijbelteksten (lokaal): Statenvertaling + Berean Standard Bible | Bijbel en grondtaal | werkend | Ja | SV: CC0/publiek domein (editie 1888-transcriptie). BSB: publiek domein. |
| Grondtekst (lokaal): STEPBible TAHOT/TAGNT + TBESH/TBESG | Bijbel en grondtaal | werkend | Ja (Hebreeuwse Leningradensis; Griekse NA28-woorden gemarkeerd) | CC BY 4.0 (per bestand gecontroleerd in de README van de repository) — commercieel gebruik toegestaan met naamsvermelding |
| Kruisverwijzingen (lokaal): OpenBible.info | Bijbel en grondtaal | werkend | n.v.t. | CC BY 4.0 |
| Historische commentaren (lokaal): Kanttekeningen SV, Calvijn, Matthew Henry (+ optioneel kerkvaders) | Historische commentaren en boeken | werkend | Ja (per vers of perikoop) | Zie per werk (tabel 'werken') |
| Eigen bibliotheek (lokaal): preken, notities, transcripten, toegestane fragmenten | Eigen bibliotheek | werkend | Ja | Privé |
| HelloAO Free Use Bible API — publiek-domeincommentaren | Historische commentaren en boeken | gedeeltelijk | Ja (per vers) | Publiek domein (teksten) |
| OpenAlex | Academisch | gedeeltelijk | Nee — alleen links naar open-accessversies | Metadata CC0 |
| Protestantse Theologische Universiteit (via OpenAlex + doorverwijzing) | Academisch | gedeeltelijk | Alleen via open-accesslinks van OpenAlex | Per publicatie |
| Crossref | Academisch | gedeeltelijk | Nee | Metadata grotendeels vrij (CC0-feiten) |
| DOAJ — Directory of Open Access Journals | Academisch | gedeeltelijk | Via link naar tijdschrift | Metadata CC0; artikelen per tijdschrift-licentie (vaak CC BY) |
| Semantic Scholar | Academisch | gedeeltelijk | Nee (soms open-access-PDF-link) | API-licentievoorwaarden S2 |
| CORE (open-access repositories) | Academisch | gedeeltelijk | Soms (fullText-veld) | Per publicatie |
| Internet Archive | Historische commentaren en boeken | gedeeltelijk | Soms (publiek-domeinitems met tekstlaag) | Per item (licenseurl/rights); 'uitleenbaar' ≠ herbruikbaar |
| Open Library | Historische commentaren en boeken | gedeeltelijk | Nee (alleen via Internet Archive bij publiek domein) | Catalogusdata CC0 |
| Project Gutenberg (via Gutendex) | Historische commentaren en boeken | gedeeltelijk | Ja (tekstbestanden) | Publiek domein in de VS; per land controleren (NL: 70 jaar na overlijden) |
| Google Books | Historische commentaren en boeken | gedeeltelijk | Nee (alleen beschrijving/fragmentweergave bij Google) | Inhoud niet herbruikbaar (behalve publiek domein-weergave) |
| YouTube Data API v3 (ontdekken van preken en lezingen) | Video en preken | gedeeltelijk | Nee — transcript alleen via de gebruiker (eigen bestand/eigen kanaal) | Metadata via API; video-inhoud blijft van de maker |
| Logos Bible Software / Biblia API | Bibliotheek (extern) | alleen doorverwijzing | Nee (niet voor externe apps) | Commercieel, per boek |
| BibleHub | Bijbel en grondtaal | alleen doorverwijzing | Alleen op de site | Gemengd (veel PD-teksten, maar site-inhoud/presentatie eigen) |
| Blue Letter Bible | Bijbel en grondtaal | alleen doorverwijzing | Alleen op de site | Gemengd |
| NET Bible (met vertaalnotities) | Bijbel en grondtaal | alleen doorverwijzing | Op de site | © Biblical Studies Press; beperkt gebruik |
| API.Bible (American Bible Society) | Bijbel en grondtaal | niet beschikbaar | Per vertaling | Per vertaling (veel beschermd) |
| CrossWire / SWORD-modules | Bijbel en grondtaal | gedeeltelijk | Ja (lokaal) | Per module (PD, CC, of 'Copyrighted; permission to distribute') |
| HSV, NBV21, NBG51, BGT (moderne Nederlandse vertalingen) | Bijbel en grondtaal | niet beschikbaar | Nee | Beschermd |
| Google Scholar | Academisch | alleen doorverwijzing | Nee | — |
| Christian Classics Ethereal Library (CCEL) | Historische commentaren en boeken | alleen doorverwijzing | Op de site | Gemengd |
| Open-access tijdschriften (Handelingen, Int. Journal of Homiletics, Religie & Samenleving, Ecclesial Futures) | Academisch | gedeeltelijk | Via links | Per tijdschrift (vaak CC BY) |

## Lokale datasets (vastgepind)

| Dataset | Repository @ commit | Licentie | Attributie |
|---|---|---|---|
| STEPBible-Data (TAHOT, TAGNT, TBESH, TBESG, morfologie) | STEPBible/STEPBible-Data @ `be4191f008` | CC BY 4.0 | Grondtekstdata: STEP Bible (www.STEPBible.org), Tyndale House Cambridge — CC BY 4.0 |
| Statenvertaling met Strong-nummers en Kanttekeningen (OSIS) | Isidore-Guild/statenvertaling @ `d39d8ee01c` | CC0 1.0 (tekst publiek domein; transcriptie naar de editie van 1888) | Statenvertaling en Kanttekeningen, digitale editie Isidore-Guild (CC0) |
| Berean Standard Bible + OpenBible.info-kruisverwijzingen | trekhleb/bible-cross-references @ `2abb53a56a` | BSB: publiek domein; kruisverwijzingen: CC BY 4.0 (OpenBible.info) | Berean Standard Bible (publiek domein); kruisverwijzingen: OpenBible.info (CC BY), grotendeels uit de Treasury of Scripture Knowledge |
| Calvijn, commentaren (Engelse vertaling, Calvin Translation Society) | thefrenchpressed/pillar-commentary-data @ `ba1587984c` | Tekst publiek domein (via CrossWire/CCEL); conversie MIT | John Calvin's Commentaries (publiek domein), conversie Pillar Commentary Data |
| Matthew Henry, Complete Commentary (1706–1714) | lyteword/mhenry-complete @ `fff64e68c5` | CC0 1.0 (tekst publiek domein) | Matthew Henry, Commentary on the Whole Bible (publiek domein), Markdown-editie lyteword (CC0) |
| Historical Christian Faith — Commentaries Database (kerkvaders en latere uitleggers) (optioneel) | HistoricalChristianFaith/Commentaries-Database @ `bbf63b2b1f` | Gemengd: compilatie publiek domein; een deel betreft citaten onder Amerikaanse 'fair use' | HistoricalChristianFaith/Commentaries-Database |

## Details per bron

### Bijbelteksten (lokaal): Statenvertaling + Berean Standard Bible

- **Officiële website:** https://github.com/Isidore-Guild/statenvertaling
- **Zoekmogelijkheden:** Verwijzing (NL/EN boeknamen), woord- en zinszoeken (FTS5)
- **API's of datasets:** Geen API nodig: dataset lokaal in SQLite
- **Toegangsvoorwaarden:** Geen
- **Licentievoorwaarden:** SV: CC0/publiek domein (editie 1888-transcriptie). BSB: publiek domein.
- **Full-textgebruik:** Ja
- **Actualiteit:** Vastgepinde versie (commit in datasets.ts)
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Basis van elk onderzoek
- **Status:** werkend — Geïmporteerd en getest. HSV/NBV21 zijn bewust niet opgenomen (auteursrecht; zie bronkaart Moderne NL-vertalingen).
- **Getest:** 01-11-2026: import 31.102 SV-verzen, 31.086 BSB-verzen; zoeken en ophalen getest.

### Grondtekst (lokaal): STEPBible TAHOT/TAGNT + TBESH/TBESG

- **Officiële website:** https://github.com/STEPBible/STEPBible-Data
- **Zoekmogelijkheden:** Per vers: woord, lemma, morfologie, Strong; concordantie per lemma; motiefanalyse
- **API's of datasets:** Geen API nodig: tab-gescheiden bestanden, lokaal in SQLite
- **Toegangsvoorwaarden:** Naamsvermelding 'STEP Bible' (www.STEPBible.org)
- **Licentievoorwaarden:** CC BY 4.0 (per bestand gecontroleerd in de README van de repository) — commercieel gebruik toegestaan met naamsvermelding
- **Full-textgebruik:** Ja (Hebreeuwse Leningradensis; Griekse NA28-woorden gemarkeerd)
- **Actualiteit:** Vastgepinde commit; STEP werkt de data periodiek bij
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Hoog — kern van de grondtaalfuncties
- **Status:** werkend — Geïmporteerd en getest. Betekenissen komen uit TBESH/TBESG (verkorte BDB/Abbott-Smith); geen eigen woordbetekenissen.
- **Getest:** 01-11-2026: 439.457 woorden geïmporteerd; Gen 31:13 woord-voor-woord gecontroleerd.

### Kruisverwijzingen (lokaal): OpenBible.info

- **Officiële website:** https://www.openbible.info/labs/cross-references/
- **Zoekmogelijkheden:** Per vers, uitgaand en inkomend, met stemmen (populariteit, geen exegetisch oordeel)
- **API's of datasets:** Geen API: dataset (via trekhleb/bible-cross-references, vastgepind)
- **Toegangsvoorwaarden:** Naamsvermelding
- **Licentievoorwaarden:** CC BY 4.0
- **Full-textgebruik:** n.v.t.
- **Actualiteit:** Datasetversie 2026-09-21
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Hoog als vindplaats; stemmen zijn geen bewijs
- **Status:** werkend — 341.282 verwijzingen met ≥1 stem geïmporteerd.
- **Getest:** 01-11-2026: Gen 28:12 → Joh 1:51 (36 stemmen) gecontroleerd.

### Historische commentaren (lokaal): Kanttekeningen SV, Calvijn, Matthew Henry (+ optioneel kerkvaders)

- **Officiële website:** https://github.com/thefrenchpressed/pillar-commentary-data
- **Zoekmogelijkheden:** Per vers/perikoop en vrij zoeken (FTS5)
- **API's of datasets:** Geen API: open datasets lokaal
- **Toegangsvoorwaarden:** Kanttekeningen/Calvijn/Henry: publiek domein. Kerkvaders-database: gemengde rechten (alleen eigen studie, standaard uit).
- **Licentievoorwaarden:** Zie per werk (tabel 'werken')
- **Full-textgebruik:** Ja (per vers of perikoop)
- **Actualiteit:** Historisch; vastgepinde datasets
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Hoog — oudere uitleg met exacte tekst, dus citaten zijn controleerbaar
- **Status:** werkend — Calvijn in Engelse vertaling (1844–1856); Nederlandse Calvijn-vertalingen niet opgenomen (rechten per editie onbekend).
- **Getest:** 01-11-2026: Calvijn 13.106, Henry 4.259, Kanttekeningen 59.385 items; Gen 31:13 gecontroleerd.

### Eigen bibliotheek (lokaal): preken, notities, transcripten, toegestane fragmenten

- **Officiële website:** lokaal
- **Zoekmogelijkheden:** Vrij zoeken (FTS5) met pagina/sectie/tijdstip
- **API's of datasets:** n.v.t.
- **Toegangsvoorwaarden:** Gebruiker is verantwoordelijk voor de rechten op geüploade bestanden
- **Licentievoorwaarden:** Privé
- **Full-textgebruik:** Ja
- **Actualiteit:** Direct
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Hoog
- **Status:** werkend — Standaard privé: inhoud gaat niet naar een AI-aanbieder, tenzij dat in Instellingen is toegestaan.
- **Getest:** 01-11-2026: upload TXT/MD/SRT/VTT/DOCX/PDF, zoeken, verwijderen (zie tests).

### HelloAO Free Use Bible API — publiek-domeincommentaren

- **Officiële website:** https://bible.helloao.org/
- **Zoekmogelijkheden:** Per hoofdstuk: Keil-Delitzsch, John Gill, Adam Clarke, Jamieson-Fausset-Brown
- **API's of datasets:** Statische JSON (bible.helloao.org/api/c/{id}/{BOEK}/{hoofdstuk}.json)
- **Toegangsvoorwaarden:** Vrij te gebruiken volgens aanbieder ('free use'); teksten zelf publiek domein
- **Licentievoorwaarden:** Publiek domein (teksten)
- **Full-textgebruik:** Ja (per vers)
- **Actualiteit:** Statisch
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Hoog — voegt Keil-Delitzsch toe (belangrijk exegetisch OT-commentaar)
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving). URL-patroon afgeleid uit documentatie van een afgeleid project (Pillar Commentary Data).
- **Getest:** Niet live getest.

### OpenAlex

- **Officiële website:** https://openalex.org/
- **Zoekmogelijkheden:** Trefwoord, auteur, instelling, jaar, open access, type
- **API's of datasets:** REST JSON (api.openalex.org/works)
- **Toegangsvoorwaarden:** Open; optioneel API-sleutel en contactadres (polite pool). Actuele sleutel-/kredietregels nog te controleren in docs.openalex.org.
- **Licentievoorwaarden:** Metadata CC0
- **Full-textgebruik:** Nee — alleen links naar open-accessversies
- **Actualiteit:** Dagelijks bijgewerkt
- **Kosten:** Gratis (sleutel/limieten volgens aanbieder)
- **Technische uitvoerbaarheid:** Hoog (JSON-API)
- **Geschiktheid pilot:** Hoog als vindplaats academische literatuur
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Unit-test met vaste voorbeeldrespons (vorm), geen live-aanroep.

### Protestantse Theologische Universiteit (via OpenAlex + doorverwijzing)

- **Officiële website:** https://www.pthu.nl/
- **Zoekmogelijkheden:** Publicaties met PThU-affiliatie (OpenAlex); doorverwijzing naar PThU-site voor het research portal en de theologische repository
- **API's of datasets:** Geen eigen gedocumenteerde API gevonden/gecontroleerd; OAI-PMH of portal-API nog te onderzoeken
- **Toegangsvoorwaarden:** Vrij lezen ≠ vrij hergebruik; per publicatie licentie controleren
- **Licentievoorwaarden:** Per publicatie
- **Full-textgebruik:** Alleen via open-accesslinks van OpenAlex
- **Actualiteit:** Afhankelijk van OpenAlex-indexering
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Middel
- **Geschiktheid pilot:** Middel — waardevol voor PKN-context; directe harvesting eerst juridisch/technisch checken
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving). De PThU-website was in de ontwikkelomgeving niet bereikbaar; repository-interface niet geverifieerd.
- **Getest:** Niet live getest.

### Crossref

- **Officiële website:** https://www.crossref.org/
- **Zoekmogelijkheden:** Bibliografisch zoeken; DOI-verificatie
- **API's of datasets:** REST JSON (api.crossref.org/works)
- **Toegangsvoorwaarden:** Open; contactadres aanbevolen
- **Licentievoorwaarden:** Metadata grotendeels vrij (CC0-feiten)
- **Full-textgebruik:** Nee
- **Actualiteit:** Dagelijks bijgewerkt
- **Kosten:** Gratis (sleutel/limieten volgens aanbieder)
- **Technische uitvoerbaarheid:** Hoog (JSON-API)
- **Geschiktheid pilot:** Hoog voor bibliografische verificatie (bestaat deze DOI/titel echt?)
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Unit-test met vaste voorbeeldrespons, geen live-aanroep.

### DOAJ — Directory of Open Access Journals

- **Officiële website:** https://doaj.org/
- **Zoekmogelijkheden:** Artikelen in open-accesstijdschriften
- **API's of datasets:** REST JSON (doaj.org/api/search/articles/…)
- **Toegangsvoorwaarden:** Open
- **Licentievoorwaarden:** Metadata CC0; artikelen per tijdschrift-licentie (vaak CC BY)
- **Full-textgebruik:** Via link naar tijdschrift
- **Actualiteit:** Dagelijks bijgewerkt
- **Kosten:** Gratis (sleutel/limieten volgens aanbieder)
- **Technische uitvoerbaarheid:** Hoog (JSON-API)
- **Geschiktheid pilot:** Hoog — o.a. open-access theologie/homiletiek (bv. Int. Journal of Homiletics, Handelingen indien geïndexeerd)
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Niet live getest.

### Semantic Scholar

- **Officiële website:** https://www.semanticscholar.org/
- **Zoekmogelijkheden:** Trefwoord; citaties
- **API's of datasets:** Graph API (api.semanticscholar.org/graph/v1/paper/search)
- **Toegangsvoorwaarden:** Zonder sleutel strenge gedeelde limiet; gratis sleutel aan te vragen
- **Licentievoorwaarden:** API-licentievoorwaarden S2
- **Full-textgebruik:** Nee (soms open-access-PDF-link)
- **Actualiteit:** Dagelijks bijgewerkt
- **Kosten:** Gratis (sleutel/limieten volgens aanbieder)
- **Technische uitvoerbaarheid:** Hoog (JSON-API)
- **Geschiktheid pilot:** Middel — theologie minder goed gedekt dan exacte wetenschappen
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Niet live getest.

### CORE (open-access repositories)

- **Officiële website:** https://core.ac.uk/
- **Zoekmogelijkheden:** Trefwoord; volledige tekst van open-accesspublicaties uit repositories
- **API's of datasets:** REST v3 (api.core.ac.uk/v3/search/works), Bearer-sleutel
- **Toegangsvoorwaarden:** Gratis API-sleutel na registratie; gebruiksvoorwaarden CORE
- **Licentievoorwaarden:** Per publicatie
- **Full-textgebruik:** Soms (fullText-veld)
- **Actualiteit:** Dagelijks bijgewerkt
- **Kosten:** Gratis (sleutel/limieten volgens aanbieder)
- **Technische uitvoerbaarheid:** Hoog (JSON-API)
- **Geschiktheid pilot:** Middel-hoog voor repository-materiaal (o.a. Nederlandse universiteiten)
- **Status:** gedeeltelijk — Vereist eigen gratis sleutel. Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Niet live getest.

### Internet Archive

- **Officiële website:** https://archive.org/
- **Zoekmogelijkheden:** Metadata (titel, maker, datum, collectie); per item tekstbestanden
- **API's of datasets:** advancedsearch.php (JSON)
- **Toegangsvoorwaarden:** Open; rechten per item verschillen (veel publiek domein, ook uitleenboeken!)
- **Licentievoorwaarden:** Per item (licenseurl/rights); 'uitleenbaar' ≠ herbruikbaar
- **Full-textgebruik:** Soms (publiek-domeinitems met tekstlaag)
- **Actualiteit:** Continu
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Middel (kwaliteit OCR wisselend)
- **Geschiktheid pilot:** Middel — vindplaats voor oude commentaren (Keil-Delitzsch, Gill, Lange e.d.)
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving). Alleen metadata; tekst ophalen pas na rechtencontrole per item.
- **Getest:** Niet live getest.

### Open Library

- **Officiële website:** https://openlibrary.org/
- **Zoekmogelijkheden:** Titel/auteur/onderwerp
- **API's of datasets:** search.json
- **Toegangsvoorwaarden:** Open; uitlenen ≠ hergebruik
- **Licentievoorwaarden:** Catalogusdata CC0
- **Full-textgebruik:** Nee (alleen via Internet Archive bij publiek domein)
- **Actualiteit:** Continu
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Middel — bibliografische controle van boektitels
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Niet live getest.

### Project Gutenberg (via Gutendex)

- **Officiële website:** https://www.gutenberg.org/
- **Zoekmogelijkheden:** Titel/auteur
- **API's of datasets:** Gutendex JSON-API (gutendex.com/books) — onofficieel, open source
- **Toegangsvoorwaarden:** Gutenberg: geen massale automatische downloads van gutenberg.org; gebruik mirrors/offline-catalogus
- **Licentievoorwaarden:** Publiek domein in de VS; per land controleren (NL: 70 jaar na overlijden)
- **Full-textgebruik:** Ja (tekstbestanden)
- **Actualiteit:** Continu
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** Hoog voor metadata
- **Geschiktheid pilot:** Laag-middel — weinig Bijbelcommentaren
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Niet live getest.

### Google Books

- **Officiële website:** https://books.google.com/
- **Zoekmogelijkheden:** Titel/auteur/trefwoord, ook binnen gedigitaliseerde boeken
- **API's of datasets:** Books API v1 (volumes); sleutel optioneel
- **Toegangsvoorwaarden:** Google API-voorwaarden; inhoud alleen bekijken via Google
- **Licentievoorwaarden:** Inhoud niet herbruikbaar (behalve publiek domein-weergave)
- **Full-textgebruik:** Nee (alleen beschrijving/fragmentweergave bij Google)
- **Actualiteit:** Continu
- **Kosten:** Gratis binnen quotum
- **Technische uitvoerbaarheid:** Hoog
- **Geschiktheid pilot:** Middel — vindplaats; nooit inhoud kopiëren
- **Status:** gedeeltelijk — Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).
- **Getest:** Niet live getest.

### YouTube Data API v3 (ontdekken van preken en lezingen)

- **Officiële website:** https://developers.google.com/youtube/v3
- **Zoekmogelijkheden:** Zoeken op tekst (Bijbelgedeelte, thema, predikant), taalvoorkeur; titel, kanaal, beschrijving, datum, duur
- **API's of datasets:** search.list (100 quota-eenheden per aanroep) + videos.list (1 eenheid); API-sleutel van Google Cloud
- **Toegangsvoorwaarden:** YouTube API Services Terms; captions.download alleen met OAuth en (in de praktijk) voor eigen video's — niet voor willekeurige video's van derden
- **Licentievoorwaarden:** Metadata via API; video-inhoud blijft van de maker
- **Full-textgebruik:** Nee — transcript alleen via de gebruiker (eigen bestand/eigen kanaal)
- **Actualiteit:** Actueel
- **Kosten:** Gratis binnen dagquotum (standaard 10.000 eenheden ≈ 100 zoekopdrachten)
- **Technische uitvoerbaarheid:** Hoog voor metadata
- **Geschiktheid pilot:** Hoog voor ontdekken; inhoudelijke analyse alleen met aangeleverd transcript
- **Status:** gedeeltelijk — Werkt na invoer van een eigen sleutel; niet live getest in de ontwikkelomgeving. Relevantie zonder transcript = alleen op metadata.
- **Getest:** URL-herkenning, tijdlinks en transcriptimport getest (unit-tests); API-aanroep niet live getest.

### Logos Bible Software / Biblia API

- **Officiële website:** https://www.logos.com/
- **Zoekmogelijkheden:** In Logos zelf
- **API's of datasets:** Biblia API (bibliaapi.com) — volgens opdrachtgever en eerdere documentatie gesloten voor nieuwe registraties
- **Toegangsvoorwaarden:** Eigen Logos-licentie geeft geen recht om teksten in een andere applicatie te gebruiken; Biblia-voorwaarden beperken opslag in een andere database
- **Licentievoorwaarden:** Commercieel, per boek
- **Full-textgebruik:** Nee (niet voor externe apps)
- **Actualiteit:** —
- **Kosten:** Betaald (eigen bibliotheek)
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Alleen doorverwijzing (ref.ly-links) en import van eigen notities/exports waarvoor de gebruiker rechten heeft
- **Status:** alleen doorverwijzing — LogosConnector = doorverwijzing per vers; geen cookies, geen database-uitlezing, geen DRM-omzeiling. Actuele Biblia-status niet live gecontroleerd (site geblokkeerd in ontwikkelomgeving).
- **Getest:** Linkvorm opgebouwd; niet live gecontroleerd.

### BibleHub

- **Officiële website:** https://biblehub.com/
- **Zoekmogelijkheden:** Per vers: vertalingen, interlineair, commentaren
- **API's of datasets:** Geen officiële API bekend
- **Toegangsvoorwaarden:** Geen toestemming voor scraping vastgesteld
- **Licentievoorwaarden:** Gemengd (veel PD-teksten, maar site-inhoud/presentatie eigen)
- **Full-textgebruik:** Alleen op de site
- **Actualiteit:** —
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Doorverwijzing
- **Status:** alleen doorverwijzing — Links per vers (interlineair, commentaren).
- **Getest:** Linkvorm niet live gecontroleerd.

### Blue Letter Bible

- **Officiële website:** https://www.blueletterbible.org/
- **Zoekmogelijkheden:** Lexica, concordantie, commentaren
- **API's of datasets:** Geen open API vastgesteld
- **Toegangsvoorwaarden:** Gebruiksvoorwaarden beperken overname
- **Licentievoorwaarden:** Gemengd
- **Full-textgebruik:** Alleen op de site
- **Actualiteit:** —
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Doorverwijzing
- **Status:** alleen doorverwijzing — Zoeklink per vers.
- **Getest:** Linkvorm niet live gecontroleerd.

### NET Bible (met vertaalnotities)

- **Officiële website:** https://netbible.org/
- **Zoekmogelijkheden:** Tekst + ±60.000 vertaalnotities
- **API's of datasets:** labs.bible.org-API bestond; huidige status niet geverifieerd
- **Toegangsvoorwaarden:** NET-licentie: tekst beperkt vrij citeerbaar; notities beschermd
- **Licentievoorwaarden:** © Biblical Studies Press; beperkt gebruik
- **Full-textgebruik:** Op de site
- **Actualiteit:** —
- **Kosten:** Gratis lezen
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Doorverwijzing — waardevol voor vertaalkeuzes
- **Status:** alleen doorverwijzing — Link per hoofdstuk.
- **Getest:** Niet live gecontroleerd.

### API.Bible (American Bible Society)

- **Officiële website:** https://scripture.api.bible/
- **Zoekmogelijkheden:** Veel vertalingen via API
- **API's of datasets:** REST met sleutel
- **Toegangsvoorwaarden:** Registratie; per vertaling eigen voorwaarden, caching beperkt, attributie verplicht
- **Licentievoorwaarden:** Per vertaling (veel beschermd)
- **Full-textgebruik:** Per vertaling
- **Actualiteit:** —
- **Kosten:** Gratis tier (voorwaarden controleren)
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Later — bv. voor een moderne NL-vertaling als die daar onder een passende licentie beschikbaar is
- **Status:** niet beschikbaar — Niet gekoppeld in v0.1; vereist sleutel en controle per vertaling.
- **Getest:** Niet getest.

### CrossWire / SWORD-modules

- **Officiële website:** https://crosswire.org/
- **Zoekmogelijkheden:** Lokale modules (Bijbels, commentaren)
- **API's of datasets:** SWORD-bibliotheek / modulebestanden
- **Toegangsvoorwaarden:** Per module 'DistributionLicense'
- **Licentievoorwaarden:** Per module (PD, CC, of 'Copyrighted; permission to distribute')
- **Full-textgebruik:** Ja (lokaal)
- **Actualiteit:** —
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Middel — de SV en Calvijn komen al uit SWORD-afgeleide open bronnen
- **Status:** gedeeltelijk — Indirect gebruikt (Statenvertaling-OSIS, Calvijn via CrossWire→Pillar). Geen eigen SWORD-lezer in v0.1.
- **Getest:** Indirect via datasets.

### HSV, NBV21, NBG51, BGT (moderne Nederlandse vertalingen)

- **Officiële website:** https://www.debijbel.nl/
- **Zoekmogelijkheden:** Op debijbel.nl / in eigen software
- **API's of datasets:** Geen open API voor hergebruik vastgesteld
- **Toegangsvoorwaarden:** Auteursrecht NBG / Stichting HSV
- **Licentievoorwaarden:** Beschermd
- **Full-textgebruik:** Nee
- **Actualiteit:** —
- **Kosten:** Licentie nodig
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Niet opnemen. Gebruiker kan zelf een vers plakken; Preekhulp linkt naar debijbel.nl.
- **Status:** niet beschikbaar — Bewust niet geïntegreerd (rechten).
- **Getest:** n.v.t.

### Google Scholar

- **Officiële website:** https://scholar.google.com/
- **Zoekmogelijkheden:** Breed
- **API's of datasets:** Geen
- **Toegangsvoorwaarden:** Automatisch bevragen niet toegestaan
- **Licentievoorwaarden:** —
- **Full-textgebruik:** Nee
- **Actualiteit:** —
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Alleen als zoeklink
- **Status:** alleen doorverwijzing — Zoeklink met de gegenereerde zoekvragen.
- **Getest:** n.v.t.

### Christian Classics Ethereal Library (CCEL)

- **Officiële website:** https://www.ccel.org/
- **Zoekmogelijkheden:** Klassieke christelijke teksten
- **API's of datasets:** Geen gedocumenteerde API vastgesteld
- **Toegangsvoorwaarden:** Teksten vaak PD, site-edities met eigen voorwaarden
- **Licentievoorwaarden:** Gemengd
- **Full-textgebruik:** Op de site
- **Actualiteit:** —
- **Kosten:** Gratis lezen
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Doorverwijzing; PD-teksten via andere open datasets (Calvijn)
- **Status:** alleen doorverwijzing — Site was niet bereikbaar in ontwikkelomgeving.
- **Getest:** Niet getest.

### Open-access tijdschriften (Handelingen, Int. Journal of Homiletics, Religie & Samenleving, Ecclesial Futures)

- **Officiële website:** —
- **Zoekmogelijkheden:** Via DOAJ/OpenAlex/Crossref voor zover geïndexeerd
- **API's of datasets:** Indirect
- **Toegangsvoorwaarden:** Per tijdschrift
- **Licentievoorwaarden:** Per tijdschrift (vaak CC BY)
- **Full-textgebruik:** Via links
- **Actualiteit:** —
- **Kosten:** Gratis
- **Technische uitvoerbaarheid:** —
- **Geschiktheid pilot:** Hoog voor homiletiek/praktische theologie
- **Status:** gedeeltelijk — Geen aparte connectors; indexering per tijdschrift in DOAJ/OpenAlex nog live te controleren.
- **Getest:** Niet getest.
