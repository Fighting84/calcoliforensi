// Controlla i sommari della Gazzetta Ufficiale (Serie Generale) pubblicati dall'ultima verifica
// e segnala gli atti che toccano i calcolatori. Nessun MCP, nessun browser: funziona in cloud.
// Uso: node app/scripts/check_gazzetta.js  → exit 0 nessuna novità, exit 10 novità trovate, exit 1 errore
// Le novità sono scritte in monitoraggio/novita.json (consumate dal workflow per aprire una issue).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const STATO = path.join(ROOT, "monitoraggio", "stato.json");
const OUT = path.join(ROOT, "monitoraggio", "novita.json");
const H = { "User-Agent": "Mozilla/5.0 (compatible; calcoliforensi-monitor/1.0)" };

// parola chiave → calcolatore interessato
const TEMI = [
  [/saggio\s+degli\s+interessi\s+legali|misura\s+del\s+saggio/i, "interessi-legali", "Saggio legale (art. 1284 c.c.)"],
  [/transazioni\s+commerciali|decreto\s+legislativo\s+9\s+ottobre\s+2002,?\s*n\.?\s*231|tasso\s+di\s+riferimento/i, "interessi-mora", "Tasso BCE / interessi di mora (D.Lgs. 231/2002)"],
  [/danno\s+biologico|lesioni\s+di\s+lieve\s+entit|articolo\s+139\s+del\s+codice\s+delle\s+assicurazioni|micropermanenti/i, "danno-micro", "Art. 139 CdA — micropermanenti"],
  [/tabella\s+unica\s+nazionale|articolo\s+138\s+del\s+codice\s+delle\s+assicurazioni|macropermanenti/i, "danno-tun", "Art. 138 CdA — TUN"],
  [/parametri\s+per\s+la\s+liquidazione\s+dei\s+compensi|professione\s+forense|decreto.{0,40}n\.?\s*55\s+del\s+2014/i, "parcella", "Parametri forensi (DM 55/2014)"],
  [/contributo\s+unificato|spese\s+di\s+giustizia|testo\s+unico.{0,30}115\s+del\s+2002/i, "contributo-unificato", "Contributo unificato (DPR 115/2002)"],
  [/indennit.{0,3}\s+di\s+mediazione|organismi\s+di\s+mediazione|decreto\s+legislativo.{0,20}28\s+del\s+2010/i, "parcella", "Mediazione"],
  [/imposta\s+municipale\s+propria/i, "imu", "IMU"],
  [/successioni\s+e\s+donazioni|imposta\s+sulle\s+successioni/i, "successione", "Imposta di successione"],
  [/cedolare\s+secca/i, "cedolare", "Cedolare secca"],
  [/assegno\s+sociale|perequazione\s+automatica\s+dei\s+trattamenti\s+pensionistici/i, "pignoramento", "Assegno sociale (limiti di pignorabilità)"],
  [/aliquote.{0,30}IRPEF|scaglioni\s+di\s+reddito/i, "tfr", "Scaglioni IRPEF (tassazione TFR)"],
  [/prospetto.{0,30}usufrutto|coefficienti.{0,30}usufrutto/i, "usufrutto", "Coefficienti usufrutto"],
  [/termini\s+processuali|sospensione\s+feriale|codice\s+di\s+procedura\s+civile/i, "scadenze", "Termini processuali"],
  [/pene\s+sostitutive|applicazione\s+della\s+pena\s+su\s+richiesta|giudizio\s+abbreviato|sospensione\s+condizionale\s+della\s+pena|articol[oi]\s+(?:442|444|445)\s+del\s+codice\s+di\s+procedura\s+penale/i, "pena", "Determinazione della pena e riti speciali"],
  [/prescrizione\s+del\s+reato|improcedibilit|articol[oi]\s+(?:157|158|159|160|161|161-bis)\s+del\s+codice\s+penale|articolo\s+344-bis/i, "prescrizione-reato", "Prescrizione del reato e improcedibilità"],
  [/ravvedimento|articolo\s+13\s+del\s+decreto\s+legislativo\s+18\s+dicembre\s+1997,?\s+n\.\s*47[12]|testo\s+unico\s+delle\s+sanzioni\s+tributarie/i, "ravvedimento", "Ravvedimento operoso e sanzioni tributarie"],
  // i testi unici tributari possono essere rinviati da decreti successivi (es. art. 4 DL 200/2025): ogni modifica della decorrenza va letta
  [/testo\s+unico[^.;]{0,160}(?:1°|primo)\s+gennaio\s+20\d\d|decreto\s+legislativo\s+(?:5\s+novembre\s+2024,?\s+n\.\s*17[345]|1°?\s+agosto\s+2025,?\s+n\.\s*123|24\s+marzo\s+2025,?\s+n\.\s*33)\b/i, "compravendita", "Testi unici tributari (decorrenza e modifiche)"],
];

