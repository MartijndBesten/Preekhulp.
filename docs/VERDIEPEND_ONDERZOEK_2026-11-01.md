# Verdiepend technisch en inhoudelijk onderzoek — Preekhulp.

**Datum:** 1 november 2026  
**Doel:** van een goed opgebouwde lokale zoekapp naar aantoonbaar betrouwbare exegetische onderzoeksassistent.  
**Status:** technische bevindingen en officiële externe documentatie gecontroleerd; live API-koppelingen en modelkwaliteit zijn hiermee *niet* bewezen.

## 1. Nulmeting uit de bestaande repository

Het project heeft al SV/BSB, STEP-grondtekst, intertekstuele motiefanalyse, kruisverwijzingen, Calvijn/Matthew Henry/Kanttekeningen, lokale dossiers, bronregister, tijdlinks voor eigen transcripten en onderzoeksstappen A–H. De eerdere Genesis 31-run zonder AI kan tekstverbanden vinden. De echte AI-analyse en vrijwel alle externe API's stonden volgens HANDOFF.md op *niet live getest*.

De publieke productpagina op denckh.nl/preekhulp/ is **niet** dezelfde deployment als de lokaal draaiende Next.js-app. Noem de onderzoeksengine niet publiek live zonder afzonderlijke deploymentcontrole, authenticatie en werkingstests.

## 2. Bronnenmatrix — geverifieerde randvoorwaarden

| Dienst | Sterkte | Actuele beperking | Actie |
| --- | --- | --- | --- |
| STEP Bible Data | Open Hebreeuws/Grieks, lexica en lemma's | CC BY 4.0 en bronvermelding; versies/datasets afzonderlijk controleren | Behouden, provenance per dataset versienummer/commit toevoegen |
| OpenAlex | Breed academisch zoek- en auteursnetwerk | Gratis gebruik; gratis sleutel verhoogt budget 10×, $1/dag inbegrepen; meer verbruik betaald | Live test en exact API-verbruik vastleggen; sleutel niet verplicht voor kleine tests |
| Crossref | DOI/metadata, bibliografische controle | Een DOI of tijdschriftartikel bewijst op zichzelf geen peer review of volledige tekst | Metadata gescheiden houden van inhoudelijke bewijsvoering |
| PThU | Relevante Nederlandse theologie, repositories | Vrij lezen betekent niet vrij hergebruiken; huidige connector zoekt *indirect* via OpenAlex-affiliatie | PThU Research Portal en Theologische Repository als eigen, wettig ondersteunde vindplaatsen verder onderzoeken |
| YouTube Data API | Vindbaarheid internationale preken, titel en beschrijving | Officiële quota in 2026: standaard 100 search.list-aanroepen/dag; captions.download vereist bevoegdheid om video te bewerken | Metadata noemen als metadata; SRT/VTT-import ondersteunen; geen onbevoegde transcriptdownloads |
| Logos/Biblia | Zeer waardevolle betaalde theologische bibliotheek | Biblia API gesloten voor nieuwe registraties; verbod op extractie voor alternatieve database, concurrerende commerciële toepassingen beperkt | Alleen legale deep links/eigen notities, tenzij schriftelijke toestemming voor verdergaande integratie |
| Internet Archive/Open Library/Gutenberg | Historische werken en bibliografie | Catalogus, uitleenrechten, land van auteursrecht, originele uitgave en vertaling uiteenhouden | Alleen per daadwerkelijk toegankelijk en toegestaan werk inhoud ophalen |

**Officiële documentatie:**
- STEP: https://github.com/STEPBible/STEPBible-Data
- OpenAlex: https://help.openalex.org/api/authentication/ en https://help.openalex.org/access/pricing/
- PThU: https://www.pthu.nl/onderzoek/open-access/
- YouTube quota: https://developers.google.com/youtube/data/determine_quota_cost
- YouTube captions: https://developers.google.com/youtube/data/reference/rest/v3/captions/download
- Biblia: https://bibliaapi.com/docs/ en https://bibliaapi.com/docs/Terms_of_Use

