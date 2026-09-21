# MONEY — Calcoli Forensi

Piattaforma di calcolatori legali/fiscali in abbonamento. Gestita dall'agente.
Piano completo: `C:\Users\Admin\.claude\plans\ti-do-50-euro-stateless-neumann.md`

## I 2 passi che restano a te (una tantum, ~20 minuti)

1. **Lemon Squeezy** — https://app.lemonsqueezy.com/register
   - Crea l'account e lo store (nome: "Calcoli Forensi"), inserisci l'IBAN per i payout.
   - Resta loggato nel browser integrato di Claude: da lì configuro io prodotti, prezzi e licenze.
2. **Dominio** — `calcoliforensi.it`: verificato **libero** il 17/09/2026 (whois nic.it). ~10 €/anno.
   - Ti chiedo il "sì" alla spesa in chat e ti dico esattamente dove cliccare.

## Stato

- 17/09/2026 — v0.1.1: 4 calcolatori attivi (danno micro, interessi legali, mora, contributo unificato),
  64/64 test coincidenti con gli MCP. Anteprima: https://claude.ai/artifact/6syxbxKKtUNZvnkh5cHxJq
- 17/09/2026 — v0.2.0: +Tabelle di Milano 2024 (1–100%) e danno parentale a punti, dati trascritti dal PDF
  ufficiale del Tribunale di Milano (`fonti/`). 94/94 test (MCP + celle tabella + esempi Osservatorio).
- Dominio: l'utente lo registra su Hostinger (account già esistente).
- Test: `node app/tests/run_tests.js`

Tutto il resto (app, contenuti, SEO, ads, contabilità, report) lo faccio io.
Ti chiedo un "sì" in chat solo per: spese, pubblicazioni online.

## Struttura

- `app/` — web app (index.html, un file), `build.js`, `scripts/` (monitoraggio), `tests/`
- `docs/` — sito pubblicato (GitHub Pages, generato da build.js: non modificare a mano)
- `monitoraggio/` — procedura, stato dei temi, log delle verifiche
- `.github/workflows/monitor.yml` — controllo automatico giornaliero in cloud
- `app/tests/` — casi di test presi dagli MCP Legal IT, usati per verificare i calcolatori
- `seo/` — pagine e articoli
- `motore2/` — micro-tool esplorativi in altri settori
- `contabilita.xlsx` — cassa, MRR, costi, KPI vs patto
