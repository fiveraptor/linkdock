# Betrieb, Backups und Fehlerbehebung

## Updates

- Erweiterungen: Dateien im bisherigen Installationsordner ersetzen; Chrome/Safari neu laden oder das bestehende Safari-Xcode-Projekt erneut bauen. Keine parallele zweite Chrome-Installation erzeugen.
- Server: SQLite sichern, neue Dateien installieren, Konfiguration beibehalten und Dienst neu starten. `install.sh` kann erneut ausgeführt werden; es erzeugt keinen neuen Schlüssel, wenn die Konfiguration bereits existiert.
- Nach jedem Update mit einem Testordner Erstellung, Umbenennen und Löschen zwischen beiden Browsern prüfen.

## Datenbank sichern

Eine laufende SQLite-Datenbank im WAL-Modus nicht allein durch Kopieren der Hauptdatei sichern. Als root einen konsistenten Export erstellen:

```bash
install -d -m 700 /var/backups/linkdock
sqlite3 /var/lib/linkdock/linkdock.sqlite ".backup '/var/backups/linkdock/linkdock.sqlite'"
chmod 600 /var/backups/linkdock/linkdock.sqlite
sqlite3 /var/backups/linkdock/linkdock.sqlite 'PRAGMA integrity_check;'
```

Bei abweichendem Datenbankpfad entsprechend anpassen. Das Ergebnis sollte `ok` sein. Die Sicherung anschließend außerhalb des Containers aufbewahren. Zusätzlich `/etc/linkdock.env` sicher sichern. Beides enthält persönliche Daten und gehört niemals nach GitHub. Ein automatischer Backupplan ist noch nicht Bestandteil des Projekts.

## Wiederherstellung

Zunächst die Erweiterungen auf allen Geräten deaktivieren, damit keine Offline-Änderungen sofort wieder übertragen werden. Lokale Sammlungen vorher exportieren. Den Serverdienst stoppen.

Eine geprüfte Sicherung unter einem neuen Dateinamen im Datenverzeichnis ablegen, z. B. `restored.sqlite`, Eigentümer `linkdock:linkdock` und Modus `600`. In `/etc/linkdock.env` den Datenbankpfad auf diese Datei ändern und den Dienst starten. Dadurch bleibt die ursprüngliche Datenbank für eine Rückkehr erhalten; deren WAL-Dateien werden nicht mit der Sicherung vermischt.

Mit einem frischen Testprofil zuerst den Serverstand prüfen. Bestehende Profile besitzen lokale Ausgangskopien und können nicht übertragene Änderungen erneut einspielen. Diese Profile einzeln und bewusst wieder verbinden. Eine automatische Wiederherstellung aller Browserprofile aus einem Serverbackup ist nicht implementiert.

## Lokale Sicherungen und Konflikte

Die Einstellungen bieten einen JSON-Export der lokalen Sammlung. Chrome speichert zusätzlich den Stand vor der ersten Verknüpfung, exportierbar als HTML, und Zwischenstände vor unterbrochenen Schreibvorgängen. Ein HTML-Import in Chrome fügt Einträge hinzu und ersetzt nicht automatisch die gesamte Leiste.

Bei einem Konflikt zwischen Server und lokaler Sammlung entscheidet die vorhandene Oberfläche über **die gesamte Sammlung**, nicht einzelne Felder. Vor der Wahl exportieren. „Serverstand übernehmen“ verwirft noch nicht übertragene lokale Änderungen; „Server durch lokale Sammlung ersetzen“ kann nur auf dem Server vorhandene Änderungen verwerfen.

Bei einem unterbrochenen Chrome-Schreibvorgang zuerst die Sicherung exportieren. Danach „Chrome-Leiste übernehmen“ oder „LinkDock in Chrome übernehmen“ entsprechend dem gewünschten Stand wählen. LinkDock verhindert damit, dass eine halbfertige Übertragung automatisch als bewusste Löschung behandelt wird.

## Häufige Fehler

| Meldung / Verhalten | Prüfen |
|---|---|
| Server nicht erreichbar | `/health`, DNS, Port, Proxy, TLS und Browser-Hostfreigabe |
| Zugangsschlüssel ungültig | Gleicher Schlüssel in Serverkonfiguration und Erweiterung; kein Präfix `LINKDOCK_TOKEN=` mitkopiert |
| Nach Update fehlen Hostrechte | Einstellungen erneut speichern und Serverhost erlauben |
| Leiste mit mehreren Kontoablagen | Derzeit nur eine eindeutig erkennbare Chrome-Leiste unterstützt |
| Ordner lässt sich nicht entfernen | Nicht unterstützte oder neu hinzugekommene Einträge darin; keine rekursive Zwangslöschung |
| Safari-Erweiterung nach Neustart weg | Temporäre Installation oder zurückgesetzte Freigabe unsignierter Erweiterungen |
| Speziallink fehlt in LinkDock | Nur HTTP(S)-Links werden synchronisiert |

Logs und Fehlertexte nur ohne Schlüssel, lokale Adressen und private Favoriten veröffentlichen.
