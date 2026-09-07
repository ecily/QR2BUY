# P0.3.4 – geplanter realer Abnahmelauf

Dieser Plan ist **nicht ausgeführt**. Kein Deploy, Flash oder produktiver Assignment-Wechsel gehört zur lokalen Implementierung.

Aktuelle Freigabe nach lokaler Implementierung: Veröffentlichung und erste reale Abnahme ausschließlich für Schild 1/Ledertasche. Erforderlichen Ingress/Operator-Scope und Produktcodes kontrolliert vorbereiten. Firmware 0.3.4 nur auf COM3; COM4 nicht öffnen oder flashen. Schild 2 erhält keine Preview oder Aktivierung und bleibt PENDING/assigned=false. Der unten beschriebene analoge zweite Gerätelauf ist erst nach einem weiteren ausdrücklichen Go freigegeben.

## Voraussetzungen nach gesonderter Freigabe

1. Geprüften Backend-/Frontend-Stand veröffentlichen. DigitalOcean-Ingress zusätzlich für `/device` an `qr2buy-backend` mit erhaltenem Pfad konfigurieren; `/binding` bleibt beim Frontend. Bestehende `/api`- und Marketing-Routen erhalten. Health 200, unbekanntes `/device/QR2B-999999` HTTP 404 und gültiger Geräte-Aufkleber HTTP 303 auf `/binding/:deviceId` prüfen.
2. `BINDING_OPERATOR_MERCHANT_ID=merchant-demo-001` ausschließlich im Server-ENV setzen. Zugang verwendet die vorhandene interne `ADMIN_USER`/`ADMIN_PASS`-Authentifizierung. Diese globalen Operator-Credentials dürfen nicht als Händlerkonten verteilt werden. Kein neues Rollen-/Onboarding-System vorhanden; für echte Händlerkonten ist später eine eigene Authentifizierung erforderlich.
3. Fehlende stabile Produktcodes ausschließlich im freigegebenen Merchant-Scope nachtragen: `node src/scripts/prepareProductBindingIds.js` mit expliziten Gates `BINDING_CODE_MIGRATION_ENABLED=true` und produktiv zusätzlich `BINDING_CODE_MIGRATION_ALLOW_PRODUCTION=true`. Mongo-Verbindung und Merchant-Scope kommen nur aus ENV. Der Befehl verändert keine Produkteigenschaften, Offers, Credentials oder Assignments; vorhandene Codes bleiben unverändert. Gates anschließend wieder deaktivieren. Dieser Befehl wurde bisher nur gegen die isolierte Testdatenbank geprüft.
4. Firmware 0.3.4 einzeln auf die Geräte flashen und Preview-Screen real abnehmen: CS5 weiterhin Rotation 1 auf COM3, NOCS Rotation 3 auf COM4. Alte Firmware 0.3.2 ist für Preview-Starts absichtlich gesperrt. Kein Firmware-Update in diesem lokalen Arbeitsschritt.
5. Beide permanenten Geräte-Aufkleber physisch am richtigen Schild anbringen und Klartext-ID/Hardwarezuordnung prüfen. Produkte tatsächlich danebenstellen. Alle DisplayAssignments bleiben bis zur bestätigten Vor-Ort-Prüfung PENDING.

## Schild 1, danach Schild 2

1. Geräte-Aufkleber mit Smartphone-Kamera scannen; Operator anmelden. Primär muss „Schild 1“ beziehungsweise „Schild 2“ erscheinen.
2. Schild 1 → Handgemachte Ledertasche, 129,00 EUR. Schild 2 → Roman „Stadtlichter“, 24,90 EUR. Vorbereitete passende PENDING-Assignments werden wiederverwendet.
3. EAN scannen/eingeben, wenn vorhanden. Die Pilotprodukte haben keine EAN: passenden qr2buy-Produktcode auswählen/eingeben und das physische Produkt prüfen. Kamera-Scan nutzt die Browser-BarcodeDetector-Funktion, falls verfügbar; Eingabe/Auswahl bleibt als Fallback erhalten.
4. Vorschau starten. Nur das gewählte TFT muss „ZUORDNUNG PRUEFEN“, Produktname, Preis und einen sechsstelligen Code zeigen; kein Käufer-QR. Das andere Gerät bleibt unverändert.
5. Auf dem Smartphone „Ist das das Produkt vor dir?“ prüfen. Den Code direkt vom physischen Schild eingeben und „Ja, Schild aktivieren“ drücken. Der Smartphone-API wird dieser Code niemals geliefert. Höchstens fünf Fehlversuche; Vorschau maximal zwei Minuten.
6. Erst jetzt wird PENDING → ACTIVE; bisheriges ACTIVE desselben Geräts wird transaktional REPLACED. Aktuelles Produkt, Preis und eigener Buyer-QR auf dem TFT abnehmen. Wiederholte identische Bestätigung darf keine weitere Zuordnung erzeugen.

