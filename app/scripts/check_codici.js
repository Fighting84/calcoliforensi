// Verifica sulla banca dati ufficiale dell'Agenzia delle entrate che i codici tributo usati dal calcolatore
// del ravvedimento esistano ancora (l'Agenzia li sopprime e sostituisce con risoluzioni che non passano dalla Gazzetta:
// es. 8906, 8913 e 1992 soppressi nel 2023). Uso: node app/scripts/check_codici.js
// exit 0 tutti validi, exit 10 codici soppressi o non trovati (scritti in monitoraggio/codici.json), exit 1 servizio non raggiungibile
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "monitoraggio", "codici.json");
const URL = "https://www1.agenziaentrate.gov.it/servizi/codici/ricerca/DettagliTributo.php";
const H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)", "Content-Type": "application/x-www-form-urlencoded" };

const html = fs.readFileSync(path.join(ROOT, "app", "index.html"), "utf8");
const blocco = html.slice(html.indexOf("const RAVV_TRIBUTI"), html.indexOf("const prevMese"));
const codici = new Set([...blocco.matchAll(/(?:cod|sanz|int):"(\d{4})"/g)].map(m => m[1]));
for (let m = 1; m <= 12; m++) codici.add(String(6000 + m));          // IVA mensile (codice calcolato dal mese)
for (const c of ["6031", "6032", "6033"]) codici.add(c);            // IVA trimestrale

(async () => {
  const problemi = []; let errori = 0;
  for (const c of [...codici].sort()) {
    try {
      const t = await (await fetch(URL, { method: "POST", headers: H, body: `codTrib=${c}&tipoTributo=&descrizione=` })).text();
      const p = t.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
      const sopp = p.match(/Il Codice Tributo \w+ - (.*?) stato soppresso a decorrere dal (\d{2}\/\d{2}\/\d{4})/);
      if (sopp) problemi.push({ codice: c, esito: "soppresso", descrizione: sopp[1], dal: sopp[2] });
      else if (!new RegExp(`Come compilare il modello F24 .*?\\b${c}\\b`).test(p)) problemi.push({ codice: c, esito: "non trovato" });
    } catch (e) { errori++; }
    await new Promise(r => setTimeout(r, 300));
  }
  if (errori > codici.size / 2) { console.log(`ERRORE check_codici: servizio dell'Agenzia non raggiungibile (${errori} errori)`); process.exit(1); }
  if (!problemi.length) { console.log(`Codici tributo: ${codici.size} verificati, tutti validi`); try { fs.unlinkSync(OUT); } catch (e) {} return; }
  fs.writeFileSync(OUT, JSON.stringify(problemi, null, 1) + "\n");
  for (const x of problemi) console.log(`  ${x.codice}: ${x.esito}${x.dal ? " dal " + x.dal : ""} ${x.descrizione || ""}`);
  console.log(`Codici tributo: ${problemi.length} da sostituire`);
  process.exit(10);
})().catch(e => { console.log("ERRORE check_codici:", e.message); process.exit(1); });
