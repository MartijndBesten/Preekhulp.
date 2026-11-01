# HANDOFF — Preekhulp.

**Status:** v0.1 gebouwd en lokaal getest (zonder echte AI); gekoppeld aan Denckh (makersvermelding + productpagina op branch, nog niet live); wacht op besluiten V-001 t/m V-006.
**Bijgewerkt:** 2026-11-01 ±13:00 UTC door Claude Code (cloudsessie).
**Branch:** `claude/onderzoeksassistent-v0-1` (repository `MartijndBesten/Preekhulp.`, was leeg).
**Volgende actor:** Martijn (vragen V-001 t/m V-005), daarna Claude Code.

## Huidige opdracht

Bouwopdracht "AI-onderzoeksassistent voor predikanten" (Martijn, 01-11-2026), inclusief verplichte referentiecasus Genesis 31. NB: de opdrachttekst kwam afgekapt binnen (de tweede, herhalende versie stopt in §6 bij "Als geen transcript beschikbaar is: Meld dit duidelijk"). De eerste, volledige versie (§0–§18) is als leidend gebruikt; de afgekapte herhaling voegde voor zover ontvangen geen nieuwe eisen toe.

## Statusladder (besloten / gebouwd / bewezen)

| Onderdeel | Besloten | Gebouwd | Bewezen (hoe) |
|---|---|---|---|
| Lokale data: SV + Kanttekeningen, BSB, STEP-grondtekst, lexica, morfologie, kruisverwijzingen, Calvijn, Matthew Henry | ja | ja | ja — import 01-11 (31.102 SV-verzen, 59.385 kanttekeningen, 31.086 BSB, ±439.000 woorden, 341.282 kruisverwijzingen, 13.106 Calvijn, 4.259 Henry); steekproef Gen 31:13 woord-voor-woord |
| Kerkvaders-database (optioneel) | nee (V-004) | ja, standaard uit | import getest (91.561 citaten, 300 auteurs vóór 1900) |
| Referentieparser NL/EN, reeksen, meerdere delen | ja | ja | unit-tests |
| Motiefanalyse / interteksten / NT-verbanden / versnummering / tussenliggende hoofdstukken | ja | ja | Gen 31:13 → Gen 28:18–22, 35:1–3, 35:14–16, Gen 32–34, Joh 1:51 via Gen 28:12; Gen 31:55 = Hebr. 32:1 |
| Workflow A–H, modi, los herhalen van stappen | ja | ja | integratietest zonder AI en met nep-AI; UI-run in browser |
| Claimcontrole (verzonnen verwijzingen/citaten, niveaus) | ja | ja | unit- en integratietests |
| AI-aanbieders: Anthropic (officiële SDK), OpenAI, Ollama | ja | ja | **niet live** — alleen nep-aanbieder en budgetweigering zonder netwerk getest (V-001) |
| Budget/kostenraming/kostenoverzicht | ja | ja | raming berekend; budgetweigering getest |
| Externe connectors (OpenAlex, PThU via OpenAlex, Crossref, DOAJ, Semantic Scholar, CORE, Unpaywall, Internet Archive, Open Library, Gutenberg, Google Books, HelloAO) | ja | ja | **niet live** (hosts geblokkeerd in cloudsessie); vormtests met voorbeeldantwoorden (V-002) |
| YouTube (metadata) + transcript-import met tijdlinks + vergelijking | ja | ja | URL/tijdlinks/SRT/VTT getest; API niet live (geen sleutel, V-003); vergelijking alleen typecheck (vereist AI) |
| Eigen bibliotheek (PDF, DOCX, TXT, MD, SRT, VTT; dedup; verwijderen) | ja | ja | tests voor TXT/MD/SRT/VTT, dedup, verwijderen, type-validatie; **PDF/DOCX-extractie niet met een echt bestand getest** |
| Projecten, bronmarkeringen | ja | ja | UI geladen; geen aparte test |
| Dossier 13 onderdelen + Markdown-export + afdrukken | ja | ja | export gegenereerd en gelezen; afdrukweergave niet als PDF gecontroleerd |
| Logos | ja (alleen doorverwijzing) | ja (ref.ly-link) | linkvorm niet live gecontroleerd |
| Beveiliging lokaal (Host/Origin, SSRF, uploads, geheimen) | ja | ja | curl-controle Host/Origin; SSRF-unit-tests |
| Evaluatie Genesis 31 | ja | ja | run **zonder AI** vastgelegd: `evaluatie/resultaten/2026-11-01-verdiepen-zonder-ai.md`; run met AI wacht op V-001 |

Tests (01-11-2026, `npx vitest run`): **7 bestanden, 37 tests geslaagd**. `npx tsc --noEmit` schoon. `next build` geslaagd. Browsercontrole (Playwright, 1280 px en 390 px): start, onderzoek, dossier, tekst, bronnen, bibliotheek, video, projecten, instellingen — geen consolefouten.

## Wat de evaluatie zonder AI laat zien (Genesis 31)