## 3. Problemen en beslissingen in deze verbeterslag

1. **Dubbelen:** titel + jaar is onvoldoende om twee boeken gelijk te stellen. Dezelfde titel van verschillende auteurs kan andere interpretaties bevatten. Titel/jaar-ontdubbeling vereist nu overeenstemmende auteur; DOI en canonieke URL blijven prioriteit krijgen. Bij ontbreken van auteur wordt niet gegokt.
2. **Peer review:** OpenAlex, Crossref, CORE en Semantic Scholar verschaffen vaak slechts *metadata*. Hun artikeltype bewijst op zichzelf geen peer review. Brontype is daarom expliciet 'academisch artikel (peer review niet vastgesteld)'.
3. **Live controle:** een bereikbare dienst zonder treffers is niet hetzelfde als een fout. De controle toont een aparte status 'geen treffers'.
4. **Bewijsniveaus:** een willekeurige AI-conclusie mag niet 'direct aangetoond' worden alleen omdat zij naar enig berekend databewijs verwijst. Berekende feiten tellen op dit niveau alleen als de opgeslagen databewering exact overeenkomt. Semantische claimverificatie blijft een open verbeterpunt.
5. **Overdraagbaarheid:** een CI-proef met Node 22.13 leverde 'no such module: fts5' op; typecheck slaagde. Runtime/FTS5 moet op de beoogde installatieplatforms expliciet worden gevalideerd, niet als vanzelfsprekend aangenomen.
6. **YouTube-quotum:** documentatie in de repo was gebaseerd op een ouder quotummodel. Officiële documentatie 2026 specificeert 100 zoekaanroepen/dag, met daarnaast een afzonderlijk budget voor overige API-methoden.

## 4. Inhoudelijke kwaliteitslat: Genesis 31

### Blinde testinvoer

'Genesis 31:13. Thema: Terug naar de belofte. Context: een PKN-doopdienst. Zoek de oorspronkelijke context, argumenten, alternatieve uitleg, mogelijke verbindingen met doop en zwakke aannames. Geef echte bronnen en tegenperspectieven.'

De eerder gehouden preek en uitgebreide reconstructie blijven **afgeschermde referentie**, niet in de prompt, databank of AI-context van de blinde testrun.

### Vast te leggen scorecard

| Criterium | Controle | Meetresultaat |
| --- | --- | --- |
| Verifieerbare vindplaatsen | Open vijf willekeurig gekozen verwijzingen, controleer de bedoelde passage | Nog niet gemeten |
| Tekst en chronologie | Gen 28, 31, 32–34, 35 worden als afzonderlijke fasen onderscheiden | Zonder AI eerder deels gevonden |
| Vernieuwende lijn | Rachel en de terafim, Jakobs gelofte, Lea/Rachel, Esau, Betel | Nog niet met echte AI gemeten |
| Kritische diepgang | Geen bewijsclaim dat Jakob zijn gelofte 'vergeten' was | Nog niet met echte AI gemeten |
| Dooptheologie | Onderscheid oorspronkelijke tekst, verbondstheologische lezing, homiletiek | Nog niet met echte AI gemeten |
| Tegengeluid | Verantwoorde alternatieve interpretatie met authentieke bron | Nog niet met echte AI gemeten |
| Video | Geen tijdstempels zonder echt getimed transcript | Bestaande code en vormtests, geen live YouTube-proef |

Geef de predikant per bevinding een knop 'nuttig / bekend / onjuist / verder onderzoeken'. De inhoudelijke opbrengst wordt niet bepaald door het aantal gegenereerde ideeën, maar door de door de predikant als nieuw, relevant en onderbouwd beoordeelde ontdekkingen.

## 5. Volgende technische stappen, op bewijskracht geprioriteerd

