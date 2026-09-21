// Costruisce site/index.html (documento completo, con meta SEO) a partire da app/index.html (formato Artifact).
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const body = src.replace(/^<meta charset="utf-8">\s*/i, "").replace(/^<title>.*?<\/title>\s*/i, "");
const title = "Calcoli Forensi — calcolatori legali e fiscali per professionisti";
const desc = "Danno biologico (art. 139 CdA e Tabelle di Milano 2024), danno parentale, interessi legali e di mora, contributo unificato. Formula, norma e tabella accanto a ogni risultato.";
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%230E5A48'/%3E%3Ctext x='32' y='44' font-family='Georgia,serif' font-size='34' font-weight='700' text-anchor='middle' fill='white'%3ECF%3C/text%3E%3C/svg%3E">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Calcoli Forensi","url":"https://calcoliforensi.it/","applicationCategory":"BusinessApplication","operatingSystem":"Web","inLanguage":"it","description":"${desc}","offers":[{"@type":"Offer","price":"0","priceCurrency":"EUR","name":"Gratis"},{"@type":"Offer","price":"19","priceCurrency":"EUR","name":"Pro mensile"},{"@type":"Offer","price":"149","priceCurrency":"EUR","name":"Pro annuale"}]}
</script>
<style>
html{color-scheme:light dark}
body{margin:0;font-family:system-ui,sans-serif;font-size:14px}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
${body}
</body>
</html>
`;
const dest = path.join(__dirname, "..", "docs", "index.html");
fs.writeFileSync(dest, out);
console.log("scritto", dest, out.length, "byte");