## Negative und abschließende Prüfungen

- Abbruch einer Vorschau verändert kein ACTIVE-Assignment. Nach spätestens dem nächsten Poll verschwindet die Vorschau; bestehende aktive Anzeige wird wiederhergestellt.
- Ablauf nach zwei Minuten: keine Bestätigung möglich. Auch bei WLAN-Ausfall löscht die Firmware den Preview-Screen lokal; eine vorherige aktive Anzeige kommt erst mit der nächsten gültigen Config zurück.
- Falscher Code, altes Preview, fremdes Gerät/Produkt, Preisänderung oder MerchantAssignment-Wechsel dürfen nicht aktivieren. Beide Geräte bleiben unabhängig.
- Beide Buyer-QRs müssen verschieden sein und auf die passenden öffentlichen Offers zeigen. Kein DemoSession-Token, kein Merchant-Checkout; öffentliche Offer-Seite bleibt lesend mit `checkoutAvailable=false`.
- Marketing-Demo separat prüfen; reale TFT-/Smartphone-Abnahme dokumentieren. Diese Hardware-Abnahme ist noch offen und wird nicht aus lokalen Tests abgeleitet.

Grenze des MVP: Der Gerätecode beweist Zugriff auf die aktuelle Display-Vorschau. Dass das tatsächlich davorliegende Produkt korrekt ist, bestätigt der Operator durch physischen Vergleich; keine automatische Objekterkennung oder Standortmessung wird behauptet. Der einzige derzeit implementierte Merchant-Commerce-Zustand mit Sperrvorrang ist SOLD (Nullbestand); vor späteren echten Checkout-/Reservierungszuständen ist die Priorität entsprechend zu erweitern.

## Dateien dieser lokalen Umsetzung

- `backend/.env.example`
- `backend/src/index.js`
- `backend/src/merchant/binding.js`
- `backend/src/merchant/deviceRepository.js`
- `backend/src/merchant/deviceService.js`
- `backend/src/merchant/models.js`
- `backend/src/merchant/service.js`
- `backend/src/routes/binding.js`
- `backend/src/scripts/prepareProductBindingIds.js`
- `backend/test/binding.integration.test.js`
- `backend/test/deviceLogging.test.js`
- `backend/test/merchantDomain.test.js`
- `docs/QR2BUY_CONTEXT.md`
- `docs/QR2BUY_P034_LIVE_PLAN.md`
- `docs/exports/device-qrs/QR2B-000001-device-qr.png`
- `docs/exports/device-qrs/QR2B-000001-device-qr.svg`
- `docs/exports/device-qrs/QR2B-000002-device-qr.png`
- `docs/exports/device-qrs/QR2B-000002-device-qr.svg`
- `docs/exports/device-qrs/README.md`
- `firmware/qr_display_fw/include/merchant_config.h`
- `firmware/qr_display_fw/src/static_app.cpp`
- `firmware/qr_display_fw/test/merchant_config_host.cpp`
- `firmware/qr_display_fw/test/test_merchant_app_contract.py`
- `frontend/e2e/binding.spec.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/playwright.config.js`
- `frontend/scripts/device-qrs.mjs`
- `frontend/src/App.jsx`
- `frontend/src/binding.js`
- `frontend/src/pages/DeviceBindingPage.css`
- `frontend/src/pages/DeviceBindingPage.jsx`
- `frontend/test/binding.test.js`
- `frontend/vite.config.js`
