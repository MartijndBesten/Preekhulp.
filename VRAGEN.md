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

### V-007 — Sleutel en toestemming voor de betaalde Genesis 31-evaluatie

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Wil je (1) in een aparte Anthropic-workspace met maandlimiet $10 een API-sleutel aanmaken en die lokaal in Preekhulp → Instellingen zetten (of als `PREEKHULP_ANTHROPIC_KEY`), en (2) toestemming geven voor deze drie runs in modus *Verdiepen*: Preekhulp-Sonnet (bovengrens $0,68), Preekhulp-Opus (bovengrens $1,36) en rechtstreeks Claude Opus met dezelfde vraag (bovengrens $0,24)? Samen maximaal **$2,28**; werkelijke kosten zijn meestal lager. (Modus *Kritisch* zou samen maximaal $5,54 zijn.)

**Waarom nodig**

Zonder echte AI-run is niet te beoordelen of Preekhulp beter onderzoek levert dan een rechtstreekse vraag aan Claude. Alles is voorbereid (`npm run evaluatie -- --raming`, `evaluatie/resultaten/README.md`); betaalde runs weigeren zonder sleutel én zonder `--akkoord`.

**Antwoord**

Nog niet beantwoord.

**Verwerkt in**

Nog niet verwerkt.

### V-008 — Gratis OpenAlex-sleutel (en eventueel CORE) instellen?

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Wil je een gratis OpenAlex-sleutel (en eventueel een gratis CORE-sleutel) aanvragen en die als GitHub-secret (`PREEKHULP_OPENALEX_KEY`, `PREEKHULP_CORE_KEY`) en lokaal in Instellingen zetten?

**Waarom nodig**

In de live-proeven gaf OpenAlex wisselend HTTP 429 (1 van 2 runs); Semantic Scholar en Google Books gaven beide keren 429 zonder sleutel. Preekhulp vangt dat af (afkoelen, cache, doorgaan met andere bronnen), maar met sleutel is academisch zoeken stabieler. CORE is zonder sleutel niet getest. Accounts aanmaken is aan Martijn.

**Antwoord**

Nog niet beantwoord.

**Verwerkt in**

Nog niet verwerkt.

### V-009 — Publieke repository zonder licentie — zo bedoeld?

status: open
gesteld_door: claude
datum: 2026-11-01

**Vraag**

`MartijndBesten/Preekhulp.` is **publiek** en heeft geen licentiebestand. Is publiek zo bedoeld? Zo nee: wil je de repository zelf op privé zetten (Claude wijzigt zichtbaarheid niet)?

**Waarom nodig**

Zonder licentie geldt ‘alle rechten voorbehouden’: zichtbaar is niet open source. Wel is alles leesbaar voor iedereen, ook `evaluatie/referentie/genesis31-preek.md` (samenvatting van een gehouden preek, zonder namen) en de evaluatieresultaten. Er staan geen sleutels of klantgegevens in de repository. Zie ook V-005.

**Antwoord**

Nog niet beantwoord.

**Verwerkt in**

Nog niet verwerkt.

## Beantwoorde en verwerkte vragen

### V-001 — AI-aanbieder en budget voor de echte Genesis 31-evaluatie

status: verwerkt
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Welke AI-verbinding gebruikt de pilot, en mag Claude Code de Genesis 31-evaluatie daarmee draaien?

**Waarom nodig**

Interpretatielaag was alleen met nep-antwoorden getest; kosten en sleutel zijn een besluit van Martijn.

**Antwoord**

Martijn, 01-11-2026: Anthropic Claude als primaire aanbieder; Sonnet eerst, Opus als tweede vergelijking; aparte Denckh-workspace met voorgestelde maandlimiet $10; geen betaalde aanroepen zonder expliciete toestemming en ingestelde sleutel; Ollama voorlopig geen prioriteit. De sleutel en de testtoestemming zelf staan open in **V-007**.

**Verwerkt in**

`src/lib/settings.ts` (standaard Sonnet 5.5, maandbudget $10); `src/lib/ai/prijzen.ts` (keuze Sonnet/Opus, prijzen gecontroleerd 01-11-2026); `src/lib/ai/verbinding.ts` + Instellingen (7 sleuteltoestanden, gratis verbindingstest); `docs/AI_GATEWAY.md`; `scripts/evaluatie.ts` (betaald alleen met `--akkoord`).

