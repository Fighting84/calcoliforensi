// Applica alle segnalazioni GitHub gli esiti scritti dalla routine settimanale in monitoraggio/esiti.json:
// [{ "issue": 12, "commento": "…", "chiudi": true, "etichetta": "da-fare" }]. Dopo l'applicazione il file viene svuotato.
// Uso (nel workflow): GITHUB_TOKEN=… node app/scripts/applica_esiti.js
const fs = require("fs"), path = require("path");
const F = path.join(__dirname, "..", "..", "monitoraggio", "esiti.json");
const REPO = "Fighting84/calcoliforensi";
(async () => {
  let esiti = []; try { esiti = JSON.parse(fs.readFileSync(F, "utf8")); } catch (e) {}
  if (!esiti.length) { console.log("Esiti della routine: nessuno da applicare"); return; }
  const T = process.env.GITHUB_TOKEN; if (!T) throw new Error("manca GITHUB_TOKEN");
  const api = async (m, u, b) => { const r = await fetch(`https://api.github.com/repos/${REPO}${u}`, { method: m, headers: { Authorization: `Bearer ${T}`, Accept: "application/vnd.github+json", "User-Agent": "calcoliforensi-monitor" }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`${m} ${u}: HTTP ${r.status}`); return r.status === 204 ? null : r.json(); };
  for (const e of esiti) {
    if (!(e.issue > 0)) continue;
    if (e.commento) await api("POST", `/issues/${e.issue}/comments`, { body: e.commento });
    if (e.etichetta) await api("POST", `/issues/${e.issue}/labels`, { labels: [e.etichetta] });
    if (e.chiudi) await api("PATCH", `/issues/${e.issue}`, { state: "closed" });
    console.log(`  #${e.issue}: ${e.chiudi ? "chiusa" : "aggiornata"}`);
  }
  fs.writeFileSync(F, "[]\n");
})().catch(e => { console.error("ERRORE applica_esiti:", e.message); process.exit(1); });
