@echo off
rem Controllo quotidiano Cassazione per calcoliforensi.it (Utilita' di pianificazione di Windows)
cd /d "C:\Users\Admin\Desktop\Cowork\MONEY"
rem il server di Italgiure non invia il certificato intermedio corretto: lo forniamo noi
set NODE_EXTRA_CA_CERTS=C:\Users\Admin\Desktop\Cowork\MONEY\app\scripts\certs\italgiure-intermedio.pem
"C:\Program Files\nodejs\node.exe" app\scripts\locale_cassazione.js
