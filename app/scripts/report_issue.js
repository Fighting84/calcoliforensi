// Compone il testo della segnalazione GitHub con tutte le novità del giorno (Gazzetta, Cassazione, scadenziario, errori).
const fs = require("fs"), path = require("path");
const M = path.join(__dirname, "..", "..", "monitoraggio");
const leggi = f => { try { return JSON.parse(fs.readFileSync(path.join(M, f), "utf8")); } catch (e) { return null; } };
const log = f => { try { return fs.readFileSync(f, "utf8").trim().split("\n").pop(); } catch (e) { return ""; } };
const out = [];
out.push("Il monitoraggio automatico di calcoliforensi.it ha rilevato elementi che richiedono un esame. La routine settimanale li prende in carico; questa email è per conoscenza.\n");

const scad = leggi("scadenze.json");
if (scad) { out.push("## Dati periodici in ritardo"); for (const x of scad) out.push(`- **${x.msg}** — calcolatori: ${x.calc.join(", ")}`); out.push(""); }

const gu = leggi("novita.json");
if (gu) { out.push("## Gazzetta Ufficiale"); for (const x of gu) out.push(`- **${x.tema}** (calcolatore \`${x.calcolatore}\`) — GU Serie Generale n. ${x.gazzetta} del ${x.data.split("-").reverse().join("/")}\n  > ${x.contesto.slice(0, 400)}\n  ${x.url}`); out.push(""); }

const cass = leggi("novita_cass.json");
if (cass) { out.push("## Cassazione"); for (const x of cass) out.push(`- **${x.estremi}** — ${x.materia} (tema: ${x.tema}, calcolatore \`${x.calcolatore}\`)\n  > ${(x.estratto || "").slice(0, 400)}`); out.push(""); }

const norme = leggi("norme_novita.json");
if (norme) { out.push("## Norme sentinella variate (testo vigente su Normattiva)"); for (const x of norme) out.push(x.errore ? `- **${x.id}**: ${x.errore}` : `- **${x.id}**${x.abrogato ? " — ABROGAZIONE" : ""} (calcolatori: ${x.calc.join(", ")}) ${x.url}\n  > prima: ${x.prima.slice(0, 500)}\n  > ora: ${x.ora.slice(0, 500)}`); out.push(""); }

const cod = leggi("codici.json");
if (cod) { out.push("## Codici tributo del ravvedimento da sostituire"); for (const x of cod) out.push(`- **${x.codice}**: ${x.esito}${x.dal ? " dal " + x.dal : ""} ${x.descrizione || ""} — cercare la risoluzione dell'Agenzia che lo sostituisce e aggiornare \`RAVV_TRIBUTI\``); out.push(""); }

const errori = ["foi.log", "bce.log", "saggio.log"].map(log).filter(l => /ERRORE|DISCORDANZA/.test(l));
if (errori.length) { out.push("## Controlli non riusciti o discordanze"); for (const e of errori) out.push(`- ${e}`); out.push(""); }

out.push("---\nRegola: nessuna modifica ai calcoli viene pubblicata senza lettura della fonte e test superati.");
console.log(out.join("\n"));
