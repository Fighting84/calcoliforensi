// Costruisce site/index.html (documento completo, con meta SEO) a partire da app/index.html (formato Artifact).
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const body = src.replace(/^<meta charset="utf-8">\s*/i, "").replace(/^<title>.*?<\/title>\s*/i, "");
// Contatore delle visite Cloudflare Web Analytics (senza cookie): token assegnato da Cloudflare; vuoto = contatore spento
const ANALYTICS_TOKEN = "";
const contatore = ANALYTICS_TOKEN ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${ANALYTICS_TOKEN}","spa":true}'></script>
` : "";
const title = "Ponderis — calcoli forensi: calcolatori legali e fiscali per professionisti";
const desc = "Calcolatori per avvocati, commercialisti, consulenti del lavoro, notai, agenti immobiliari, medici legali e CAF: danno biologico (TUN, art. 139, Tabelle di Milano), interessi e rivalutazione ISTAT, parcella DM 55/2014, scadenze, TFR, IMU, successioni, locazioni. Formula e fonte accanto a ogni risultato, dati aggiornati ogni giorno.";
const out = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="https://calcoliforensi.it/">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="https://calcoliforensi.it/">
<meta property="og:locale" content="it_IT">
<meta name="robots" content="index,follow">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<meta property="og:site_name" content="Ponderis">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Ponderis — calcoli forensi","url":"https://calcoliforensi.it/","applicationCategory":"BusinessApplication","operatingSystem":"Web","inLanguage":"it","description":"${desc}","offers":{"@type":"Offer","price":"0","priceCurrency":"EUR","name":"Risultato dei calcoli"}}
</script>
<style>
html{color-scheme:light dark}
body{margin:0;font-family:system-ui,sans-serif;font-size:14px}
img{max-width:100%}
[hidden]{display:none!important}
</style>
${contatore}</head>
<body>
${body}
</body>
</html>
`;
const dest = path.join(__dirname, "..", "docs", "index.html");
fs.writeFileSync(dest, out);
console.log("scritto", dest, out.length, "byte");
// pagine indicizzabili per Google (una per calcolatore) e sitemap
require("./build_pagine").costruisci().catch(e => { console.error("ERRORE build_pagine:", e.message); process.exit(1); });