### V-002 — Externe bronnen live testen: waar?

status: verwerkt
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Testen we de externe connectors in de cloudomgeving of op de eigen pc?

**Waarom nodig**

Zonder live test geen 'werkend'-status.

**Antwoord**

Martijn, 01-11-2026: live-proeven lopen via GitHub Actions; verwerk de resultaten en de HTTP 429-beperking van OpenAlex; niet-geteste bronnen blijven niet-gevalideerd; niet opnieuw om netwerktoegang vragen.

**Verwerkt in**

Twee live-runs (GitHub Actions, workflow `kwaliteitscontrole.yml`, 01-11-2026): werkend HelloAO (4/4 commentaren), Crossref, DOAJ; bereikbaar met metadata Internet Archive, Open Library; OpenAlex 1× 429 / 1× ok; PThU bereikbaar zonder treffers; Semantic Scholar en Google Books 2× 429; Gutenberg (Gutendex) 2× 403; CORE en YouTube niet getest (geen sleutel). Vastgelegd in de bronkaarten (`src/lib/sources/connectors/*`, `docs/BRONKAARTEN.md`); 429-afhandeling in `src/lib/http/veilig.ts`. Vervolg: V-008.

### V-003 — YouTube Data API-sleutel

status: verwerkt
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Wil je een YouTube Data API-sleutel aanmaken?

**Waarom nodig**

Zonder sleutel alleen zoeklinks.

**Antwoord**

Martijn, 01-11-2026: functionaliteit blijft gewenst; bouw alles wat zonder sleutel kan volledig af; sleutel blijft optioneel en moet later veilig in te voeren zijn.

**Verwerkt in**

Zonder sleutel: YouTube-link in de onderzoeksvraag (alleen met eigen transcript inhoudelijk, met tijdlinks; anders uitdrukkelijk geen uitspraken), linkcontrole met titel via oEmbed, zoeken in transcripten, zoeklinks, vergelijken van transcripten (`src/lib/videos/youtube.ts`, `src/lib/research/stappen.ts`, `src/app/videos/page.tsx`, `src/app/api/videos/link`). Met sleutel: rangschikking op metadata en bewaren in een project. Sleutel invoerbaar via Instellingen (server-side).

### V-004 — Kerkvaders-database (rechten onzeker)

status: verwerkt
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Mag de HistoricalChristianFaith-database voor eigen studie aan?

**Waarom nodig**

Rechtenstatus in NL/EU niet eenduidig.

**Antwoord**

Martijn, 01-11-2026: voorlopig uitgeschakeld houden; alleen vrijgegeven, juridisch controleerbare datasets later activeren.

**Verwerkt in**

Blijft uit (`kerkvadersGebruiken: false`). Route en minimale metadata per item: `docs/KERKVADERS.md`.

### V-005 — Eigendom, licentie en registratie van het project

status: verwerkt
gesteld_door: claude
datum: 2026-11-01

**Vraag**

Valt Preekhulp onder privé, Denckh of een opdrachtgever? Welke licentie? Registratie in de workbench?

**Waarom nodig**

Bepaalt bouwsteen-eigendom, makervermelding en overdrachtsroute.

**Antwoord**

Martijn, 01-11-2026: eigen product van Denckh; niet aannemen dat de code open source is omdat de repository zichtbaar is; zichtbaarheid en licentiebestanden controleren; geen nieuwe licentie zonder opdracht; registreren in de workbench als dat binnen de afspraken en toegang valt.

**Verwerkt in**

Gecontroleerd 01-11-2026: repository **publiek**, geen licentiebestand (dus ‘alle rechten voorbehouden’), `package.json` `private: true`. Geen licentie toegevoegd. Registratie in de workbench niet uitgevoerd: volgens de workbench-instructies vult alleen ChatGPT `PROJECTS.md` aan bij een nieuw project. Zichtbaarheid: zie **V-009**.

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

Livecontrole: vanuit de ontwikkelomgeving niet mogelijk (netwerkbeleid); Martijn bevestigde op 01-11-2026 via de browser dat de pagina live staat en goed laadt. Bron op `denckh` `main` (`ccc2769`), GitHub Pages-uitrol geslaagd. `MartijndBesten/denckh` `main` → `ccc2769` (B-098, O-44 afgehandeld); Preekhulp `src/app/layout.tsx` (makerslink naar /preekhulp/); `HANDOFF.md`.

