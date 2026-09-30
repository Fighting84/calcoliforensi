// Scadenziario dei dati periodici: segnala i valori il cui aggiornamento è atteso ma non ancora inserito.
// Uso: node app/scripts/check_scadenze.js → exit 0 tutto aggiornato, 10 aggiornamenti in ritardo, 1 errore
// Prova su una data: OGGI=2027-02-15 node app/scripts/check_scadenze.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
try {
  const html = fs.readFileSync(path.join(ROOT, "app", "index.html"), "utf8");
  const src = html.slice(html.indexOf("/* ===================== DATI NORMATIVI"), html.indexOf("/* ===================== LICENZA"));
  const datiScaduti = new Function(src + "\nreturn datiScaduti;")();
  const oggi = process.env.OGGI ? new Date(process.env.OGGI + "T12:00:00Z") : new Date();
  const r = datiScaduti(oggi);
  // storico: da quando ciascun ritardo è aperto (serve all'agente "azioni per il titolare")
  if (!process.env.OGGI) {
    const fStor = path.join(ROOT, "monitoraggio", "scadenze_storico.json");
    let stor = []; try { stor = JSON.parse(fs.readFileSync(fStor, "utf8")); } catch (e) {}
    const iso = oggi.toISOString().slice(0, 10);
    stor = r.map(x => ({ ...x, dal: (stor.find(y => y.id === x.id) || {}).dal || iso }));
    fs.writeFileSync(fStor, JSON.stringify(stor, null, 2) + "\n");
  }
  const out = path.join(ROOT, "monitoraggio", "scadenze.json");
  if (!r.length) { try { fs.unlinkSync(out); } catch (e) {} console.log(`Scadenziario: tutti i valori periodici sono aggiornati (${oggi.toISOString().slice(0, 10)})`); process.exit(0); }
  if (!process.env.OGGI) fs.writeFileSync(out, JSON.stringify(r, null, 2) + "\n");
  console.log(`Scadenziario: ${r.length} aggiornamenti attesi e non ancora inseriti`);
  for (const x of r) console.log(`  - ${x.msg} → ${x.calc.join(", ")}`);
  process.exit(10);
} catch (e) { console.error("ERRORE check_scadenze:", e.message); process.exit(1); }
