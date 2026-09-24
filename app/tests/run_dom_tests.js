// Collaudo automatico dell'interfaccia: carica il sito costruito in jsdom, apre ogni calcolatore,
// verifica che produca un risultato, che il prospetto Pro non sia servito senza licenza e che valori
// limite non generino NaN/Infinity/undefined. Uso: npm i --no-save jsdom && node app/tests/run_dom_tests.js
const fs = require("fs"), path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const FILE = path.join(__dirname, "..", "..", "docs", "index.html");
const HTML = fs.readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ck = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "OK  " : "DIFF"} ${name}${extra ? ": " + extra : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function apri(licenza) {
  const errori = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => { if (!/Not implemented/.test(e.message)) errori.push(e.message); });
  const dom = new JSDOM(HTML, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://calcoliforensi.it/", virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; w.print = () => {};
      if (licenza) { try { w.localStorage.setItem("cf_license", licenza); } catch (e) {} }
      w.addEventListener("error", e => errori.push(e.message || String(e.error)));
    } });
  return { dom, window: dom.window, errori };
}

(async () => {
  // ---- sessione senza licenza ----
  const A = apri(null); await sleep(700);
  const w = A.window, $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const vai = async id => { w.location.hash = "#/" + id; w.dispatchEvent(new w.HashChangeEvent("hashchange")); await sleep(50); };

  ck("pagina caricata", !!$("#main") && !!$("#nav"));
  const ids = $$('.nav a[href^="#/"]').map(a => a.getAttribute("href").slice(2)).filter(x => x && x !== "piani");
  ck("calcolatori in elenco", ids.length >= 20, `${ids.length} voci`);

  for (const id of ids) {
    await vai(id);
    const big = $("#result .total .big");
    ck(`risultato ${id}`, !!big && /\d/.test(big.textContent), big ? big.textContent.trim().replace(/\s+/g, " ") : "NESSUN RISULTATO");
  }

  // paywall: il prospetto (formule, riferimenti, note) non deve essere presente nel documento
  await vai("danno-tun");
  const testoLibero = $("#result").textContent;
  ck("paywall attivo", !!$("#result .gate .cta"));
  ck("prospetto Pro non servito", !/Coefficiente moltiplicatore|Tavola 1\.A|DPR 13 gennaio 2025/.test(testoLibero));
  ck("risultato gratuito visibile", !!$("#result .total .big") && /\d/.test($("#result .total .big").textContent));
  ck("stampa riservata a Pro", /\(Pro\)/.test($("#btnPrint")?.textContent || ""));

  // valori limite
  let limiti = 0;
  for (const id of ids) {
    await vai(id);
    for (const val of ["0", "-5", "999999999", ""]) {
      for (const el of $$(".panel [data-in]")) if (el.type === "number") { el.value = val; el.dispatchEvent(new w.Event("input", { bubbles: true })); }
      await sleep(10); limiti++;
      const txt = $("#result")?.textContent || "";
      if (/NaN|Infinity|undefined|\[object/.test(txt)) { fail++; console.log(`DIFF ${id} con valore "${val || "vuoto"}": ${txt.replace(/\s+/g, " ").slice(0, 100)}`); }
    }
  }
  ck("valori limite senza risultati anomali", true, `${limiti} combinazioni`);
  ck("nessun errore JavaScript", A.errori.length === 0, A.errori.join(" | "));

  // dati pubblicati
  const annoCorr = new Date().getFullYear(), sem = new Date().getMonth() < 6 ? 1 : 2;
  const foi = JSON.parse(HTML.match(/const FOI = (\{.*?\});/)[1]);
  const tassi = HTML.match(/const TASSI_LEGALI = \{([\s\S]*?)\};/)[1];
  const bce = HTML.match(/const TASSI_BCE = \{([\s\S]*?)\};/)[1];
  const ultimoFoi = Object.keys(foi).sort().pop();
  ck("serie FOI aggiornata", Object.keys(foi).length > 350 && ultimoFoi >= "2026-08", `${Object.keys(foi).length} mesi, ultimo ${ultimoFoi}`);
  ck("saggio legale dell'anno in corso", new RegExp(`${annoCorr}\\s*:`).test(tassi), `${annoCorr}`);
  ck("tasso BCE del semestre in corso", new RegExp(`"${annoCorr}-${sem}"`).test(bce), `${annoCorr}-${sem}`);
  A.dom.window.close();

  // ---- sessione con licenza ----
  const B = apri("PROVA-CALCOLI-FORENSI-2026"); await sleep(700);
  const w2 = B.window, $2 = s => w2.document.querySelector(s);
  w2.location.hash = "#/danno-tun"; w2.dispatchEvent(new w2.HashChangeEvent("hashchange")); await sleep(80);
  ck("con licenza: prospetto servito", /Coefficiente moltiplicatore/.test($2("#result").textContent));
  ck("con licenza: nessun paywall", !$2("#result .gate"));
  ck("con licenza: stampa abilitata", /Stampa relazione \/ PDF/.test($2("#btnPrint")?.textContent || ""));
  ck("con licenza: badge Pro", /PRO ATTIVO/i.test($2("#licenseBadge").textContent));
  B.dom.window.close();

  console.log(`\n${pass} OK, ${fail} DIFF`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("ERRORE run_dom_tests:", e); process.exit(1); });
