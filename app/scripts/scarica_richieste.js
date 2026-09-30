// Scarica i testi della Gazzetta richiesti dalla routine settimanale (che dal cloud non raggiunge la Gazzetta).
// monitoraggio/gazzetta_richieste.json accetta due forme:
//   {"data":"2026-08-11","codice":"26G00169"}                        (data di pubblicazione e codice redazionale)
//   {"tipo":"DECRETO LEGISLATIVO","dataAtto":"2025-08-01","numero":123} (estremi dell'atto: il codice viene cercato
//     nei sommari della Gazzetta dei 120 giorni successivi alla data dell'atto)
// I testi finiscono in monitoraggio/gazzetta/<data>_<codice>.txt; le richieste evase vengono tolte dal file.
const fs = require("fs"), path = require("path");
const { testoAtto } = require("./gu_testo");
const ROOT = path.join(__dirname, "..", "..");
const F = path.join(ROOT, "monitoraggio", "gazzetta_richieste.json");
const GU = "https://www.gazzettaufficiale.it", H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)" };
const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];

async function trova({ tipo, dataAtto, numero }) {
  const [a, m, g] = dataAtto.split("-").map(Number);
  const estremi = new RegExp(`${tipo.replace(/\s+/g, "\\s+")}\\s+${g}\\S*\\s+${MESI[m - 1]}\\s+${a},\\s+n\\.\\s*${numero}\\b`, "i");
  const fine = new Date(Date.UTC(a, m - 1, g + 120)).toISOString().slice(0, 10);
  for (const anno of [...new Set([a, +fine.slice(0, 4)])]) {
    const idx = await (await fetch(`${GU}/ricercaArchivioCompleto/serie_generale/${anno}`, { headers: H })).text();
    const fasc = [...idx.matchAll(/n&#176;\s*(?:&nbsp;)*\s*(\d+)\s*del\s*(\d{2})-(\d{2})-(\d{4})/g)].map(x => ({ num: x[1], iso: `${x[4]}-${x[3]}-${x[2]}` }))
      .filter(f => f.iso >= dataAtto && f.iso <= fine);
    for (const f of fasc) {
      const s = await (await fetch(`${GU}/gazzetta/serie_generale/caricaDettaglio?dataPubblicazioneGazzetta=${f.iso}&numeroGazzetta=${f.num}`, { headers: H })).text();
      const piatto = s.replace(/<[^>]+>/g, " ").replace(/&#176;|&deg;/g, "°").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
      if (!estremi.test(piatto)) { await new Promise(r => setTimeout(r, 150)); continue; }
      // il codice è nel collegamento all'atto che segue gli estremi nel sommario
      const i = s.search(new RegExp(`n\\.\\s*(?:<[^>]+>\\s*)*${numero}\\b`));
      const cod = ([...s.slice(Math.max(0, i - 200), i + 2500).matchAll(/codiceRedazionale=([A-Z0-9]+)/g)][0] || [])[1];
      if (cod) return { data: f.iso, codice: cod };
    }
  }
  return null;
}

(async () => {
  let r = []; try { r = JSON.parse(fs.readFileSync(F, "utf8")); } catch (e) {}
  if (!r.length) { console.log("Richieste di testi Gazzetta: nessuna"); return; }
  const dir = path.join(ROOT, "monitoraggio", "gazzetta"); fs.mkdirSync(dir, { recursive: true });
  const rimaste = [];
  for (const x of r) {
    try {
      let rif = /^\d{4}-\d{2}-\d{2}$/.test(x.data || "") && /^[A-Z0-9]{6,12}$/.test(x.codice || "") ? { data: x.data, codice: x.codice } : null;
      if (!rif && x.tipo && /^\d{4}-\d{2}-\d{2}$/.test(x.dataAtto || "") && +x.numero > 0) rif = await trova(x);
      if (!rif) { console.log(`  non trovato: ${JSON.stringify(x)}`); rimaste.push({ ...x, tentativi: (x.tentativi || 0) + 1 }); continue; }
      const nome = `${rif.data}_${rif.codice}.txt`;
      const intestazione = x.tipo ? `${x.tipo} ${x.dataAtto.split("-").reverse().join("/")} n. ${x.numero} — GU Serie Generale del ${rif.data.split("-").reverse().join("/")}, codice ${rif.codice}\n\n` : "";
      fs.writeFileSync(path.join(dir, nome), intestazione + (await testoAtto(rif.data, rif.codice)).slice(0, 4000000) + "\n");
      console.log(`  scaricato ${nome}`);
    } catch (e) { console.log(`  errore ${JSON.stringify(x)}: ${e.message}`); rimaste.push({ ...x, tentativi: (x.tentativi || 0) + 1 }); }
  }
  fs.writeFileSync(F, JSON.stringify(rimaste.filter(x => (x.tentativi || 0) < 5)) + "\n");
})().catch(e => { console.error("ERRORE scarica_richieste:", e.message); process.exit(1); });
