// Norme sentinella: rilegge ogni giorno su Normattiva il testo VIGENTE degli articoli usati dai calcolatori e segnala
// ogni variazione (modifiche, abrogazioni, rinvii di decorrenza, nuove note di aggiornamento o sentenze della Corte
// costituzionale). Copre ciò che il controllo della Gazzetta non vede: le modifiche già incorporate nel testo vigente.
// Uso: node app/scripts/check_norme.js [--inizializza]
// exit 0 nessuna variazione, exit 10 variazioni (monitoraggio/norme_novita.json), exit 1 Normattiva non raggiungibile
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..", "..");
const ELENCO = path.join(ROOT, "monitoraggio", "norme_sentinella.json");   // [{id, urn, calc:[...]}]
const STATO = path.join(ROOT, "monitoraggio", "norme_stato.json");         // {id: {hash, testo, verificato}}
const OUT = path.join(ROOT, "monitoraggio", "norme_novita.json");
const H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)" };
const BASE = "https://www.normattiva.it/uri-res/N2Ls?";

const pulisci = html => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#39;|&rsquo;/g, "'").replace(/&agrave;/g, "à").replace(/&egrave;/g, "è")
  .replace(/&eacute;/g, "é").replace(/&igrave;/g, "ì").replace(/&ograve;/g, "ò").replace(/&ugrave;/g, "ù").replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

// testo dell'articolo: dall'intestazione "Art. N" fino ai collegamenti di navigazione della pagina
function estrai(testo, art, max = 60000) {
  const n = art.replace(/^art/, "").replace(/(\d+)(bis|ter|quater|quinquies|sexies|septies|octies)$/, "$1[- ]?$2");
  // intestazione con la A maiuscola ("Art. 157." / "Art. 161-bis"): l'indice laterale della pagina usa "art."
  const m = testo.match(new RegExp(`(?:Art\\.|ARTICOLO|Articolo)\\s*${n}\\b`)); if (!m) return null;
  const da = m.index, fine = testo.indexOf("articolo precedente", da);
  return testo.slice(da, fine > da ? fine : da + max).trim();
}

(async () => {
  const elenco = JSON.parse(fs.readFileSync(ELENCO, "utf8"));
  let stato = {}; try { stato = JSON.parse(fs.readFileSync(STATO, "utf8")); } catch (e) {}
  const iniz = process.argv.includes("--inizializza"), oggi = new Date().toISOString().slice(0, 10);
  const novita = [], errori = [];
  for (const x of elenco) {
    try {
      // fino a 3 tentativi: un errore di rete momentaneo non deve generare una segnalazione
      let r;
      for (let k = 1; ; k++) {
        try { r = await fetch(BASE + x.urn, { headers: H }); if (r.ok) break; if (k >= 3) throw new Error("HTTP " + r.status); }
        catch (e) { if (k >= 3) throw e; }
        await new Promise(z => setTimeout(z, 3000 * k));
      }
      const html = await r.text(), art = x.urn.split("~").pop();
      let t = x.commi ? null : estrai(pulisci(html), art);
      // articoli lunghissimi divisi da Normattiva in blocchi di 100 commi: si carica il blocco che contiene i commi sorvegliati
      if (x.commi && /^art\d+$/.test(art)) {
        const id = art.slice(3), blocco = Math.ceil(+x.commi[0] / 100), cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(";")[0]).join("; ");
        const links = [...html.matchAll(new RegExp(`caricaArticolo\\?[^"']*?art\\.idArticolo=${id}&art\\.idSottoArticolo=1&[^"']*`, "g"))].map(m => m[0].replace(/&amp;/g, "&"));
        const vers = Math.max(...links.map(l => +l.match(/versione=(\d+)/)[1]));
        const link = links.find(l => l.includes(`versione=${vers}&`) && l.includes(`progressivo=${blocco}&`));
        if (link) { const y = await fetch("https://www.normattiva.it/atto/" + link, { headers: { ...H, Cookie: cookie } }); if (y.ok) t = pulisci(await y.text()); }
      }
      // negli atti lunghi (testi unici) la pagina non contiene l'articolo: si carica la versione più recente con caricaArticolo
      if (!t && /^art\d+$/.test(art)) {
        const id = art.slice(3), cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(";")[0]).join("; ");
        const link = [...html.matchAll(new RegExp(`caricaArticolo\\?[^"']*?art\\.idArticolo=${id}&art\\.idSottoArticolo=1&[^"']*`, "g"))].map(m => m[0].replace(/&amp;/g, "&"))
          .sort((a, b) => (+b.match(/versione=(\d+)/)[1]) - (+a.match(/versione=(\d+)/)[1]))[0];
        if (link) { const y = await fetch("https://www.normattiva.it/atto/" + link, { headers: { ...H, Cookie: cookie } }); if (y.ok) t = estrai(pulisci(await y.text()), art); }
      }
      if (!t || t.length < 40) throw new Error("articolo non trovato nella pagina");
      // articoli lunghissimi (es. art. 1 L. 296/2006): si sorvegliano solo i commi indicati in "commi": ["161", "165"] (da/a escluso)
      if (x.commi) { const i = t.search(new RegExp(`(?:^|\\s)${x.commi[0]}\\.\\s`)), j = t.search(new RegExp(`(?:^|\\s)${x.commi[1]}\\.\\s`));
        if (i < 0) throw new Error(`comma ${x.commi[0]} non trovato`); t = t.slice(i, j > i ? j : i + 20000).trim(); }
      const hash = crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);
      const prima = stato[x.id];
      if (prima && prima.hash !== hash && !iniz) {
        novita.push({ id: x.id, calc: x.calc, url: BASE + x.urn, abrogato: /ABROGAT/i.test(t.slice(0, 300)), prima: prima.testo.slice(0, 1500), ora: t.slice(0, 1500) });
      }
      stato[x.id] = { hash, testo: t.slice(0, 4000), verificato: oggi };
    } catch (e) { errori.push(`${x.id}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 400));
  }
  if (errori.length > elenco.length / 2) { console.log(`ERRORE check_norme: Normattiva non raggiungibile (${errori.length}/${elenco.length})`); process.exit(1); }
  fs.writeFileSync(STATO, JSON.stringify(stato, null, 1) + "\n");
  for (const e of errori) console.log("  non letto: " + e);
  if (errori.length) novita.push(...errori.map(e => ({ id: e.split(":")[0], errore: e })));
  if (!novita.length) { console.log(`Norme sentinella: ${elenco.length - errori.length} articoli invariati`); try { fs.unlinkSync(OUT); } catch (e) {} return; }
  fs.writeFileSync(OUT, JSON.stringify(novita, null, 1) + "\n");
  for (const n of novita) console.log(`  VARIATO: ${n.id}${n.abrogato ? " (abrogazione)" : ""}${n.errore ? " — " + n.errore : ""}`);
  console.log(`Norme sentinella: ${novita.length} da esaminare`);
  process.exit(10);
})().catch(e => { console.log("ERRORE check_norme:", e.message); process.exit(1); });
