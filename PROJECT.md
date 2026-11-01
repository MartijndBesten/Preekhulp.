# PROJECT — Preekhulp. (AI-onderzoeksassistent voor predikanten)

## Doel

Een lokaal werkende onderzoeksassistent voor predikanten en theologische onderzoekers die Bijbeltekst, grondtaal, historische commentaren, academische literatuur, preken/lezingen en eigen documenten samenbrengt in een controleerbaar onderzoeksdossier. Aantoonbaar beter onderzoek dan een gewone AI-chat — niet door meer tekst, maar door gecontroleerde bronnen, gescheiden onderzoeksstappen, kritische tegenlezing en zelfstandig ontdekte onderzoekslijnen.

Eerste gebruiker: een PKN-predikant. Interface Nederlands; onderzoek in NL, EN en waar relevant Hebreeuws/Grieks.

## Scope (opdracht Martijn, 01-11-2026)

- Webapplicatie met startscherm "Wat wil je onderzoeken?", drie modi (Verkennen, Verdiepen, Kritisch onderzoeken) en kostenzicht vooraf.
- Workflow A–H (vraag, zoekvragen, bronnen, beoordeling, vergelijking, nieuwe lijnen, tegenlezing, dossier) met rollen exegeet, bijbels theoloog, dogmaticus, homileticus en kritische tegenlezer.
- Bronnen: STEP-data, open Bijbelteksten, open historische commentaren, academische metadata-API's, open collecties, YouTube-ontdekking, eigen documenten; Logos alleen als toegestane doorverwijzing.
- Bewijsniveaus per bewering; geen verzonnen bronnen, citaten of tijdstippen.
- Eigen bibliotheek (PDF, DOCX, TXT, MD, SRT/VTT, plaktekst via bestand), projecten, bronmarkeringen, Markdown-export, afdrukken/PDF.
- Verplichte referentiecasus Genesis 31 (doopdienst 1-11-2026) met afgeschermde referentie en reproduceerbare evaluatie.

**Buiten scope v0.1:** accounts/authenticatie (alleen lokaal), lokale spraakherkenning (Whisper), visuele verbandenkaart, eigen SWORD-lezer, moderne beschermde NL-vertalingen.

## Randvoorwaarden en vaste besluiten

| # | Besluit | Bron |
|---|---|---|
| 1 | Geen automatische preekschrijver; predikant blijft eigenaar. | Opdracht §0 |
| 2 | Gratis/zeer goedkope pilot; geen betaalde API's, hosting of licenties zonder expliciete toestemming. | Opdracht §0, §18 |
| 3 | Geen scraping zonder toestemming, geen DRM-omzeiling, geen opslag beschermde boeken, geen omzeiling YouTube-ondertitelbeperking. | Opdracht §6–8, §17 |
| 4 | App mag niet afhankelijk zijn van het Claude Code-abonnement; eigen sleutel of lokaal model. | Opdracht §15 |
| 5 | Bronzoeken, eigen documenten en dossiers werken zonder AI. | Opdracht §15 |
| 6 | Persoonlijke documenten standaard privé; niet naar externe AI zonder expliciete keuze. | Opdracht §11 |
| 7 | Lokaal zonder accounts; extern bereikbaar pas na authenticatie. | Opdracht §17 |
| 8 | Stack: Next.js + TypeScript + React + SQLite/FTS5; geen extra infrastructuur. Gekozen: ingebouwde `node:sqlite` (geen native build), geen ORM (klein expliciet schema). | Opdracht §15; technische keuze Claude |
| 9 | Standaard AI-model Claude Opus 5.5 (instelbaar; Sonnet/Haiku goedkoper). Geen server-side model-fallback (kosten buiten raming; lijn B86). | Technische keuze Claude; B86-besluit |
| 10 | Kerkvaders-database (rechten van vertalingen onzeker) standaard uit. | Technische keuze Claude, zie V-004 |

## Bouwstenen (bibliotheek/BOUWSTENEN.md op main, versie 37)

| Bouwsteen | Hergebruik | Toelichting |
|---|---|---|
| **B86** Denckh. AI Engine (budget, logboek zonder inhoud, gegevensklassen) | **Patroon** overgenomen, geen code | B86 is Python; dit project is TypeScript. Overgenomen: volgorde modus → sleutel → prijs → slechtste-geval-raming × budget → pas dan netwerk; logboek zonder inhoud; expliciete `apiKey` + `baseURL` (Claude Code zet `ANTHROPIC_BASE_URL`); geen `temperature`; `effort` via `output_config`; geen server-side fallback. |
| **B99** Claude Code in de cloud — grenzen | Kennis gebruikt | Netwerkbeperkingen vooraf gemeld; externe connectors bewust 'niet live getest'. |
| **B38** visuele controle | Werkwijze (Playwright-screenshots desktop 1280 / mobiel 390) | Geen code gekopieerd. |
| B23/B57/B58 (auth/beveiliging) | Niet hergebruikt | v0.1 is alleen lokaal; authenticatie volgt bij externe bereikbaarheid. |

Kandidaat nieuwe bouwstenen (na bewezen gebruik): bronconnectorcontract met rechtenmodel en bewijsniveaus; claimcontrole (citaatverificatie + niveauverlaging); motiefanalyse op STEP-data. Zie HANDOFF.

## Documenten

- `README.md` — installatie, gebruik, veiligheid.
- `docs/BRONKAARTEN.md` — gegenereerde bronkaarten (licentie, status, wat getest is).
- `docs/ARCHITECTUUR.md` — modules, datamodel, workflow, beveiliging.
- `evaluatie/` — Genesis 31-test.
- `HANDOFF.md` — enige bron voor status; `VRAGEN.md` — open vragen.
