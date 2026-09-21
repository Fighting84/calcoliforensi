// Aggiorna la serie FOI (senza tabacchi) in app/index.html dall'API SDMX ufficiale ISTAT (esploradati.istat.it).
// Flussi: 169_748_DF_DCSP_FOI1B2025_2 (mensili 1996-2025, basi 1995/2010/2015) e 169_748_DF_DCSP_FOI1B2025_1 (dal 2026, base 2025).
// Uso: node app/scripts/update_foi.js   → exit 0 = nessuna novità, exit 10 = serie aggiornata, exit 1 = errore
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "index.html");
const BASE = "https://esploradati.istat.it/SDMXWS/rest/data/IT1,";
const H = { Accept: "application/vnd.sdmx.genericdata+xml;version=2.1", "User-Agent": "calcoliforensi.it monitor (node)" };

async function serie(flow, start) {
  const r = await fetch(`${BASE}${flow},1.0/M.IT..4.00ST?startPeriod=${start}`, { headers: H });
  if (!r.ok) throw new Error(`${flow}: HTTP ${r.status}`);
  const t = await r.text(); const out = {};
  for (const m of t.matchAll(/TIME_PERIOD" value="(\d{4}-\d{2})" \/><generic:ObsValue value="([\d.]+)"/g)) out[m[1]] = +m[2];
  return out;
}

(async () => {
  try {
    const A = await serie("169_748_DF_DCSP_FOI1B2025_2", "1996-01");
    const B = await serie("169_748_DF_DCSP_FOI1B2025_1", "2026-01");
    const all = { ...A, ...B };
    const keys = Object.keys(all).sort();
    if (keys.length < 300 || keys[0] !== "1996-01") throw new Error("serie incompleta: " + keys.length + " mesi da " + keys[0]);
    const html = fs.readFileSync(FILE, "utf8");
    const cur = JSON.parse(html.match(/const FOI = (\{[^\n]*\});/)[1]);
    const curLast = Object.keys(cur).sort().pop(), newLast = keys[keys.length - 1];
    const diffs = Object.keys(cur).filter(k => all[k] != null && Math.abs(all[k] - cur[k]) > 0.05);
    if (diffs.length) console.log("ATTENZIONE valori revisionati da ISTAT:", diffs.map(k => `${k}: ${cur[k]}→${all[k]}`).join(", "));
    if (newLast <= curLast && !diffs.length) { console.log("FOI: nessuna novità (ultimo mese " + curLast + ")"); process.exit(0); }
    const obj = {}; for (const k of keys) obj[k] = all[k];
    const oggi = new Date(); const dd = `${String(oggi.getDate()).padStart(2, "0")}/${String(oggi.getMonth() + 1).padStart(2, "0")}/${oggi.getFullYear()}`;
    let out = html.replace(/const FOI = \{[^\n]*\};/, "const FOI = " + JSON.stringify(obj) + ";");
    out = out.replace(/ultimo:"\d{4}-\d{2}", aggiornato:"[^"]*"/, `ultimo:"${newLast}", aggiornato:"${dd}"`);
    const mesi = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
    const lab = `${mesi[+newLast.slice(5) - 1]} ${newLast.slice(0, 4)}`;
    out = out.replace(/ultimo dato \w+ \d{4}/g, "ultimo dato " + lab).replace(/Ultimo indice: \w+ \d{4}/g, "Ultimo indice: " + lab);
    fs.writeFileSync(FILE, out);
    console.log(`FOI aggiornato: ${curLast} → ${newLast} (${all[newLast]})`);
    process.exit(10);
  } catch (e) { console.error("ERRORE update_foi:", e.message); process.exit(1); }
})();
