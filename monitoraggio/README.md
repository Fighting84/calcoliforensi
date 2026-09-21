# Monitoraggio — Calcoli Forensi

Due livelli.

## 1. Automatico in cloud (GitHub Actions, `.github/workflows/monitor.yml`)
Ogni giorno alle 06:30 (ora italiana), senza che nessun PC sia acceso:
- `app/scripts/update_foi.js`: legge la serie FOI senza tabacchi dall'API SDMX ISTAT (flussi 169_748) e la aggiorna in `app/index.html` se esce un nuovo mese o se ISTAT revisiona un valore (segnalato nel log).
- `app/tests/run_tests.js`: tutti i motori contro i casi ufficiali; se un test fallisce il workflow si ferma e non pubblica.
- `app/scripts/stamp.js dati`: timbra la data del controllo automatico (compare nel piè di pagina).
- `app/build.js` + commit + push: il sito si ripubblica da solo. Poi `check_site.js` verifica che risponda.

## 2. Verifica delle fonti (task programmato locale "calcoli-forensi-monitor", ogni mattina)
Eseguito da Claude sul PC quando l'app è aperta (altrimenti al primo avvio). Per ogni tema in `stato.json`:
1. Cassazione (Italgiure via MCP `cerca_giurisprudenza` / `ultime_pronunce`), ultimi 7 giorni, con le parole chiave del tema.
2. Gazzetta Ufficiale (`cerca_gazzetta_ufficiale` / `ultime_gazzette`) per decreti su saggio legale, tassi BCE (art. 5 D.Lgs. 231/2002), aggiornamento art. 139 CdA, TUN, parametri forensi, contributo unificato.
3. Se una novità incide su un calcolatore: aggiornare dati/testi in `app/index.html` (con test), oppure registrare un "DA FARE" se richiede lavoro esteso.
4. Scrivere il log in `monitoraggio/log/AAAA-MM-GG.md`, aggiornare `stato.json`, eseguire `stamp.js fonti`, build, commit, push.
5. Il lunedì: report settimanale all'utente (visite da `gh api repos/Fighting84/calcoliforensi/traffic/views`, novità, KPI vs patto).

Regola: mai pubblicare una modifica ai motori senza test verdi; mai citare una pronuncia senza averla verificata con `leggi_sentenza`.
