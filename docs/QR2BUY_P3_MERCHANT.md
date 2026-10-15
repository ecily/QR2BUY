# Prototyp 3 – Merchant-Vorbereitung, 15. Oktober 2026

Operative Source of Truth: [QR2BUY_CONTEXT.md](QR2BUY_CONTEXT.md). Dieser Ablauf ist vorbereitet; produktive Registrierung und Merchant-Flash sind nicht ausgeführt.

## Aktueller Nachtrag: Provisioning-Helfer und Zugriff geprüft

Dieser Nachtrag ersetzt die untenstehenden historischen Aussagen „Helfer nicht gebaut“, „Pepperzugang nicht geprüft“ und „Konfliktfreiheit nicht geprüft“. Keine produktive Registrierung erfolgt.

- Produktive Vorprüfung: ID QR2B-000003 und erwartete MAC frei; keine P3-Credentials/Assignments/Previews. Backend weiterhin auf 502d539; identischer produktiver Auth-/Device-/Modellcode. DB-Zuordnung anhand authentifizierter Merchant-GET-Antwort bestätigt. Replica Set, Sessions und notwendige Unique-Indizes vorhanden. Device 1/2 eindeutig identifiziert, Credentials und Bindings ACTIVE; Heartbeats veraltet, nicht als aktuell online behauptet.
- **Pepper PASS:** direkter geschützter DigitalOcean-Exec-/WebSocket-Kanal funktioniert; Node im Backend bestätigt ausschließlich boolesche Angaben zu Runtime-Pepper/Format und Mongo-Konfiguration. Pepper nie aus der Runtime-Umgebung herauskopiert, nie gespeichert oder ausgegeben. Zugang über doctl API-Token nur im lokalen Prozessspeicher; keine Token-/Console-URL-Ausgabe. Read-only Console-Probe ohne Produktionsdatenmutation.
- **Eingabekanal geprüft:** `stty -echo`, Node mit `readline({ input: process.stdin, terminal: false })`, Bereitschaftsmarker abwarten, dann JSON-Zeile senden; mit harmloser Testnachricht erfolgreich und ohne Echo. Danach Prozess beendet/Terminal-Echo wiederhergestellt. Keine echten Device-Credentials in dieser Probe. Für spätere Registrierung niemals Secret als Shell-/CLI-Argument, Base64-Kommando oder Antwort senden; Base64 allein ist kein Schutz.
- **Lokaler Header PASS:** geerbte Rechte entfernt, geschützte DACL nur aktueller Benutzer/SYSTEM/Administratoren. Inhalt und WLAN-Platzhalter unverändert. Neue Datei oder atomarer Dateiaustausch muss dieselbe DACL erneut setzen/prüfen; Git erhält diese Windows-ACL nicht. P1/P2-Dateien unverändert.

### Interner Helfervertrag

`backend/src/merchant/provisionPrototype3.js` exportiert ausschließlich `provisionPrototype3`; kein Router, automatischer Aufruf oder Endnutzerzugang. Der Helfer ist nur lokal committed und noch nicht im produktiven Dateisystem vorhanden. Für den genehmigten Einmallauf muss genau die geprüfte Quelle im bestehenden geschützten Backend-Kontext bereitgestellt werden; kein Backenddeployment erforderlich, kein automatischer Upload/Exec in dieser Vorbereitung.

Eingaben: verbundener nativer MongoClient, vorab verifizierter dbName, sicher vorgemerkter eigener 32-Byte-Hex-Token, confirmDeviceId=QR2B-000003, observedMac=f4:2d:c9:6b:c2:90. Pepper standardmäßig nur aus Runtime-ENV. Außerhalb eigener qr2buy_test_<hex>-DBs zwingend allowProduction=true; im echten Lauf zusätzlich production=true setzen. Diese interne Funktionsfreigabe ersetzt keine Nutzerfreigabe. Keine Tokens für P1/P2 wiederverwenden; deren aktuelle Verifier werden nur lesend auf Wiederverwendung geprüft.

Der Helfer prüft bestehende Unique-Indizes ohne Indexanlage. Innerhalb einer Snapshot-/Majority-Transaktion prüft er feste ID und MAC (auch Großschreibungsaltwerte), Credentials und jede vorhandene P3-Zuordnung. Er schreibt ausschließlich zwei neue Dokumente in managed_devices/device_credentials. Devicewerte entsprechen dem bestehenden Modell: PROVISIONED, CS5, Schild 3, bindingRevision=0, kein Heartbeat/Aktivierungsdatum, firmwareVersionExpected=0.3.11. MACs werden kanonisch kleingeschrieben; bestehende Modellschreibpfade normalisieren ebenfalls. Keine Updates, Upserts, Rotation, Löschung oder neue Merchant-/Location-/Produkt-/Offer-Daten.

