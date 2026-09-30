// Testo integrale di un atto della Gazzetta Ufficiale (Serie Generale), articolo per articolo.
// Uso come modulo: const { testoAtto } = require("./gu_testo"); await testoAtto("2026-08-11", "26G00169")
// Uso da riga di comando: node app/scripts/gu_testo.js 2026-08-11 26G00169 [filtro-regex]
const GU = "https://www.gazzettaufficiale.it";
const H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)" };
const pulisci = h => h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&#39;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"').replace(/&laquo;/g, "«").replace(/&raquo;/g, "»").replace(/&agrave;/g, "à").replace(/&egrave;/g, "è").replace(/&eacute;/g, "é")
  .replace(/&igrave;/g, "ì").replace(/&ograve;/g, "ò").replace(/&ugrave;/g, "ù").replace(/&[a-z#0-9]+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

async function testoAtto(data, codice) {
  const menu = await (await fetch(`${GU}/atto/vediMenuHTML?atto.dataPubblicazioneGazzetta=${data}&atto.codiceRedazionale=${codice}&tipoSerie=serie_generale&tipoVigenza=originario`, { headers: H })).text();
  const link = [...new Set([...menu.matchAll(/href="([^"]*caricaArticolo[^"#]*)/g)].map(m => m[1].replace(/&amp;/g, "&")))];
  const parti = [];
  if (!link.length) {   // atto con un solo articolo: il testo sta nel riquadro indicato dalla pagina di dettaglio
    const det = await (await fetch(`${GU}/atto/serie_generale/caricaDettaglioAtto/originario?atto.dataPubblicazioneGazzetta=${data}&atto.codiceRedazionale=${codice}`, { headers: H })).text();
    const src = (det.match(/(?:src|href)="([^"]*caricaArticoloDefault[^"]*)"/) || [])[1];
    if (!src) throw new Error(`testo non trovato per ${codice}`);
    const x = await (await fetch(GU + src.replace(/&amp;/g, "&"), { headers: H })).text();
    parti.push(pulisci(x));
  }
  for (const l of link) {
    const x = await (await fetch(GU + l, { headers: H })).text();
    const t = pulisci(x.slice(Math.max(0, x.search(/<span class="dettaglio_atto_testo|<pre|class="art-num|Art\. ?\d/))));
    parti.push(t);
    await new Promise(r => setTimeout(r, 250));
  }
  return parti.join("\n\n");
}
module.exports = { testoAtto };

if (require.main === module) (async () => {
  const [data, codice, filtro] = process.argv.slice(2);
  const t = await testoAtto(data, codice);
  if (!filtro) { console.log(t); return; }
  const re = new RegExp(filtro, "i");
  const blocchi = t.split(/\n(?=Art\. ?\d)/);
  console.log(blocchi.filter(b => re.test(b)).join("\n\n---\n\n"));
})().catch(e => { console.error("ERRORE gu_testo:", e.message); process.exit(1); });