const { testoAtto } = require("./gu_testo");
const testo = html => html.replace(/<[^>]+>/g, " ").replace(/&#\d+;/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

(async () => {
  try {
    const stato = JSON.parse(fs.readFileSync(STATO, "utf8"));
    const dal = process.env.GU_DAL || stato.ultima_verifica_gu || stato.ultima_verifica_fonti;
    const anno = +(process.env.GU_ANNO || new Date().getFullYear());
    const prova = !!process.env.GU_DAL;   // in prova non si scrive lo stato
    const idx = await (await fetch(`https://www.gazzettaufficiale.it/ricercaArchivioCompleto/serie_generale/${anno}`, { headers: H })).text();
    const gazzette = [...idx.matchAll(/n&#176;\s*(?:&nbsp;)*\s*(\d+)\s*del\s*(\d{2})-(\d{2})-(\d{4})/g)]
      .map(m => ({ num: m[1], iso: `${m[4]}-${m[3]}-${m[2]}` }))
      .filter(g => g.iso > dal);
    if (!gazzette.length) { console.log(`GU: nessun nuovo fascicolo dopo il ${dal}`); process.exit(0); }
    console.log(`GU: ${gazzette.length} fascicoli da controllare (dopo il ${dal})`);
    const novita = [];
    for (const g of gazzette.slice(-(+process.env.GU_MAX || 60))) {      // limite di sicurezza (GU_MAX per le verifiche straordinarie)
      const url = `https://www.gazzettaufficiale.it/gazzetta/serie_generale/caricaDettaglio?dataPubblicazioneGazzetta=${g.iso}&numeroGazzetta=${g.num}`;
      let t, grezzo;
      try { grezzo = await (await fetch(url, { headers: H })).text(); t = testo(grezzo); } catch (e) { console.log(`  ! GU n. ${g.num}: ${e.message}`); continue; }
      for (const [re, calc, tema] of TEMI) {
        const m = t.match(re); if (!m) continue;
        const i = Math.max(0, m.index - 260);
        // codice dell'atto: ultimo link di dettaglio che precede il punto trovato nel sommario
        const pos = grezzo.search(re); const codice = pos > 0 ? ([...grezzo.slice(Math.max(0, pos - 3000), pos + 400).matchAll(/codiceRedazionale=([A-Z0-9]+)/g)].pop() || [])[1] : null;
        let fileTesto = null;
        if (codice && !prova) {
          try {
            const dir = path.join(ROOT, "monitoraggio", "gazzetta"); fs.mkdirSync(dir, { recursive: true });
            fileTesto = `monitoraggio/gazzetta/${g.iso}_${codice}.txt`;
            if (!fs.existsSync(path.join(ROOT, fileTesto))) fs.writeFileSync(path.join(ROOT, fileTesto), (await testoAtto(g.iso, codice)).slice(0, 400000) + "\n");
          } catch (e) { fileTesto = null; }
        }
        novita.push({ gazzetta: g.num, data: g.iso, tema, calcolatore: calc, url, codice, testo: fileTesto, contesto: t.slice(i, m.index + 200).trim() });
      }
      await new Promise(r => setTimeout(r, 250));   // cortesia verso il server
    }
    if (!prova) { stato.ultima_verifica_gu = new Date().toISOString().slice(0, 10); fs.writeFileSync(STATO, JSON.stringify(stato, null, 2) + "\n"); }
    if (!novita.length) { try { fs.unlinkSync(OUT); } catch (e) {} console.log("GU: nessun atto rilevante"); process.exit(0); }
    fs.writeFileSync(OUT, JSON.stringify(novita, null, 2) + "\n");
    console.log(`GU: ${novita.length} atti potenzialmente rilevanti`);
    for (const n of novita) console.log(`  - GU ${n.data} n. ${n.gazzetta} → ${n.tema} (${n.calcolatore})`);
    process.exit(10);
  } catch (e) { console.error("ERRORE check_gazzetta:", e.message); process.exit(1); }
})();
