#!/bin/bash
set -euo pipefail
LINKDOCK_SOURCE="$(cd "$(dirname "$0")" && pwd)"
if [ "$(id -u)" -ne 0 ]; then
  echo 'Bitte als root im Debian-Container ausführen.' >&2
  exit 1
fi
apt-get update
apt-get install -y nodejs sqlite3 ca-certificates curl
if ! id linkdock >/dev/null 2>&1; then
  adduser --system --group --home /var/lib/linkdock --no-create-home linkdock
fi
install -d -o root -g root -m 755 /opt/linkdock
install -d -o linkdock -g linkdock -m 750 /var/lib/linkdock
install -o root -g root -m 644 "$LINKDOCK_SOURCE/server.cjs" /opt/linkdock/server.cjs
install -o root -g root -m 644 "$LINKDOCK_SOURCE/linkdock.service" /etc/systemd/system/linkdock.service
if [ ! -e /etc/linkdock.env ]; then
  (umask 077
   node -e "process.stdout.write('LINKDOCK_TOKEN=' + require('node:crypto').randomBytes(32).toString('hex') + '\nHOST=0.0.0.0\nPORT=3000\nLINKDOCK_DB=/var/lib/linkdock/linkdock.sqlite\n')" > /etc/linkdock.env
  )
fi
node --check /opt/linkdock/server.cjs
systemctl daemon-reload
systemctl enable linkdock
systemctl restart linkdock
systemctl is-active --quiet linkdock
printf '%s\n' 'LinkDock gestartet. Status: systemctl status linkdock --no-pager' 'Der Zugangsschlüssel bleibt in /etc/linkdock.env.'
