# Chrome installieren und aktualisieren

## Installation

1. Die Chrome-ZIP aus den GitHub Releases herunterladen und vollständig entpacken.
2. Den Ordner dauerhaft aufbewahren. `manifest.json` muss direkt im ausgewählten Erweiterungsordner liegen.
3. In Chrome `chrome://extensions` öffnen, **Entwicklermodus** aktivieren und **Entpackte Erweiterung laden** wählen.
4. Den Erweiterungsordner auswählen und LinkDock über das Puzzle-Symbol anheften.
5. LinkDock öffnen → **Server verbinden**.
6. Die eigene vollständige Serveradresse und den Zugangsschlüssel eingeben. Das Adressfeld ist absichtlich leer; `https://linkdock.example.com` ist nur ein Platzhalter.
7. Den angefragten Zugriff auf die eigene Serveradresse erlauben.

Auf dem Windows-PC sind für die fertige ZIP weder Node.js noch npm nötig. Der Server muss vom PC aus erreichbar sein.

## Bestehende Installation aktualisieren

Neue Dateien in den **bisherigen** Erweiterungsordner kopieren und ersetzen. Unter `chrome://extensions` bei LinkDock **Neu laden** drücken. Nicht deinstallieren und keine zweite Kopie aus einem anderen Ordner laden: So bleiben Einstellungen, Zuordnungen und noch nicht übertragene Änderungen erhalten.

Die bereinigte Projektversion enthält keine vorgegebenen Serverhosts. Eine bereits gespeicherte Adresse bleibt erhalten. Falls Chrome nach dem Update fehlenden Zugriff meldet, in den Einstellungen erneut **Speichern & verbinden** wählen und die Host-Berechtigung erlauben. Der gespeicherte Schlüssel kann durch ein leeres Schlüsselfeld beibehalten werden.

## Erste Verbindung und tägliche Verwendung

Die erste Verbindung führt Serversammlung und vorhandene Chrome-Leiste zusammen. Gleiche Einträge im gleichen Ordner werden anhand von Typ, Name und normalisierter URL zugeordnet. Bewusst mehrfach vorhandene Einträge bleiben erhalten. Vor Änderungen erstellt LinkDock eine lokale Sicherung.

Nachher verwendet LinkDock stabile IDs: Umbenennen und Verschieben erzeugen keinen neuen Favoriten. Änderungen direkt in der Leiste und im LinkDock-Menü werden abgeglichen. **Löschungen werden ebenfalls auf die anderen Geräte übertragen.**

- **Diese Seite speichern** übernimmt die geöffnete Webseite.
- **+** legt einen Ordner oder manuell eingegebenen Link an.
- **⋯** enthält Bearbeiten, Sortieren und Löschen.
- Löschen öffnet einen eigenen Dialog im Menü. Ordner zeigen dabei die Zahl enthaltener Einträge.
- Gelbe Ordnersymbole unterscheiden Ordner von Links. Für Links werden Chromes Favicons verwendet, ansonsten ein neutrales Websymbol.
- Unter Darstellung gibt es Dunkel, Hell und System.

## Test nach einem Update

Einen Testordner in der Chrome-Leiste anlegen, einen Weblink darin speichern und in LinkDock prüfen. Den Link im Menü umbenennen und danach den Testordner löschen. Die Leiste muss beide Änderungen übernehmen; nach Abgleich muss Safari denselben Stand zeigen.

## Einschränkungen

Nur die komplette normale Leiste wird synchronisiert. „Andere Lesezeichen“, mobile und verwaltete Einträge bleiben außerhalb des Abgleichs. Nicht-HTTP(S)-Links bleiben in Chrome erhalten. Ein Ordner mit solchen Links wird nicht rekursiv gelöscht; LinkDock pausiert stattdessen.

Meldet Chrome mehrere mögliche Lesezeichenleisten, hält die Erweiterung an. Eine Auswahl zwischen mehreren Konto- und lokalen Leisten ist noch nicht implementiert. Die Grenzen sind 5000 Einträge und 1 MiB pro Sammlung.

Bei Konflikten oder unterbrochenen Übertragungen die Hinweise in den Einstellungen lesen und zuerst eine Sicherung exportieren. Siehe [Betrieb](operations.md).
