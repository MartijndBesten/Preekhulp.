# Architectuur

## Overzicht

```
Browser (Next.js/React, Nederlands)
   │  fetch /api/*  (alleen 127.0.0.1; Host- en Origin-controle)
   ▼
Route handlers (src/app/api) ──► src/lib/*
   research/   workflow A–H  ──► ai/ (Anthropic SDK | OpenAI | Ollama | geen)
       │                      └► verification/ (claimcontrole)
       ├► scripture/ (verzen, woorden, concordantie, motieven, kruisverwijzingen, commentaren)
       ├► sources/ (connectorcontract, register, connectors, opslag/ontdubbeling)
       ├► documents/ (import/extractie)   videos/ (YouTube, transcriptvergelijking)
       └► reports/ (dossier + Markdown)
   ▼
SQLite (.data/preekhulp.sqlite, FTS5)  ·  .data/uploads  ·  .data/geheimen.local.json
```

## Datamodel (kern)

- **verzen** (vertaling, vkey, tekst) + `verzen_fts`. `vkey = boek×1.000.000 + hoofdstuk×1.000 + vers` (KJV/Engelse versnummering; Hebreeuwse afwijkingen per woord in `woorden.bron_ref`).
- **woorden** (STEP TAHOT/TAGNT): vorm, translit., glosse, Strong (uitgebreid + basis), lemma, morfologiecode, eigennaam. **lexicon** (TBESH/TBESG), **morfologie** (TEHMC/TEGMC), **lemma_freq**.
- **kruisverwijzingen** (OpenBible, met stemmen). **werken/commentaar** (+FTS) met licentie en rechtenstatus per werk.
- **bronnen** (alle gevonden bronnen; ontdubbeld op DOI, URL, titel+jaar) met `toegang` en `rechten` (vindbaar/leesbaar/downloadbaar/herbruikbaar). **passages**: de concrete fragmenten.
- **onderzoeken**, **onderzoek_stappen** (uitvoer per stap, los herhaalbaar), **onderzoek_bewijs** (labels E1…), **beweringen** (niveau, voorgesteld niveau, verwijzingen, controle).
- **documenten/document_delen** (+FTS) met pagina/sectie/tijdstip; **projecten**, **bron_markeringen**.
- **ai_gebruik** en **externe_aanroepen**: tokens, kosten, status, host, duur — nooit inhoud. **http_cache** met TTL per bron.

## Workflow

| Stap | Deterministisch (altijd) | AI (indien actief en modus) |
|---|---|---|
| A Vraag | verwijzingen, thema, dienst, plan | kernvraag, afbakening, (impliciete) aannames, exegese/dogmatiek/homiletiek, extra gedeelten (alleen als geldige verwijzing overgenomen) |
| B Zoekvragen | regelgebaseerd NL/EN, ontdubbeld | gevarieerde zoekvragen (vakterminologie, tegenperspectieven) |
| C Bronnen | tekst (focus, context, interteksten, tussenliggende hoofdstukken), grondtekst, motiefanalyse → databeweringen, commentaren, kruisverwijzingen, eigen documenten, externe connectors met status per bron | — |
| D Beoordeling | verdeling brontype/traditie/taal/periode/toegang + waarschuwingen (eenzijdigheid) | relevantie 0–3 en perspectief op titel/abstract |
| E Vergelijking | — | Verdiepen: één analyse met gescheiden rollen. Kritisch: vier perspectieven apart + aparte vergelijking |
| F Nieuwe lijnen | uit motieven, interteksten, NT-verbanden | AI-lijnen met exegetische sterkte |
| (controle) | elke bewering → `verification/claims.ts` | |
| G Tegenlezing | vaste signalen (bronverdeling, populariteit kruisverwijzingen, doopstap) | aparte tegenlezer op alle beweringen + bronverdeling |
| H Dossier | 13 onderdelen, Markdown-export, afdrukweergave | — |

Bewijsselectie voor AI: prioriteit focus-tekst/grondtekst → berekende data → commentaren op de focus → interteksten → overige; per modus een tekenplafond (30k / 80k / 140k). Eigen documenten alleen als dat is toegestaan.

## Claimcontrole (hallucinatiereductie)

1. Verwijzing naar een niet-bestaand label → verwijderd; zonder geldige verwijzing → *Niet geverifieerd*.
2. Citaat wordt genormaliseerd (hoofdletters, aanhalingstekens, Hebreeuwse punctuatie) letterlijk gezocht in het volledige bronfragment; niet gevonden → citaat weggelaten en gemeld.
3. *Direct aangetoond* alleen met een teruggevonden citaat uit een primaire bron of met berekende tekstdata.
4. *Onderbouwde interpretatie* vereist gelezen inhoud (geen abstract/catalogus) en ≥2 bronnen of een primaire bron.
5. Niveaus worden alleen verlaagd, nooit verhoogd; elke aanpassing is zichtbaar in het dossier.

## Beveiliging

Zie README §Veiligheid. Aanvullend: SSRF-controle (`http/veilig.ts`) voor door gebruikers opgegeven URL's (protocol, poort, inloggegevens, DNS-resolutie naar privé-adressen, redirects opnieuw gecontroleerd); vaste host-lijst voor connectors; rate-limit per host; antwoordgrootte en time-outs begrensd.

## Bekende beperkingen

- Glossen en lexicondefinities zijn Engels (STEP); interface Nederlands.
- Calvijn en Matthew Henry Engelstalig; Nederlandse Calvijn-vertalingen niet opgenomen (rechten per editie onbekend).
- Externe connectors en de AI-interpretatielaag zijn gebouwd en met nep-antwoorden getest, maar niet live (zie HANDOFF).
- PDF-export via de afdrukfunctie van de browser (bewust geen extra PDF-bibliotheek).
