// Aggiorna il saggio degli interessi legali (art. 1284 c.c.) leggendo il decreto MEF in Gazzetta Ufficiale.
// Il decreto esce di norma a metà dicembre con decorrenza dal 1° gennaio successivo.
// Uso: node app/scripts/update_saggio.js → exit 0 nulla da fare, 10 aggiornato, 1 errore
// Prova senza scrivere: PROVA_ANNO=2026 node app/scripts/update_saggio.js
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "index.html");
const GU = "https://www.gazzettaufficiale.it";
const H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)" };
const testo = h => h.replace(/<[^>]+>/g, " ").replace(/&#39;|&rsquo;/g, "'").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
const get = async u => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.text(); };

async function cercaDecreto(anno) {
  // il decreto per l'anno X è pubblicato tra metà novembre dell'anno X-1 e fine gennaio dell'anno X
  const fascicoli = [];
  for (const a of [anno - 1, anno]) {
    let idx; try { idx = await get(`${GU}/ricercaArchivioCompleto/serie_generale/${a}`); } catch (e) { continue; }
    for (const m of idx.matchAll(/n&#176;\s*(?:&nbsp;)*\s*(\d+)\s*del\s*(\d{2})-(\d{2})-(\d{4})/g)) {
      const iso = `${m[4]}-${m[3]}-${m[2]}`;
      if (iso >= `${anno - 1}-11-15` && iso <= `${anno}-01-31`) fascicoli.push({ num: m[1], iso });
    }
  }
  for (const f of fascicoli.sort((x, y) => y.iso.localeCompare(x.iso))) {
    const s = await get(`${GU}/gazzetta/serie_generale/caricaDettaglio?dataPubblicazioneGazzetta=${f.iso}&numeroGazzetta=${f.num}`);
    const i = s.search(/saggio\s+degli\s+interessi\s+legali/i); if (i < 0) { await new Promise(r => setTimeout(r, 200)); continue; }
    const link = [...s.slice(Math.max(0, i - 2000), i + 300).matchAll(/href="([^"]*caricaDettaglioAtto[^"]*)"/g)].map(m => m[1].replace(/&amp;/g, "&")).pop();
    if (!link) continue;
    const cod = (link.match(/codiceRedazionale=([A-Z0-9]+)/) || [])[1];
    const art = testo(await get(`${GU}/atto/serie_generale/caricaArticoloDefault/originario?atto.dataPubblicazioneGazzetta=${f.iso}&atto.codiceRedazionale=${cod}&atto.tipoProvvedimento=DECRETO`));
    const dispositivo = art.slice(Math.max(0, art.search(/Decreta/i)));
    const m = dispositivo.match(/fissata\s+al(?:l.)?\s*(\d+(?:,\d+)?)\s+per\s+cento\s+in\s+ragione\s+d.anno,?\s+con\s+decorrenza\s+dal\s+1.?\s*gennaio\s+(\d{4})/i);
    if (m && +m[2] === anno) return { tasso: +m[1].replace(",", "."), gu: `GU n. ${f.num} del ${f.iso.split("-").reverse().join("/")}`, codice: cod };
  }
  return null;
}

(async () => {
  try {
    const html = fs.readFileSync(FILE, "utf8");
    const blocco = html.match(/const TASSI_LEGALI = \{([\s\S]*?)\};/);
    const attuali = {}; for (const x of blocco[1].matchAll(/(\d{4}):([\d.]+)/g)) attuali[+x[1]] = +x[2];
    const oggi = new Date(), anno = oggi.getFullYear(), mese = oggi.getMonth() + 1;
    const prova = process.env.PROVA_ANNO ? +process.env.PROVA_ANNO : null;
    const daCercare = prova ? [prova] : [anno, ...(mese >= 11 ? [anno + 1] : [])].filter(y => attuali[y] == null);
    if (!daCercare.length) { console.log(`Saggio legale: già presente (${anno}: ${attuali[anno]}%)`); process.exit(0); }
    let aggiornati = [];
    for (const y of daCercare) {
      const d = await cercaDecreto(y);
      if (!d) { console.log(`Saggio legale ${y}: decreto non ancora pubblicato`); continue; }
      if (!(d.tasso >= 0 && d.tasso <= 15)) throw new Error(`valore anomalo ${d.tasso} per il ${y}`);
      console.log(`Saggio legale ${y}: ${String(d.tasso).replace(".", ",")}% (${d.gu}, ${d.codice})`);
      if (!prova) { attuali[y] = d.tasso; aggiornati.push(y); }
    }
    if (!aggiornati.length) process.exit(0);
    const anni = Object.keys(attuali).map(Number).sort((a, b) => a - b);
    const righe = []; for (let i = 0; i < anni.length; i += 8) righe.push("  " + anni.slice(i, i + 8).map(y => `${y}:${attuali[y]}`).join(","));
    let out = html.replace(/const TASSI_LEGALI = \{[\s\S]*?\};/, `const TASSI_LEGALI = {\n${righe.join(",\n")}\n};`);
    const ultimo = anni[anni.length - 1];
    out = out.replace(/TASSI_LEGALI\[\d{4}\](?=\s*[;)|,}])/g, `TASSI_LEGALI[${ultimo}]`);
    fs.writeFileSync(FILE, out);
    process.exit(10);
  } catch (e) { console.error("ERRORE update_saggio:", e.message); process.exit(1); }
})();
