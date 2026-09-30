// Cerca nella banca dati della Cassazione (Italgiure, indice pubblico) le pronunce depositate di recente
// che toccano i temi dei calcolatori. Funziona in cloud, senza MCP.
// Uso: node app/scripts/check_cassazione.js → exit 0 nessuna novità, 10 novità, 1 errore
// Novità in monitoraggio/novita_cass.json; pronunce già viste in monitoraggio/cass_viste.json.
// Le sentenze il cui testo viene pubblicato in ritardo (es. "in fase di oscuramento") sono intercettate
// perché ogni giorno si riesamina una finestra di 180 giorni e si scartano solo quelle già viste.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const STATO = path.join(ROOT, "monitoraggio", "stato.json");
const VISTE = path.join(ROOT, "monitoraggio", "cass_viste.json");
const OUT = path.join(ROOT, "monitoraggio", "novita_cass.json");
const URL = "https://www.italgiure.giustizia.it/sncass/isapi/hc.dll/sn.solr/sn-collection/select?app.query";
const H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)", "Content-Type": "application/x-www-form-urlencoded" };

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, "");
const fmt = s => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
const pulisci = s => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function cerca(query, dal, tentativo = 1) {
  const body = `start=0&rows=8&q=${encodeURIComponent(`(${query}) AND datdep:[${dal} TO *]`)}&wt=json&sort=pd+desc`
    + `&fl=id,numdec,anno,szdec,datdep,kind,tipoprov,materia`;
  const r = await fetch(URL, { method: "POST", headers: H, body });
  if (!r.ok) {
    if (tentativo < 4) { await new Promise(x => setTimeout(x, 2500 * tentativo)); return cerca(query, dal, tentativo + 1); }
    throw new Error("HTTP " + r.status);
  }
  const j = await r.json();
  return j.response?.docs || [];
}
// estratto del testo solo per la singola pronuncia nuova (gli estratti su molti documenti mandano in errore il server)
async function estratto(id, query) {
  try {
    const body = `start=0&rows=1&q=${encodeURIComponent(`id:${id} AND (${query})`)}&wt=json&fl=id&hl=true&hl.fl=ocr&hl.snippets=2&hl.fragsize=220`;
    const r = await fetch(URL, { method: "POST", headers: H, body }); if (!r.ok) return "";
    const j = await r.json(); return ((j.highlighting || {})[id]?.ocr || []).map(pulisci).join(" … ");
  } catch (e) { return ""; }
}

(async () => {
  try {
    const stato = JSON.parse(fs.readFileSync(STATO, "utf8"));
    let mem = { viste: [], query: [] }; try { const m = JSON.parse(fs.readFileSync(VISTE, "utf8")); mem = Array.isArray(m) ? { viste: m, query: [] } : m; } catch (e) {}
    const viste = mem.viste, queryNote = new Set(mem.query);
    const dal = ymd(new Date(Date.now() - 180 * 86400000));
    const soglia = (stato.ultima_verifica_fonti || "2026-01-01").replace(/-/g, "");
    const nuove = [], nuoviId = new Set();
    let errori = 0;
    for (const t of stato.temi) {
      for (const q of (t.cass || [])) {
        let docs;
        try { docs = await cerca(q, dal); } catch (e) { errori++; console.log(`  ! ${t.id} «${q}»: ${e.message}`); continue; }
        const primoAvvio = !queryNote.has(q); queryNote.add(q);
        for (const d of docs) {
          if (viste.includes(d.id) || nuoviId.has(d.id)) continue;
          nuoviId.add(d.id);
          const dep = (d.datdep || [""])[0];
          // al primo avvio si segnala solo ciò che è successivo all'ultima verifica manuale
          if (primoAvvio && dep <= soglia) continue;
          nuove.push({ tema: t.id, calcolatore: t.calcolatore, query: q,
            estremi: `Cass. ${d.kind === "snpen" ? "pen." : "civ."}, sez. ${d.szdec}, ${String(d.tipoprov || "").toLowerCase()} n. ${+d.numdec}/${d.anno}, dep. ${fmt(dep)}`,
            materia: (d.materia || []).join(", "), id: d.id, deposito: dep, estratto: (await estratto(d.id, q)).slice(0, 600) });
          await new Promise(r => setTimeout(r, 800));
        }
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    if (errori && !nuoviId.size) throw new Error(`${errori} ricerche fallite, nessun risultato`);
    fs.writeFileSync(VISTE, JSON.stringify([...viste, ...nuoviId].slice(-5000)) + "\n");
    if (!nuove.length) { try { fs.unlinkSync(OUT); } catch (e) {} console.log(`Cassazione: nessuna nuova pronuncia rilevante (${nuoviId.size} pronunce registrate)`); process.exit(0); }
    nuove.sort((a, b) => b.deposito.localeCompare(a.deposito));
    fs.writeFileSync(OUT, JSON.stringify(nuove, null, 2) + "\n");
    console.log(`Cassazione: ${nuove.length} pronunce nuove da esaminare`);
    for (const n of nuove) console.log(`  - [${n.tema}] ${n.estremi} — ${n.materia}`);
    process.exit(10);
  } catch (e) { console.error("ERRORE check_cassazione:", e.message); process.exit(1); }
})();
