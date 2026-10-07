// Pagine indicizzabili: una pagina vera per ogni calcolatore (docs/<slug>/index.html) con titolo, descrizione,
// indirizzo canonico e il contenuto del calcolatore già disegnato (esempio compreso), più sitemap.xml.
// Gli indirizzi con "#" non vengono indicizzati da Google: queste pagine sono quelle che compaiono nelle ricerche.
// Uso: chiamato da build.js dopo aver scritto docs/index.html (richiede jsdom, già installato nel workflow).
const fs = require("fs"), path = require("path");
const DOCS = path.join(__dirname, "..", "docs");
const SITO = "https://calcoliforensi.it";

// id del calcolatore → [indirizzo, titolo per Google]
const PAGINE = {
  "danno-micro": ["calcolo-danno-biologico-micropermanenti", "Calcolo danno biologico micropermanenti 2026 (art. 139 CdA)"],
  "danno-tun": ["calcolo-danno-biologico-tabella-unica-nazionale", "Calcolo danno biologico macropermanenti: Tabella Unica Nazionale (art. 138)"],
  "danno-milano": ["calcolo-danno-tabelle-milano", "Calcolo danno non patrimoniale con le Tabelle di Milano 2024"],
  "danno-parentale": ["calcolo-danno-perdita-rapporto-parentale", "Calcolo danno da perdita del rapporto parentale (Tabelle di Milano a punti)"],
  "interessi-legali": ["calcolo-interessi-legali", "Calcolo interessi legali 2026 con prospetto per periodo"],
  "usura": ["verifica-usura-tassi-soglia", "Verifica usura: tassi soglia trimestrali dal 1997 (L. 108/1996)"],
  "interessi-mora": ["calcolo-interessi-di-mora", "Calcolo interessi di mora commerciali (D.Lgs. 231/2002)"],
  "rivalutazione": ["rivalutazione-monetaria-istat", "Rivalutazione monetaria ISTAT e interessi sul capitale rivalutato"],
  "scadenze": ["calcolo-termini-processuali", "Calcolo termini processuali civili con sospensione feriale"],
  "calendario-processo": ["calendario-memorie-cartabia", "Calendario delle memorie integrative (riforma Cartabia, art. 171-ter c.p.c.)"],
  "contributo-unificato": ["calcolo-contributo-unificato", "Calcolo contributo unificato 2026 per valore e grado"],
  "parcella": ["calcolo-parcella-avvocato", "Calcolo parcella avvocato civile: parametri forensi DM 55/2014"],
  "preventivo": ["preventivo-avvocato", "Preventivo avvocato ex art. 13 L. 247/2012"],
  "precetto": ["calcolo-atto-di-precetto", "Calcolo atto di precetto: capitale, interessi, spese e compensi"],
  "prescrizione": ["calcolo-prescrizione-diritti", "Calcolo prescrizione dei diritti (codice civile)"],
  "pignoramento": ["calcolo-pignoramento-stipendio-pensione", "Calcolo pignoramento di stipendio e pensione"],
  "pena": ["calcolo-pena-patteggiamento-abbreviato", "Calcolo della pena: circostanze, patteggiamento e abbreviato"],
  "prescrizione-reato": ["calcolo-prescrizione-reato", "Calcolo prescrizione del reato (Cirielli, Orlando, Bonafede, Cartabia)"],
  "parcella-penale": ["calcolo-parcella-avvocato-penale", "Calcolo parcella avvocato penale: parametri forensi"],
  "sanzioni-inps": ["calcolo-sanzioni-civili-inps", "Calcolo sanzioni civili INPS 2026 e ravvedimento sui contributi"],
  "tfr": ["calcolo-tfr", "Calcolo TFR: rivalutazione e tassazione"],
  "imu": ["calcolo-imu-valore-catastale", "Calcolo IMU e valore catastale"],
  "compravendita": ["imposte-acquisto-casa", "Calcolo imposte sull'acquisto di un immobile: registro, IVA, ipotecaria e catastale"],
  "quote-ereditarie": ["calcolo-quote-ereditarie-legittima", "Calcolo quote ereditarie e legittima"],
  "successione": ["calcolo-imposta-di-successione", "Calcolo imposta di successione e donazione"],
  "usufrutto": ["calcolo-usufrutto-nuda-proprieta", "Calcolo valore di usufrutto e nuda proprietà 2026"],
  "canone": ["aggiornamento-istat-canone-locazione", "Aggiornamento ISTAT del canone di locazione"],
  "cedolare": ["cedolare-secca-o-irpef", "Cedolare secca o IRPEF: confronto per il locatore"],
  "ravvedimento": ["calcolo-ravvedimento-operoso", "Calcolo ravvedimento operoso 2026 con modello F24"],
  "prescrizione-tributi": ["prescrizione-cartelle-imposte-tributi", "Prescrizione e decadenza di imposte, tributi e cartelle esattoriali"],
  "cambi": ["cambi-valute-banca-italia", "Cambi delle valute Banca d'Italia e conversione lire-euro"],
  "f24": ["compilazione-modello-f24", "Compilazione e stampa del modello F24"],
};

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function costruisci() {
  const { JSDOM, VirtualConsole } = require("jsdom");
  const base = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");

  // disegna una pagina del sito come la vede un visitatore senza licenza
  const disegna = async id => {
    const vc = new VirtualConsole();
    const dom = new JSDOM(base, { runScripts: "dangerously", pretendToBeVisual: true, url: `${SITO}/#/${id}`, virtualConsole: vc,
      beforeParse(w) { w.scrollTo = () => {}; w.print = () => {}; w.fetch = async () => { throw new Error("non in linea"); }; } });
    await sleep(250);
    const d = dom.window.document;
    const r = { main: d.querySelector("#main").innerHTML, nav: d.querySelector("#nav").innerHTML,
      calc: dom.window.eval("CATALOG.flatMap(g=>g.items.map(i=>({id:i.id,title:i.title,desc:i.desc,group:g.group})))") };
    dom.window.close();
    return r;
  };

  const home = await disegna("");
  const elenco = home.calc.filter(c => PAGINE[c.id]);
  const mancanti = home.calc.filter(c => !PAGINE[c.id]).map(c => c.id);
  if (mancanti.length) throw new Error("calcolatori senza pagina indicizzabile: " + mancanti.join(", "));

  // elenco dei calcolatori con collegamenti veri, in fondo a ogni pagina (Google segue questi, non quelli con "#")
  const piede = `<p class="foot-calc">Calcolatori: ${elenco.map(c => `<a href="/${PAGINE[c.id][0]}/">${esc(c.title)}</a>`).join(" · ")}</p>`;
  const conPiede = html => html.replace('<p id="footTitolare"></p>', piede + '<p id="footTitolare"></p>');

  // pagina iniziale: stesso contenuto, più l'elenco dei collegamenti
  fs.writeFileSync(path.join(DOCS, "index.html"), conPiede(base)
    .replace('<nav class="nav" id="nav"></nav>', `<nav class="nav" id="nav">${home.nav}</nav>`)
    .replace('<main class="main" id="main"></main>', `<main class="main" id="main">${home.main}</main>`));

  for (const c of elenco) {
    const [slug, titolo] = PAGINE[c.id];
    const url = `${SITO}/${slug}/`;
    const t = `${titolo} | Calcoli Forensi`;
    const v = await disegna(c.id);
    let html = conPiede(base)
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t)}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(c.desc)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(t)}">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(c.desc)}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
      .replace('<nav class="nav" id="nav"></nav>', `<nav class="nav" id="nav">${v.nav}</nav>`)
      .replace('<main class="main" id="main"></main>', `<main class="main" id="main">${v.main}</main>`)
      .replace("<body>", `<body>\n<script>window.CF_START=${JSON.stringify(c.id)};</script>`);
    if (!html.includes(`window.CF_START=`) || !html.includes(v.main.slice(0, 60))) throw new Error("pagina non composta: " + c.id);
    fs.mkdirSync(path.join(DOCS, slug), { recursive: true });
    fs.writeFileSync(path.join(DOCS, slug, "index.html"), html);
  }

  // sitemap: solo indirizzi veri, senza "#"
  const oggi = new Date().toISOString().slice(0, 10);
  const urls = [`${SITO}/`, ...elenco.map(c => `${SITO}/${PAGINE[c.id][0]}/`)];
  fs.writeFileSync(path.join(DOCS, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u, i) => `  <url><loc>${u}</loc><lastmod>${oggi}</lastmod><changefreq>weekly</changefreq><priority>${i ? "0.8" : "1.0"}</priority></url>`).join("\n")}\n</urlset>\n`);
  console.log(`pagine indicizzabili: ${elenco.length} + sitemap (${urls.length} indirizzi)`);
}

module.exports = { costruisci, PAGINE };
if (require.main === module) costruisci().catch(e => { console.error("ERRORE build_pagine:", e.message); process.exit(1); });
