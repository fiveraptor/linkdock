# Safari auf macOS

Die Safari-Variante zeigt dieselbe Sammlung im eigenen LinkDock-Menü. Die eingebauten Safari-Lesezeichen bleiben unverändert. Oberfläche und Synchronisierung entsprechen Chrome; Link-Symbole sind hier zunächst neutral, da Chromes Favicon-Schnittstelle fehlt.

Für die Oberfläche wird Safari 17 oder neuer benötigt. Der direkte temporäre Installationsweg steht erst in neueren Safari-Versionen zur Verfügung.

## Temporäre Testinstallation

1. Safari-ZIP entpacken.
2. Safari → **Einstellungen → Erweitert → Funktionen für Webentwickler anzeigen** aktivieren.
3. Unter **Entwickler → Temporäre Erweiterung hinzufügen** den enthaltenen Ordner `extension` auswählen. Bei einem eigenen Build aus dem Repository stattdessen `dist/safari` auswählen.
4. Falls Safari die Freigabe einer unsignierten Erweiterung verlangt, ist dies der Entwicklungsmodus für die selbst gebaute Testversion.
5. Unter **Erweiterungen** LinkDock aktivieren, gegebenenfalls dem gewünschten Safari-Profil zuordnen.
6. LinkDock öffnen und Serveradresse sowie denselben Zugangsschlüssel wie in Chrome eintragen. Zugriff auf den Server erlauben.

Safari entfernt temporäre Erweiterungen beim Beenden oder nach spätestens 24 Stunden. Vorher offene Änderungen synchronisieren; nicht auf den Erhalt unsynchronisierter Daten nach Neuinstallation verlassen. Fehlt der Menüpunkt, den Xcode-Weg verwenden. [Apple: Safari-Erweiterungen ausführen](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)

## Mit Xcode als Mac-App verpacken

Vollständiges Xcode aus dem Mac App Store installieren und dessen Ersteinrichtung einschließlich Lizenzprüfung selbst abschließen. Die Command Line Tools allein reichen nicht.

Im entpackten Safari-Paket:

```bash
bash Xcode-Projekt-erstellen.command
```

Alternativ im Repository:

```bash
npm run build
bash scripts/safari-project.sh
```

Das Skript erkennt Apples aktuellen Packager oder den früheren Converter, legt ein macOS-Projekt an und öffnet Xcode. Im Repository liegt es unter `local/Xcode`, im Releasepaket unter `Xcode`. Bestehende Projekte werden nicht überschrieben.

Als neutrales Bundle-Kennzeichen wird `org.example.linkdock` verwendet. Für eine eigene signierte App vor dem ersten Erstellen beispielsweise `LINKDOCK_BUNDLE_ID` auf das eigene Kennzeichen setzen. Keine Team-IDs oder Signierdateien ins Repository legen.

In Xcode das Schema **LinkDock**, Ziel **My Mac** und die passende Signierung für App und Extension wählen. Mit **Product → Run** bauen und die umschließende App einmal starten. Danach LinkDock in Safari aktivieren. [Apple: Erweiterung verpacken](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)

Ohne Zertifikat ist lokale Entwicklung mit Apples Freigabe unsignierter Erweiterungen möglich. Diese Freigabe wird beim Beenden von Safari zurückgesetzt. Eine reguläre Verteilung erfordert passende Signierung; außerhalb des App Store zusätzlich Developer ID und Notarisierung. Dieses Projekt liefert keine fertig signierte App. [Apple: Verteilung](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)

## Update

Bei temporärer Installation Dateien im vorhandenen `extension`-Ordner ersetzen und in Safari bei LinkDock **Neu laden** wählen. Bei Xcode-Installation die verknüpften Quelldateien aktualisieren und das bestehende Projekt erneut bauen. Nicht deinstallieren, solange unsynchronisierte Daten vorliegen.

## Verbindung testen

In Safari zuerst `/health` am eigenen Server öffnen. Im Menü verbinden und die vorhandenen Chrome-Favoriten prüfen. Anschließend einen Testlink in Safari speichern, in Chrome abgleichen und den Link wieder über **⋯ → Löschen** entfernen. Der eigene Löschdialog vermeidet native `window.confirm()`-Dialoge im Safari-Popup.

Bei Verbindungsproblemen die Website-Berechtigungen für LinkDock prüfen. Für den regulären Betrieb HTTPS nutzen. Hintergrundalarme können von Safari verzögert werden; zusätzlich wird beim Öffnen abgeglichen.
