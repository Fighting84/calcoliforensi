// Estrae dati + motori da index.html e li confronta con casi_test.json (output MCP Legal IT).
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = html.slice(html.indexOf("/* ===================== DATI NORMATIVI"), html.indexOf("/* ===================== LICENZA"));
const ENGINES = new Function(src + "\nreturn ENGINES;")();
const T = JSON.parse(fs.readFileSync(path.join(__dirname, "casi_test.json"), "utf8"));
let pass = 0, fail = 0;
const r2 = x=>Math.round(x*100)/100;
const ck = (name, got, exp) => { const ok = Math.abs(got - exp) < 0.011; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };

for (const c of T.danno_micro) {
  const R = ENGINES.dannoMicro(c.in.pct, c.in.eta, c.in.itt, c.in.itp75, c.in.itp50, c.in.itp25, c.in.pers, "2025");
  ck(`micro ${c.in.pct}%/${c.in.eta}a totale`, R.totale, c.out.totale);
  ck(`  permanente`, R.perm, c.out.danno_permanente);
  ck(`  temporaneo`, R.temp, c.out.temporaneo);
  if (c.out.morale != null) ck(`  morale`, R.morale, c.out.morale);
}
for (const c of T.interessi_legali) {
  const R = ENGINES.interessiLegali(c.in.capitale, c.in.da, c.in.a);
  ck(`legali ${c.in.capitale} ${c.in.da}→${c.in.a}`, R.totale, c.out.totale);
  c.out.periodi.forEach(([y, g, t, i], k) => { ck(`  ${y} giorni`, R.periodi[k].giorni, g); ck(`  ${y} interessi`, R.periodi[k].interessi, i); });
}
for (const c of T.interessi_mora) {
  const R = ENGINES.interessiMora(c.in.capitale, c.in.da, c.in.a);
  ck(`mora ${c.in.capitale} ${c.in.da}→${c.in.a}`, R.totale, c.out.totale);
  c.out.periodi.forEach(([dal, al, g, t, i], k) => { ck(`  ${dal}–${al} giorni`, R.periodi[k].giorni, g); ck(`  tasso`, R.periodi[k].tasso, t); ck(`  interessi`, R.periodi[k].interessi, i); if (R.periodi[k].dal !== dal || R.periodi[k].al !== al) { fail++; console.log(`DIFF etichette ${R.periodi[k].dal}–${R.periodi[k].al}`); } });
}
for (const c of T.contributo_unificato) {
  const R = ENGINES.contributoUnificato(c.in.valore, c.in.tipo, c.in.grado);
  ck(`CU ${c.in.valore} ${c.in.tipo} ${c.in.grado}`, R.dovuto, c.out.dovuto);
}
// Tabelle di Milano 2024 — celle lette dal PDF ufficiale (Tribunale di Milano, P. 7646/24)
const MIL = [[1,1,1742,1393,349],[25,1,155412],[50,1,555135],[70,5,928311],[100,1,1436820],[100,100,725594],[10,10,31435],[76,91,580826],[90,100,649770],[60,1,754722],[35,1,294326]];
for (const [pct, eta, cella, bio, soff] of MIL) {
  const R = ENGINES.dannoMilano(pct, eta, 0, 0, 0, 0, 0, 0);
  ck(`Milano ${pct}% ${eta}a cella`, R.cella, cella);
  if (bio != null) { ck(`  bio`, R.bio, bio); ck(`  soff`, R.soff, soff); }
}
// Personalizzazione massima e temporanea
ck("Milano persMax 10%", ENGINES.dannoMilano(10, 1, 0, 0, 0, 0, 0, 0).persMax, 49);
ck("Milano persMax 34%", ENGINES.dannoMilano(34, 1, 0, 0, 0, 0, 0, 0).persMax, 25);
ck("Milano temporanea 10g ITT + 20g 50% +50%", ENGINES.dannoMilano(1, 1, 0, 10, 0, 20, 0, 50).temporaneo, (1150 + 1150) * 1.5);
// Danno parentale — esempi ufficiali Allegato 1 (punti) + tetto 2024
const PAR = [
  ["genitori", 15, 45, "si", 2, 0, 74], ["genitori", 15, 45, "si", 2, 30, 104], ["genitori", 10, 39, "si", 0, 15, 97],
  ["genitori", 45, 68, "no", 2, 0, 48], ["genitori", 80, 85, "si", 1, 0, 50], ["genitori", 48, 49, "si", 1, 30, 100], ["genitori", 40, 6, "si", 2, 30, 108],
  ["fratelli", 51, 45, "no", 5, 0, 26], ["fratelli", 11, 5, "si", 2, 30, 102], ["fratelli", 15, 75, "no", 5, 15, 43]];
