# LinkDock

Eigene Favoriten-Synchronisierung zwischen **Chrome unter Windows** und **Safari unter macOS**, mit einem selbst gehosteten Server und SQLite.

Chrome synchronisiert seine komplette Lesezeichenleiste mit allen Unterordnern. Safari verwendet ein eigenes LinkDock-Menü für dieselbe Sammlung. Änderungen werden in beide Richtungen übertragen.

- Links und Ordner erstellen, bearbeiten, verschieben, sortieren und löschen.
- Eigener Löschdialog in **beiden Browsern**.
- Dark Mode als Standard, alternativ Hell oder System.
- Favicons in Chrome; neutrale Link-Symbole in Safari.
- Offline-Speicherung und anschließender Abgleich.
- Versionsprüfung und Zusammenführung unabhängiger Änderungen; sichtbare Konflikte statt stiller Überschreibung.
- Freies Serveradressfeld mit gezielter Freigabe des jeweiligen Hosts.

## Installation

Die fertigen ZIP-Pakete stehen unter [Releases](https://github.com/fiveraptor/linkdock/releases). Keine Zugangsdaten, persönlichen Serveradressen, Lesezeichen oder Datenbanken sind enthalten.

1. [Server auf Debian installieren](docs/server.md).
2. [Chrome installieren oder aktualisieren](docs/chrome.md).
3. [Safari auf macOS installieren](docs/safari.md).
4. In beiden Erweiterungen denselben Server und den lokal erzeugten Zugangsschlüssel eintragen.

Ein bereits eingerichteter Server mit API-Version 0.1.0 bleibt kompatibel. Die Projektversion beschreibt das Gesamtpaket, nicht eine Änderung des Synchronisierungsprotokolls.

## Aus dem Quellcode bauen

Voraussetzungen: Node.js ab 20; für Server und Tests zusätzlich das SQLite-Kommandozeilenprogramm. Die JavaScript-Seite hat keine externen npm-Abhängigkeiten.

```bash
npm run build
npm test
npm run package
```

Die Browserordner entstehen in `dist/chrome` und `dist/safari`, die ZIP-Dateien in `dist/releases`. `dist` ist bewusst nicht in Git enthalten.

## Dokumentation

| Thema | Anleitung |
|---|---|
| Debian/LXC, Konfiguration und Reverse-Proxy | [Server](docs/server.md) |
| Bestehende Chrome-Erweiterung aktualisieren | [Chrome](docs/chrome.md) |
| Temporärer Safari-Test, Xcode und Signierung | [Safari](docs/safari.md) |
| Updates, Sicherung und Wiederherstellung | [Betrieb](docs/operations.md) |
| API, Zusammenführung und Ordnerzuordnung | [Architektur](docs/architecture.md) |
| Entwickeln, Tests und Pakete | [Entwicklung](docs/development.md) |
| Zugangsdaten und Veröffentlichungsprüfung | [Sicherheit](SECURITY.md) |
| Änderungen | [Changelog](CHANGELOG.md) |

## Grenzen

LinkDock verwaltet aktuell eine gemeinsame Sammlung mit einem gemeinsamen Zugangsschlüssel. Es gibt keine Benutzerverwaltung, keine verschlüsselte Speicherung der Datenbank und keine automatische Versionshistorie auf dem Server.

Unterstützt werden HTTP(S)-Lesezeichen. Spezielle Chrome-Links und Bookmarklets bleiben lokal. „Andere Lesezeichen“ und mobile Lesezeichen gehören nicht zur synchronisierten Chrome-Leiste. Safari verändert seine eingebauten Lesezeichen nicht.

Die Safari-ZIP ist eine Web-Erweiterung für lokale Tests und enthält ein Xcode-Projektskript. Sie ist **keine signierte oder notarisierte Mac-App**. Apples temporärer Installationsmodus und die Freigabe unsignierter Erweiterungen haben Einschränkungen; siehe Safari-Anleitung.

Die Kernfunktionen wurden in Chrome und Safari manuell erprobt. Die automatisierten Tests simulieren Browser-APIs und verwenden für Serverintegration eine echte SQLite-Datenbank. Sie ersetzen keine vollständigen Browser- oder Signierungstests.

Eine Lizenz für die Weiterverwendung wurde noch nicht festgelegt (`UNLICENSED`).
