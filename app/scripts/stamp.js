// Aggiorna la data di verifica in MONITOR (app/index.html). Uso: node app/scripts/stamp.js dati|fonti [gg/mm/aaaa]
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "index.html");
const campo = process.argv[2]; if (!["dati", "fonti"].includes(campo)) { console.error("uso: stamp.js dati|fonti [data]"); process.exit(1); }
const oggi = new Date(); const data = process.argv[3] || `${String(oggi.getDate()).padStart(2, "0")}/${String(oggi.getMonth() + 1).padStart(2, "0")}/${oggi.getFullYear()}`;
let html = fs.readFileSync(FILE, "utf8");
const re = new RegExp(`(${campo}:")\\d{2}/\\d{2}/\\d{4}(")`);
if (!re.test(html)) { console.error("campo MONITOR non trovato"); process.exit(1); }
html = html.replace(re, `$1${data}$2`);
fs.writeFileSync(FILE, html); console.log(`MONITOR.${campo} = ${data}`);
