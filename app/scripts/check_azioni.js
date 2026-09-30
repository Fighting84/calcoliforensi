// Agente "azioni per il titolare": individua le situazioni che richiedono un intervento umano e le comunica
// con istruzioni passo passo, aprendo una segnalazione GitHub assegnata al titolare (email).
// Quando la condizione si risolve, la segnalazione viene chiusa automaticamente.
// Uso: node app/scripts/check_azioni.js            → solo elenco (prova)
//      GITHUB_TOKEN=… node app/scripts/check_azioni.js --sincronizza   → apre/chiude le segnalazioni
// Prova su una data: OGGI=2027-08-25 node app/scripts/check_azioni.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const M = path.join(ROOT, "monitoraggio");
const REPO = "Fighting84/calcoliforensi", TITOLARE = "Fighting84", ETICHETTA = "azione-richiesta";
const oggi = process.env.OGGI ? new Date(process.env.OGGI + "T12:00:00Z") : new Date();
const giorniDa = iso => Math.floor((oggi - new Date(iso + "T12:00:00Z")) / 86400000);
const leggi = (f, d = null) => { try { return fs.readFileSync(path.join(M, f), "utf8").trim(); } catch (e) { return d; } };
const json = (f, d = null) => { try { return JSON.parse(leggi(f)); } catch (e) { return d; } };
const it = iso => iso.split("-").reverse().join("/");

const cfg = json("azioni_config.json", {});
const azioni = [];
const azione = (chiave, titolo, cosa, passi, tempo, seNo) => azioni.push({ chiave, titolo, cosa, passi, tempo, seNo });

// 1. Controllo Cassazione dal PC fermo
const hbC = leggi("heartbeat_cassazione.txt");
if (hbC && giorniDa(hbC) >= 10) azione("cassazione-ferma",
  `il controllo della Cassazione non gira da ${giorniDa(hbC)} giorni`,
  `L'ultimo controllo delle nuove sentenze di Cassazione risale al ${it(hbC)}. Questo controllo parte dal tuo PC (la banca dati della Cassazione non accetta connessioni dai server esteri), quindi si ferma se il PC resta spento o se l'attività di Windows è disattivata.`,
  ["Accendi il PC e lascialo acceso almeno 5 minuti: il controllo parte da solo e recupera tutti i giorni persi.",
   "Se il PC era già acceso: apri il menu Start, cerca «Utilità di pianificazione», apri la cartella «Libreria Utilità di pianificazione» e controlla che «Calcoli Forensi - Cassazione» sia «Pronta». Se è «Disabilitata», clic destro → Abilita.",
   "Nessun'altra azione: questa segnalazione si chiude da sola al primo controllo riuscito."],
  "5 minuti", "Le nuove sentenze non vengono rilevate finché il controllo non riparte; non si perde nulla degli ultimi 6 mesi.");

// 2. Routine settimanale ferma
const hbR = leggi("heartbeat_routine.txt");
if (hbR && giorniDa(hbR) >= 10) azione("routine-ferma",
  `la routine settimanale non gira da ${giorniDa(hbR)} giorni`,
  `La routine che esamina le segnalazioni e aggiorna i calcolatori ha completato l'ultimo giro il ${it(hbR)}.`,
  [`Apri ${cfg.routineUrl || "https://claude.ai/code/routines"} e controlla che la routine «Calcoli Forensi — esame settimanale» sia attiva.`,
   "Se compare un messaggio sul collegamento a GitHub, apri https://claude.ai/connect-github e autorizza di nuovo l'account Fighting84.",
   "Poi scrivi a Claude in una sessione: «la routine settimanale è ferma, verifica». Se è attiva ma fallisce, a ripararla ci pensa Claude."],
  "5 minuti", "Le novità vengono comunque rilevate e segnalate, ma non vengono trasposte nei calcolatori.");

// 3. Richieste esplicite della routine (decisioni che spettano al titolare)
for (const r of json("azioni_utente.json", [])) if (!r.risolta) azione(`decisione-${r.id}`, r.titolo, r.cosa, r.passi || [], r.tempo || "da valutare", r.seNo || "La modifica resta in sospeso.");

