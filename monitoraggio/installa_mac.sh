#!/bin/bash
# Installa sul Mac il controllo quotidiano Cassazione alle 12:00 (una sola volta: bash monitoraggio/installa_mac.sh).
# Se a mezzogiorno il Mac dorme, launchd esegue il controllo al risveglio; se è spento, salta quel giorno.
DIR="$(cd "$(dirname "$0")" && pwd)"
ETICHETTA="it.calcoliforensi.cassazione"
PLIST="$HOME/Library/LaunchAgents/$ETICHETTA.plist"
chmod +x "$DIR/cassazione_locale.sh"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETICHETTA</string>
  <key>ProgramArguments</key><array><string>$DIR/cassazione_locale.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/calcoliforensi-cassazione.log</string>
  <key>StandardErrorPath</key><string>/tmp/calcoliforensi-cassazione.log</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/$ETICHETTA" 2>/dev/null
launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "Controllo Cassazione installato: ogni giorno alle 12:00."
