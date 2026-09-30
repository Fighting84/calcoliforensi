// Una tantum: aggiunge a stato.json le ricerche Cassazione per tema e i temi dei calcolatori non ancora monitorati.
const fs = require("fs"), path = require("path");
const F = path.join(__dirname, "..", "..", "monitoraggio", "stato.json");
const s = JSON.parse(fs.readFileSync(F, "utf8"));
const Q = {
  tun: ['"tabella unica nazionale"', '"tabella unica" AND macropermanent*'],
  micro: ['micropermanenti AND "139"', '"lesioni di lieve entità" AND "accertamento clinico strumentale"'],
  milano: ['"tabelle milanesi" OR "tabelle di Milano" OR "tabella milanese"'],
  parentale: ['"tabella a punti" OR "tabelle a punti" OR "tabelle integrate a punti"', '"perdita del rapporto parentale" AND liquidazione'],
  interessi: ['"1284" AND "quarto comma"', 'anatocismo AND "interessi legali"'],
  mora: ['"231 del 2002" OR "d.lgs. n. 231/2002"', '"interessi moratori" AND "transazioni commerciali"'],
  parcella: ['"147 del 2022" AND (applicabil* OR intertemporal*)', '"parametri forensi" AND ("valori medi" OR "sotto i minimi")'],
  cu: ['"contributo unificato" AND "valore indeterminabile"'],
  scadenze: ['"termine a ritroso" OR "termini a ritroso"', '"sospensione feriale" AND (sabato OR festivo)', '"171-ter" AND termin*'],
  tfr: ['"rivalutazione del trattamento di fine rapporto"', '"2120" AND rivalutazione AND indice'],
  rivalutazione: ['"debito di valore" AND "interessi compensativi"'],
};
const nuovi = [
  { id: "prescrizione", calcolatore: "prescrizione", keywords: ["prescrizione", "2946", "2947"], gu: [], cass: ['prescrizione AND "2947" AND "dies a quo"', '"prescrizione presuntiva" AND "2956"'], note: "" },
  { id: "pignoramento", calcolatore: "pignoramento", keywords: ["pignoramento stipendio", "545 c.p.c."], gu: ["assegno sociale"], cass: ['"545" AND (pensione OR stipendio) AND "assegno sociale"'], note: "Assegno sociale: aggiornamento ogni gennaio (circolare INPS)." },
  { id: "imu", calcolatore: "imu", keywords: ["IMU"], gu: ["imposta municipale propria"], cass: ['"imposta municipale propria" AND ("abitazione principale" OR moltiplicator*)'], note: "Le aliquote comunali sono inserite dall'utente." },
  { id: "compravendita", calcolatore: "compravendita", keywords: ["prezzo-valore", "prima casa"], gu: ["imposta di registro"], cass: ['"prezzo-valore" AND registro', '"agevolazione prima casa" AND decadenza'], note: "" },
  { id: "successione", calcolatore: "successione", keywords: ["imposta di successione"], gu: ["successioni e donazioni"], cass: ['"imposta di successione" AND franchigia'], note: "D.Lgs. 139/2024 in vigore dal 2025." },
  { id: "usufrutto", calcolatore: "usufrutto", keywords: ["usufrutto", "coefficienti"], gu: ["usufrutto"], cass: ['usufrutto AND coefficient* AND "saggio legale"'], note: "Coefficienti aggiornati con DM MEF a ogni variazione del saggio legale." },
  { id: "canone", calcolatore: "canone", keywords: ["aggiornamento ISTAT canone"], gu: [], cass: ['"aggiornamento del canone" AND ISTAT'], note: "" },
  { id: "cedolare", calcolatore: "cedolare", keywords: ["cedolare secca"], gu: ["cedolare secca"], cass: ['"cedolare secca"'], note: "" },
  { id: "preventivo", calcolatore: "preventivo", keywords: ["preventivo", "art. 13 L. 247/2012"], gu: [], cass: ['preventivo AND "247 del 2012"'], note: "" },
];
for (const t of s.temi) t.cass = Q[t.id] || t.cass || [];
for (const n of nuovi) if (!s.temi.find(t => t.id === n.id)) s.temi.push(n);
fs.writeFileSync(F, JSON.stringify(s, null, 2) + "\n");
console.log("temi monitorati:", s.temi.length, "— ricerche Cassazione:", s.temi.reduce((a, t) => a + t.cass.length, 0));
