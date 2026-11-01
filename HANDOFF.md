# HANDOFF — Preekhulp.

**Status:** technisch pilotklaar voor gebruik **zonder AI** en voor een eerste echte AI-proef; **inhoudelijk niet afgerond**: de echte AI-test met controleerbare bronnen (blinde Genesis 31-evaluatie) is nog niet uitgevoerd (wacht op sleutel en toestemming, V-007).
**Bijgewerkt:** 2026-11-01 ±18:40 UTC door Claude Code (cloudsessie).
**Branches:** werk op `claude/afbouw-pilot` → PR naar `claude/onderzoeksassistent-v0-1` (PR #1 is daarin opgenomen als `e81d434`). `main` is niet gewijzigd.
**Volgende actor:** Martijn (V-007, V-008, V-009), daarna Claude Code (betaalde evaluatieruns + vergelijking).

## Huidige opdracht

"CLAUDE CODE — PREEKHULP. VOLLEDIG VERDER AFBOUWEN EN VALIDEREN" (Martijn, 01-11-2026), prioriteiten 1–10: PR #1 integreren → technische kwaliteit → connectors → bronselectie/verificatie → PDF/DOCX → YouTube zonder sleutel → AI-configuratie/budget → Genesis 31-evaluatie voorbereiden → UI → documentatie/overdracht.

## Statusladder (besloten / gebouwd / bewezen)

| Onderdeel | Gebouwd | Bewezen (hoe) |
|---|---|---|
| PR #1 (strengere claimcontrole, live API-proef, CI) | ja | lokaal 41/41 tests, daarna gemerged (`e81d434`) |
| Externe bronnen: 429/`Retry-After`/backoff/afkoelen/cache-terugval | ja | `tests/netwerk.test.ts` (4) |
| Live bronnenproef (statusladder 1–4, alle netwerkconnectors) | ja | 2× GitHub Actions 01-11: HelloAO 4/4 commentaren, Crossref, DOAJ werkend; IA, Open Library metadata; OpenAlex 1× 429/1× ok; PThU bereikbaar, 0 treffers; Semantic Scholar en Google Books 429; Gutenberg 403; CORE/YouTube niet getest (geen sleutel) |
| Bronselectie (uitlegbare relevantiescore, diversiteit) | ja | `tests/selectie.test.ts`; integratietest |
| Verdiepingsronde (stap V) | ja | integratietest met nep-AI (Gen 31:19 terafim); zonder AI datagedreven onderwerpen |
| Claim-bronmatrix, steuncontrole, statusladder 1–6 in dossier en export | ja | integratietests; **AI-kwaliteit onbewezen** |
| PDF/DOCX met echte bestanden (tekst, meerdere pagina's, voetnoten, 2 kolommen, scan; koppen, tabel, voetnoot) | ja | `tests/documenten-echt.test.ts` (9); origineel openen (PDF op pagina) |
| YouTube zonder sleutel (link in vraag, oEmbed, transcriptzoeken, tijdlinks) | ja | `tests/youtube.test.ts`, integratietest; API met sleutel niet getest |
| AI-configuratie: Sonnet standaard/Opus, 7 toestanden, gratis verbindingstest, maandbudget $10 | ja | `tests/verbinding.test.ts` (11, nagebootste HTTP); **geen echte aanroep gedaan** |
| "Wat zie ik over het hoofd?" (gedachte + dossier; gratis + optionele AI) | ja | integratietests; browser (telefoon) bediend |
| Genesis 31-evaluatie: 15 punten, 3 varianten, ruwe resultaten, scorekaart, steekproef 5 claims | ja | gratis keten-run `evaluatie/resultaten/2026-11-01-zonder-ai-verdiepen/` + vergelijking; **betaalde runs niet uitgevoerd** |
| UI telefoon/tablet/desktop | ja | Playwright 390/820/1440 px × 6 pagina's: geen horizontale overloop, geen consolefouten (na reparatie) |

Tests 01-11-2026 ±18:35 UTC: **13 bestanden, 75 tests geslaagd** (`npx vitest run`); `tsc --noEmit` schoon; `next build` geslaagd; CI (GitHub Actions, Node 24) groen op de laatste gecontroleerde runs.

## Wat zonder AI al blijkt (Genesis 31:13, gratis run)

Bewijs aanwezig voor 12 van de 15 beoordelingspunten (Gen 28, 35, 32–34, gelofte, Betel, terafim, Lea/Rachel, Esau, Joh 1:51, commentaren); niet zonder AI: doopverbinding, grenzen van toepassing, tegengeluid, open vragen. "Over het hoofd" signaleert o.a.: ‘belofte’ en ‘doop’ staan niet in de tekst van Gen 31 (de tekst spreekt van Jakobs **gelofte**), de steenhoop van Gilead en de gestreepte/gespikkelde kudde worden niet besproken, geen joodse uitleg, alle uitleggers uit één traditie.

## Gewijzigde/gemaakte bestanden (deze opdracht)

`src/lib/http/veilig.ts`, `src/lib/research/{selectie,verdieping,overhoofd,stappen,runner,types,bewijs}.ts`, `src/lib/reports/dossier.ts`, `src/lib/ai/{index,verbinding,prijzen}.ts`, `src/lib/settings.ts`, `src/lib/documents/import.ts`, `src/lib/db/schema.ts` (migraties 3–4), `src/lib/sources/connectors/{academisch,boeken,lokaal}.ts`, `src/lib/videos/youtube.ts`, API-routes (`documenten/[id]/bestand`, `instellingen/verbindingstest`, `onderzoek/[id]/overhoofd`, `videos/link`), pagina's (dossier, instellingen, bibliotheek, video's, start), `globals.css`, `scripts/{externe-bronproef,bronkaarten,evaluatie,evaluatie-lib,evaluatie-vergelijk}.ts`, `.github/workflows/kwaliteitscontrole.yml`, tests (`netwerk`, `selectie`, `documenten-echt`, `verbinding`, `evaluatie`, uitbreidingen `onderzoek`/`youtube`), fixtures `tests/fixtures/`, `evaluatie/genesis31/{invoer,criteria}.json`, `evaluatie/resultaten/`, docs (`AI_GATEWAY.md`, `KERKVADERS.md`, `BRONKAARTEN.md`, `ARCHITECTUUR.md`), `README.md`, `VRAGEN.md`, dit bestand.

## Blokkades

- Geen Anthropic-sleutel en geen toestemming voor betaalde runs → AI-kwaliteit onbewezen (V-007).
- Gratis API-quota (429) bij OpenAlex/Semantic Scholar/Google Books zonder sleutel (V-008).
- denckh.nl/preekhulp/ kon vanuit deze omgeving niet worden bekeken (netwerkbeleid); bron op `denckh` `main` en Pages-uitrol wel gecontroleerd (V-006).
- Repository is publiek zonder licentie (V-009); zichtbaarheid wijzigt Claude niet.

## Open vragen

V-007, V-008, V-009 (zie `VRAGEN.md`). V-001 t/m V-006 verwerkt.

## Volgende stap

1. Martijn: V-007 (sleutel in aparte workspace, $10-limiet; akkoord voor maximaal $2,28), V-008, V-009.
2. Claude: `npm run evaluatie -- --variant sonnet --akkoord`, `--variant opus --akkoord`, `--variant direct --akkoord`, dan `npm run evaluatie:vergelijk`; ruwe resultaten committen.
3. Martijn/predikant: steekproef (5 claims per variant) controleren en scorekaart invullen; pas dan een oordeel over "beter dan rechtstreeks Claude".
4. Daarna: prompts en bewijsselectie bijstellen op basis van de scorekaart; eventueel gratis OpenAlex-sleutel in CI.

## Bibliotheekcheck (BOUWSTENEN.md v37 op `origin/main`, gelezen 01-11-2026)

Geen bestaande kaart dekt deze onderdelen. **Kandidaten** (nog geen bibliotheek-PR in deze sessie; eerst bewijs met echte AI-run): (1) HTTP-laag met 429/`Retry-After`/afkoelen per host/cache-terugval en statusladder-proef in CI; (2) claimcontrole + claim-bronmatrix + alleen-verlagende steuncontrole; (3) AI-sleutelstatus in 7 toestanden met gratis verbindingstest en vingerafdruk; (4) DOCX-extractie via mammoth-HTML met kopsecties, tabellen en voetnoten + PDF-waarschuwingen. Toekomstige kaarten via een `bibliotheek/*`-branch en PR naar `main` van de workbench. Werkwijze-lessen (o.a. `pkill -f` raakt de eigen shell; layoutoverloop pas zichtbaar met meting per viewport) nog niet in `werkwijze/LESSEN.md` vastgelegd.

## Overdrachtsnotities

- Geen sleutels of klantgegevens in Git; `.data/` genegeerd; diff gecontroleerd vóór commit.
- Betaalde aanroepen zijn alleen mogelijk met sleutel én (evaluatie) `--akkoord`; in de app altijd met raming vooraf en budgetweigering vóór het netwerk.
- `PROJECTS.md` van de workbench niet gewijzigd (alleen ChatGPT). Leftover map `/home/user/martijndbesten/denckh` bewust laten staan.
