# AI-toegang: nu en later (ontwerp, niet geactiveerd)

Stand 01-11-2026. Dit document beschrijft hoe Preekhulp nu AI gebruikt en hoe dat later kan worden uitgebreid naar
door Denckh beheerde toegang voor meerdere gebruikers. **Niets uit "Later" is gebouwd of geactiveerd**: er is geen
betaalde hosting, geen gedeelde sleutel en geen publieke toegang.

## Nu: eigen sleutel, alles lokaal (optie A)

```
browser ──(alleen lokaal: 127.0.0.1)──► Next.js-server (eigen computer)
                                         ├─ instellingen + budget (SQLite)
                                         ├─ sleutel: .data/geheimen.local.json (0600) of omgevingsvariabele
                                         └─ src/lib/ai/index.ts ──► api.anthropic.com
```

- De sleutel komt nooit in de browser, in Git, in documentatie of in logs. De interface ziet alleen de *toestand*
  (`src/lib/ai/verbinding.ts`). In de database staat alleen een korte vingerafdruk (12 tekens SHA-256) om te zien dat
  de sleutel is vervangen.
- Elke betaalde aanroep loopt door één functie (`vraagJson`): aanbieder → sleutel → prijs → slechtste-geval-raming
  binnen onderzoeks- én maandbudget → pas dan netwerk → gebruik vastleggen (tokens/kosten, nooit inhoud).
- Modelkeuze: Sonnet 5.5 (standaard) of Opus 5.5. Geen automatische overstap naar een duurder model; bij een
  quotum- of modelfout stopt de stap met een duidelijke melding.
- Verbindingstest: `GET /v1/models/{id}` — kost niets, genereert geen tekst.
- API-routes weigeren verzoeken met een niet-lokale `Host` (DNS-rebinding) en wijzigingen van een andere herkomst (CSRF).

## Later: door Denckh beheerde toegang (optie B, alleen na besluit van Martijn)

```
browser ──► Preekhulp-web (met login) ──► Denckh AI-gateway ──► api.anthropic.com
                                          ├─ Denckh-sleutel (secret store, nooit in app/browser)
                                          ├─ per gebruiker: quotum, maandlimiet, tarief
                                          ├─ authenticatie (sessie/token) + rate limiting
                                          └─ boekhouding: tokens/kosten per gebruiker, geen inhoud
```

Wat daarvoor in de code al klaarstaat:

| Onderdeel | Nu | Aansluitpunt later |
|---|---|---|
| Eén toegangspunt voor AI | `vraagJson` in `src/lib/ai/index.ts` | nieuwe aanbieder `"denckh"` die naar de gateway post i.p.v. naar Anthropic |
| Budgetcontrole vóór aanroep | lokaal (onderzoek + maand) | gateway doet dezelfde controle per gebruiker; de app blijft vooraf ramen |
| Kostenregistratie zonder inhoud | `ai_gebruik` | gateway levert `kosten_usd` terug; app logt die |
| Toestanden voor de interface | `verbinding.ts` (7 toestanden) | zelfde toestanden, plus "account niet actief" |
| Geen sleutel in de browser | ja | ja — de gebruiker krijgt alleen een sessie, nooit de Denckh-sleutel |

Wat er dan nog moet gebeuren (niet nu):

1. Authenticatie vóór elke externe toegang (de pilot is nu bewust alleen lokaal).
2. Gateway als aparte dienst met secret store, per-gebruiker-quotum en rate limiting.
3. Werkruimtelimiet bij Anthropic als harde bovengrens (bijv. de voorgestelde $10/maand voor de pilot).
4. Privacy: welke broninhoud en eigen documenten via de gateway gaan, verwerkersafspraken, bewaartermijnen.
5. Kosten van hosting en wie die draagt — **betaalde infrastructuur alleen na expliciet besluit**.

Zie ook `VRAGEN.md` V-001.