// 4. Dati periodici ancora mancanti dopo 30 giorni (gli automatismi non sono riusciti a inserirli)
for (const s of json("scadenze_storico.json", [])) if (giorniDa(s.dal) >= 30) azione(`dato-${s.id}`,
  `un dato periodico è in ritardo da ${giorniDa(s.dal)} giorni: ${s.msg}`,
  `Il sistema rileva dal ${it(s.dal)} che manca un aggiornamento atteso (${s.msg}) e né gli aggiornamenti automatici né la routine settimanale l'hanno inserito. I calcolatori interessati (${s.calc.join(", ")}) mostrano un avviso agli utenti.`,
  ["Apri una sessione di Claude e scrivi: «dato in ritardo: " + s.msg + ", intervieni»."],
  "2 minuti", "Gli utenti continuano a vedere l'avviso e il valore dell'anno precedente.");

// 5. Rinnovo del dominio (spesa: la fa il titolare)
if (cfg.dominioScadenza) { const g = -giorniDa(cfg.dominioScadenza); if (g <= 30) azione("rinnovo-dominio",
  g >= 0 ? `rinnova il dominio calcoliforensi.it entro ${g} giorni` : `il dominio calcoliforensi.it è scaduto da ${-g} giorni`,
  `Il dominio calcoliforensi.it scade il ${it(cfg.dominioScadenza)}. Il rinnovo comporta una spesa e va fatto da te sul pannello del registrar.`,
  ["Apri https://hpanel.hostinger.com e accedi.", "Menu Domini → calcoliforensi.it → Rinnova (1 anno, circa 10 €).", "Paga e, se chiede di confermare i dati del registrante, conferma.", "Nient'altro: al rinnovo Claude aggiorna la data di scadenza e chiude questa segnalazione."],
  "5 minuti", "Alla scadenza il sito smette di essere raggiungibile all'indirizzo calcoliforensi.it."); }

// ---------------------------------------------------------------------------------------------------
const corpo = a => [`**Cosa è successo**\n\n${a.cosa}`, `**Cosa devi fare** (tempo stimato: ${a.tempo})\n\n${a.passi.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
  `**Se non fai nulla**\n\n${a.seNo}`, `---\n<sub>Segnalazione automatica di calcoliforensi.it — chiave \`${a.chiave}\`. Si chiude da sola quando la condizione è risolta.</sub>`].join("\n\n");

(async () => {
  console.log(azioni.length ? `Azioni per il titolare: ${azioni.length}` : "Azioni per il titolare: nessuna");
  for (const a of azioni) console.log(`  - [${a.chiave}] ${a.titolo}`);
  if (!process.argv.includes("--sincronizza")) process.exit(0);
  const T = process.env.GITHUB_TOKEN; if (!T) { console.error("manca GITHUB_TOKEN"); process.exit(1); }
  const api = async (m, u, b) => { const r = await fetch(`https://api.github.com/repos/${REPO}${u}`, { method: m, headers: { Authorization: `Bearer ${T}`, Accept: "application/vnd.github+json", "User-Agent": "calcoliforensi-monitor" }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok && r.status !== 422) throw new Error(`${m} ${u}: HTTP ${r.status}`); return r.status === 204 ? null : r.json(); };
  await api("POST", "/labels", { name: ETICHETTA, color: "d73a4a", description: "Serve un intervento del titolare" }).catch(() => {});
  const aperte = await api("GET", `/issues?state=open&labels=${ETICHETTA}&per_page=100`);
  const chiaveDi = i => ((i.body || "").match(/chiave `([^`]+)`/) || [])[1];
  for (const a of azioni) {
    if (aperte.some(i => chiaveDi(i) === a.chiave)) continue;
    const n = await api("POST", "/issues", { title: `🔴 Azione richiesta: ${a.titolo}`, body: corpo(a), labels: [ETICHETTA], assignees: [TITOLARE] });
    console.log(`  aperta #${n.number}: ${a.titolo}`);
  }
  for (const i of aperte) {
    if (azioni.some(a => a.chiave === chiaveDi(i))) continue;
    await api("POST", `/issues/${i.number}/comments`, { body: `Risolto: la condizione non si presenta più (verifica automatica del ${it(oggi.toISOString().slice(0, 10))}). Chiudo.` });
    await api("PATCH", `/issues/${i.number}`, { state: "closed" });
    console.log(`  chiusa #${i.number}`);
  }
})().catch(e => { console.error("ERRORE check_azioni:", e.message); process.exit(1); });
