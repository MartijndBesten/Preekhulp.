# Preekhulp. — onderzoeksassistent voor predikanten

Lokaal draaiende webapplicatie die Bijbeltekst, grondtaaldata, historische commentaren, academische bronnen, preken en eigen documenten samenbrengt in een **controleerbaar onderzoeksdossier**. Geen preekschrijver: de predikant blijft eigenaar van uitleg en preek.

**Wat het anders doet dan een chatbot**

- Elke inhoudelijke bewering verwijst naar een genummerd bewijsstuk (E1, E2 …). Verwijzingen die niet bestaan worden verwijderd; citaten die niet letterlijk in de bron staan worden weggelaten; het bewijsniveau wordt automatisch verlaagd als het bewijs het niet draagt.
- Een deterministische tekstlaag (werkt zonder AI en zonder internet) berekent uit de Hebreeuwse/Griekse tekst herhaalde woorden, zeldzame woordverbanden met andere gedeelten, eigennamen, versnummeringsverschillen en (ook indirecte) NT-verbanden. Zo vond Preekhulp voor Gen 31:13 zelfstandig Gen 28:18–22, Gen 35:1–3/14–16, het verhaalverloop Gen 32–34, de lijn naar Joh 1:51 (via Gen 28:12) en minder voor de hand liggende verbanden (Num 30, Jes 19:19–21, 2 Kon 10).
- Gescheiden onderzoeksstappen A–H (vraag → zoekvragen → bronnen → beoordeling → vergelijking → nieuwe lijnen → kritische tegenlezing → dossier), elk los opnieuw uit te voeren met een verdiepingsvraag.
- Kostenraming vóór de start, budget per onderzoek en per maand, en een overzicht van alle AI- en API-aanroepen (zonder inhoud).

## Snel starten (Windows, macOS, Linux)

Vereist: **Node.js 24 of nieuwer** (gebruikt de ingebouwde SQLite met FTS5) en ±1,5 GB vrije schijfruimte.

```bash
npm install
npm run data:ophalen        # haalt de vastgepinde open datasets op (±230 MB; git aanbevolen)
npm run data:importeren     # bouwt de lokale database (±1 minuut)
npm run build && npm start  # open http://127.0.0.1:3210
```

Ontwikkelen: `npm run dev`. Tests: `npm test`. Typecheck: `npm run typecheck`.

Optioneel:
- `npm run data:ophalen -- --met-kerkvaders` en `npm run data:kerkvaders` — kerkvaders-database (rechten van vertalingen onzeker; standaard uit, alleen eigen studie).
- `npm run bronnen:controleren` — test alle externe bronnen live vanaf jouw computer.
- `npm run bronnen:proef` — statusladder 1–4 voor alle netwerkbronnen (draait ook als handmatige GitHub Actions-job).
- `npm run evaluatie -- --raming` en `npm run evaluatie -- --variant …` / `npm run evaluatie:vergelijk` — de blinde Genesis 31-test (zie `evaluatie/resultaten/README.md`; betaalde varianten alleen met `--akkoord`).

De melding *ExperimentalWarning: SQLite is an experimental feature* is onschuldig (Node-functie die in Node nog als experimenteel markeert).

## AI instellen (optioneel)

Zonder AI werken tekst & grondtaal, commentaren, bronzoeken, eigen bibliotheek en dossiers volledig. Voor de interpretatiestappen kies je in **Instellingen**:

| Aanbieder | Wat nodig | Kosten |
|---|---|---|
| Anthropic (Claude) — **primair** | Eigen API-sleutel (console.anthropic.com) in een aparte workspace met bestedingslimiet (voorstel $10/maand) | Per token; standaard **Sonnet 5.5** ($2 / $10 per miljoen tokens in/uit), keuze **Opus 5.5** ($4 / $20). Prijzen gecontroleerd 01-11-2026 |
| OpenAI | API-sleutel, model-id en de actuele prijzen (zelf invullen) | Per token |
| Ollama | Lokaal geïnstalleerd model | Gratis, kwaliteit afhankelijk van model en hardware (voorlopig geen prioriteit) |

Preekhulp gebruikt **nooit** het Claude Code-abonnement. Sleutels staan in `.data/geheimen.local.json` (buiten Git) of in omgevingsvariabelen (`.env.voorbeeld`).

Berekende bovengrens per onderzoek (alle invoer + volledig uitvoermaximum per AI-stap, incl. verdiepingsronde): Verdiepen — Sonnet $0,68 · Opus $1,36; Kritisch — Sonnet $1,76 · Opus $3,53. Werkelijke kosten zijn lager en worden per stap vastgelegd. Standaard: onderzoekslimiet $1,50, maandbudget $10. Een stap die het resterende budget zou overschrijden, wordt vóór de aanroep geweigerd; Preekhulp schakelt nooit zelf over naar een duurder model.

In **Instellingen** zie je de toestand van de verbinding (sleutel ontbreekt · aanwezig, niet getest · getest en werkend · authenticatiefout · quotum of budget bereikt · model niet beschikbaar · netwerk niet bereikbaar) en kun je de verbinding **gratis testen** (alleen modelinformatie, geen tekstgeneratie). Ontwerp voor latere door Denckh beheerde toegang: [`docs/AI_GATEWAY.md`](docs/AI_GATEWAY.md).

## Bronnen in één oogopslag

Volledig overzicht met licenties en teststatus: [`docs/BRONKAARTEN.md`](docs/BRONKAARTEN.md).

