// Collaudo automatico dell'interfaccia: carica il sito costruito in jsdom, apre ogni calcolatore,
// verifica che produca un risultato, che il prospetto Pro non sia servito senza licenza e che valori
// limite non generino NaN/Infinity/undefined. Uso: npm i --no-save jsdom && node app/tests/run_dom_tests.js
const fs = require("fs"), path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const FILE = path.join(__dirname, "..", "..", "docs", "index.html");
const HTML = fs.readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ck = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}${extra ? ": " + extra : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function apri(licenza) {
  const errori = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => { if (!/Not implemented/.test(e.message)) errori.push(e.message); });
  const dom = new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://calcoliforensi.it/", virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.print = () => {};
      // servizio dei cambi della Banca d'Italia simulato: domenica 27/09/2026 senza quotazioni
      w.fetch = async url => ({ json: async () => /tassidicambio/.test(url) ? (/2026-09-27/.test(url) ? { resultsInfo: { totalRecords: 0 }, rates: [] } : { rates: [{ isoCode: "USD", currency: "Dollaro USA", avgRate: "1.1355", referenceDate: (url.match(/referenceDate=([d-]+)/) || [])[1] }, { isoCode: "GBP", currency: "Sterlina", avgRate: "0.8400" }] }) : {} });
      if (licenza) { try { w.localStorage.setItem("cf_license", licenza); } catch (e) {} }
      w.addEventListener("error", e => errori.push(e.message || String(e.error)));
    } });
  return { dom, window: dom.window, errori };
}

