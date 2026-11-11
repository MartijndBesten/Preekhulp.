# Architectuur

## Overzicht

```
Browser (Next.js/React, Nederlands)
   │  fetch /api/*  (alleen 127.0.0.1; Host- en Origin-controle)
   ▼
Route handlers (src/app/api) ──► src/lib/*
   research/   workflow A–H + V (verdieping) + W (over het hoofd)  ──► ai/ (Anthropic SDK | OpenAI | Ollama | geen; verbinding.ts: 7 toestanden)
       │                      ├► selectie.ts (uitlegbare relevantiescore)
       │                      └► verification/ (claimcontrole + steuncontrole)
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
| D Beoordeling | uitlegbare relevantiescore per bron (`selectie.ts`: noemt het gedeelte/een verwant hoofdstuk, kernwoorden, toegang, brontype); externe bronnen zonder aantoonbaar verband gaan niet naar de analyse; verdeling + waarschuwingen | relevantie 0–3 en perspectief, alleen op de relevante bronnen (top 40) |
| E Vergelijking | — | Verdiepen: één analyse met gescheiden rollen. Kritisch: vier perspectieven apart + aparte vergelijking |
| V Verdiepingsronde | onderwerpen: AI-voorstellen met geldige verwijzing, anders zeldzame woorden die het hoofdstuk herhaalt buiten de focus (bv. terafim). Per onderwerp: verzen, kruisverwijzingen (+ tekst), commentaren, begrensde academische zoekvragen (1/2/3 per modus) | analyse per onderwerp incl. ‘wat de tekst niet zegt’ |
| F Nieuwe lijnen | uit motieven, interteksten, NT-verbanden | AI-lijnen met exegetische sterkte |
| (controle) | elke bewering → `verification/claims.ts` | |
| G Tegenlezing | vaste signalen (bronverdeling, populariteit kruisverwijzingen, doopstap) | aparte tegenlezer op alle beweringen + bronverdeling + **steuncontrole** per bewering (draagt het bewijs de claim? alleen verlagend) |
| H Dossier | 13 onderdelen, statusladder per bron (1–6), claim-bronmatrix, Markdown-export, afdrukweergave | — |
| W Over het hoofd (op verzoek) | gratis signalen op dossier + voorlopige gedachte: onbesproken verhaalelementen, niet-genoemde gedeelten, begrippen/themawoorden die niet in de tekst (SV+BSB) staan, ontbrekende perspectieven, zwak bewijs, niet-doorzochte bronnen | één AI-ronde na expliciete bevestiging van de raming: ontbrekende context, niet-genoemde gedeelten, alternatieve uitleg, mogelijke fouten, wetenschappelijke tegenargumenten, homiletische mogelijkheden — verwijzingen gecontroleerd |

Bewijsselectie voor AI: prioriteit focus-tekst/grondtekst → berekende data → commentaren op de focus → interteksten → overige; per modus een tekenplafond (30k / 80k / 140k). Eigen documenten alleen als dat is toegestaan.

## Claimcontrole (hallucinatiereductie)

1. Verwijzing naar een niet-bestaand label → verwijderd; zonder geldige verwijzing → *Niet geverifieerd*.
2. Citaat wordt genormaliseerd (hoofdletters, aanhalingstekens, Hebreeuwse punctuatie) letterlijk gezocht in het volledige bronfragment; niet gevonden → citaat weggelaten en gemeld.
3. *Direct aangetoond* alleen met een teruggevonden citaat uit een primaire bron of met berekende tekstdata.
4. *Onderbouwde interpretatie* vereist gelezen inhoud (geen abstract/catalogus) en ≥2 bronnen of een primaire bron.
5. Niveaus worden alleen verlaagd, nooit verhoogd; elke aanpassing is zichtbaar in het dossier.
6. Een AI-bewering die alleen naar verwante tekstdata verwijst, wordt nooit *Direct aangetoond* tenzij de datatekst de bewering zelf is.
7. Elke AI-bewering legt vast: interpretatieve stap, tegenverwijzingen (gecontroleerd) en onzekerheid → claim-bronmatrix. De tegenlezer beoordeelt per bewering of het bewijs haar draagt; dat kan alleen afwaarderen.
8. Automatische tekstvergelijking is géén inhoudelijke juistheid; dat staat ook in het dossier.

## Externe bronnen: robuustheid

`http/veilig.ts`: max. 2 herhalingen bij 429/5xx/netwerkfout met exponentiële wachttijd, `Retry-After` gerespecteerd, afkoelperiode per host na 429 (bron wordt in dat onderzoek niet verder belast), verlopen cache als terugval, cache per bron. Live-proef met statusladder 1–4: `npm run bronnen:proef` (ook als handmatige GitHub Actions-job, met artefact `bronnenproef.json`).

## Beveiliging

Zie README §Veiligheid. Aanvullend: SSRF-controle (`http/veilig.ts`) voor door gebruikers opgegeven URL's (protocol, poort, inloggegevens, DNS-resolutie naar privé-adressen, redirects opnieuw gecontroleerd); vaste host-lijst voor connectors; rate-limit per host; antwoordgrootte en time-outs begrensd.

## Bekende beperkingen

- Glossen en lexicondefinities zijn Engels (STEP); interface Nederlands.
- Calvijn en Matthew Henry Engelstalig; Nederlandse Calvijn-vertalingen niet opgenomen (rechten per editie onbekend).
- De AI-interpretatielaag is gebouwd en met nep-antwoorden getest, maar nog niet met een echt model (VRAGEN V-007). Externe bronnen zijn live getest via GitHub Actions; quota (HTTP 429) zonder sleutel blijven een beperking.
- PDF: paginanummers zijn de volgorde in het bestand; gescande pagina's zonder tekstlaag worden gemeld en niet doorzocht (geen OCR).
- PDF-export via de afdrukfunctie van de browser (bewust geen extra PDF-bibliotheek).
