// Controllo Cassazione da eseguire su un PC in Italia (Italgiure non accetta connessioni dai server esteri).
// Lanciato dall'Utilità di pianificazione di Windows: non richiede Claude aperto né permessi.
// Se il PC resta spento per giorni non si perde nulla: ogni giro riesamina 180 giorni di depositi.
// 1) cerca le novità (check_cassazione.js); 2) salva il testo integrale delle pronunce nuove nel repository,
// così la routine in cloud può leggerle; 3) pubblica su GitHub e apre la segnalazione.
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const LOG = path.join(ROOT, "monitoraggio", "locale.log");
const URL = "https://www.italgiure.giustizia.it/sncass/isapi/hc.dll/sn.solr/sn-collection/select?app.query";
const scrivi = m => { const r = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] ${m}`; console.log(r); fs.appendFileSync(LOG, r + "\n"); };
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

(async () => {
  try {
    try { git("pull", "-q", "--rebase", "--autostash", "origin", "main"); } catch (e) { scrivi("pull non riuscito: " + e.message.split("\n")[0]); }
    const r = spawnSync(process.execPath, [path.join(__dirname, "check_cassazione.js")], { cwd: ROOT, encoding: "utf8" });
    scrivi((r.stdout || "").trim().split("\n")[0] || (r.stderr || "").trim());
    if (r.status !== 10 && r.status !== 0) { scrivi("controllo non riuscito, riprovo al prossimo avvio"); process.exit(1); }

    fs.writeFileSync(path.join(ROOT, "monitoraggio", "heartbeat_cassazione.txt"), new Date().toISOString().slice(0, 10) + "\n");
    const novita = r.status === 10 ? JSON.parse(fs.readFileSync(path.join(ROOT, "monitoraggio", "novita_cass.json"), "utf8")) : [];
    const dir = path.join(ROOT, "monitoraggio", "cassazione"); fs.mkdirSync(dir, { recursive: true });
    for (const n of novita) {
      try {
        const body = `start=0&rows=1&q=${encodeURIComponent("id:" + n.id)}&wt=json&fl=id,ocr`;
        const j = await (await fetch(URL, { method: "POST", headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded" }, body })).json();
        const testo = [].concat(j.response?.docs?.[0]?.ocr || []).join("\n").replace(/\s+\n/g, "\n");
        if (testo) fs.writeFileSync(path.join(dir, `${n.id}.txt`), `${n.estremi}\n${n.materia}\n\n${testo}\n`);
        await new Promise(x => setTimeout(x, 1200));
      } catch (e) { scrivi(`testo non scaricato per ${n.id}: ${e.message}`); }
    }

    git("add", "monitoraggio");
    const cambiato = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: ROOT }).status !== 0;
    if (cambiato) {
      git("commit", "-q", "-m", `monitor locale: Cassazione ${new Date().toLocaleDateString("it-IT")}${novita.length ? ` — ${novita.length} pronunce nuove` : ""}`);
      try { git("push", "-q", "origin", "main"); } catch (e) { git("pull", "-q", "--rebase", "origin", "main"); git("push", "-q", "origin", "main"); }
    }
    if (novita.length) {
      const testo = execFileSync(process.execPath, [path.join(__dirname, "report_issue.js")], { cwd: ROOT, encoding: "utf8" });
      const f = path.join(ROOT, "monitoraggio", ".issue.md"); fs.writeFileSync(f, testo);
      execFileSync("gh", ["issue", "create", "--repo", "Fighting84/calcoliforensi", "--title", `Monitoraggio ${new Date().toLocaleDateString("it-IT")}: nuove pronunce di Cassazione`, "--body-file", f], { cwd: ROOT });
      fs.unlinkSync(f);
      scrivi(`segnalazione aperta per ${novita.length} pronunce`);
    }
    process.exit(0);
  } catch (e) { scrivi("ERRORE: " + e.message.split("\n")[0]); process.exit(1); }
})();
