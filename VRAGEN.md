# VRAGEN

Dit bestand is het vaste vraag-en-antwoordkanaal tussen Martijn, ChatGPT/Codex en Claude Code.

## Werkwijze

- Voeg alleen vragen toe die een beslissing, ontbrekende bron of bevestiging van Martijn nodig hebben.
- Eén vraag per item met een uniek nummer: `V-001`, `V-002`, enzovoort.
- Gebruik status `open`, `beantwoord` of `verwerkt`.
- Claude zet nieuwe vragen op `open`.
- ChatGPT/Codex of Martijn vult het antwoord in en zet de status op `beantwoord`.
- Claude verwerkt het antwoord in het project, noteert waar dat is gedaan en zet de status op `verwerkt`.
- Verwijder oude vragen niet; ze vormen samen een beknopt beslisspoor.
- Algemene voortgang en volgende actor blijven uitsluitend in `HANDOFF.md`.

## Open vragen

### V-001 — AI-aanbieder en budget voor de echte Genesis 31-evaluatie

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Welke AI-verbinding gebruikt de pilot, en mag Claude Code de Genesis 31-evaluatie daarmee draaien? Voorstel: eigen Anthropic API-sleutel in een aparte workspace met bestedingslimiet (bv. $10), model Claude Opus 5.5, één run *Verdiepen* (bovengrens $1,10) en één run *Kritisch* (bovengrens $3,23). Alternatief: Sonnet 5.5 (ongeveer de helft) of een lokaal Ollama-model (gratis, lagere kwaliteit).

**Waarom nodig**

De interpretatielaag (stap A, B, D, E, G) is gebouwd en met nep-antwoorden getest, maar niet met een echt model. Of Preekhulp "aantoonbaar beter onderzoek" levert dan een gewone chat, is pas te beoordelen na een echte run. Kosten en sleutel zijn een besluit van Martijn.

**Antwoord**

Nog niet beantwoord.

**Verwerkt in**

Nog niet verwerkt.

### V-002 — Externe bronnen live testen: waar?

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Testen we de externe connectors (a) in deze cloudomgeving — dan moeten deze domeinen worden toegestaan bij *Network access → Allowed domains*: `api.openalex.org`, `api.crossref.org`, `doaj.org`, `api.semanticscholar.org`, `api.core.ac.uk`, `api.unpaywall.org`, `archive.org`, `openlibrary.org`, `gutendex.com`, `bible.helloao.org` (Google-API's waren al bereikbaar) — of (b) op de eigen pc met `npm run bronnen:controleren`?

**Waarom nodig**

Deze connectors staan nu op 'gedeeltelijk: gebouwd, niet live getest'. Zonder live test geen 'werkend'-status. Netwerkinstellingen kan alleen Martijn wijzigen.

**Antwoord**

Nog niet beantwoord.

**Verwerkt in**

Nog niet verwerkt.

### V-003 — YouTube Data API-sleutel

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Wil je een (gratis) YouTube Data API-sleutel aanmaken in Google Cloud (project → YouTube Data API v3 inschakelen → API-sleutel, beperkt tot die API) en die in Preekhulp → Instellingen invullen?

**Waarom nodig**

Zonder sleutel geeft Preekhulp voor video's alleen zoeklinks. Met sleutel: zoeken op Bijbelgedeelte/predikant met titel, kanaal, datum en duur (standaardquotum ≈ 100 zoekopdrachten per dag). Inhoudelijke analyse blijft afhankelijk van een rechtmatig transcript.

**Antwoord**

Nog niet beantwoord.

**Verwerkt in**

Nog niet verwerkt.

### V-004 — Kerkvaders-database (rechten onzeker)

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

De HistoricalChristianFaith-database (±91.000 citaten van 300 auteurs vóór 1900) is optioneel geïmporteerd maar standaard uitgeschakeld, omdat de verzamelaar voor een deel van de Engelse vertalingen alleen een Amerikaans 'fair use'-beroep doet. Mag deze bron voor eigen studie aan (alleen lokaal, niet publiceren), of laten we hem uit?

**Waarom nodig**

Inhoudelijk waardevol (Augustinus, Chrysostomus, Hiëronymus e.a. per vers), maar de rechtenstatus is in NL/EU niet eenduidig. Dat is een afweging voor Martijn.

**Antwoord**

Nog niet beantwoord.

**Verwerkt in**

Nog niet verwerkt.

### V-005 — Eigendom, licentie en registratie van het project

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Valt Preekhulp onder privé, Denckh of een opdrachtgever (de predikant)? Welke licentie krijgt de code (voorlopig geen; repository blijft privé)? En moet ChatGPT het project registreren in `PROJECTS.md`/`register/` van de workbench?

**Waarom nodig**

Bepaalt bouwsteen-eigendom in de bibliotheek, eventuele makervermelding (Denckh-regel) en of de workbench-overdrachtsroute geldt. Claude wijzigt `PROJECTS.md` niet zelf.

**Antwoord**

Deels: Martijn bevestigde op 01-11-2026 dat Preekhulp. een eigen product van Denckh is (zie V-006). Licentie en registratie in de workbench staan nog open.

**Verwerkt in**

Makersvermelding en productpagina (V-006).

## Beantwoorde en verwerkte vragen

### V-006 — Productpagina op denckh.nl publiceren?

status: verwerkt
gesteld_door: claude
datum: 2026-11-01

**Vraag**

De pagina `denckh.nl/preekhulp/` staat klaar op branch `claude/preekhulp` in `MartijndBesten/denckh` (B-098). Mag die naar `main` (= direct live via GitHub Pages)? Graag ook bevestigen: Preekhulp. als eigen product van Denckh, proefronde-aanmeldingen via `info@denckh.nl`, en de teksten (geen prijzen, AI-laag als "proefronde").

**Waarom nodig**

Publiceren op denckh.nl gebeurt alleen met akkoord van de eigenaar (CLAUDE.md van de denckh-repo en `DENCKH_MERKVERMELDING.md`).

**Antwoord**

Martijn, 01-11-2026: "Ja live. Ja klopt. Voor nu goed." — publiceren, eigen product van Denckh, proefronde via info@denckh.nl, teksten akkoord.

**Verwerkt in**

`MartijndBesten/denckh` `main` → `ccc2769` (B-098, O-44 afgehandeld); Preekhulp `src/app/layout.tsx` (makerslink naar /preekhulp/); `HANDOFF.md`.

