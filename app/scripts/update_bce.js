// Aggiorna TASSI_BCE (interessi di mora, D.Lgs. 231/2002) dal portale dati della BCE.
// Regola (art. 5, c. 2): vale il tasso delle operazioni di rifinanziamento principali in vigore il
// primo giorno di calendario del semestre (1° gennaio, 1° luglio).
// Uso: node app/scripts/update_bce.js → exit 0 nessuna novità, 10 aggiornato, 1 errore, 2 discordanza
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "index.html");
const API = "https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.MRR_FR.LEV?startPeriod=2012-06-01&format=csvdata";

(async () => {
  try {
    const r = await fetch(API, { headers: { "User-Agent": "calcoliforensi.it monitor" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const righe = (await r.text()).trim().split("\n");
    const h = righe[0].split(","), iT = h.indexOf("TIME_PERIOD"), iV = h.indexOf("OBS_VALUE");
    const serie = righe.slice(1).map(l => l.split(",")).map(c => [c[iT], +c[iV]]).filter(x => x[0] && !isNaN(x[1]));
    if (serie.length < 1000) throw new Error("serie BCE incompleta");
    const inVigore = d => { let v = null; for (const [x, y] of serie) if (x <= d) v = y; return v; };

    const html = fs.readFileSync(FILE, "utf8");
    const m = html.match(/const TASSI_BCE = \{([\s\S]*?)\};/);
    const attuali = {}; for (const x of m[1].matchAll(/"(\d{4}-[12])":([\d.]+)/g)) attuali[x[1]] = +x[2];

    const oggi = new Date().toISOString().slice(0, 10);
    const discordanze = [], nuovi = {};
    for (let y = 2013; y <= +oggi.slice(0, 4); y++) for (const s of [1, 2]) {
      const inizio = `${y}-${s === 1 ? "01" : "07"}-01`; if (inizio > oggi) continue;
      const v = inVigore(inizio); if (v == null) continue;
      const k = `${y}-${s}`;
      if (attuali[k] == null) nuovi[k] = v;
      else if (Math.abs(attuali[k] - v) > 0.001) discordanze.push(`${k}: sito ${attuali[k]} / BCE ${v}`);
    }
    if (discordanze.length) { console.log("DISCORDANZA con la BCE (nessuna modifica automatica):", discordanze.join("; ")); process.exit(2); }
    if (!Object.keys(nuovi).length) { console.log("BCE: nessun semestre nuovo (ultimo in tabella: " + Object.keys(attuali).sort().pop() + ")"); process.exit(0); }
    const tutti = { ...attuali, ...nuovi };
    const corpo = Object.keys(tutti).sort().map(k => `"${k}":${tutti[k]}`).join(",");
    let out = html.replace(/const TASSI_BCE = \{[\s\S]*?\};/, `const TASSI_BCE = {\n  ${corpo}\n};`);
    // il semestre più recente diventa il valore di ripiego per le date future
    const ultimo = Object.keys(tutti).sort().pop();
    out = out.replace(/TASSI_BCE\["\d{4}-[12]"\]/g, `TASSI_BCE["${ultimo}"]`);
    fs.writeFileSync(FILE, out);
    console.log("BCE aggiornato:", Object.entries(nuovi).map(([k, v]) => `${k} = ${v}% (mora ${(v + 8).toFixed(2)}%)`).join(", "));
    process.exit(10);
  } catch (e) { console.error("ERRORE update_bce:", e.message); process.exit(1); }
})();
