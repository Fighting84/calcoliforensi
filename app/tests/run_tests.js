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
  const R = ENGINES.dannoMicro(c.in.pct, c.in.eta, c.in.itt, c.in.itp75, c.in.itp50, c.in.itp25, c.in.pers);
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
console.log(`\n${pass} OK, ${fail} DIFF`);
process.exit(fail ? 1 : 0);