**P0 — uitvoeren voor een externe pilot**
- [ ] CI volledig groen met echt werkende FTS5 (TypeScript, unit, integratie, build); daarna test op Windows of testbare container.
- [ ] OpenAlex, Crossref, PThU-zoekroute, Gutenberg/HelloAO met echte responses toetsen; geen fixtures verwarren met live resultaten.
- [ ] Veiligheid van de lokale app bevestigen; **geen publieke Next.js-toegang zonder authenticatie**.
- [ ] Live Genesis 31-run met expliciet ingestelde AI-provider, vooraf goedgekeurd kostenbudget en onafhankelijke handcontrole van bronnen.

**P1 — inhoudelijk waardevolle uitbreidingen**
- [ ] Per claim een bronclaim-matrix met direct tekstbewijs, interpretatie, tegenspraak en toegangsstatus.
- [ ] Subquery-onderzoek: wanneer een verrassend gegeven verschijnt, zelfstandig één gerichte tweede zoekronde met bronkritiek.
- [ ] PThU repository direct ontsluiten via ondersteunde zoek- of OAI-PMH-route indien officieel beschikbaar en juridisch passend.
- [ ] Gecontroleerde bronpassageweergave (met paginaverwijzingen alleen na verificatie).

**P2 — multimodaal**
- [ ] YouTube metadata live; geüpload getimed transcript zoeken, selecteren en vergelijken.
- [ ] Eigen toegestane audio lokaal transcriberen; geen YouTube-transcriptbeperkingen omzeilen.

**P3 — toekomstig product**
- [ ] Inloggen, gebruikersisolatie, rechten, auditlogs en beveiligingsreview voor internettoegang.
- [ ] Optionele doorverwijzing naar eigen Logos-bibliotheek; officiële API pas na schriftelijke toestemming.
- [ ] Betaalbaarheid toetsen met echte gebruiksmetingen per modus.

## 6. Conclusie

Meer connectors of een grotere modelprompt zijn niet automatisch beter. De eerste grote productverbetering is **betrouwbare bewijsvoering en meetbare inhoudelijke opbrengst**. Pas als de blinde Genesis 31-test met echte bronnen voor de predikant aantoonbaar nieuwe, bruikbare inzichten geeft, is uitrol naar meerdere predikanten zinvol.

## 7. Echte academische API-proef (GitHub Actions 1-11-2026)

De eerste automatische live-proef vanuit GitHub Actions (zonder betaalde API-sleutels) gaf:
- **OpenAlex:** 3 echte resultaten.
- **PThU-route via OpenAlex:** 3 echte resultaten.
- **DOAJ:** 3 echte resultaten.
- **Crossref:** HTTP 400; oorzaak: niet-ondersteund `language`-veld in de `select`-parameter.

Na correctie van het Crossref-verzoek leverde **Crossref 3 echte resultaten** en DOAJ opnieuw 3. OpenAlex en daarmee de PThU-route gaven toen echter **HTTP 429 (rate limit)**. Dit toont aan dat OpenAlex zonder eigen API-sleutel niet als gegarandeerd continue bron mag worden voorgesteld. De zoekfunctie moet duidelijk omgaan met API-quota en tijdelijke uitval. Bronmetadata is nog geen inhoudelijke verificatie van een boek of artikel.

De CI-codecontrole met **Node 24** is groen: TypeScript, eenheidstests en Next.js-productiebuild. De externe API-proef is afzonderlijk en handmatig gemaakt vanwege wisselende quota. De volledige Genesis 31-integratieproef met lokaal geïmporteerde brondata blijft afzonderlijk (workflow_dispatch). Echte AI-runs wachten op een expliciet ingesteld en begroot model.

**Actie voor de pilot:** gratis OpenAlex-sleutel configureren met limieten, verbinding met de PThU-repository rechtstreeks onderzoeken, en afzonderlijk de geldigheid van vijf bronclaims door de predikant laten beoordelen.
