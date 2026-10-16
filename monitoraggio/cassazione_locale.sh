#!/bin/bash
# Controllo quotidiano Cassazione per calcoliforensi.it (launchd su macOS; equivalente di cassazione_locale.cmd)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
# launchd parte con un PATH minimo: aggiungiamo le cartelle dove si installano node e git
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
# il server di Italgiure non invia il certificato intermedio corretto: lo forniamo noi
export NODE_EXTRA_CA_CERTS="$ROOT/app/scripts/certs/italgiure-intermedio.pem"
node app/scripts/locale_cassazione.js