Zelfstandig gevonden en met tekstdata onderbouwd: Gen 28:18–22 als sterkste terugverwijzing (zuil, Betel, gelofte), Gen 35:1–3 en 35:14–16, *nēder/nādar* ('gelofte') in Genesis alleen in 28:20 en 31:13, *mōledet* ('verwantschap') als echo van Gen 12:1, verhaalverloop Gen 32–34 (Esau, Pniël, Sichem) tussen 31 en 35, Joh 1:51 via Gen 28:12, en minder voor de hand liggende verbanden (Num 30, Jes 19:19–21, 2 Kon 10 — Betel en de cultus). Historische uitleg: Kanttekening bij 31:13, Calvijn bij 31:13/31:19 en 28:18–22, Henry bij 31:1–16 en 35:1–5.
Niet zonder AI: doop-theologie (vraag 8), andere accenten/tradities (vraag 9), en alle homiletische lijnen. Moderne academische discussie ontbrak (externe bronnen geblokkeerd).

## Gewijzigde/gemaakte bestanden

Alles nieuw in deze repository: `package.json`, configuratie, `src/` (app en `lib/`), `scripts/`, `tests/`, `evaluatie/`, `docs/ARCHITECTUUR.md`, `docs/BRONKAARTEN.md`, `README.md`, `PROJECT.md`, `HANDOFF.md`, `VRAGEN.md`, `.env.voorbeeld`, `.gitignore`. Brondata en database staan in `.data/` (niet in Git; opnieuw op te bouwen met `npm run data:ophalen && npm run data:importeren`).

## Blokkades

- Netwerkbeleid cloudsessie: academische/boek-API's, PThU, CCEL, BibleHub e.d. niet bereikbaar; officiële documentatie (YouTube, OpenAlex, Biblia) kon niet live worden nagelezen. Connectors volgen bekende API-vormen; actuele regels (bv. OpenAlex-sleutels) moeten bij de live test worden gecontroleerd (V-002).
- Geen AI-sleutel voor de app (bewust niet het Claude Code-abonnement) → interpretatiekwaliteit onbewezen (V-001).

## Koppeling met Denckh (opdracht Martijn 01-11-2026: "Koppel het aan Denckh.nl")

| Onderdeel | Besloten | Gebouwd | Bewezen |
|---|---|---|---|
| Makersvermelding in Preekhulp (footer: "Ontwikkeld door" + officiële signatuur met krul, licht/donker, link naar denckh.nl) volgens `bibliotheek/DENCKH_MERKVERMELDING.md` | ja (opdracht) | ja — logobestanden ongewijzigd gekopieerd uit `MartijndBesten/denckh` `public/brand/` | browsercontrole licht en donker; build geslaagd |
| Productpagina `denckh.nl/preekhulp/` (repo `MartijndBesten/denckh`, branch `claude/preekhulp`, commit `96b98c9`, beslissing B-098, dossier `docs/cases/preekhulp.md`) | publicatie nog niet (O-44 daar / V-006 hier) | ja — zelfde opbouw als Ouderhulp., vier echte schermen, alleen geteste functies; AI-laag en externe bronnen als "proefronde" | typecheck, lint, build; e2e 21/21 nieuwe controles + interne links; volledige suite loopt vast op bekende homepagetest 320px (O-38 in denckh, ook zonder wijziging) |

De makerslink wijst nu naar `https://denckh.nl/` (constante `DENCKH_URL` in `src/app/layout.tsx`); na publicatie omzetten naar `/preekhulp/`.

## Open vragen

V-001, V-002, V-003, V-004, V-005, V-006 (zie `VRAGEN.md`). V-005 is deels beantwoord door de opdracht "koppel het aan Denckh.nl" (Denckh als maker); licentie en registratie staan nog open.

## Volgende stap

1. Martijn beantwoordt V-001 t/m V-005.
2. Claude: externe connectors live testen en status per bronkaart bijwerken (`npm run bronnen:controleren`, daarna `npx tsx scripts/bronkaarten.ts`).
3. Claude: Genesis 31-evaluatie met echte AI (Verdiepen en Kritisch), rapporten in `evaluatie/resultaten/`, en de beoordelingstabel laten invullen door de predikant.
4. Daarna verbeteren op basis van de beoordeling (prompts, bewijsselectie), PDF/DOCX-extractie met echte bestanden testen, en eventueel lokale transcriptie (Whisper) als vervolgstap.

## Bibliotheekcheck (BOUWSTENEN.md v37, verplicht onderhoud)

Beoordeeld: B86 als patroon gebruikt (geen codewijziging aan B86). Nieuwe herbruikbare onderdelen ontstaan — **kandidaten**: (1) bronconnectorcontract met rechtenmodel (vindbaar/leesbaar/downloadbaar/herbruikbaar) en toegangsstatus; (2) claimcontrole: bewijslabels, letterlijke citaatverificatie en alleen-verlagen van bewijsniveaus; (3) `node:sqlite`+FTS5 als dependency-vrije lokale database in Next.js. **Nog geen bibliotheek-PR ingediend**: eerst bewezen gebruik met echte AI-run (V-001); daarna kaarten via een `bibliotheek/*`-branch en PR naar `main` van de workbench. Geen bestaande kaart is door dit werk verouderd.

## Overdrachtsnotities

- Data en database niet committen (`.data/` staat in `.gitignore`); geen sleutels in Git — secret-scan op de diff uitgevoerd vóór commit.
- `PROJECTS.md` van de workbench is niet gewijzigd (alleen ChatGPT; zie V-005).