for (const [cat, v, s, c, n, e, punti] of PAR) {
  const R = ENGINES.dannoParentale(cat, v, s, c, n, e);
  ck(`parentale ${cat} V${v} S${s} ${c} sup${n} rel${e} punti`, R.punti, punti);
}
ck("parentale cap genitori", ENGINES.dannoParentale("genitori", 40, 6, "si", 2, 30).importo, 391103.18);
ck("parentale cap fratelli", ENGINES.dannoParentale("fratelli", 11, 5, "si", 2, 30).importo, 169830.60);
ck("parentale 26 punti fratelli", ENGINES.dannoParentale("fratelli", 51, 45, "no", 5, 0).importo, 44155.96);
ck("parentale 100 punti = cap", ENGINES.dannoParentale("genitori", 48, 49, "si", 1, 30).importo, 391103.18);
// Tabella Unica Nazionale — celle lette dalla GU n. 40/2025 S.O. 4 (valori 2024, primo punto 947,30)
const TUN = [[10,1,26124,2612.40],[10,2,25993],[40,20,222226,6138.85],[25,10,108680],[33,15,166605],[40,11,233276],[100,90,585921,10370.28],[100,81,629476],[71,85,364355,8727.49],[85,88,469028],[83,88,452469]];
for (const [pct, eta, cella, punto] of TUN) {
  const R = ENGINES.dannoTUN(pct, eta, "2024", "none", 0, 0, 0, 0, 0, 0);
  ck(`TUN ${pct}% ${eta}a cella bio`, R.cellaBio, cella);
  if (punto != null) ck(`  punto`, R.punto, punto);
}
// Tabella 2.A (morale minimo): riga 10% → B 548,60 (21,0%), A+B 3.161,00; riga 40% → B 2.314,35 (37,7%)
ck("TUN morale min 10% punto morale", ENGINES.dannoTUN(10, 1, "2024", "min", 0, 0, 0, 0, 0, 0).puntoMor, 548.60);
ck("TUN morale min 10% cella A+B 1a", ENGINES.dannoTUN(10, 1, "2024", "min", 0, 0, 0, 0, 0, 0).cellaTot, 31610);
ck("TUN morale min 40% punto morale", ENGINES.dannoTUN(40, 1, "2024", "min", 0, 0, 0, 0, 0, 0).puntoMor, 2314.35);
ck("TUN morale med 40% = min+5%", ENGINES.dannoTUN(40, 1, "2024", "med", 0, 0, 0, 0, 0, 0).cmMor, 0.427);
ck("TUN 2025 primo punto", ENGINES.dannoTUN(10, 1, "2025", "none", 0, 0, 0, 0, 0, 0).punto, 2656.80);
ck("TUN personalizzazione cap 30%", ENGINES.dannoTUN(10, 1, "2024", "none", 50, 0, 0, 0, 0, 0).pers, 30);
// Rivalutazione ISTAT — riferimento indipendente rivaluta.it (dati ISTAT, coefficiente a 3 decimali), 21/09/2026
const RIV = [["2020-01-01","2026-08-01",1.226],["2008-03-01","2026-08-01",1.390],["2015-01-01","2016-01-01",1.003],["2025-12-01","2026-08-01",1.036]];
for (const [da, a, c] of RIV) ck(`rivalutazione ${da}→${a} coeff`, ENGINES.rivalutazione(10000, da, a, false).coeff, c);
ck("rivalutazione 1000 dic25→ago26", ENGINES.rivalutazione(1000, "2025-12-01", "2026-08-01", false).rivalutato, 1036);
// Interessi sul rivalutato anno per anno: righe 2020-2024 coincidono con MCP (stessi indici FOI)
const RI = ENGINES.rivalutazione(10000, "2020-01-15", "2026-06-15", true);
ck("riv+int 2020 capitale", RI.anni[0].capitale, 9960); ck("riv+int 2020 giorni", RI.anni[0].giorni, 351);
ck("riv+int 2022 interessi", RI.anni[2].interessi, r2(r2(10000*Math.round(118.2/102.7*1000)/1000)*0.0125));
ck("riv+int 2024 giorni", RI.anni[4].giorni, 366);
ck("riv oltre ultimo indice usa agosto 2026", ENGINES.rivalutazione(1000, "2026-08-01", "2026-12-31", false).coeff, 1);
// Parcella DM 55/2014 (tab. DM 147/2022): valori medi vs MCP e vs tabella GU; art. 6; art. 22; fattura
const ALL = {S:0,I:0,T:0,D:0};
ck("parcella tab.2 15.000 medio", ENGINES.parcella("2", 15000, ALL, {}).compenso, 5077);
ck("parcella tab.2 80.000 medio", ENGINES.parcella("2", 80000, ALL, {}).compenso, 14103);
ck("parcella tab.2 500 minimo", ENGINES.parcella("2", 500, {S:-50,I:-50,T:-50,D:-50}, {}).compenso, (131+131+200+200)/2);
ck("parcella tab.12 300.000 max", ENGINES.parcella("12", 300000, {S:50,I:50,T:50,D:50}, {}).compenso, r2((4389+2552+5880+7298)*1.5));
ck("parcella tab.8 monitorio 30.000", ENGINES.parcella("8", 30000, {C:0}, {}).compenso, 1370);
ck("parcella art.6 1,5M bands", ENGINES.parcella("2", 1500000, ALL, {oltrePct:30}).bands, 2);
ck("parcella art.6 1,5M compenso", ENGINES.parcella("2", 1500000, ALL, {oltrePct:30}).compenso, r2(r2(3544*1.69)+r2(2338*1.69)+r2(10411*1.69)+r2(6164*1.69)));
ck("parcella art.22 stragiudiziale 1M", ENGINES.parcella("25", 1000000, {C:0}, {}).compenso, 6164 + 14400);
ck("parcella art.22 stragiudiziale 3M", ENGINES.parcella("25", 3000000, {C:0}, {}).compenso, 6164 + r2(1480000*0.03) + r2(1000000*0.0275));
const F = ENGINES.parcella("2", 15000, ALL, {ritenuta:true});
ck("fattura spese generali", F.speseGen, 761.55); ck("fattura CPA", F.cpa, 233.54); ck("fattura IVA", F.iva, 1335.86); ck("fattura totale", F.totale, 7407.95); ck("fattura ritenuta", F.ritenuta, 1167.71);
ck("parcella conciliazione", ENGINES.parcella("2", 15000, ALL, {conciliazione:true}).compenso, r2(5077 + 1701*1.25));
ck("parcella 3 parti +60%", ENGINES.parcella("2", 15000, ALL, {parti:3}).compenso, r2(5077*1.6));
ck("parcella telematico 30%", ENGINES.parcella("2", 15000, ALL, {telematico:30}).compenso, r2(5077*1.3));
// TFR — coefficienti ufficiali di rivalutazione (1,5% + 75% ΔFOI dic/dic): 2022 9,974576%; 2023 1,944173%; 2024 2,320233%; dic 2025→ago 2026 3,710988% (rivaluta.it)
const TF = ENGINES.tfr(30000, "2020-01-01", "2026-08-31", 0);
const tasso = y => TF.anni.find(r => r.anno === y).tasso * 100;
ck("TFR tasso 2022", tasso(2022), 9.9746); ck("TFR tasso 2023", tasso(2023), 1.9442); ck("TFR tasso 2024", tasso(2024), 2.3202); ck("TFR tasso 2026 (8 mesi)", tasso(2026), 3.7110);
ck("TFR quota annua 30.000", TF.anni[0].quota, r2(30000/13.5 - 150));
ck("TFR mesi 2026", TF.anni[6].mesi, 8);
// Scadenze processuali — casi calcolati a mano (art. 155 c.p.c., L. 742/1969)
const SC = [
  ["2026-09-21",30,"giorni","avanti",true,false,"2026-10-21"],           // semplice
  ["2026-07-15",30,"giorni","avanti",true,false,"2026-09-14"],           // attraversa agosto: 16 gg luglio + 14 settembre
  ["2026-03-10",6,"mesi","avanti",true,false,"2026-10-12"],              // 6 mesi + 31 gg feriale = dom 11/10 → lun 12/10
  ["2026-09-21",5,"giorni","avanti",true,false,"2026-09-28"],            // scade sabato 26 → lunedì 28
  ["2026-11-16",70,"giorni","ritroso",true,true,"2026-09-04"],           // a ritroso, liberi: dom 6/9 → sab 5/9 → ven 4/9
  ["2027-03-19",10,"giorni","avanti",true,false,"2027-03-30"],           // scade Lunedì dell'Angelo 29/3/2027 → 30/3
  ["2026-07-25",40,"giorni","avanti",true,false,"2026-10-05"],           // opposizione D.I.: dom 4/10 → lun 5/10
  ["2026-08-10",30,"giorni","avanti",true,false,"2026-09-30"],           // inizio in feriale: decorre dal 1° settembre
  ["2026-08-10",30,"giorni","avanti",false,false,"2026-09-09"],          // senza sospensione
  ["2026-01-31",1,"mesi","avanti",true,false,"2026-03-02"]];             // 31/1 + 1 mese = 28/2 (sab) → lun 2/3
