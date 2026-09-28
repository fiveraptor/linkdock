# Server auf Debian / im LXC

LinkDock benötigt Node.js ab 20 und das SQLite-Kommandozeilenprogramm. Für wenige Geräte reicht ein kleiner Debian-Container; ein separater Datenbankserver ist nicht erforderlich.

## Installation

Server-ZIP aus den Releases entpacken. Als root im Container, im entpackten Serverordner:

```bash
bash install.sh
```

Bei einem Repository-Checkout stattdessen `bash server/install.sh` ausführen.

Das Skript installiert Debian-Pakete, legt den Benutzer `linkdock` und die Verzeichnisse an und richtet systemd ein. Es kopiert Programm und Unit, erzeugt beim ersten Lauf einen zufälligen Zugangsschlüssel und startet den Dienst. Bei Wiederholung bleiben Konfiguration und Datenbank erhalten.

| Pfad | Inhalt |
|---|---|
| `/opt/linkdock/server.cjs` | Serverprogramm |
| `/etc/linkdock.env` | Lokale Konfiguration und geheimer Schlüssel |
| `/var/lib/linkdock/linkdock.sqlite` | Favoritensammlung |
| `/etc/systemd/system/linkdock.service` | systemd-Dienst |

Die Datei `.env.example` ist nur eine Vorlage und enthält keinen funktionsfähigen Schlüssel.

## Prüfen

```bash
systemctl status linkdock --no-pager
curl --fail http://localhost:3000/health
```

Erwartete Antwort: `{"ok":true,"service":"LinkDock","version":"0.1.0"}`. Die API-Version bleibt mit den bisher verwendeten Erweiterungen kompatibel.

Logs:

```bash
journalctl -u linkdock -n 50 --no-pager
```

Den Schlüssel ausschließlich lokal mit `cat /etc/linkdock.env` anzeigen und in den Erweiterungen eintragen. Nicht in Issues, Screenshots, Git oder öffentliche Nachrichten übernehmen.

## Konfiguration

| Variable | Bedeutung |
|---|---|
| `LINKDOCK_TOKEN` | 64 zufällige Hex-Zeichen; vom Installer erzeugt |
| `HOST` | Bind-Adresse; standardmäßig alle IPv4-Schnittstellen |
| `PORT` | Standard: `3000` |
| `LINKDOCK_DB` | Absoluter Pfad der SQLite-Datei |
| `SQLITE_BIN` | Optional: Pfad zum SQLite-Kommandozeilenprogramm |

Nach Änderungen `systemctl restart linkdock` ausführen. Die Konfigurationsdatei bleibt root vorbehalten; systemd übergibt die Werte an den Dienst. Der Dienst läuft als Benutzer `linkdock` und kann nur sein Datenverzeichnis beschreiben. Weitere Datenbankpfade benötigen gegebenenfalls eine passende Anpassung von `ReadWritePaths` in der Unit.

## Nginx / Reverse-Proxy

Der öffentliche Einstieg soll HTTPS verwenden. Der Proxy leitet auf den internen HTTP-Port des Containers weiter. `linkdock.example.com` ist ausschließlich ein Dokumentationsplatzhalter.

Beispiel für einen **location-Block in einem bereits eingerichteten HTTPS-Serverblock**:

```nginx
location / {
    proxy_pass http://linkdock-internal:3000;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 2m;
    proxy_connect_timeout 5s;
    proxy_read_timeout 15s;
}
```

`linkdock-internal` durch den eigenen intern auflösbaren Containerhost ersetzen. TLS-Zertifikat, DNS und Firewall gehören zur jeweiligen Installation. Den Containerport nicht zusätzlich ungeschützt ins Internet veröffentlichen. HTTP ist nur für einen kontrollierten lokalen Test vorgesehen und überträgt auch den Schlüssel unverschlüsselt.

Der Dienst akzeptiert selbst maximal 1 MiB JSON pro Schreibzugriff. Das etwas größere Proxy-Limit vermeidet, dass der Proxy eine zulässige Anfrage durch eigenes Overhead-Handling früher verwirft.

URL-Basispfade sind möglich, wenn der Proxy den Präfix entfernt: Die API erwartet intern weiterhin `/api/snapshot`. Die Erweiterung setzt diesen Pfad an die konfigurierte Basisadresse an.

## Updates und Sicherung

Vor Änderungen eine konsistente Sicherung erstellen. Danach neue Serverdateien installieren und Dienststatus prüfen. Siehe [Betrieb](operations.md). In der Server-ZIP ist diese Anleitung enthalten; die vollständige Betriebsdokumentation liegt im GitHub-Repository.
