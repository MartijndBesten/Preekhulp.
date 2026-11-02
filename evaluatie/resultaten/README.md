# Evaluatieresultaten — blinde Genesis 31-test

Per run één map `<datum>-<variant>-<modus|model>/` met de **ruwe** resultaten en alle instellingen, zodat de vergelijking
eerlijk en herhaalbaar is:

| Bestand | Inhoud |
|---|---|
| `instellingen.json` | variant, model, modus, budget, raming, werkelijke kosten, duur, git-commit, Node-versie, vastgepinde datasets, bronstatus, stappen — nooit sleutels |
| `dossier.json` / `dossier.md` | volledig Preekhulp-dossier (alleen Preekhulp-varianten) |
| `ai_gebruik.json` | per AI-aanroep: stap, model, tokens, kosten, raming (geen inhoud) |
| `antwoord.md` | het rechtstreekse Claude-antwoord (alleen variant `direct`) |

## Volgorde

1. `npm run evaluatie -- --raming` — kostenraming (gratis).
2. **Pas na expliciete toestemming van Martijn** (VRAGEN.md V-001):
   `npm run evaluatie -- --variant sonnet --akkoord`, daarna `--variant opus --akkoord` en `--variant direct --akkoord`.
3. `npm run evaluatie:vergelijk` — 15 beoordelingspunten, controleerbaarheid, steekproef van 5 bronclaims per variant,
   lege scorekaart en pas dán de vergelijking met de gehouden preek.
4. Handmatig: steekproef controleren en scorekaart invullen. Geen geforceerd positief eindoordeel.

De runs krijgen de gehouden preek en de reconstructie nooit als invoer (getest: de onderzoekscode leest `evaluatie/referentie/` niet;
alleen het vergelijkingsscript doet dat, na de runs).

## Aanwezig

- `2026-11-01-verdiepen-zonder-ai.md` — oudere opzet (v0.1), alleen deterministische lagen.
- `2026-11-01-zonder-ai-verdiepen/` — nieuwe opzet, gratis controle van de keten (zonder AI, zonder externe bronnen).
- `2026-11-01-vergelijking.md` — vergelijking met alleen de gratis variant; **de betaalde varianten zijn nog niet uitgevoerd**.