Rückgabe ausschließlich PROVISIONED oder ALREADY_PROVISIONED plus öffentliche Geräte-ID. Letzteres nur bei exakt passendem neutralem Device/Credential und gleichem Verifier, ohne Zuordnungen; andernfalls harter Konflikt. Bei p3_outcome_uncertain oder p3_registration_unconfirmed denselben vorgemerkten Token sichern, **nicht flashen** und keinen neuen Token erzeugen. Nach Verbindungsklärung denselben Helfer mit demselben Token wiederholen: vorhandener passender Datensatz → No-op; kein Datensatz → atomare Anlage; Teilzustand/fremder Token → STOP. Fehlercodes sind sanitisiert, Rohfehler/Cause/Secret/Verifier werden nicht zurückgegeben.

### Tokenübergabe und Freigabegrenze

Vor dem späteren DB-Schreibaufruf einmalig einen neuen unabhängigen Token lokal unter der geprüften ACL vormerken; noch nicht als registriert/flashbereit kennzeichnen. Bestehenden Buildtoken nicht versehentlich mit einem neuen Retrytoken verwechseln. Nur der Token geht über den geschützten echo-freien Eingabekanal; der Pepper bleibt unverändert im Backendprozess. Nach bestätigtem Erfolg Verifierzuordnung/neutralen Zustand lesen und lokale Headerzuordnung kontrollieren. Bei Antwortverlust bleibt genau dieses lokale Token erhalten. Ohne eindeutig gesicherte lokale Datei keine Registrierung beginnen. Kein automatischer Dateiaustausch oder Tokenverlust nach DB-Commit.

Tests: neue Provisioning-Suite 13/13 inklusive Parent; final vollständiges Backend 273/273, Firmware 30/30. Positive Registrierung/Auth, ID/MAC/Orphans/Assignments, Fehler am zweiten Insert und Rollback nach beiden Inserts, identischer Retry, anderer Token, verlorene Commitbestätigung, unklar ohne Commit, parallele Kandidaten, Secret-Isolation/P1-P2-Wiederverwendung und Index-/Freigabegates geprüft. Nur eigene Loopback-DBs; kein Laden produktiver .env. Keine Firmwareänderung seit den drei erfolgreichen Merchant-Builds.

**Technisches GO für einen gesondert freizugebenden kontrollierten Registrierungslauf.** Gesamtworkflow noch nicht produktiv ausgeführt. Ziel/ID/MAC und geschützte Quelle/Tokenablage unmittelbar vorher erneut prüfen. WLAN bleibt offen, keine Flashfreigabe. Keine produktive Mutation, kein Push/Merge/Deployment in dieser Vorbereitung.

## Hardware und Build

- Nutzerabnahme: ESP32-D0WD-V3 Rev. 3.1, MAC `f4:2d:c9:6b:c2:90`; KMRTM28028-SPI, ILI9341, 240×320, Landscape Rotation 1.
- VCC und LED jeweils 3V3, GND gemeinsam, SCK18/MOSI23/DC15/RST4/CS5; MISO/Touch offen. Diese acht Verbindungen sind am P3 physisch bestätigt. Keine allgemeine elektrische Zusage für andere Module.
- Isolierter Farb-/Texttest unter `firmware/prototype3_display_test` wurde auf COM3 hashverifiziert geflasht und vom Nutzer physisch abgenommen. Dieser bisher unversionierte Test wird mit diesem Arbeitsstand gesichert.
- Neuer Merchant-Build: `esp32dev_spi_cs5_rst4_device3_merchant_app`; gemeinsame App, TFT-Setup von P1, Device-Profil 3 → `secrets.device3.h` → `QR2B-000003`.
- Profile 1/2 verwenden unverändert ihre getrennten Header; die Auswahl hängt jetzt ausdrücklich vom Profil ab, nicht von CS/NOCS. Compile-Time-Prüfungen sperren fremde IDs/unbekannte Profile. Keine Renderer-/Transportänderung; Wire-Version bleibt 0.3.11.
- Der lokale P3-Header enthält nur einen unabhängigen **unprovisionierten Buildtoken und WLAN-Platzhalter**. Das erzeugte Binary ist kein freigegebenes Flashartefakt. Beispielheader enthält ausschließlich Platzhalter. Ignore-Regeln schützen auch weitere nummerierte Geräteheader.

Lokaler Build aus `firmware/qr_display_fw`:

```powershell
& 'C:\Users\Nutzer\.platformio\penv\Scripts\platformio.exe' run -e esp32dev_spi_cs5_rst4_device3_merchant_app
```

Platform espressif32 7.0.1, Arduino/esp32dev, TFT_eSPI 2.5.43, ArduinoJson 7.4.3, bestehende QRCode-Gitabhängigkeit; SPI 4 MHz. Vorhandene lokale Libraries für P3 bytegleich aus dem ignorierten P1-libdeps übernommen, keine TLS-Abschwächung oder Dependencyänderung. QRCode bleibt historisch ungepinnt.

## Sichere neutrale Registrierung – noch freizugeben

Der Backendvertrag ist bereits geräteunabhängig: ManagedDevice, separates HMAC-SHA-256-Credential mit Pepper, `/api/device/config`. PROVISIONED ohne Assignment darf authentifiziert pollen und erhält assigned=false. Binding verlangt später ACTIVE und eine gültige Händler-/Standortzuordnung. MAC ist eindeutige Hardware-UID, kein Secret; die Device-API prüft Credentials, nicht die MAC des angeschlossenen Boards.

