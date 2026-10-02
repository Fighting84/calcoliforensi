// Verifica che il servizio dei cambi della Banca d'Italia, usato in tempo reale dal calcolatore "cambi", risponda con
// dati validi e consenta le richieste dal sito (intestazione CORS). Uso: node app/scripts/check_cambi.js → exit 0 ok, 1 problema
(async () => {
  try {
    const r = await fetch("https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/latestRates?lang=it", { headers: { Accept: "application/json", Origin: "https://calcoliforensi.it" } });
    const cors = r.headers.get("access-control-allow-origin"), j = await r.json();
    const usd = (j.latestRates || j.rates || []).find(x => x.isoCode === "USD"), val = usd && +(usd.eurRate || usd.avgRate);
    if (!r.ok || !usd || !(val > 0)) throw new Error(`risposta non valida (HTTP ${r.status})`);
    if (cors !== "*" && cors !== "https://calcoliforensi.it") throw new Error(`il servizio non consente più le richieste dal sito (CORS: ${cors})`);
    console.log(`Cambi Banca d'Italia: servizio attivo (USD ${val} del ${usd.referenceDate})`);
  } catch (e) { console.log("ERRORE check_cambi: " + e.message); process.exit(1); }
})();
