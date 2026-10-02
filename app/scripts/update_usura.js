// Tassi effettivi globali medi (TEGM) e tassi soglia antiusura (L. 108/1996), per trimestre di applicazione.
// Fonti ufficiali Banca d'Italia: serie storica CSV (TEGM_serie_storica.zip, dal 2/4/1997) e comunicati stampa trimestrali
// in PDF (tabella in testo), elencati in monitoraggio/usura_fonti.json; i nuovi comunicati si trovano nella pagina dei
// comunicati stampa. Ogni soglia viene ricontrollata con la formula di legge prima di essere pubblicata.
// Uso: node app/scripts/update_usura.js   → exit 0 nessuna novità, exit 10 dati aggiornati, exit 1 errore, exit 2 discordanza
// Richiede pdftotext (poppler-utils).
const fs = require("fs"), path = require("path"), zlib = require("zlib"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..", "..");
const FILE = path.join(ROOT, "app", "index.html");
const FONTI = path.join(ROOT, "monitoraggio", "usura_fonti.json");
const BDI = "https://www.bancaditalia.it";
const H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)" };
const num = s => +String(s).trim().replace(/\./g, "").replace(",", ".");
const iso = s => { const [d, m, y] = s.split("/"); return `${y}-${m}-${d}`; };
const sogliaDiLegge = (tegm, dal) => dal >= "2011-05-14" ? Math.min(tegm * 1.25 + 4, tegm + 8) : tegm * 1.5;

