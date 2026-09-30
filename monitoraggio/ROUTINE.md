# Routine settimanale — presa in carico delle segnalazioni

Istruzioni per l'agente in cloud che, una volta a settimana, lavora sulle segnalazioni aperte
dal monitoraggio automatico (issue GitHub "Monitoraggio …: novità da esaminare").

## Contesto
Repository: `Fighting84/calcoliforensi` (sito https://calcoliforensi.it). L'app è un unico file
`app/index.html`; il sito pubblicato (`docs/`) si genera con `node app/build.js`. Il titolare ha
autorizzato in modo permanente la pubblicazione degli aggiornamenti del sito. Nessuna spesa, nessuna
pubblicazione su altri canali.

## Procedura
1. `gh issue list --state open --search "Monitoraggio in:title"`: leggi tutte le segnalazioni aperte.
2. Per ogni voce:
   - **Dato periodico in ritardo** (scadenziario): cerca la fonte ufficiale (Gazzetta Ufficiale,
     circolare INPS, legge di bilancio, decreto MIMIT), leggila, aggiorna la costante in
     `app/index.html` (`MICRO_ANNI`, `TUN_P1`, `ASSEGNO_SOCIALE`, `IRPEF`, `TASSI_LEGALI`, `TASSI_BCE`)
     mantenendo i valori degli anni precedenti, aggiungi un caso in `app/tests/run_tests.js`
     calcolato a mano dalla fonte.
   - **Atto in Gazzetta**: apri l'atto, valuta se cambia un valore, una regola o una nota. Se sì,
     applica la modifica con test; se non incide, annotalo.
   - **Pronuncia di Cassazione**: leggi il testo integrale (indice Italgiure:
     `POST https://www.italgiure.giustizia.it/sncass/isapi/hc.dll/sn.solr/sn-collection/select?app.query`
     con `q=id:<id>&fl=ocr&wt=json`). Se enuncia un principio che incide sul calcolo o sulla nota del
     calcolatore, aggiorna la nota citando estremi esatti; altrimenti annotalo come non rilevante.
   - **Lavoro esteso** (nuove tabelle, nuova logica): non improvvisare. Lascia la segnalazione aperta
     con un commento "DA FARE" dettagliato e un'etichetta `da-fare`.
3. Esegui `node app/tests/run_tests.js` e `npm i --no-save jsdom@24 && node app/tests/run_dom_tests.js`.
   Si prosegue solo se entrambi sono a 0 DIFF.
4. `node app/scripts/stamp.js fonti`, `node app/build.js`, scrivi `monitoraggio/log/AAAA-MM-GG.md`
   (cosa hai esaminato, cosa hai cambiato, con fonte), aggiorna `ultima_verifica_fonti` in
   `monitoraggio/stato.json`, poi commit e push su `main`.
5. Chiudi con un commento le segnalazioni risolte, indicando per ciascuna la decisione e la fonte.
6. Il primo lunedì del mese: aggiungi `monitoraggio/report/AAAA-MM-GG.md` con visite
   (`gh api repos/Fighting84/calcoliforensi/traffic/views`), novità del mese, DA FARE aperti.

## Regole
- Mai pubblicare una modifica ai calcoli senza aver letto la fonte ufficiale e senza test verdi.
- Mai inventare estremi di sentenze o decreti: se non riesci a leggere la fonte, lascia aperto.
- Messaggio finale: massimo 8 righe, con l'elenco delle modifiche pubblicate e dei DA FARE.
