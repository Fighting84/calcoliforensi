# Monitoraggio — Calcoli Forensi

Obiettivo: nessun dato scaduto, nessuna novità normativa o giurisprudenziale persa, senza interventi del titolare.

## 1. Cloud ogni giorno alle 06:30 (GitHub Actions, `.github/workflows/monitor.yml`) — non richiede il PC
Aggiornamenti automatici di dati numerici da fonti ufficiali in formato certo:
- `app/scripts/update_foi.js` — indice FOI dall'API SDMX ISTAT.
- `app/scripts/update_bce.js` — tasso BCE (interessi di mora) dal portale dati BCE; se un valore storico non coincide, non modifica nulla e segnala la discordanza.
- `app/scripts/update_saggio.js` — saggio legale letto dal dispositivo del decreto MEF in Gazzetta (da novembre).

Rilevamento delle novità da esaminare:
- `app/scripts/check_gazzetta.js` — sommari della Gazzetta Ufficiale, 14 temi.
- `app/scripts/check_scadenze.js` — scadenziario dei valori periodici (saggio legale, BCE, FOI, art. 139, assegno sociale, IRPEF): se un aggiornamento atteso manca, avviso sui calcolatori interessati e segnalazione.

Collaudo e pubblicazione: `run_tests.js` e `run_dom_tests.js` (se falliscono il sito non si ripubblica), timbro, build, push, verifica che il sito risponda. Le novità aprono una segnalazione GitHub (email al titolare, per conoscenza).

## 2. PC, ogni giorno (Utilità di pianificazione di Windows) — non richiede Claude aperto
`monitoraggio/cassazione_locale.cmd` → `app/scripts/locale_cassazione.js`. La banca dati della Cassazione (Italgiure) accetta solo connessioni dall'Italia: il controllo parte dal PC, cerca con 31 ricerche su 20 temi, salva il testo integrale delle pronunce nuove in `monitoraggio/cassazione/`, pubblica e apre la segnalazione. Se il PC resta spento non si perde nulla: ogni giro riesamina 180 giorni di depositi.

## 3. Cloud una volta a settimana (routine Claude) — esame delle segnalazioni
Procedura in `monitoraggio/ROUTINE.md`: legge le segnalazioni aperte, esamina le fonti, aggiorna dati e note con test, pubblica, chiude le segnalazioni motivando. Il lavoro esteso resta aperto come "DA FARE". Richiede il collegamento di GitHub all'account Claude.

## Collaudo automatico
- `node app/tests/run_tests.js` — casi sui motori di calcolo contro fonti ufficiali.
- `npm i --no-save jsdom@24 && node app/tests/run_dom_tests.js` — interfaccia, funzioni abbonato, paywall, valori limite, scadenziario.

## Regole
Mai pubblicare una modifica ai calcoli senza aver letto la fonte ufficiale e senza test verdi. Mai citare una pronuncia o un decreto senza averne letto il testo.
