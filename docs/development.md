# Entwicklung und Veröffentlichung

## Voraussetzungen und Befehle

Node.js ab 20. Für Serverintegrationstests muss `sqlite3` im PATH liegen. Unter Debian sind `nodejs`, `npm` und `sqlite3` passende Pakete. Keine externen npm-Abhängigkeiten; `npm install` ist nicht erforderlich.

```bash
npm run build
npm test
npm run check:public
npm run package
```

Die Befehle lassen sich auch direkt als `node scripts/build.mjs`, `node scripts/test.mjs` usw. ausführen.

`npm test` baut die Browserordner, prüft die Veröffentlichungsregeln und führt alle Tests in eigenen Node-Prozessen aus. Die Servertests verwenden temporäre SQLite-Datenbanken. Browser-APIs und UI-DOM werden simuliert. Die Erweiterungsintegration verwendet einen simulierten HTTP-Transport; ein zusätzlicher Test startet den echten HTTP-Server und prüft Authentifizierung, Lesen, Schreiben und konkurrierende Revisionen über lokale Netzwerkaufrufe. Die Tests prüfen keine echte Safari-Signierung, Installation oder Windows-Oberfläche.

## Verzeichnisstruktur

```text
extension/shared/           Oberfläche, Validierung und Synchronisierung
extension/platform/chrome/ Chrome-API und native Lesezeichenanbindung
extension/platform/safari/ Safari-API und neutraler Adapter
server/                    Dienst, Konfigurationsvorlage und Installer
scripts/                   Build, Tests, ZIP-Pakete und Xcode-Projekt
tests/                    Automatisierte Tests (ohne Nutzerdaten)
docs/                      Installation, Betrieb und Architektur
dist/                      Generierte Dateien; nicht versioniert
local/                     Lokale Xcode-Projekte; nicht versioniert
```

Die Versionsnummer der Erweiterungen stammt aus `package.json`. `server/server.cjs` meldet unabhängig davon die kompatible API-Version. Keine Dateien direkt in `dist` bearbeiten: Der nächste Build ersetzt sie.

## Tests

- Zusammenführung unabhängiger Änderungen, gleiche und unterschiedliche Feldänderungen, Löschen gegen Bearbeiten.
- Ordnerhierarchie, Zyklen, URLs, Duplikate und Sortierung.
- Serverauthentifizierung, gleichzeitige SQL-Schreibvorgänge, Revisionen und Persistenz.
- Offline-Bearbeitung, verlorene Schreibantwort und zweites Chrome-Profil.
- Chrome-Adapter: Einfügen, Umbenennen, Verschieben, Löschung, unbekannte Kinder und Wiederaufnahme nach unterbrochenem Erstellen.
- Safari-Adapter ohne Chrome-spezifische APIs.
- Eigener Löschdialog: Abbrechen, Bestätigen, doppeltes Absenden und Fehleranzeige.
- Serveradressvalidierung und verweigerte Host-Berechtigung ohne Übertragung eines Schlüssels.

Zusätzlich prüft CI JavaScript-Syntax, Dateiverweise und erzeugte ZIP-Pakete. Vor einer Veröffentlichung die aktuellen Builds in den echten Browsern testen. Eine Benutzerbestätigung im Alltag ist wertvolle zusätzliche Evidenz, deckt aber nicht jede Kombination aus Browser, Betriebssystem und Rechtekonfiguration ab.

## Neue Version

1. Versionsnummer in `package.json` erhöhen und Changelog ergänzen.
2. `npm test` und `npm run package` ausführen.
3. ZIP-Inhalte und Änderungen auf persönliche Daten prüfen.
4. Chrome und Safari aus den neuen Paketen testen.
5. Änderungen committen und nach GitHub übertragen.
6. Eine GitHub Release mit den drei ZIP-Paketen aus `dist/releases` erstellen.

Konfigurationen, Datenbanken, Exporte, private Schlüssel und Apple-Signierdateien niemals mit `git add -f` aufnehmen. Der lokale Prüfer ist eine zusätzliche Hilfe und keine Garantie, dass jede Art von Geheimnis erkannt wird.

Das Repository enthält keine freigegebene Weiterverwendungslizenz. Eine Lizenzentscheidung trifft der Projekteigentümer separat.
