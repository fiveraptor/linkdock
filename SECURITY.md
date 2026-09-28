# Zugangsdaten und persönliche Daten

LinkDock ist für eine eigene kleine Installation mit einer gemeinsamen Sammlung gedacht. Der Bearer-Schlüssel gibt vollständigen Lese- und Schreibzugriff. Er ist kein Passwort pro Gerät; es gibt keine Rollen, Benutzerverwaltung oder gerätespezifische Widerrufsfunktion.

- Öffentlicher Zugriff nur über HTTPS; der interne Port gehört ins eigene Netz hinter den Reverse-Proxy.
- Der Installer erzeugt den Schlüssel lokal. Keine echten Schlüssel oder Datenbanken im Repository oder in Releases.
- Der Schlüssel wird lokal im Browserprofil gespeichert. Er wird nicht über Google-Sync synchronisiert. Schutz des Browserprofils und des Serverdateisystems bleibt wichtig.
- Die SQLite-Datei enthält die Favoriten unverschlüsselt. Backups und Exporte entsprechend behandeln.
- Die Erweiterung fragt Hostrechte gezielt für die konfigurierte Serveradresse an; optional mögliche Hosts sind keine pauschale Freigabe aller Websites.
- Es gibt keine Content-Skripte und keine externen Tracking-, Schrift- oder Favicon-Dienste. Safari verwendet neutrale Icons.

## Vor dem Veröffentlichen

`npm run check:public` prüft bekannte Schlüsseldateien, mögliche Tokenmuster, persönliche Dateipfade und nicht generische IPv4-Literale. `.gitignore` schließt Konfigurationen, Datenbanken, Backups und Apple-Signierdateien aus. Die Prüfung ist heuristisch: Private Domains, persönliche Lesezeichentitel oder ungewöhnliche Geheimnisse benötigen zusätzlich eine manuelle Prüfung.

Bind- und Loopback-Adressen im Programmcode sind technische Standardwerte und keine Adressen einer konkreten Installation. Dokumentationsdomains verwenden reservierte Beispielnamen.

## Falls ein Schlüssel veröffentlicht wurde

Schlüssel auf dem Server lokal neu erzeugen, Konfiguration aktualisieren und Dienst neu starten. Den neuen Wert auf den eigenen Geräten eintragen. Erst danach die Veröffentlichung und gegebenenfalls Git-Historie bereinigen. Bloßes Löschen aus dem aktuellen Dateistand widerruft einen Schlüssel nicht.

Keine geheimen Werte in öffentliche GitHub Issues kopieren. Sicherheitsprobleme ohne Zugangsdaten und ohne private Favoriten beschreiben; für sensible Details einen privaten Kanal mit dem Projekteigentümer verwenden.