Vor jeder produktiven Mutation separat:

1. Zielsystem/Zieldatenbank und Zugriffsberechtigung zweifelsfrei rein lesend bestätigen, ohne DemoSession oder künstlichen Geräteheartbeat. Keine lokalen ENV-/Secretwerte ausgeben. Kein produktiver Modellimport mit automatischer Indexanlage.
2. Nach deviceId `QR2B-000003` und unabhängig nach hardwareUid `f4:2d:c9:6b:c2:90` suchen; keine bestehende Identität überschreiben. Bei beliebigem Konflikt stoppen und Ursache klären. Gegen Device 1/2 darf nicht rotiert oder neu provisioniert werden. Aktuellen Board-MAC-Nachweis unmittelbar vor Flash mit dieser UID vergleichen.
3. Bestehenden Backend-Pepper sicher verfügbar bestätigen, nicht ersetzen. Bestehende Device-1/2- und Assignment-/Geschäftsdaten für den Nachhervergleich rein lesend sichern, ohne Klartextsecrets.
4. Nach ausdrücklicher Registrierungsfreigabe genau ein neues ManagedDevice (PROVISIONED, CS5, Name Schild 3, feste MAC) und ein eigenes Credential Version 1 anlegen. Kein MerchantAssignment/DisplayAssignment/Preview, keine Produkte/Offers. Zufällige 32 Byte; Verifier nach bestehendem `credentialVerifier`-Vertrag, Klartext nur in geschütztem lokalen P3-Header.
5. Für diesen Einmalvorgang Device- und Credentialanlage gemeinsam transaktional und gegen konkurrierende ID-/MAC-Konflikte absichern. Der vorhandene `rotate`-Service ist kein atomarer Neugeräte-Provisioner: er setzt ein bereits existierendes Device voraus und könnte vorhandene Credentials rotieren. Keinen unkontrollierten Aufruf und keinen allgemeinen Demo-Seed verwenden. Ein produktiver Ausführungshelfer wurde hier bewusst nicht gebaut oder gestartet.
6. Lokale Dateiübergabe und Transaktionsabschluss müssen nachweisbar zusammenpassen; bei unklarem Ausgang keinen zweiten Token erzeugen und keinen Flash ausführen. Bei fehlgeschlagener Transaktion kein scheinbar provisioniertes Flashartefakt zurücklassen. Kein Credential in CLI-Argumenten, Logs oder Antworten.
7. Nachher genau Device 3 und Credential prüfen, keine Assignments; bestehende Geräte/Credentials/Bindings/Offers unverändert nachweisen. Credentials nicht durch künstliche Configaufrufe auf Device 1/2 testen.

Produktive Konfliktfreiheit, Pepperzugang und Livezustand sind in dieser Vorbereitung **nicht geprüft**. Das lokale Testcredential ist keine produktive Registrierung und wird später kontrolliert ersetzt, niemals vom anderen Gerät kopiert. WLAN nur für P3 separat sicher bereitstellen.

## Abnahme und nächste Grenze

- Drei Merchant-Builds SUCCESS. P1/P2-Header unverändert per SHA-256 verglichen; gemeinsame Laufzeit ab dem Identitätsblock unverändert gegen Ausgangs-HEAD geprüft.
- Firmware 30/30: echte C++-Parser-/Rendererprüfung, alle drei Identitäten, unbekannte/fremde Profile vom Compiler abgewiesen, P3 akzeptiert keine P1/P2-Projektionen; Ignore-Regeln inklusive Beispiele getestet.
- Vollständige Backend-Testsuite erfolgreich; Mongo/HTTP-Suite 7/7. Neues neutrales P3 mit 0.3.11 erhält HTTP 200/assigned=false; Credentialtausch in beide Richtungen 401, MAC-Unique-Constraint geprüft, vorhandene Testgeräte/Collections unverändert. Nur eigene Loopback-Datenbank; Cleanup bestätigt. Kein neuer Frontend-/Browserlauf, da keine Web-/Runtimeänderung.
- Keine produktive Registrierung, kein Merchant-Flash, keine bestehenden Gerätezugriffe, kein Deploy, Push, Merge oder Stripe-Vorgang.

Nach freigegebener Registrierung und gültiger WLAN-Konfiguration: neu bauen, bestehende Header unverändert prüfen, **Port erneut ermitteln und MAC vergleichen**, Firmwareartefakt dem P3-Build zuordnen. Erst mit ausdrücklicher Flashfreigabe ausschließlich dieses Environment und den frisch bestätigten Port hochladen; Hashverifikation, TLS-/Config-Logs und echte P3-Heartbeats beobachten. Zuerst physisch neutrales UNBOUND ohne Käufer-QR abnehmen. Händler-/Standortzuordnung, Produktbindung und Commerce-Tests sind weitere getrennte Schritte; Device 1/2 und deren Offers bleiben unangetastet.