for (const [ini, n, u, d, f, l, exp] of SC) { const R = ENGINES.scadenza(ini, n, u, d, f, l); const ok = R.scadenza === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} scadenza ${ini} +${n} ${u} ${d}${f ? " feriale" : ""}${l ? " liberi" : ""}: atteso ${exp}, ottenuto ${R.scadenza}`); }
// Immobili, locazioni, fisco, esecuzione, prescrizione
ck("usufrutto 45 anni", ENGINES.usufrutto(100000, 45).pct, 80); ck("usufrutto 75 anni", ENGINES.usufrutto(100000, 75).pct, 35);
ck("usufrutto 20 anni", ENGINES.usufrutto(100000, 20).pct, 95); ck("usufrutto 21 anni", ENGINES.usufrutto(100000, 21).pct, 90); ck("usufrutto 100 anni", ENGINES.usufrutto(100000, 100).pct, 5);
ck("val. catastale A/2 registro", ENGINES.valoreCatastale(800, "A/2", "registro", false).valore, 100800);
ck("val. catastale A/2 prima casa", ENGINES.valoreCatastale(800, "A/2", "registro", true).valore, 92400);
ck("val. catastale C/1 successione (34)", ENGINES.valoreCatastale(2000, "C/1", "successione", false).valore, 71400);
ck("val. catastale B registro (168)", ENGINES.valoreCatastale(1000, "B/2", "registro", false).valore, 176400);
ck("IMU A/2 10,6‰", ENGINES.imu(800, "A/2", 10.6, 12, 100, false, 200).imu, 1424.64);
ck("IMU 6 mesi 50%", ENGINES.imu(800, "A/2", 10.6, 6, 50, false, 200).imu, 356.16);
ck("IMU abitazione principale esente", ENGINES.imu(800, "A/2", 10.6, 12, 100, true, 200).imu, 0);
ck("IMU A/1 abitazione principale con detrazione", ENGINES.imu(2000, "A/1", 6, 12, 100, true, 200).imu, r2(2100 * 160 * 0.006) - 200);
ck("compravendita prima casa prezzo-valore", ENGINES.compravendita(250000, 800, "abitazione", true, false, false).totale, 1948);
ck("compravendita non prima casa", ENGINES.compravendita(250000, 800, "abitazione", false, false, false).totale, 9172);
ck("compravendita impresa IVA 4%", ENGINES.compravendita(250000, 0, "abitazione", true, true, false).totale, 10600);
ck("compravendita registro minimo 1000", ENGINES.compravendita(20000, 0, "altro", false, false, false).totale, 1900);
ck("successione coniuge 1,5M con immobili", ENGINES.successione(1500000, 1500000, "retta", false, false).totale, 65000);
ck("successione fratello 150k", ENGINES.successione(150000, 0, "fratelli", false, false).imposta, 3000);
ck("successione disabile 1,4M", ENGINES.successione(1400000, 0, "retta", true, false).imposta, 0);
ck("successione estraneo 50k", ENGINES.successione(50000, 0, "altri", false, false).imposta, 4000);
ck("canone 75% stesso mese", ENGINES.adeguamentoCanone(9600, "2024-09-01", "2025-09-01", 75, "stesso").nuovo, 9702);
ck("canone 100% mese precedente", ENGINES.adeguamentoCanone(9600, "2024-09-01", "2025-09-01", 100, "precedente").nuovo, r2(9600 * (121.8 / 120.1)));
ck("cedolare 21%", ENGINES.cedolare(9600, "libero", 35, 2.5, 4).ced, 2016);
ck("ordinaria 35%+2,5%", ENGINES.cedolare(9600, "libero", 35, 2.5, 4).totIrpef, 3420 + 96 + 16);
ck("pignoramento fiscale 1800", ENGINES.pignoramento(1800, "fiscale", false, 538.69, 0).pign, 180);
ck("pignoramento pensione ordinario", ENGINES.pignoramento(1800, "ordinario", true, 538.69, 0).pign, r2((1800 - 1077.38) / 5));
ck("pignoramento pensione minimo 1000", ENGINES.pignoramento(1300, "ordinario", true, 400, 0).impign, 1000);
{ const P = ENGINES.prescrizione("rca", "2024-03-10"); const ok = P.scadenza === "2026-03-10" && P.prescritto; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} prescrizione RCA 2 anni: ${P.scadenza} prescritto=${P.prescritto}`); }
{ const P = ENGINES.prescrizione("ordinaria", "2024-02-29"); const ok = P.scadenza === "2034-02-28"; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} prescrizione da 29/2: ${P.scadenza}`); }
// Importi art. 139 2026 (DM MIMIT 20/07/2026, GU n. 173/2026): calcolo indipendente con la formula di legge
{ const P = 988.45, ITT = 57.64, rid = 0.875, coeff = [1, 1.1, 1.2, 1.3, 1.5];
  const perm = r2(coeff.reduce((a, c) => a + P * rid * c, 0)), temp = r2(r2(10 * ITT) + r2(20 * r2(ITT * 0.5)));
  const R = ENGINES.dannoMicro(5, 35, 10, 0, 20, 0, 10, "2026");
  ck("micro 2026 permanente", R.perm, perm); ck("micro 2026 temporanea", R.temp, temp); ck("micro 2026 totale", R.totale, r2(r2(perm + temp) * 1.1));
  ck("micro senza anno usa gli importi più recenti", ENGINES.dannoMicro(5, 35, 10, 0, 20, 0, 10).totale, R.totale); }
ck("TUN 2026 punto 10%", ENGINES.dannoTUN(10, 1, "2026", "none", 0, 0, 0, 0, 0, 0).punto, r2(988.45 * 2.75773));
ck("TUN senza anno usa il 2026", ENGINES.dannoTUN(10, 1, "", "none", 0, 0, 0, 0, 0, 0).punto, r2(988.45 * 2.75773));
ck("pignoramento: assegno sociale 2026 predefinito", ENGINES.pignoramento(1800, "ordinario", true, 0, 0).AS, 546.24);
{ const T = ENGINES.tfr(30000, "2016-01-01", "2026-08-31", 0); const x = T.rif, sc = [[28000, .23], [50000, .33], [Infinity, .43]]; let tax = 0, prev = 0; for (const [l, a] of sc) { if (x <= prev) break; tax += (Math.min(x, l) - prev) * a; prev = l; } ck("TFR: scaglioni IRPEF 2026", T.aliq, tax / x); }
// Citazioni dei testi unici: tutti applicabili dal 1/1/2027 (D.Lgs. 123/2025 registro e 173/2024 sanzioni rinviati dall'art. 4 DL 200/2025,
// GU 302 del 31/12/2025; D.Lgs. 10/2026 IVA, 117/2026 TUIR e 141/2026 adempimenti dal 1/1/2027 in origine). Testi in monitoraggio/gazzetta
{ const need = ["TU registro D.Lgs. 123/2025", "artt. 50 e 52 e allegato 4", "artt. 93 e 133 del TU registro", "art. 299", "D.Lgs. 117/2026", "TU IVA D.Lgs. 10/2026", "DL 200/2025"]; const miss = need.filter(n => !html.includes(n)); miss.length ? fail++ : pass++; console.log(`${miss.length ? "DIFF" : "OK  "} citazioni testi unici nelle note ${miss.join("; ")}`); }
{ const bad = (html.match(/.{0,120}(?:1° gennaio 2026|1\/1\/2026).{0,40}/g) || []).filter(s => /D\.Lgs\. (?:123\/2025|173\/2024)|TU (?:registro|sanzioni)/.test(s)); bad.length ? fail++ : pass++; console.log(`${bad.length ? "DIFF" : "OK  "} nessun testo unico indicato come applicabile dal 2026 ${bad.join(" | ")}`); }
// Pena: casi calcolati a mano (giorni con mese di 30 e anno di 360, frazioni di giorno ed euro eliminate: art. 134 c.p.)
{ const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  const P = o => ENGINES.pena({ tipo: "delitto", eta: "adulto", valoreGiorno: 5, ...o });
  const pt = new Function(src + "\nreturn penaTesto;")();
  eq("testo pena 320 giorni", pt(320), "10 mesi e 20 giorni"); eq("testo pena 400 giorni", pt(400), "1 anno, 1 mese e 10 giorni"); eq("testo pena 361 giorni", pt(361), "1 anno e 1 giorno");
  let R = P({ base: { a: 2 }, circ: [{ t: "att", f: "1/3" }], rito: "abbr", nonImpugnata: true });
  eq("2 anni − generiche 1/3 − abbreviato 1/3", R.d, 320); eq("  ulteriore 1/6 senza impugnazione (266,67 → 266)", R.esec.d, 266);
  R = P({ base: { a: 1, m: 6 }, multa: 600, circ: [{ t: "att", f: "1/3" }], rito: "patt", patFr: "1/3" });
  eq("patteggiamento 1a6m + 600 € − 1/3 − 1/3", `${R.d}/${R.p}`, "240/266"); eq("  art. 445 e sospensione (240 gg + 2 gg di ragguaglio)", `${R.patt.art445}/${R.sosp.tot}/${R.sosp.esito}`, "true/242/si");
  eq("  pena pecuniaria sostitutiva 240 gg × 5 €", R.sostitutive[2].importo, 1200);
  R = P({ base: { a: 2 }, circ: [{ t: "agg", f: "1/3" }, { t: "att", f: "1/3" }], bil: "equi" }); eq("equivalenza: pena base invariata", R.d, 720);
  R = P({ base: { a: 2 }, circ: [{ t: "agg", f: "1/3" }, { t: "att", f: "1/3" }], bil: "agg" }); eq("prevalenza aggravanti: solo +1/3", R.d, 960);
  R = P({ base: { m: 7 }, circ: [{ t: "agg", f: "1/3" }, { t: "agg", f: "1/2" }] }); eq("effetto speciale applicato per primo", R.passi[1].voce.startsWith("Aggravante ad effetto speciale") && R.d === 420, true);
  R = P({ base: { a: 1 }, circ: [1, 2, 3, 4].map(() => ({ t: "att", f: "1/3" })) }); eq("art. 67: non sotto 1/4 (360 → 70 → 90)", R.d, 90);
  R = ENGINES.pena({ tipo: "contravvenzione", base: { m: 3 }, multa: 1000, rito: "abbr" }); eq("contravvenzione abbreviato −1/2", `${R.d}/${R.p}/${R.pec}`, "45/500/ammenda");
  R = P({ base: { a: 1 }, cont: { m: 4 } }); eq("continuazione +4 mesi", R.d, 480);
  R = P({ base: { m: 1 }, cont: { m: 3 } }); eq("continuazione oltre il triplo ridotta", `${R.d}/${R.avvisi.length}`, "90/1");
  R = P({ base: { a: 6 }, tentativo: "2/3" }); eq("tentativo −2/3 su 6 anni", R.d, 720);
  R = P({ base: { a: 24 }, circ: [{ t: "agg", f: "1/2" }] }); eq("limite 30 anni di reclusione", R.d, 10800);
  eq("sospensione 2a3m: adulto no, 18-21 sì", `${P({ base: { a: 2, m: 3 } }).sosp.esito}/${P({ base: { a: 2, m: 3 }, eta: "giovane" }).sosp.esito}`, "no/si");
  eq("sospensione solo detentiva se la multa ragguagliata supera", P({ base: { a: 1, m: 11 }, multa: 10000 }).sosp.esito, "solo-detentiva");
  eq("patteggiamento oltre 5 anni non ammissibile", P({ base: { a: 9 }, rito: "patt", patFr: "1/3" }).patt.ammissibile, false);
  eq("pene sostitutive a 3 anni e 6 mesi: solo semilibertà/detenzione domiciliare", P({ base: { a: 3, m: 6 } }).sostitutive.map(s => s.ok).join(), "true,false,false");
  eq("nessuna pena: nessun calcolo", P({ base: {} }), null); }
// Parcella penale: tabella 15 DM 147/2022 (GU 236/2022, pag. 7) — Tribunale monocratico confrontato con Legal IT (5.241,16 €)
{ const PP = o => ENGINES.parcellaPenale({ righe: [{ aut: "mono", fasi: "tutte" }], ...o });
  let R = PP({}); ck("monocratico tutte le fasi: compenso", R.compenso, 3592); ck("  totale con spese generali, CPA e IVA", R.totale, 5241.16);
  ck("Cassazione (senza istruttoria in tabella)", ENGINES.parcellaPenale({ righe: [{ aut: "cass", fasi: "tutte" }] }).compenso, 945 + 2646 + 2741);
  ck("GIP senza istruttoria + monocratico", ENGINES.parcellaPenale({ righe: [{ aut: "gip", fasi: "senzaIst" }, { aut: "mono", fasi: "tutte" }] }).compenso, 851 + 756 + 1418 + 3592);
  ck("variazione +50%", PP({ varPct: 50 }).compenso, 5388); ck("variazione −80% limitata a −50%", PP({ varPct: -80 }).compenso, 1796);
  ck("3 assistiti: +60%", PP({ assistiti: 3 }).compenso, r2(3592 * 1.6)); ck("12 assistiti: +270% +20%", PP({ assistiti: 12 }).compenso, r2(3592 * 3.9));
  ck("patrocinio a spese dello Stato: −1/3", PP({ gratuito: true }).compenso, r2(3592 - r2(3592 / 3)));
  ck("indagini difensive complesse +20%", ENGINES.parcellaPenale({ righe: [{ aut: "idif", fasi: "tutte" }], idCompl: true }).compenso, r2(851 * 1.2 + 1418 * 1.2));
  ck("Corte di Assise di Appello", ENGINES.parcellaPenale({ righe: [{ aut: "assapp", fasi: "tutte" }] }).compenso, 756 + 1985 + 2268 + 2336); }
// Prescrizione del reato: casi calcolati a mano dagli artt. 157-161-bis c.p.
{ const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  const PR = o => ENGINES.prescrizioneReato({ tipo: "delitto", pena: "detentiva", limite: "1/4", oggi: "2026-10-01", ...o });
  let R = PR({ data: "2021-03-10", maxA: 3 });
  eq("delitto max 3 anni: minimo 6 anni, massimo 7a6m", `${R.mesi}/${R.mesiMax}/${R.ordinaria}/${R.massima}`, "72/90/2027-03-10/2028-09-10");
  eq("  dal 2020 senza sentenza: non prescritto", R.prescritto, false);
  eq("atti interruttivi senza data: termine massimo", PR({ data: "2021-03-10", maxA: 3, interrotto: true }).effettiva, "2028-09-10");
  R = PR({ tipo: "contravvenzione", data: "2021-03-10", maxA: 1 }); eq("contravvenzione: 4 anni, massimo 5", `${R.ordinaria}/${R.massima}`, "2025-03-10/2026-03-10");
  eq("  prescritta al 1/10/2026", R.prescritto, true);
  R = PR({ data: "2021-03-10", maxA: 10 }); eq("rapina (max 10 anni): 10 anni e 12a6m", `${R.mesi}/${R.mesiMax}`, "120/150");
  R = PR({ data: "2021-03-10", maxA: 10, tentato: true }); eq("tentativo: 80 mesi, massimo 100", `${R.mesi}/${R.mesiMax}`, "80/100");
  R = PR({ data: "2021-03-10", maxA: 5, aggSpec: "1/2" }); eq("aggravante ad effetto speciale +1/2 su 5 anni: 7a6m; massimo 112,5 mesi", `${R.mesi}/${R.mesiMax}/${R.massima}`, "90/112.5/2030-07-25");
  R = PR({ data: "2021-03-10", maxA: 7, raddoppio: true }); eq("raddoppio (art. 589 c. 2): 14 anni, massimo 17a6m", `${R.mesi}/${R.mesiMax}`, "168/210");
  R = PR({ data: "2021-03-10", maxA: 3, limite: "2/3" }); eq("recidiva reiterata: massimo 10 anni", R.mesiMax, 120);
  R = PR({ data: "2021-03-10", maxA: 3, limite: "illimitato", ultimaInterr: "2026-01-15" }); eq("art. 51 c. 3-bis: nessun limite, nuovo termine dall'atto", `${R.massima}/${R.effettiva}`, "null/2032-01-15");
  R = PR({ data: "2021-03-10", maxA: 3, ultimaInterr: "2024-01-15" }); eq("interruzione: nuovo termine oltre il massimo → massimo", R.effettiva, "2028-09-10");
  R = PR({ data: "2021-03-10", maxA: 3, ultimaInterr: "2021-06-01" }); eq("interruzione precoce: 6 anni dall'atto", R.effettiva, "2027-06-01");
  R = PR({ data: "2021-03-10", maxA: 3, ultimaInterr: "2027-06-01" }); eq("atto successivo alla scadenza ordinaria: non interrompe", `${R.effettiva}/${R.avvisi.length}`, "2027-03-10/1");
  R = PR({ data: "2021-03-10", maxA: 3, sospGiorni: 100 }); eq("sospensione di 100 giorni", R.ordinaria, "2027-06-18");
  R = PR({ tipo: "contravvenzione", data: "2018-05-01", maxA: 1, interrotto: true, condanna1: true, condanna2: true }); eq("legge Orlando: termine massimo + 36 mesi dopo due condanne", `${R.regime}/${R.massima}/${R.dopo.conSosp}`, "orlando/2023-05-01/2026-05-01");
  R = PR({ tipo: "contravvenzione", data: "2018-05-01", maxA: 1, condanna1: true }); eq("  senza atti interruttivi e con una sola condanna: +18 mesi sul termine ordinario", R.dopo.conSosp, "2023-11-01");
  eq("legge Orlando dal 3/8/2017 (SU 20989/2025)", `${PR({ data: "2017-08-03", maxA: 3 }).regime}/${PR({ data: "2017-08-02", maxA: 3 }).regime}/${PR({ data: "2020-01-01", maxA: 3 }).regime}`, "orlando/ante/cartabia");
  R = PR({ data: "2021-01-10", maxA: 3, sentenza1: "2025-06-01" }); eq("dal 2020: sentenza di primo grado prima della scadenza → corso cessato", `${R.cessata}/${R.prescritto}`, "true/false");
  R = PR({ data: "2021-01-10", maxA: 3, sentenza1: "2029-06-01" }); eq("sentenza dopo la scadenza: già prescritto (al 2029)", R.cessata, false);
  eq("sola pena pecuniaria: 6 anni (delitto) e 4 (contravvenzione)", `${PR({ data: "2021-03-10", pena: "pecuniaria" }).mesi}/${PR({ tipo: "contravvenzione", data: "2021-03-10", pena: "pecuniaria" }).mesi}`, "72/48");
  eq("pene diverse: 3 anni sotto il minimo → minimo", PR({ tipo: "contravvenzione", data: "2021-03-10", pena: "altre" }).mesi, 48);
  eq("ergastolo: imprescrittibile", PR({ data: "2021-03-10", ergastolo: true }).imprescrittibile, true);
  eq("fatti anteriori alla ex Cirielli: non calcolato", !!PR({ data: "2004-01-01", maxA: 3 }).errore, true);
  eq("fine mese: 31/08/2020 + 6 anni", PR({ data: "2020-08-31", maxA: 3 }).ordinaria, "2026-08-31");
  eq("29 febbraio + 4 anni (contravvenzione)", PR({ tipo: "contravvenzione", data: "2020-02-29", maxA: 1 }).ordinaria, "2024-02-29");
  eq("29 febbraio + 6 anni → 28 febbraio", PR({ data: "2020-02-29", maxA: 3 }).ordinaria, "2026-02-28"); }
// Cambi e lire-euro
ck("cambi: 1.135,50 USD a 1,1355 = 1.000 €", ENGINES.convValuta(1135.5, 1.1355, "val2eur"), 1000);
ck("cambi: 1.000 € a 1,1355 = 1.135,50 USD", ENGINES.convValuta(1000, 1.1355, "eur2val"), 1135.5);
ck("lire: 1.000.000 lire = 516,46 €", ENGINES.lireEuro(1000000, "lire2eur"), 516.46);
ck("lire: 1.000 € = 1.936.270 lire", ENGINES.lireEuro(1000, "eur2lire"), 1936270);
// Calendario del processo: prima udienza 10/03/2027 (mercoledì), calcolo a mano a ritroso con giorni liberi
{ const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  const R = ENGINES.calendarioProcesso({ udienza: "2027-03-10", oggi: "2026-10-02" }), d = re => (R.ev.find(e => re.test(e.titolo)) || {}).data;
  eq("notifica entro il 09/11/2026 (121 giorni prima)", d(/notificare/), "2026-11-09");
  eq("costituzione entro il 29/12/2026 (71 giorni prima)", d(/Costituzione/), "2026-12-29");
  eq("verifiche preliminari entro il 13/01/2027", d(/verifiche/), "2027-01-13");
  eq("prima memoria 28/01/2027", d(/Prima memoria/), "2027-01-28");
  eq("seconda memoria 17/02/2027", d(/Seconda memoria/), "2027-02-17");
  eq("terza memoria: 27/02/2027 è sabato → 26/02/2027", d(/Terza memoria/), "2027-02-26");
  eq("prossima scadenza: notifica", R.prossimo.titolo.startsWith("Ultimo giorno utile"), true);
  const S = ENGINES.calendarioProcesso({ udienza: "2027-03-10", udienzaGiudice: "2027-04-14", udDecisione: "2028-01-19", notifica: "2026-11-20", estero: false });
  eq("udienza differita dal giudice: memorie sulla nuova udienza (41 giorni prima del 14/04/2027 = 04/03/2027)", (S.ev.find(e => /Prima memoria/.test(e.titolo)) || {}).data, "2027-03-04");
  eq("notifica tardiva segnalata", S.avvisi.some(a => /164/.test(a)), true);
  eq("note di precisazione 60 giorni liberi prima del 19/01/2028 → 19/11/2027", (S.ev.find(e => /precisazione/.test(e.titolo)) || {}).data, "2027-11-19");
  eq("estero: 150 giorni liberi, 10/10/2026 sabato → 09/10/2026", ENGINES.calendarioProcesso({ udienza: "2027-03-10", estero: true }).ev[0].data, "2026-10-09");
  eq("dati mancanti", ENGINES.calendarioProcesso({ udienza: "" }), null); }
// Usura: tassi soglia ufficiali (Banca d'Italia) e formula di legge
{ const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  const U = new Function(src + "\nreturn USURA;")();
  const ks = Object.keys(U.q).sort();
  eq("usura: serie dal 2 aprile 1997 al 4° trimestre 2026", `${ks[0]}/${ks[ks.length - 1]}/${U.q[ks[ks.length - 1]][0]}`, "1997-04-02/2026-10-01/2026-12-31");
  const ci = (k, re) => U.q[k][1].find(r => re.test(U.cat[r[0]]))[0];
  let R = ENGINES.usura({ data: "2026-10-15", cat: ci("2026-10-01", /^Mutui.*tasso fisso/i), teg: 9 });
  eq("mutuo fisso 4° trim. 2026: TEGM 4,52, soglia 9,65; TEG 9% entro soglia", `${R.tegm}/${R.soglia}/${R.usurario}`, "4.52/9.65/false");
  eq("  TEG 9,70% oltre soglia", ENGINES.usura({ data: "2026-10-15", cat: R.ci, teg: 9.7 }).usurario, true);
  R = ENGINES.usura({ data: "2026-10-15", cat: R.ci, teg: 5, mora: 12 });
  eq("  mora: (4,52 + 1,9) × 1,25 + 4 = 12,025; mora 12% entro", `${R.magg}/${R.sogliaMora}/${R.moraUsuraria}`, "1.9/12.025/false");
  eq("mutuo fisso 3° trim. 2026: soglia 9,2625", ENGINES.usura({ data: "2026-08-01", cat: ci("2026-07-01", /^Mutui.*tasso fisso/i), teg: 1 }).soglia, 9.2625);
  R = ENGINES.usura({ data: "2026-10-15", cat: ci("2026-10-01", /Scoperti/i), cls: U.cls.indexOf("fino a 1.500"), teg: 1 });
  eq("scoperti fino a 1.500: limite di 8 punti (16,08 + 8 = 24,08)", `${R.tegm}/${R.soglia}`, "16.08/24.08");
  const k10 = ks.filter(k => k <= "2010-06-15").pop(); R = ENGINES.usura({ data: "2010-06-15", cat: U.q[k10][1][0][0], cls: U.q[k10][1][0][1], teg: 1 });
  eq("prima del 14/5/2011 soglia = TEGM × 1,5", Math.abs(R.soglia - R.tegm * 1.5) < 0.006, true);
  eq("refuso della fonte (3° trim. 2020 chiuso al 01/09): il 15/09/2020 resta nel trimestre", ENGINES.usura({ data: "2020-09-15", teg: 1 }).k, "2020-07-01");
  eq("contratto anteriore al 1997: nessuna soglia", !!ENGINES.usura({ data: "1996-05-01", teg: 1 }).errore, true);
  eq("trimestre non ancora pubblicato", !!ENGINES.usura({ data: "2027-02-01", teg: 1 }).errore, true);
  eq("ogni soglia dal 2011 rispetta la formula di legge (tolleranza di arrotondamento della fonte)", ks.filter(k => k >= "2011-05-14").every(k => U.q[k][1].every(r => Math.abs(Math.min(r[2] * 1.25 + 4, r[2] + 8) - r[3]) < 0.0101)), true); }
// Atto di precetto: calcolo a mano (legali 2,5% nel 2024 e 2% nel 2025; tab. 6 (GU 236/2022): 0-5.200 = 142, 5.200,01-26.000 = 236, 26.000,01-52.000 = 331, 52.000,01-260.000 = 425 €)
{ const R = ENGINES.precetto({ capitale: 10000, data: "2025-01-15", tipoInt: "legali", daInt: "2024-01-15", compensi: 2500, esborsi: 264, speseVive: 30 });
  ck("precetto: interessi legali 351 gg al 2,5% + 15 gg al 2%", R.interessi, r2(r2(10000 * 0.025 * 351 / 365) + r2(10000 * 0.02 * 15 / 365)));
  ck("  spese del titolo (2.500 + 15% + 4% + IVA 22% + 264)", R.speseTitolo, 3911.8);
  ck("  compenso precetto tab. 6 (valore 14.160,43)", R.P.compenso, 236); ck("  precetto con accessori (236 + 35,40 + 10,86 + IVA 62,10)", R.P.totale, 344.36);
  ck("  totale intimato", R.totale, 14534.79);
  const S = ENGINES.precetto({ capitale: 10000, data: "2025-01-15", tipoInt: "no", compensi: 2500, esborsi: 0, creditoreIva: true });
  ck("precetto: creditore soggetto IVA, senza interessi", S.totale, r2(10000 + 2500 + 375 + 115 + r2(236 + 35.4 + r2(271.4 * 0.04))));
  ck("precetto: interessi convenzionali 5% per 365 giorni", ENGINES.precetto({ capitale: 10000, data: "2025-01-15", tipoInt: "conv", tassoConv: 5, daInt: "2024-01-16" }).interessi, 500);
  ck("precetto: tra 52.000 e 260.000 € compenso 425", ENGINES.precetto({ capitale: 60000, data: "2025-01-15", tipoInt: "no" }).P.compenso, 425); }
// Quote ereditarie e legittima: casi del codice civile
{ const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  const Q = o => ENGINES.quoteEreditarie({ coniuge: "no", figli: 0, genitori: 0, germani: 0, unilaterali: 0, ...o });
  const s = R => R.eredi.map(e => `${e.q[0]}/${e.q[1]}|${e.r[0]}/${e.r[1]}`).join(" ") + ` disp ${R.disp[0]}/${R.disp[1]}`;
  eq("coniuge + 1 figlio: 1/2 e 1/2; riserva 1/3 e 1/3", s(Q({ coniuge: "si", figli: 1 })), "1/2|1/3 1/2|1/3 disp 1/3");
  eq("coniuge + 2 figli: 1/3 e 1/3 ciascuno; riserva 1/4 e 1/4 ciascuno", s(Q({ coniuge: "si", figli: 2 })), "1/3|1/4 1/3|1/4 1/3|1/4 disp 1/4");
  eq("3 figli soli: 1/3 ciascuno; riserva 2/9 ciascuno", s(Q({ figli: 3 })), "1/3|2/9 1/3|2/9 1/3|2/9 disp 1/3");
  eq("1 figlio solo: intero; riserva 1/2", s(Q({ figli: 1 })), "1/1|1/2 disp 1/2");
  eq("coniuge solo: intero; riserva 1/2", s(Q({ coniuge: "si" })), "1/1|1/2 disp 1/2");
  eq("coniuge + 2 genitori: 2/3, 1/6, 1/6; riserva 1/2, 1/8, 1/8", s(Q({ coniuge: "si", genitori: 2 })), "2/3|1/2 1/6|1/8 1/6|1/8 disp 1/4");
  eq("coniuge + 1 genitore + 1 fratello: 2/3, 1/4 (minimo), 1/12", s(Q({ coniuge: "si", genitori: 1, germani: 1 })), "2/3|1/2 1/4|1/4 1/12|0/1 disp 1/4");
  eq("coniuge + 2 fratelli: 2/3, 1/6, 1/6; fratelli non legittimari", s(Q({ coniuge: "si", germani: 2 })), "2/3|1/2 1/6|0/1 1/6|0/1 disp 1/2");
  eq("2 genitori + 1 fratello: per capi 1/3; riserva genitori 1/6 ciascuno", s(Q({ genitori: 2, germani: 1 })), "1/3|1/6 1/3|1/6 1/3|0/1 disp 2/3");
  eq("1 genitore + 3 fratelli: genitore almeno 1/2, fratelli 1/6", s(Q({ genitori: 1, germani: 3 })), "1/2|1/3 1/6|0/1 1/6|0/1 1/6|0/1 disp 2/3");
  eq("1 germano + 1 unilaterale: 2/3 e 1/3", s(Q({ germani: 1, unilaterali: 1 })), "2/3|0/1 1/3|0/1 disp 1/1");
  eq("rappresentazione: coniuge + 1 figlio + figlio premorto con 2 nipoti", s(Q({ coniuge: "si", figli: 1, stirpi: [2] })), "1/3|1/4 1/3|1/4 1/6|1/8 1/6|1/8 disp 1/4");
  let R = Q({ coniuge: "si", figli: 2, attivo: 600000, debiti: 60000, donazioni: 60000 });
  eq("importi: asse netto 540.000, massa 600.000; quota 180.000, riserva 150.000", `${R.netto}/${R.massa}/${R.eredi[0].qEuro}/${R.eredi[0].rEuro}/${R.dispEuro}`, "540000/600000/180000/150000/150000");
  eq("nessun familiare indicato", Q({}).vuota, true); }
// Prescrizione e decadenza tributaria: casi calcolati a mano dai testi vigenti
{ const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  const T = o => ENGINES.prescrizioneTributi({ oggi: "2026-10-01", ...o });
  const piuG = (iso, g) => new Date(Date.parse(iso + "T00:00:00Z") + g * 864e5).toISOString().slice(0, 10);
  const A = o => T({ modo: "accertamento", ente: "ade", dich: "presentata", ...o });
  let R = A({ anno: 2020, annoPres: 2021 }); eq("IRPEF 2020, dichiarazione 2021: 31/12/2026 senza 85 giorni (art. 22 D.Lgs. 81/2025)", `${R.base}/${R.alt.length}/${R.stato}`, "2026-12-31/0/no");
  eq("dichiarazione omessa 2020: 31/12/2028", A({ anno: 2020, dich: "omessa" }).base, "2028-12-31");
  R = A({ anno: 2018, annoPres: 2019 }); eq("periodo 2018: 31/12/2024 e, con 85 giorni, 26/03/2025", `${R.base}/${R.alt[0].data}`, "2024-12-31/2025-03-26");
  eq("periodo 2019 (scadenza 31/12/2025): niente 85 giorni", A({ anno: 2019, annoPres: 2020 }).alt.length, 0);
  eq("periodo 2015: regime anteriore (4 anni)", A({ anno: 2015, annoPres: 2016 }).base, "2020-12-31");
  R = A({ anno: 2020, annoPres: 2022 }); eq("dichiarazione tardiva: termine dall'anno di presentazione", `${R.base}/${R.avvisi.some(a => /tardivamente/.test(a))}`, "2027-12-31/true");
  R = T({ modo: "accertamento", ente: "locale", anno: 2021 }); eq("IMU 2021: 31/12/2026, con 85 giorni 26/03/2027", `${R.base}/${R.alt[0].data}`, "2026-12-31/2027-03-26");
  const C = o => T({ modo: "cartella", ...o });
  eq("cartella 36-bis dichiarazione 2023: 31/12/2026", C({ tipoCartella: "36bis", annoPres: 2023 }).base, "2026-12-31");
  eq("36-bis dichiarazione 2018: +14 mesi → 28/02/2023", C({ tipoCartella: "36bis", annoPres: 2018 }).base, "2023-02-28");
  eq("36-bis dichiarazione 2019: +1 anno → 31/12/2023", C({ tipoCartella: "36bis", annoPres: 2019 }).base, "2023-12-31");
  eq("36-bis periodo 2019 (dichiarazione 2020): +1 anno → 31/12/2024", C({ tipoCartella: "36bis", annoPres: 2020 }).base, "2024-12-31");
  eq("36-ter dichiarazione 2017: 31/12/2021 +14 mesi", C({ tipoCartella: "36ter", annoPres: 2017 }).base, "2023-02-28");
  eq("accertamento definitivo 2024: 31/12/2026", C({ tipoCartella: "definitivo", annoPres: 2024 }).base, "2026-12-31");
  eq("tributi locali, definitivo 2024: 31/12/2027", C({ tipoCartella: "locale", annoPres: 2024 }).base, "2027-12-31");
  eq("carico affidato 2020-2021: +24 mesi in alternativa", C({ tipoCartella: "36bis", annoPres: 2023, affidato2021: true }).alt[0].data, "2028-12-31");
  const S = o => T({ modo: "riscossione", ...o });
  R = S({ dataNotifica: "2019-05-15", tipoCredito: "erariali" }); eq("erariali notificati 15/5/2019: 10 anni + 542 giorni di sospensione", `${R.base}/${R.alt[0].data}`, `2029-05-15/${piuG("2029-05-15", 542)}`);
  R = S({ dataNotifica: "2019-05-15", tipoCredito: "locali" }); eq("tributi locali 2019: prescritti anche con la sospensione", `${R.base}/${R.stato}`, "2024-05-15/sempre");
  R = S({ dataNotifica: "2021-04-15", tipoCredito: "locali", oggi: "2026-06-01" }); eq("notifica nel periodo di sospensione: decorre dal 1/9/2021", `${R.base}/${R.alt[0].data}/${R.stato}`, "2026-04-15/2026-08-31/dipende");
  eq("bollo notificato nel 2023: 3 anni, nessuna sospensione", `${S({ dataNotifica: "2023-02-01", tipoCredito: "bollo" }).base}/${S({ dataNotifica: "2023-02-01", tipoCredito: "bollo" }).alt.length}`, "2026-02-01/0");
  eq("sanzioni 5 anni", S({ dataNotifica: "2022-10-10", tipoCredito: "sanzioni" }).base, "2027-10-10");
  eq("giudicato: avviso sulla SU 23397/2016", S({ dataNotifica: "2022-10-10", tipoCredito: "giudicato" }).avvisi.length, 1);
  eq("dati mancanti: nessun calcolo", S({ dataNotifica: "" }), null); }
// Modello F24: raggruppamento per sezione, totali e saldo
{ const F = ENGINES.f24([
    { sez: "Erario", codice: "4001", anno: "2025", deb: 1000 }, { sez: "Erario", codice: "8901", anno: "2025", deb: 8.33 },
    { sez: "Regioni", codice: "3801", ente: "20", anno: "2025", deb: 120.5 }, { sez: "Erario", codice: "6099", anno: "2025", cred: 200 },
    { sez: "IMU e altri tributi locali", codice: "3918", ente: "G565", anno: "2026", deb: 506.91, ravv: true } ]);
  ck("F24: totale Erario a debito", F.tot.erario.deb, 1008.33); ck("  credito compensato", F.tot.erario.cred, 200); ck("  saldo finale", F.saldo, r2(1008.33 - 200 + 120.5 + 506.91));
  const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  eq("  righe per sezione", `${F.s.erario.length}/${F.s.regioni.length}/${F.s.imu.length}`, "3/1/1"); eq("  nessun avviso", F.avvisi.length, 0);
  const G = ENGINES.f24(Array.from({ length: 7 }, () => ({ sez: "Regioni", codice: "38", anno: "", deb: 1 })));
  eq("F24: avvisi su righe in eccesso, codice, anno e codice Regione", G.avvisi.length, 1 + 7 * 3); }
// Ravvedimento operoso: casi calcolati a mano dalla norma (art. 13 D.Lgs. 471/1997 e 472/1997), saggi legali 2025 2%, 2026 1,6%
{ const rv = o => ENGINES.ravvedimento({ tributo: "irpef_saldo", imposta: 1000, ...o });
  const eq = (name, got, exp) => { const ok = got === exp; ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}: atteso ${exp}, ottenuto ${got}`); };
  let R = rv({ scadenza: "2026-06-30", pagamento: "2026-07-10" });
  ck("ravv. sprint 10 gg (nuovo regime): sanzione 12,5%×10/15÷10", R.sanzione, r2(1000 * 0.125 * 10 / 15 / 10)); ck("  interessi 1,6% × 10/365", R.interessi, r2(1000 * 0.016 * 10 / 365));
  ck("  totale", R.totale, r2(1000 + r2(1000 * 0.125 * 10 / 15 / 10) + r2(1000 * 0.016 * 10 / 365)));
  eq("  righe F24", R.righe.map(x => `${x.codice}/${x.anno}/${x.importo}`).join(" "), "4001/2025/1000 8901/2025/8.33 1989/2025/0.44");
  R = rv({ scadenza: "2026-06-30", pagamento: "2026-08-14" }); ck("ravv. 45 gg: 12,5% ÷ 9", R.sanzione, r2(125 / 9)); eq("  lettera", R.lett, "a-bis");
  R = rv({ scadenza: "2025-06-30", pagamento: "2026-09-30" }); eq("ravv. 457 gg entro dichiarazione 2025 (31/10/2026): 1/8", `${R.giorni} 1/${R.fr} ${R.t1}`, "457 1/8 2026-10-31");
  ck("  sanzione 25% ÷ 8", R.sanzione, 31.25); ck("  interessi 2025 (184 gg al 2%) + 2026 (273 gg all'1,6%)", R.interessi, r2(1000 * 0.02 * 184 / 365 + 1000 * 0.016 * 273 / 365));
  R = rv({ scadenza: "2025-06-30", pagamento: "2026-11-02" }); eq("ravv. oltre la dichiarazione (nuovo regime): 1/7", R.fr, 7); ck("  sanzione 25% ÷ 7", R.sanzione, r2(250 / 7));
  R = rv({ scadenza: "2024-07-01", pagamento: "2026-09-30" }); eq("vecchio regime: entro dichiarazione anno successivo (31/10/2026) 1/7", `${R.nuovo} 1/${R.fr} ${R.t2}`, "false 1/7 2026-10-31"); ck("  sanzione 30% ÷ 7", R.sanzione, r2(300 / 7));
  R = rv({ scadenza: "2022-06-30", pagamento: "2026-09-30" }); eq("vecchio regime oltre la dichiarazione dell'anno successivo: 1/6", `${R.fr} ${R.t2}`, "6 2024-10-31"); ck("  sanzione 30% ÷ 6", R.sanzione, 50);
  eq("termine dichiarazione redditi 2022 (30 novembre)", R.t1, "2023-11-30");
  R = rv({ scadenza: "2024-05-16", pagamento: "2024-05-21" }); ck("vecchio regime sprint 5 gg: 15%×5/15÷10", R.sanzione, 5);
  R = rv({ scadenza: "2026-06-30", pagamento: "2026-12-30", pvc: true }); ck("dopo processo verbale: 25% ÷ 5", R.sanzione, 50);
  R = rv({ scadenza: "2026-06-30", pagamento: "2027-01-10", dich: "2026-12-31" }); eq("termine dichiarazione indicato a mano", `1/${R.fr} ${R.t1}`, "1/7 2026-12-31");
  eq("scadenza anteriore al 2016: nessun calcolo", !!rv({ scadenza: "2015-06-16", pagamento: "2026-09-30" }).errore, true);
  eq("pagamento non successivo alla scadenza: nessun calcolo", rv({ scadenza: "2026-06-30", pagamento: "2026-06-30" }), null);
  R = ENGINES.ravvedimento({ tributo: "rit_dip", imposta: 1000, scadenza: "2026-01-16", pagamento: "2026-02-05" });
  eq("ritenute dicembre: interessi nel 1001, sanzione 8947 con mese 12", R.righe.map(x => `${x.codice}/${x.rat}/${x.anno}/${x.importo}`).join(" "), `1001//2025/${r2(1000 + r2(1000 * 0.016 * 20 / 365))} 8947/12/2025/12.5`);
  R = ENGINES.ravvedimento({ tributo: "imu_altri", imposta: 500, scadenza: "2026-06-16", pagamento: "2026-07-16", ente: "g565" });
  eq("IMU: una riga 3918 con imposta+sanzione+interessi, Ravv. e acconto", R.righe.map(x => `${x.codice}/${x.ente}/${x.anno}/${x.importo}/${x.accSaldo}/${x.ravv}`).join(" "), `3918/G565/2026/${r2(500 + 6.25 + r2(500 * 0.016 * 30 / 365))}/acconto/true`);
  eq("IMU: termine dichiarazione 30 giugno", R.t1, "2027-06-30");
  eq("IVA mensile: codice e anno dal mese precedente la scadenza", ["2026-03-16", "2026-01-16"].map(s => { const x = ENGINES.ravvedimento({ tributo: "iva_mese", imposta: 100, scadenza: s, pagamento: "2026-09-30" }); return x.cod + "/" + x.anno; }).join(" "), "6002/2026 6012/2025");
  eq("IVA trimestrale: 2° trimestre 6032", ENGINES.ravvedimento({ tributo: "iva_trim", imposta: 100, scadenza: "2026-08-20", pagamento: "2026-09-30" }).cod, "6032");
  eq("IVA: termine dichiarazione 30 aprile", ENGINES.ravvedimento({ tributo: "iva_ann", imposta: 100, scadenza: "2026-03-16", pagamento: "2026-09-30" }).t1, "2027-04-30");
  R = ENGINES.ravvedimento({ tributo: "addcom_saldo", imposta: 100, scadenza: "2026-06-30", pagamento: "2026-07-10" });
  eq("addizionale comunale: 3844/8926/1998 in sezione tributi locali", R.righe.map(x => x.codice).join(" ") + " " + R.T.sez, "3844 8926 1998 IMU e altri tributi locali");
  eq("cedolare: 8940 e 1940 (ris. 12/E/2023)", ENGINES.ravvedimento({ tributo: "ced_saldo", imposta: 100, scadenza: "2026-06-30", pagamento: "2026-07-10" }).righe.map(x => x.codice).join(" "), "1842 8940 1940");
  eq("scadenza di sabato segnalata", rv({ scadenza: "2026-05-16", pagamento: "2026-07-10" }).avvisi.some(a => /sabato/.test(a)), true);
  eq("nessun codice soppresso (8906, 8913, 1992, 8903, 8908)", /"(8906|8913|1992|8903|8908)"/.test(html.slice(html.indexOf("const RAVV_TRIBUTI"), html.indexOf("const prevMese"))), false); }
console.log(`\n${pass} OK, ${fail} DIFF`);
process.exit(fail ? 1 : 0);