async function scarica(url) { const r = await fetch(url, { headers: H }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

function unzipPrimo(b) {   // zip con un solo file: directory centrale
  const e = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); let p = b.readUInt32LE(e + 16);
  const meth = b.readUInt16LE(p + 10), cs = b.readUInt32LE(p + 20), fl = b.readUInt16LE(p + 28), off = b.readUInt32LE(p + 42);
  const lfl = b.readUInt16LE(off + 26), lel = b.readUInt16LE(off + 28), d = b.slice(off + 30 + lfl + lel, off + 30 + lfl + lel + cs);
  return meth === 8 ? zlib.inflateRawSync(d) : d;
}

// serie storica: righe INIZIO;FINE;CATEGORIA;CLASSE;TEGM;SOGLIA
async function daCsv() {
  const t = unzipPrimo(await scarica(`${BDI}/compiti/vigilanza/compiti-vigilanza/tegm/TEGM_serie_storica.zip`)).toString("latin1");
  const q = {};
  for (const riga of t.split(/\r?\n/).slice(1)) {
    const c = riga.split(";"); if (c.length < 6 || !/^\d{2}\/\d{2}\/\d{4}$/.test(c[0])) continue;
    const k = iso(c[0]); (q[k] = q[k] || { fine: iso(c[1]), righe: [] }).righe.push([c[2].trim(), c[3].trim(), num(c[4]), num(c[5])]);
  }
  return q;
}

// comunicato trimestrale: titolo "... SOGLIA VALIDI PER IL QUARTO TRIMESTRE 2026" e righe "<categoria> <classe> <tegm> <soglia>"
function daPdf(buf) {
  const tmp = path.join(os.tmpdir(), "usura_" + Date.now() + ".pdf"); fs.writeFileSync(tmp, buf);
  // UTF-8 esplicito e apostrofi tipografici uniformati: stesso risultato su Windows e sui server Linux
  const t = execFileSync("pdftotext", ["-raw", "-enc", "UTF-8", tmp, "-"], { encoding: "utf8" }).replace(/[‘’]/g, "'"); fs.unlinkSync(tmp);
  const piatto = t.replace(/\s+/g, " ");
  const m = piatto.match(/VALIDI PER IL (PRIMO|SECONDO|TERZO|QUARTO) TRIMESTRE (\d{4})/i); if (!m) throw new Error("trimestre non trovato nel comunicato");
  const n = ["PRIMO", "SECONDO", "TERZO", "QUARTO"].indexOf(m[1].toUpperCase()), y = +m[2];
  const dal = `${y}-${String(n * 3 + 1).padStart(2, "0")}-01`, fine = new Date(Date.UTC(y, n * 3 + 3, 0)).toISOString().slice(0, 10);
  const inizio = t.search(/^Aperture di credito/im), stop = t.search(/Compenso di mediazione/i);   // la prima categoria è sempre questa
  if (inizio < 0 || stop < inizio) throw new Error("tabella non trovata nel comunicato");
  const righe = []; let attesa = [], cat = "";
  const RE = /^(.*?)\s*(fino a [\d.]+|oltre [\d.]+|da [\d.]+ a [\d.]+|intera distribuzione)\s+(\d+,\d+)\s+(\d+,\d+)$/i;
  for (const l of t.slice(inizio, stop).split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const r = l.match(RE);
    if (!r) { attesa.push(l); continue; }
    cat = [...attesa, r[1]].join(" ").replace(/\s+/g, " ").trim() || cat; attesa = [];
    righe.push([cat, r[2], num(r[3]), num(r[4])]);
  }
  if (righe.length < 15) throw new Error(`solo ${righe.length} righe lette dal comunicato ${dal}`);
  return { dal, fine, righe };
}

(async () => {
  try {
    const fonti = JSON.parse(fs.readFileSync(FONTI, "utf8"));
    // nuovi comunicati nella pagina dei comunicati stampa
    const idx = (await scarica(`${BDI}/media/comunicati/index.html`)).toString();
    for (const m of idx.matchAll(/href=["']([^"']*antiusura[^"']*\.pdf)\s*["']/gi)) { const u = BDI + m[1].trim(); if (!fonti.pdf.includes(u)) fonti.pdf.push(u); }
    const Q = await daCsv();
    for (const u of fonti.pdf) { const p = daPdf(await scarica(u)); Q[p.dal] = { fine: p.fine, righe: p.righe, fonte: u }; }
    // controllo della formula di legge su ogni riga
    const errori = [];
    for (const [dal, q] of Object.entries(Q)) for (const [c, k, tg, s] of q.righe) if (Math.abs(sogliaDiLegge(tg, dal) - s) > 0.0051) errori.push(`${dal} ${c} ${k}: TEGM ${tg} soglia ${s} (formula ${sogliaDiLegge(tg, dal).toFixed(4)})`);
    if (errori.length > 3) { console.log("DISCORDANZA usura (soglie diverse dalla formula di legge): " + errori.slice(0, 6).join(" | ")); process.exit(2); }
    for (const e of errori) console.log("  nota (arrotondamento della fonte): " + e);
    // compattazione: dizionari di categorie e classi
    const cat = [], cls = [], ix = (a, v) => { let i = a.indexOf(v); if (i < 0) { a.push(v); i = a.length - 1; } return i; };
    const q = {}; for (const dal of Object.keys(Q).sort()) q[dal] = [Q[dal].fine, Q[dal].righe.map(([c, k, tg, s]) => [ix(cat, c), ix(cls, k), tg, s])];
    const dati = { cat, cls, q };
    const html = fs.readFileSync(FILE, "utf8"), cur = html.match(/const USURA = (\{[^\n]*\});/);
    const nuovo = JSON.stringify(dati), ultimo = Object.keys(q).sort().pop();
    fs.writeFileSync(FONTI, JSON.stringify(fonti, null, 1) + "\n");
    if (cur && cur[1] === nuovo) { console.log(`Usura: nessuna novità (ultimo trimestre dal ${ultimo})`); process.exit(0); }
    fs.writeFileSync(FILE, cur ? html.replace(/const USURA = \{[^\n]*\};/, `const USURA = ${nuovo};`) : html);
    if (!cur) { console.log("ERRORE update_usura: costante USURA non trovata in index.html"); process.exit(1); }
    console.log(`Usura aggiornata: ${Object.keys(q).length} trimestri, ultimo dal ${ultimo}`);
    process.exit(10);
  } catch (e) { console.log("ERRORE update_usura: " + e.message); process.exit(1); }
})();
