# Routine settimanale — esame delle segnalazioni

Istruzioni per l'agente in cloud che ogni lunedì lavora sulle segnalazioni aperte dal monitoraggio.

## Contesto
Repository `Fighting84/calcoliforensi` (sito https://calcoliforensi.it, pubblicato da `docs/`).
L'app è il file unico `app/index.html`; `node app/build.js` genera `docs/index.html`.
Il titolare (avv. Pier Giorgio Ometto) ha autorizzato in modo permanente la pubblicazione degli
aggiornamenti del sito. Vietato: spese, pubblicazioni su altri canali, modifiche a prezzi, condizioni,
pagina Informazioni o dati del titolare (queste sono decisioni del titolare: vedi "Richieste al titolare").

## Come leggere le segnalazioni (il repository è pubblico)
`curl -s "https://api.github.com/repos/Fighting84/calcoliforensi/issues?state=open&per_page=50"`
Ignora quelle con etichetta `azione-richiesta` (sono per il titolare). Le altre si chiamano
"Monitoraggio …: novità da esaminare" o "…: nuove pronunce di Cassazione".

## Procedura per ogni voce
- **Dato periodico in ritardo**: trova la fonte ufficiale (Gazzetta Ufficiale https://www.gazzettaufficiale.it,
  circolari INPS, legge di bilancio, decreti MIMIT/MEF), leggi il testo, aggiorna la costante in `app/index.html`
  (`MICRO_ANNI`, `TUN_P1`, `ASSEGNO_SOCIALE`, `IRPEF`, `TASSI_LEGALI`, `TASSI_BCE`) mantenendo gli anni
  precedenti, aggiungi un caso in `app/tests/run_tests.js` calcolato a mano dalla fonte.
- **Atto in Gazzetta**: il sito della Gazzetta non è raggiungibile dal cloud; il testo integrale degli atti segnalati è in `monitoraggio/gazzetta/<data>_<codice>.txt` (lo salva il controllo quotidiano; per un atto non ancora salvato chiedilo aggiungendo a `monitoraggio/gazzetta_richieste.json` una voce con i soli estremi, ad esempio `{"tipo":"DECRETO LEGISLATIVO","dataAtto":"2025-08-01","numero":123}` (oppure `{"data":"AAAA-MM-GG","codice":"…"}` se conosci data di pubblicazione e codice): il controllo quotidiano lo scarica entro il giorno dopo; se serve subito, lascia la segnalazione aperta e riprendila al giro successivo). Valuta se cambia un valore, una regola o una nota; se sì, applica con test.
- **Pronuncia di Cassazione**: il testo integrale è in `monitoraggio/cassazione/<id>.txt` (la banca dati
  della Cassazione non è raggiungibile dal cloud). Se enuncia un principio che incide sul calcolo o sulla
  nota del calcolatore indicato, aggiorna la nota citando estremi esatti; altrimenti annota "non rilevante".
- **Lavoro esteso** (nuove tabelle, nuova logica): non improvvisare; lascia aperta con etichetta `da-fare`
  e un commento che descrive cosa serve.

## Collaudo e pubblicazione
1. `node app/tests/run_tests.js` e `npm i --no-save jsdom@24 && node app/tests/run_dom_tests.js`: si
   pubblica solo con 0 DIFF in entrambi.
2. `node app/scripts/stamp.js fonti` e `node app/build.js`.
3. Scrivi `monitoraggio/log/AAAA-MM-GG.md` (cosa hai esaminato, decisioni, fonti) e aggiorna
   `ultima_verifica_fonti` in `monitoraggio/stato.json`.
4. Scrivi gli esiti in `monitoraggio/esiti.json` (il controllo quotidiano li applica alle segnalazioni):
   `[{"issue": 12, "commento": "Esaminata: …; fonte: …; modifica: …", "chiudi": true}]`
   (per il lavoro esteso: `"chiudi": false, "etichetta": "da-fare"`).
5. Scrivi la data odierna (AAAA-MM-GG) in `monitoraggio/heartbeat_routine.txt`.
6. Commit e `git push origin HEAD:main`. Se il push su main è rifiutato, spingi su un ramo
   `routine/AAAA-MM-GG` e segnalalo nel messaggio finale.

## Richieste al titolare
Se una novità richiede una decisione del titolare (es. una norma che cambia le condizioni del servizio,
un costo, una scelta deontologica), aggiungi una voce a `monitoraggio/azioni_utente.json`:
`{"id":"breve-id","titolo":"…","cosa":"cosa è successo, in italiano semplice","passi":["passo 1","passo 2"],"tempo":"5 minuti","seNo":"cosa succede se non interviene","risolta":false}`.
Il controllo quotidiano gliela invia come "Azione richiesta" con istruzioni. Quando è risolta, metti `"risolta": true`.
Il titolare non è tecnico: passi concreti, un'azione per volta, niente gergo.

## Regole
- Mai pubblicare una modifica ai calcoli senza aver letto la fonte ufficiale e senza test verdi.
- Mai inventare estremi di sentenze o decreti. Se non riesci a leggere la fonte, lascia aperta.
- Messaggio finale: massimo 8 righe, con modifiche pubblicate, segnalazioni chiuse, DA FARE, richieste al titolare.
