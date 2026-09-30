// Scarica i testi della Gazzetta richiesti dalla routine settimanale (che dal cloud non raggiunge la Gazzetta).
// Richieste in monitoraggio/gazzetta_richieste.json: [{"data":"2026-08-11","codice":"26G00169"}]; poi il file viene svuotato.
const fs = require("fs"), path = require("path");
const { testoAtto } = require("./gu_testo");
const ROOT = path.join(__dirname, "..", "..");
const F = path.join(ROOT, "monitoraggio", "gazzetta_richieste.json");
(async () => {
  let r = []; try { r = JSON.parse(fs.readFileSync(F, "utf8")); } catch (e) {}
  if (!r.length) { console.log("Richieste di testi Gazzetta: nessuna"); return; }
  const dir = path.join(ROOT, "monitoraggio", "gazzetta"); fs.mkdirSync(dir, { recursive: true });
  const rimaste = [];
  for (const x of r) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.data || "") || !/^[A-Z0-9]{6,12}$/.test(x.codice || "")) continue;
    try { fs.writeFileSync(path.join(dir, `${x.data}_${x.codice}.txt`), (await testoAtto(x.data, x.codice)).slice(0, 400000) + "\n"); console.log(`  scaricato ${x.data} ${x.codice}`); }
    catch (e) { console.log(`  non riuscito ${x.codice}: ${e.message}`); rimaste.push(x); }
  }
  fs.writeFileSync(F, JSON.stringify(rimaste) + "\n");
})().catch(e => { console.error("ERRORE scarica_richieste:", e.message); process.exit(1); });