| Laag | Bronnen | Status |
|---|---|---|
| Bijbeltekst | Statenvertaling (CC0) + Berean Standard Bible (PD) | werkend, lokaal |
| Grondtekst | STEPBible TAHOT/TAGNT + TBESH/TBESG (CC BY 4.0) | werkend, lokaal |
| Kruisverwijzingen | OpenBible.info (CC BY) | werkend, lokaal |
| Historische uitleg | Kanttekeningen SV (1637), Calvijn, Matthew Henry (PD) · optioneel kerkvaders | werkend, lokaal |
| Extra commentaren | HelloAO: Keil-Delitzsch, Gill, Clarke, JFB (PD) | werkend (live getest 01-11-2026; Gill per vers, andere drie per perikoop) |
| Academisch | Crossref, DOAJ (werkend) · OpenAlex (wisselend HTTP 429 zonder sleutel) · PThU via OpenAlex (bereikbaar) · Semantic Scholar (429) · CORE (sleutel, niet getest) · Unpaywall | live getest 01-11-2026, zie bronkaarten |
| Boeken | Internet Archive, Open Library (werkend, alleen catalogus) · Gutenberg (403) · Google Books (429) | live getest 01-11-2026 |
| Video | Zonder sleutel: linkherkenning (ook in de onderzoeksvraag), zoeklinks, eigen transcripten (SRT/VTT/TXT) met tijdlinks, zoeken en vergelijken · met eigen sleutel: YouTube Data API (metadata) | zonder-sleutel-deel getest; API niet getest (geen sleutel) |
| Doorverwijzing | Logos (ref.ly), BibleHub, Blue Letter Bible, NET Bible, STEP, Google Scholar, PThU/TUU/VU/Radboud | links |

**Live getest via GitHub Actions** (01-11-2026, twee runs). Statusladder per gevonden bron in een dossier: 1 bereikbaar · 2 zoekopdracht gelukt · 3 relevant · 4 volledige inhoud · 5 geanalyseerd · 6 citaat geverifieerd. Een catalogusvermelding is nooit basis voor een inhoudelijke samenvatting.

## Bewust níet gedaan

- Geen scraping van BibleHub, Blue Letter Bible, Google Scholar of CCEL; geen omzeiling van YouTube-ondertitelbeperkingen; geen Logos-cookies of database-uitlezing.
- Geen HSV/NBV21/NBG51 (auteursrecht). Geen opslag van beschermde boeken.
- Geen automatische preek.

## Veiligheid en privacy

- Draait alleen op `127.0.0.1`. API-routes weigeren verzoeken met een niet-lokale Host (DNS-rebinding) of een vreemde Origin (CSRF). **Externe bereikbaarheid vereist eerst authenticatie** (niet gebouwd in v0.1).
- Eigen documenten zijn privé en gaan standaard niet naar een AI-aanbieder (instelbaar: alleen relevante fragmenten).
- Opgehaalde teksten worden als data aangeboden, nooit als instructie (prompt-injectiebescherming); door gebruikers opgegeven URL's krijgen SSRF-controle.
- Uploads: type- en inhoudscontrole (PDF/DOCX-handtekening), max. 25 MB, ontdubbeling op SHA-256; verwijderen wist ook zoekindex en afgeleide passages.
- Logboeken bevatten nooit prompts, antwoorden of sleutels.

## Projectstructuur

```
src/lib/scripture   verwijzingen, tekst, grondtaal, concordantie, motiefanalyse
src/lib/sources     connectorcontract, register/bronkaarten, connectors, opslag/ontdubbeling
src/lib/research    workflow A–H, bewijsregister, modi en budget
src/lib/verification controle van beweringen, citaten en bewijsniveaus
src/lib/ai          aanbieders (Anthropic SDK, OpenAI, Ollama), budget, prijzen
src/lib/documents   import/extractie (PDF, DOCX, TXT, MD, SRT, VTT) en verwijderen
src/lib/videos      YouTube-metadata, tijdlinks, vergelijking op transcript
src/lib/reports     dossier (13 onderdelen) en Markdown-export
scripts/            data ophalen/importeren, bronnencontrole, evaluatie, bronkaarten
evaluatie/          Genesis 31-referentietest (invoer, criteria, afgeschermde referentie, resultaten)
```

## Attributie

Grondtekstdata: STEP Bible (www.STEPBible.org), Tyndale House Cambridge — CC BY 4.0. Kruisverwijzingen: OpenBible.info — CC BY 4.0. Statenvertaling en Kanttekeningen: digitale editie Isidore-Guild — CC0. Berean Standard Bible — publiek domein. Calvijn (via CrossWire/CCEL, conversie Pillar Commentary Data, MIT). Matthew Henry (Markdown-editie lyteword, CC0).

## Geautomatiseerde kwaliteitscontrole

GitHub Actions controleert bij nieuwe commits op de ontwikkelbranches: TypeScript, de eenheidstests en de productiebuild met Node 24. Een aparte handmatig uit te voeren **academische API-proef** (`npm run bronnen:proef`) test echte netwerkresponses van OpenAlex, Crossref, de PThU-route en DOAJ. Die proef is bewust niet verplicht bij elke commit: gratis API-quota, met name OpenAlex HTTP 429, zouden anders de codekwaliteitstests onterecht laten mislukken. Een groene codebuild is géén bewijs dat een externe API altijd beschikbaar is.

De lokale installatie vereist een Node-bouw met SQLite FTS5. De GitHub-run met Node 22.13 gaf `no such module: fts5`, met Node 24 is de reguliere testsuite en build wel geslaagd. Controleer FTS5 ook op Windows voordat de app breder wordt gedeeld.
