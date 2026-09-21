// Verifica che il sito pubblicato risponda e contenga l'app. Uso: node app/scripts/check_site.js  → exit 0 ok, 1 errore
(async () => {
  try {
    const r = await fetch("https://calcoliforensi.it/", { redirect: "follow", headers: { "User-Agent": "calcoliforensi.it monitor" } });
    const t = await r.text();
    const ok = r.status === 200 && t.includes("Calcoli Forensi") && t.includes("const ENGINES");
    const v = (t.match(/version: "([^"]+)"/) || [])[1];
    console.log(`sito: HTTP ${r.status}, ${t.length} byte, versione ${v || "?"} → ${ok ? "OK" : "PROBLEMA"}`);
    process.exit(ok ? 0 : 1);
  } catch (e) { console.error("sito NON raggiungibile:", e.message); process.exit(1); }
})();