(async () => {
  // ---- sessione senza licenza ----
  const A = apri(null); await sleep(700);
  const w = A.window, $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const vai = async id => { w.location.hash = "#/" + id; w.dispatchEvent(new w.HashChangeEvent("hashchange")); await sleep(50); };

  ck("pagina caricata", !!$("#main") && !!$("#nav"));
  const ids = $$('.nav a[href^="#/"]').map(a => a.getAttribute("href").slice(2)).filter(x => x && x !== "piani");
  ck("calcolatori in elenco", ids.length >= 20, `${ids.length} voci`);

  for (const id of ids) {
    await vai(id);
    const big = $("#result .total .big");
    ck(`risultato ${id}`, !!big && /\d/.test(big.textContent), big ? big.textContent.trim().replace(/\s+/g, " ") : "NESSUN RISULTATO");
  }

  // menu: ricerca e gruppi richiudibili
  await vai("danno-tun");
  const visibili = () => $$('.nav-list .group:not([hidden]) a[data-id]:not([hidden])').filter(a => a.closest(".group").classList.contains("aperto")).map(a => a.dataset.id);
  ck("menu: aperto solo il gruppo in uso", visibili().every(id => /^danno-/.test(id)) && visibili().length === 4, visibili().join(","));
  const cerca = $("#navCerca"); cerca.value = "cartella"; cerca.dispatchEvent(new w.Event("input", { bubbles: true }));
  ck("menu: «cartella» trova la prescrizione tributaria", visibili().join() === "prescrizione-tributi", visibili().join(","));
  cerca.value = "risarcimento"; cerca.dispatchEvent(new w.Event("input", { bubbles: true }));
  ck("menu: «risarcimento» trova i quattro calcolatori del danno", visibili().length === 4 && visibili().every(id => /^danno-/.test(id)), visibili().join(","));
  cerca.value = "xyzxyz"; cerca.dispatchEvent(new w.Event("input", { bubbles: true }));
  ck("menu: nessun risultato segnalato", !$("#navVuoto").hidden);
  $$(".nav-g")[2].click(); await sleep(20);
  await vai(""); const hc = $("#homeCerca"); hc.value = "usura"; hc.dispatchEvent(new w.Event("input", { bubbles: true }));
  ck("home: ricerca «usura» mostra una sola scheda", $$(".home-g:not([hidden]) a.card:not([hidden])").length === 1);
  ck("home: una scorciatoia per ogni gruppo (7)", $$("[data-vai]").length === 7);

  // paywall: il prospetto (formule, riferimenti, note) non deve essere presente nel documento
  await vai("danno-tun");
  const testoLibero = $("#result").textContent;
  ck("paywall attivo", !!$("#result .gate .cta"));
  ck("prospetto Pro non servito", !/Coefficiente moltiplicatore|Tavola 1\.A|DPR 13 gennaio 2025/.test(testoLibero));
  ck("risultato gratuito visibile", !!$("#result .total .big") && /\d/.test($("#result .total .big").textContent));
  ck("stampa riservata a Pro", /\(Pro\)/.test($("#btnPrint")?.textContent || ""));

  await vai("ravvedimento");
  ck("ravvedimento: righe F24 riservate a Pro", !!$("#result .gate") && !/8901|1989/.test($("#result").textContent));

  // valori limite
  let limiti = 0;
  for (const id of ids) {
    await vai(id);
    for (const val of ["0", "-5", "999999999", ""]) {
      for (const el of $$(".panel [data-in]")) if (el.type === "number") { el.value = val; el.dispatchEvent(new w.Event("input", { bubbles: true })); }
      await sleep(10); limiti++;
      const txt = $("#result")?.textContent || "";
      if (/NaN|Infinity|undefined|\[object/.test(txt)) { fail++; console.log(`DIFF ${id} con valore "${val || "vuoto"}": ${txt.replace(/\s+/g, " ").slice(0, 100)}`); }
    }
  }
  ck("valori limite senza risultati anomali", true, `${limiti} combinazioni`);
  ck("nessun errore JavaScript", A.errori.length === 0, A.errori.join(" | "));

  // dati pubblicati
  const annoCorr = new Date().getFullYear(), sem = new Date().getMonth() < 6 ? 1 : 2;
  const foi = JSON.parse(HTML.match(/const FOI = (\{.*?\});/)[1]);
  const tassi = HTML.match(/const TASSI_LEGALI = \{([\s\S]*?)\};/)[1];
  const bce = HTML.match(/const TASSI_BCE = \{([\s\S]*?)\};/)[1];
  const ultimoFoi = Object.keys(foi).sort().pop();
  ck("serie FOI aggiornata", Object.keys(foi).length > 350 && ultimoFoi >= "2026-08", `${Object.keys(foi).length} mesi, ultimo ${ultimoFoi}`);
  ck("saggio legale dell'anno in corso", new RegExp(`${annoCorr}\\s*:`).test(tassi), `${annoCorr}`);
  ck("tasso BCE del semestre in corso", new RegExp(`"${annoCorr}-${sem}"`).test(bce), `${annoCorr}-${sem}`);
  A.dom.window.close();

  // ---- sessione con licenza ----
  const B = apri("PROVA-CALCOLI-FORENSI-2026"); await sleep(700);
  const w2 = B.window, $2 = s => w2.document.querySelector(s);
  w2.location.hash = "#/danno-tun"; w2.dispatchEvent(new w2.HashChangeEvent("hashchange")); await sleep(80);
  ck("con licenza: prospetto servito", /Coefficiente moltiplicatore/.test($2("#result").textContent));
  ck("con licenza: nessun paywall", !$2("#result .gate"));
  ck("con licenza: stampa abilitata", /Stampa relazione \/ PDF/.test($2("#btnPrint")?.textContent || ""));
  ck("con licenza: badge Pro", /PRO ATTIVO/i.test($2("#licenseBadge").textContent));
  B.dom.window.close();

  // ---- funzioni dell'abbonato ----
  const C = apri("PROVA-CALCOLI-FORENSI-2026"); await sleep(700);
  const w3 = C.window, $3 = s => w3.document.querySelector(s);
  const vai3 = async h => { w3.location.hash = h; w3.dispatchEvent(new w3.HashChangeEvent("hashchange")); await sleep(90); };

  await vai3("#/danno-tun");
  ck("campo riferimento pratica", !!$3("#rifPratica"));
  ck("pulsante copia prospetto", !!$3("#btnCopyFull"));
  ck("pulsante salva nello storico", !!$3("#btnSave"));
  ck("catena di calcolo verso la rivalutazione", !!$3('[data-next="rivalutazione"]'));
  ck("intestazione di stampa con fonti", /relazione del/.test($3(".print-head")?.textContent || ""));
  ck("avvertenza in calce alla relazione", /non costituisce consulenza legale/.test($3(".print-foot")?.textContent || ""));

  // riferimento pratica sulla relazione
  $3("#rifPratica").value = "Rossi / Generali — sinistro 12.05.2023";
  $3("#rifPratica").dispatchEvent(new w3.Event("input", { bubbles: true }));
  await sleep(120);
  ck("pratica riportata nell'intestazione", /Rossi \/ Generali/.test($3(".print-head").textContent));

  // catena: l'importo passa al calcolatore successivo
  const totale = $3("#result .total .big").textContent;
  $3('[data-next="rivalutazione"]').click(); await sleep(150);
  ck("importo trasferito alla rivalutazione", /Importo ricevuto da/.test($3(".panel")?.textContent || ""));
  const passato = +($3("#rcap")?.value || 0);
  ck("importo trasferito corretto", Math.abs(passato - parseFloat(totale.replace(/[^\d,]/g, "").replace(".", "").replace(",", "."))) < 1000, `${passato}`);

  // storico
  await vai3("#/danno-micro"); $3("#btnSave").click(); await sleep(80);
  await vai3("#/storico");
  ck("storico registra il calcolo", /Danno biologico/.test($3("#main").textContent));
  ck("storico ha il pulsante riapri", !!$3("[data-open]"));

  // impostazioni: intestazione dello studio
  await vai3("#/impostazioni");
  ck("impostazioni accessibili", !!$3("#stInt") && !$3("#stInt").disabled);
  $3("#stInt").value = "Studio Legale Ometto"; $3("#stR2").value = "Via Carducci 2 — Pianiga (VE)";
  $3("#stSave").click(); await sleep(80);
  await vai3("#/danno-tun");
  ck("intestazione dello studio sulla relazione", /Studio Legale Ometto/.test($3(".print-head").textContent));

  // pagine informative e contatti
  await vai3("#/informazioni");
  const info = $3("#main").textContent;
  ck("informazioni: GenAItix S.r.l.s. in costituzione, campi societari previsti", /GenAItix S.r.l.s./.test(info) && /in costituzione/.test(info) && /Partita IVA/.test(info) && /REA/.test(info) && !/Ordine degli Avvocati/.test(info));
  ck("informazioni: condizioni e disdetta", /disdett/i.test(info));
  ck("informazioni: privacy", /Regolamento UE 2016\/679/.test(info));
  ck("informazioni: recesso", /recesso/i.test(info));
  ck("informazioni: assistenza", /assistenza/i.test(info));
  ck("footer con link informativi", !!$3('.foot a[href="#/informazioni"]'));
  ck("footer con erogatore e contatto", /Servizio erogato da GenAItix S\.r\.l\.s\. \(in costituzione\)/.test($3("#footTitolare").textContent) && /@/.test($3("#footTitolare").textContent));

  // ravvedimento: righe F24 e cambio di tributo
  await vai3("#/ravvedimento");
  const set3 = async (id, v) => { const el = $3("#" + id); el.value = v; el.dispatchEvent(new w3.Event("input", { bubbles: true })); await sleep(90); };
  await set3("rscad", "2026-06-30"); await set3("rpag", "2026-07-10");
  const rv = $3("#result").textContent;
  ck("ravvedimento: totale 1.008,77 € (1.000 € pagati 10 giorni dopo)", /1\.008,77/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  ck("ravvedimento: righe 4001, 8901, 1989 con anno 2025", /4001/.test(rv) && /8901/.test(rv) && /1989/.test(rv) && /2025/.test(rv));
  ck("ravvedimento: riduzione a 1/10", /1\/10/.test(rv));
  await set3("rtrib", "imu_altri");
  ck("ravvedimento IMU: campo codice Comune", !!$3("#rente"));
  await set3("rente", "g565");
  const rimu = $3("#result").textContent;
  ck("ravvedimento IMU: una riga 3918 con Ravv. e codice G565", /3918/.test(rimu) && /Ravv\./.test(rimu) && /G565/.test(rimu) && !/8901/.test(rimu));
  await set3("rtrib", "rit_dip"); await set3("rscad", "2026-01-16");
  const rrit = $3("#result").textContent;
  ck("ravvedimento ritenute: 1001 e 8947 con mese 12", /1001/.test(rrit) && /8947/.test(rrit) && !!$3("#rmese"));
  ck("ravvedimento: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // F24: dal ravvedimento al modello stampabile
  await set3("rtrib", "irpef_saldo"); await set3("rscad", "2026-06-30"); await set3("rpag", "2026-07-10");
  ck("ravvedimento: pulsante «Aggiungi all'F24»", !!$3("#btnF24"));
  $3("#btnF24").click(); await sleep(50);
  await vai3("#/f24");
  ck("F24: righe del ravvedimento nel prospetto", /4001/.test($3("#f24foglio").textContent) && /8901/.test($3("#f24foglio").textContent) && /1989/.test($3("#f24foglio").textContent));
  ck("F24: saldo 1.008,77 €", /1\.008,77/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  await set3("fsez", "Regioni"); await set3("fcod", "3801"); await set3("fente", "20"); await set3("fanno", "2025"); await set3("fdeb", "100");
  [...w3.document.querySelectorAll("button")].find(b => /Aggiungi la riga/.test(b.textContent)).click(); await sleep(120);
  ck("F24: riga aggiunta a mano nella sezione Regioni", /3801/.test($3("#f24foglio").textContent) && /1\.108,77/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  [...w3.document.querySelectorAll("button")].filter(b => b.textContent === "Elimina").pop().click(); await sleep(120);
  ck("F24: eliminazione di una riga", !/3801/.test($3("#f24foglio").textContent));
  ck("F24: pulsante di stampa", [...w3.document.querySelectorAll("button")].some(b => /Stampa F24/.test(b.textContent)));
  ck("F24: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // pena: patteggiamento e abbreviato
  await vai3("#/pena");
  ck("pena: 2 anni con attenuanti generiche = 1 anno e 4 mesi", /1 anno e 4 mesi di reclusione/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  await set3("prito", "patt");
  ck("pena: patteggiamento mostra la diminuzione concordata", !!$3("#ppatfr") && /10 mesi e 20 giorni/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  ck("pena: effetti dell'art. 445 nel prospetto", /art\. 445/.test($3("#result").textContent));
  await set3("prito", "abbr"); await set3("pnonimp", "si");
  ck("pena: abbreviato con ulteriore 1/6", /8 mesi e 26 giorni/.test($3("#result").textContent));
  await set3("ptipo", "contravvenzione");
  ck("pena: contravvenzione con arresto e ammenda", /arresto/.test($3("#result .total .big").textContent) && /Ammenda/.test($3(".panel").textContent));
  // prescrizione del reato
  await vai3("#/prescrizione-reato");
  ck("prescrizione reato: delitto max 3 anni del 10/03/2021 con interruzioni → 10/09/2028", /10\/09\/2028/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  await set3("pzdata", "2018-05-01"); await set3("pzc1", "si");
  ck("prescrizione reato: regime legge Orlando con sospensione", /L\. 103\/2017/.test($3("#result").textContent) && /01\/05\/2027/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  await set3("pzdata", "2021-03-10"); await set3("pzsent", "2025-06-01");
  ck("prescrizione reato: dal 2020 corso cessato con la sentenza di primo grado", /Corso cessato/.test($3("#result .total .big").textContent) && /344-bis/.test($3("#result").textContent));
  await set3("pzintsel", "data");
  ck("prescrizione reato: campo data dell'ultimo atto interruttivo", !!$3("#pzint"));
  await set3("pzpena", "ergastolo");
  ck("prescrizione reato: ergastolo imprescrittibile", /Imprescrittibile/.test($3("#result .total .big").textContent));
  ck("prescrizione reato: nessun errore", C.errori.length === 0, C.errori.join(" | "));
  // cambi
  await vai3("#/cambi");
  await set3("cbdata", "2026-09-30"); await set3("cbimp", "1135.5"); await sleep(60);
  ck("cambi: 1.135,50 USD al cambio 1,1355 = 1.000,00 €", /1\.000,00/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  await set3("cbdata", "2026-09-27"); await sleep(60);
  ck("cambi: domenica senza quotazione → giorno antecedente più prossimo", /giorno antecedente più prossimo, 26\/09\/2026/.test($3("#result").textContent), $3("#result .total").textContent.replace(/\s+/g, " ").slice(0, 200));
  await set3("cbmodo", "lire"); await set3("cbimp", "1936270");
  ck("cambi: 1.936.270 lire = 1.000,00 €", /1\.000,00/.test($3("#result .total .big").textContent));
  ck("cambi: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // calendario del processo
  await vai3("#/calendario-processo");
  ck("calendario: terza memoria anticipata al venerdì 26/02/2027", /26\/02\/2027/.test($3("#result").textContent));
  ck("calendario: esportazione .ics", /BEGIN%3AVCALENDAR/.test($3('a[download="calendario-processo.ics"]')?.getAttribute("href") || ""));
  await set3("cpdec", "2028-01-19");
  ck("calendario: scritti conclusivi aggiunti", /Comparse conclusionali/.test($3("#result").textContent));
  ck("calendario: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // usura
  await vai3("#/usura");
  const optMutuo = [...$3("#uscat").options].find(o => /^Mutui.*tasso fisso/i.test(o.textContent));
  await set3("usdata", "2026-10-15"); await set3("uscat", optMutuo.value); await set3("usteg", "9.7");
  ck("usura: mutuo fisso 4° trim. 2026, soglia 9,6500% e TEG 9,70% oltre", /9,6500/.test($3("#result .total .big").textContent) && /oltre la soglia/i.test($3("#result .total").textContent), $3("#result .total").textContent.replace(/\s+/g, " ").slice(0, 120));
  await set3("usdata", "2008-03-10");
  ck("usura: data del 2008 ricarica le categorie dell'epoca", [...$3("#uscat").options].some(o => /\(fino al 31 dicembre 2009\)|MUTUI/i.test(o.textContent)));
  ck("usura: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // atto di precetto
  await vai3("#/precetto");
  await set3("prdata", "2025-01-15"); await set3("prvive", "30");
  ck("precetto: totale 14.534,79 € (caso calcolato a mano)", /14\.534,79/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  await set3("prtint", "conv");
  ck("precetto: campo tasso convenzionale", !!$3("#prtasso"));
  ck("precetto: avvertenze dell'art. 480", /sovraindebitamento/.test($3("#result").textContent));
  ck("precetto: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // quote ereditarie
  await vai3("#/quote-ereditarie");
  ck("eredità: coniuge e due figli 1/3 ciascuno", /Coniuge 1\/3/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  ck("eredità: riserva 150.000 € su massa di 600.000", /150\.000,00/.test($3("#result").textContent));
  await set3("qestirpi", "2");
  ck("eredità: rappresentazione dei nipoti", /per rappresentazione/.test($3("#result").textContent));
  ck("eredità: passaggio all'imposta di successione", !!$3('[data-next="successione"]'));
  ck("eredità: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // prescrizione e decadenza tributaria
  await vai3("#/prescrizione-tributi");
  ck("tributi: erariali notificati il 15/05/2019 → 15/05/2029", /15\/05\/2029/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  ck("tributi: data con la sospensione Covid mostrata a parte", /31\/8\/2021/.test($3("#result").textContent));
  await set3("ptmodo", "accertamento"); await set3("ptanno", "2018"); await set3("ptpres", "2019");
  ck("tributi: accertamento periodo 2018 → 31/12/2024 e 26/03/2025", /31\/12\/2024/.test($3("#result .total .big").textContent) && /26\/03\/2025/.test($3("#result").textContent));
  await set3("ptmodo", "cartella"); await set3("pttipo", "36bis"); await set3("ptpres", "2018");
  ck("tributi: cartella 36-bis dichiarazione 2018 → 28/02/2023", /28\/02\/2023/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  ck("tributi: nessun errore", C.errori.length === 0, C.errori.join(" | "));
  // parcella penale
  await vai3("#/parcella-penale");
  ck("parcella penale: monocratico 5.241,16 €", /5\.241,16/.test($3("#result .total .big").textContent), $3("#result .total .big").textContent);
  await set3("pp2aut", "gip"); await set3("pp2fasi", "senzaIst");
  ck("parcella penale: seconda autorità sommata", /GIP e GUP/.test($3("#result").textContent));
  ck("pena e parcella penale: nessun errore", C.errori.length === 0, C.errori.join(" | "));

  // senza licenza le impostazioni restano bloccate
  const D = apri(null); await sleep(600);
  D.window.location.hash = "#/impostazioni"; D.window.dispatchEvent(new D.window.HashChangeEvent("hashchange")); await sleep(90);
  ck("senza licenza intestazione bloccata", D.window.document.querySelector("#stInt").disabled);
  ck("senza licenza niente campo pratica", !D.window.document.querySelector("#rifPratica"));
  ck("nessun errore nelle nuove pagine", C.errori.length === 0 && D.errori.length === 0, [...C.errori, ...D.errori].join(" | "));
  C.dom.window.close(); D.dom.window.close();

  // ---- scadenziario: oggi nessun avviso; in una data futura senza aggiornamenti, avviso sui calcolatori interessati ----
  const E = apri(null); await sleep(600);
  E.window.location.hash = "#/danno-micro"; E.window.dispatchEvent(new E.window.HashChangeEvent("hashchange")); await sleep(80);
  ck("scadenziario: nessun avviso con dati aggiornati", !/Aggiornamento in corso/.test(E.window.document.querySelector("#main").textContent));
  const scad = E.window.eval("datiScaduti(new Date('2027-09-20T12:00:00Z'))");
  ck("scadenziario: rileva art. 139 non aggiornato", scad.some(x => x.id === "art139" && x.calc.includes("danno-micro")));
  ck("scadenziario: rileva saggio legale e BCE mancanti", scad.some(x => x.id === "saggio") && scad.some(x => x.id === "bce"));
  E.window.eval("window.__D=Date; Date=class extends window.__D{constructor(...a){super(...(a.length?a:['2027-09-20T12:00:00Z']))} static now(){return new window.__D('2027-09-20T12:00:00Z').getTime()}}");
  E.window.location.hash = "#/interessi-legali"; E.window.dispatchEvent(new E.window.HashChangeEvent("hashchange")); await sleep(80);
  ck("scadenziario: avviso visibile sul calcolatore", /Aggiornamento in corso: saggio degli interessi legali 2027/.test(E.window.document.querySelector("#main").textContent));
  ck("pubblico esteso nella home", true);
  E.window.location.hash = "#/"; E.window.dispatchEvent(new E.window.HashChangeEvent("hashchange")); await sleep(80);
  ck("home: professioni servite", /commercialisti e consulenti del lavoro/.test(E.window.document.querySelector("#main").textContent));
  E.dom.window.close();

  console.log(`\n${pass} OK, ${fail} DIFF`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("ERRORE run_dom_tests:", e); process.exit(1); });
