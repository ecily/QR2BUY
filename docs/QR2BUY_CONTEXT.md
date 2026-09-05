# qr2buy.com – operativer Projektkontext

Stand: 5. September 2026. Dieses Dokument ist die operative Source of Truth für den aktuellen qr2buy-Projektstand.

## Verbindliche Arbeitsregeln

- Bei jeder künftigen Coding-/Codex-Arbeit zuerst diese Datei und danach den aktuellen Git-Status lesen.
- Ausschließlich das Projekt `qr2buy.com` im Repo `C:\coding\qr2buy` bearbeiten; keinen Kontext aus anderen Projekten übernehmen.
- Nach materiellen, verifizierten Änderungen dieses Dokument schlank aktualisieren.
- Git-, Test-, Hardware- und Deploymentstände nur als bestätigt dokumentieren, wenn sie tatsächlich geprüft wurden.
- Reale Secrets niemals lesen, ausgeben, loggen oder committen. Lokale ENV- und Firmware-Secret-Dateien bleiben ignoriert.
- Historische Dokumente unter `docs/` beschreiben frühere Planungs-/Auditstände; bei Widersprüchen gilt diese Datei.

## System und produktive URLs

qr2buy verbindet ein physisches QR-Verkaufsschild mit einer mobilen Produkt-, Reservierungs- und Kauf-Journey. MongoDB Atlas hält den Serverzustand; Express stellt API und Demo bereit; React/Vite rendert Frontpage und Produktseiten; ein ESP32 pollt die autorisierte Hardware-Projektion und steuert ein ILI9341-TFT.

Produktiv bestätigt:

- `https://qr2buy.com/`
- `https://www.qr2buy.com/`
- `https://qr2buy.com/api/health`
- `https://qr2buy.com/p/demo`
- `https://qr2buy.com/api/public/products/by-short/demo`
- `/demo/p/:productKey#session=<TOKEN>` für die sessiongebundene Live-Demo; das Token steht ausschließlich im Fragment.

## Frontpage und session-isolierte Live-Demo

Die produktive React/Vite-Frontpage ist responsiv, deutsch/englisch lokalisiert und konsequent auf kleine und mittlere Händler mit Schaufenstern oder anderen nach Ladenschluss sichtbaren Produkten ausgerichtet. Ihre Kernstory: Ein Passant sieht bei geschlossener Tür ein konkretes Produkt und kann es per QR-Scan ohne App und ohne Mitarbeiter vor Ort kaufen oder reservieren. qr2buy wird ausdrücklich nicht als Supermarkt- oder Massensortimentslösung dargestellt.

Der Hero lautet deutsch „Dein Schaufenster verkauft weiter – auch wenn du längst geschlossen hast.“ und englisch „Your shop window keeps selling – long after you have closed.“; der Browser-/SEO-/OG-/Twitter-Titel lautet sprachabhängig `qr2buy – Scannen. Kaufen. Verkauft.` beziehungsweise `qr2buy – Scan. Buy. Sold.`. `/de` und `/en` liefern die jeweilige Sprache deterministisch; der Sprachwechsel hält Dokumenttitel, HTML-Sprache, Description, Canonical URL und Open-Graph-Felder synchron. Die Live-Demo steht direkt nach dem Hero. Danach folgen eine konkrete Samstagabend-Problemszene, der Haupt-USP „Das Verkaufsschild zeigt nicht nur den Preis. Es verkauft.“, die Abgrenzung zum normalen, nur eine Website öffnenden QR-Code, Wiederverwendbarkeit, Käufervertrauen, KMU-Einsatzorte, Ablauf, realer Hardwarebeweis und abschließende Pilot-CTA.

Die verbindliche Primärmarke besteht aus der bestehenden Bildmarke links und der Wortmarke `qr2buy` rechts und wird über eine gemeinsame Frontend-Komponente in Header, Footer, Demo-Display und mobiler Demo verwendet. Das Favicon verwendet ausschließlich diese kontrastoptimierte Bildmarke als SVG sowie PNG in 16, 32 und 48 Pixeln; ein Apple-Touch-Icon liegt in 180 Pixeln vor. Es gibt kein Webmanifest/PWA und daher keine künstlich ergänzten Manifest-Icons. Ein geeignetes bestehendes Social-Preview-Bild ist nicht vorhanden; `og:image` und `twitter:image` bleiben bewusst aus, statt ein Platzhalterbild zu veröffentlichen.

Die Einsatzorte-Sektion ist visuell konsolidiert: sieben kurze DE/EN-Branchenkarten stehen auf Desktop bewusst als zentriertes 4+3-Raster, auf Tablet zweispaltig mit zentrierter Schlusskarte und auf Mobile einspaltig. Dunkle Überschriften und Sekundärtexte auf warmen hellen Karten sichern den Kontrast zum dunkelgrünen Abschnitt.

Die Seite behauptet keine produktiv unbewiesene Flottenverwaltung, Massenskalierung, Bestandsverriegelung oder garantierte Sicherheit. E-Mail wird sachlich korrekt nur als optionaler Demo-Beleg nach einem bestätigten Testkauf beschrieben; der eigentliche Kauf-/Reservierungsstatus wird unmittelbar im Ablauf und am gekoppelten Display sichtbar.

Vor dem Start der Live-Demo bestätigt der Besucher ausdrücklich den ausschließlich ungefährlichen Stripe-Testmodus. Erst danach wird die persönliche DemoSession erzeugt beziehungsweise restauriert und die Interaktion freigegeben. Dieser Bestätigungsmarker liegt nur in `sessionStorage`, nicht in `localStorage`; es entstehen weiterhin weder eine reale Abbuchung noch eine echte Bestellung.

Die sichtbare Display-Simulation, QR-Produktseite und der physische Prototyp verwenden dieselbe serverseitige `DemoSession` als Statusquelle. Jede Frontpage erzeugt beziehungsweise restauriert eine eigene kryptografisch zufällige Session; MongoDB speichert nur den SHA-256-Hash des Tokens. Demo-Daten verändern keine normalen `Product`-, `Device`- oder `Order`-Datensätze.

Der serverseitige Katalog `DEMO_PRODUCTS` ist die Produkt-Source-of-Truth:

| productKey | Deutsch | Preis | Verhalten |
| --- | --- | ---: | --- |
| `bag` | Handgemachte Ledertasche | 129,00 EUR | wiederverwendbar |
| `book` | Roman „Stadtlichter“ | 24,90 EUR | wiederverwendbar |
| `print` | Gerahmter Kunstdruck | 390,00 EUR | wiederverwendbar |
| `tree` | Nordmanntanne Nr. 17 | 59,00 EUR | konkretes Einzelstück |

Das Statusmodell lautet `READY`, `CHECKOUT_STARTED`, `CANCELLED`, `RESERVED`, `PAID`, `SOLD`. Session und Produktstatus werden per sessiongebundenem SSE plus Polling synchronisiert. Reservierung erfolgt serverseitig ohne Stripe. Der Kauf nutzt ausschließlich Stripe-Sandbox; nur ein signierter, serverseitig erneut verifizierter Test-Webhook darf `PAID` setzen. Stripe-Live-Keys und Live-Events werden abgewiesen.

Wiederverwendbare Produkte kehren nach `RESERVED`, `PAID` oder `CANCELLED` nach 20 Sekunden session- und produktbezogen zu `READY` zurück. Die konkrete Tanne bleibt bei Reservierung dauerhaft `RESERVED`; nach bestätigter Testzahlung folgt auf `PAID` nach 20 Sekunden dauerhaft `SOLD`. Event-Versionen verhindern mehrdeutige UI-Aktualisierungen. Der Checkout ist als Demo gekennzeichnet, erzeugt keine reale Abbuchung/Bestellung und verwendet eine öffentliche HTTPS-Rücksprung-Origin.

Wichtige Demo-Routen:

- `POST /api/demo/sessions`
- `GET /api/demo/sessions/:token`
- `GET /api/demo/sessions/:token/products/:productKey`
- `POST /api/demo/sessions/:token/products/:productKey/interaction`
- `POST /api/demo/sessions/:token/products/:productKey/reserve`
- `POST /api/demo/sessions/:token/products/:productKey/checkout`
- `POST /api/demo/sessions/:token/products/:productKey/cancel`
- `GET /api/demo/sessions/:token/events`
- `POST /api/demo/stripe/webhook`

Ein optionaler qr2buy-eigener SMTP-over-TLS-Dienst kann nach `PAID` höchstens einen klar als Demo gekennzeichneten HTML-Beleg senden. Er ist standardmäßig deaktiviert; E-Mail-Adressen werden nicht in MongoDB gespeichert oder per SSE verteilt.

## P0.2 Mobile Käufer-Journey – produktiver Stand

Der erste P0.2-Schritt ist seit dem 5. September 2026 produktiv; der funktionale Stand wurde mit Commit `bcb9239` live bestätigt. Die zugehörige Firmware war bereits zuvor auf die reale Hardware geflasht. Die mobile Demo-Produktseite priorisiert unmittelbar die vorhandene Produktvisualisierung, Verfügbarkeit, Produktname, Preis, den primären CTA `Jetzt kaufen`, den sekundären CTA `Reservieren` und einen kompakten DE/EN-Vertrauensblock. Der Katalog enthält aktuell keine echten Produktbilder; deshalb bleibt die bestehende farbcodierte Visualisierung erhalten und es wurden keine Bilder erfunden. Checkout-, Stripe- und Reservierungs-Handler bleiben unverändert.

Ein validierter QR-Aufruf meldet einmalig `POST /api/demo/sessions/:token/products/:productKey/interaction`. `DemoProductState` speichert dafür getrennt vom Commerce-Status `lastScannedAt` und `interactionExpiresAt`; die Projektion liefert für zehn Sekunden `interactionState: SCANNED`. Wiederholungen im frischen Zeitfenster werden atomar ohne weitere DB-Schreibvorgänge oder Broadcasts dedupliziert. Ungültige Session-Token und unbekannte Produkte erzeugen keinen Interaction-State; ein eigenes Rate-Limit schützt den Endpunkt. Der Session-Token bleibt in den bestehenden URL-Logs redigiert.

Die Anzeigepriorität lautet `SOLD`/`PAID`/`RESERVED` vor `CHECKOUT_STARTED`, danach frischer Scan und danach `READY`; die Projektion zeigt `SCANNED` nur bei unverändertem Commerce-Status `READY`. Frontpage-Simulation und Hardware-Config nutzen dieselbe Projektion. Die Firmware zeigt bei frischem Scan `SCAN ERKANNT` und `Bitte am Smartphone fortfahren`, behält Produktname, Preis, QR-Geometrie und LIVE-Footer und fällt durch das vorhandene Drei-Sekunden-Polling nach Ablauf wieder auf `READY` zurück. Produktiv bestätigt sind die getrennte `SCANNED`-/`READY`-Projektion, der Rückfall nach der Zehn-Sekunden-TTL und fortlaufende autorisierte Hardware-Abrufe mit HTTP 200 nach dem Backend-Rollout. Die physische Scan-Ansicht auf dem TFT bleibt visuell durch den Nutzer abzunehmen.

## Stripe-Sandbox und Webhooks

Alle öffentlich angebotenen Checkout-Pfade sind auf Stripe-Testmodus begrenzt. Zwei getrennte, signaturgeprüfte Raw-Body-Webhooks verarbeiten ausschließlich ihre jeweilige Projektion:

- `POST /api/demo/stripe/webhook` verarbeitet nur `flow=qr2buy_demo` für `DemoSession`, akzeptiert `checkout.session.completed` und `checkout.session.async_payment_succeeded`, verifiziert den Checkout erneut bei Stripe und setzt erst danach atomar `PAID`. Unbekannte, unbezahlte und fremde Events werden ohne Statusänderung quittiert; Live-Events und falsche Signaturen werden abgewiesen.
- `POST /api/stripe/webhook` gehört zum älteren `/p/:shortId`-Buyer-Flow und aktualisiert ausschließlich normale `Product`-, `Device`- und `Order`-Modelle für `system=qr2buy`. Demo- und unbekannte Events werden mit 2xx ignoriert. Fulfillment setzt einen bezahlten Test-Checkout voraus, ist über die Checkout-Session-ID idempotent und speichert nur eine redigierte Sessionprojektion statt des vollständigen Stripe-Objekts.

Die frühere Stripe-Zustellung an `https://lionfish-app-zidqr.ondigitalocean.app/api/stripe/webhook` erzeugte 42 HTTP-500-Antworten, weil dieser Legacy-Endpoint aktiv blieb, während `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` im produktiven Service nicht gesetzt waren. Der kanonische Legacy-Endpoint ist `https://qr2buy.com/api/stripe/webhook`; er verwendet einen eigenen Signing Secret. Der Demo-Endpoint verwendet weiterhin getrennt `STRIPE_DEMO_SECRET_KEY` und `STRIPE_DEMO_WEBHOOK_SECRET`. Webhooks, nicht Browser-Returns, sind die maßgebliche Bestätigung für bezahlte Zustände.

Am 4. September 2026 hat der Nutzer nach dem Webhook-Fix erneut einen vollständigen manuellen Sandbox-Checkout mit der offiziellen Stripe-Testkarte `4242 4242 4242 4242` erfolgreich durchgeführt. Damit sind produktiv die Frontpage-Demo, die mobile Demo-Produktseite, der ausschließlich simulierte Stripe-Testcheckout ohne echte Zahlung oder Bestellung, der Checkout-Return, die Webhook-Verarbeitung und der bestätigte Zahlungsstatus der zugehörigen `DemoSession` belegt. Frontpage und mobile Journey reagierten korrekt. Hardware-Synchronisierung, produktiver Reservierungsflow und der vertragsgemäße automatische Reset auf `READY` waren bereits separat bestätigt; diese manuelle Abnahme wird nicht als neue Detailabnahme aller physischen TFT-Statusansichten ausgelegt.

Aktuell sind genau diese Stripe-Test-Webhooks verbindlich:

- `https://qr2buy.com/api/stripe/webhook` für den Legacy-Buyer-Flow der normalen `Product`-, `Device`- und `Order`-Modelle
- `https://qr2buy.com/api/demo/stripe/webhook` für die session-isolierte Frontpage-/Hardware-Demo über `DemoSession`

Beide akzeptieren mindestens `checkout.session.completed` und `checkout.session.async_payment_succeeded`, verlangen eine gültige Stripe-Signatur, beantworten ungültige Signaturen mit HTTP 400 und erfolgreiche legitime Zustellungen mit HTTP 2xx. Der alte `lionfish-app-zidqr.ondigitalocean.app`-Endpoint darf nicht erneut als Stripe-Destination konfiguriert werden. Die zugehörigen ENV-Namen sind `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_DEMO_SECRET_KEY` und `STRIPE_DEMO_WEBHOOK_SECRET`; alle vier müssen im produktiven DigitalOcean-Backend als Secrets gesetzt sein. Ein ausschließlich lokal grüner Test ersetzt diese produktive Konfiguration nicht.

### Stripe Regression Guard

Vor jeder Änderung an Checkout, Stripe, Webhooks oder `DemoSession` sind zu prüfen:

1. beide verbindlichen produktiven Webhook-Endpunkte,
2. alle vier zugehörigen DigitalOcean-Stripe-ENV als Secrets,
3. Stripe-Testmodus und niemals Live-Modus für die Demo,
4. zwingende Webhook-Signaturprüfung,
5. `pending_webhooks: 0` beziehungsweise erfolgreiche Zustellung nach einem kontrollierten Testevent,
6. keine HTTP-500 in den Backend-Logs,
7. Frontpage- und Mobile-Status nach Checkout,
8. der Reservierungsflow,
9. der Hardware-Config-State und
10. dass keine alte DigitalOcean-Webhook-URL erneut aktiviert wurde.

Der signierte Stripe-Webhook bleibt die maßgebliche serverseitige Kaufbestätigung; der Browser-Return allein genügt nicht.

## Hardware-Binding und Hardware-API

`DemoHardwareBinding` koppelt `demo-device` nach ausdrücklichem Operator-Pairing an genau eine aktive `DemoSession`, einen `productKey` und eine Locale. Ein autorisiertes Rebinding derselben `deviceId` ersetzt das vorherige Binding atomar. Produktwechsel der gekoppelten Frontpage werden per PATCH übertragen. Es gibt keinen parallelen Hardware-Produktkatalog; Produktname, Preis, Status und QR werden aus `DemoSession` plus `DEMO_PRODUCTS` projiziert.

API-Vertrag:

- `POST /api/demo/sessions/:token/hardware-binding`
  - Header: `x-demo-pairing-secret`
  - Body: `deviceId`, `productKey`, `locale`
  - Erstellt beziehungsweise ersetzt das Binding und liefert die aktuelle Hardware-Projektion.
- `PATCH /api/demo/sessions/:token/hardware-binding`
  - Body: `deviceId`, `productKey`, optional `locale`
  - Aktualisiert ausschließlich das Binding derselben autorisierten Session.
- `GET /api/demo/hardware/config?deviceId=demo-device`
  - Header: `x-device-secret`
  - Ohne gültiges Device-Secret fail-closed mit 401.
  - Ohne aktives Binding regulär HTTP 200 mit `{ "ok": true, "bound": false }`.
  - Mit Binding: `ok`, `bound`, `deviceId`, `productKey`, `text`, `priceText`, `status`, `interactionState`, `interactionExpiresAt`, `qr`, `eventVersion`, `resetAt`, `expiresAt`.

Bindings besitzen einen TTL-Index und laufen mit ihrer DemoSession ab. Das Session-Token wird im Binding ausschließlich AES-256-GCM-verschlüsselt gespeichert; der Schlüssel kommt nur aus ENV. Binding und Hardware-Polling besitzen getrennte Rate-Limits.

## Physischer Hardware-Prototyp

- Controller: ESP32 Dev Module, Arduino-Framework über PlatformIO
- Display: ILI9341, physisch 240×320 Pixel, aktiv als 320×240 Landscape mit `setRotation(1)`
- Bus: SPI
- Bestätigte Pins: CS GPIO5, RST GPIO4, DC GPIO15, MOSI GPIO23, MISO GPIO19, SCLK GPIO18
- Aktives Environment: `esp32dev_spi_cs5_rst4_app`
- Aktiver Quellpfad: `firmware/qr_display_fw/src/static_app.cpp`
- Lokaler Port/Monitor: COM3, 115200 Baud
- Backlight: kein steuerbarer GPIO dokumentiert; `TFT_BL = -1`. Softwaredimmung ist erst nach sicher dokumentierter Hardwareverdrahtung zulässig.

Die reale Hardware wurde erfolgreich geflasht und getestet. Bestätigt sind WLAN, NTP/TLS, Hardware-Config HTTP 200 mit rotiertem Device-Secret, explizites Frontpage-Pairing, physischer Produktwechsel `bag → tree` innerhalb ungefähr des Drei-Sekunden-Pollingintervalls, scanbarer QR und das Laden der korrekten mobilen Zielseite. Reservierung und Stripe-Testkauf wurden grundsätzlich erfolgreich durchlaufen. Die Detaildarstellung von `RESERVED`, `PAID` und `SOLD` auf dem realen TFT ist noch nicht als vollständig perfektioniert abgenommen und bleibt bewusste Nacharbeit.

## Finale Firmware-Funktion und Display

Die Firmware testet alle Einträge der lokalen `WIFI_LIST` nacheinander mit je 15 Sekunden Timeout, verwendet das erste erreichbare WLAN und führt bei Verbindungsverlust einen nicht blockierenden Runtime-Reconnect aus. SSIDs dürfen im Serial Monitor erscheinen, Passwörter nie. Ein Hintergrund-Task pollt alle drei Sekunden. Temporäre WLAN-/HTTP-Fehler überschreiben keinen bereits gültigen Produktzustand.

TLS wird mit `WiFiClientSecure`, verifizierter Systemzeit und dem offiziellen selbstsignierten `GTS Root R4` validiert. `client.setCACert(QR2BUY_ROOT_CA)` bleibt aktiv; `setInsecure()` ist verboten. Der Trust Anchor muss bei einer künftigen Änderung der von `qr2buy.com` ausgelieferten Zertifikatskette erneut geprüft werden.

Der real akzeptierte Displaystand:

- 320×240 Landscape, zweispaltig: QR und Scan-USP links, Produktinformationen rechts
- warme qr2buy-Farbwelt mit kontrastoptimierten RGB565-Haupt-, Sekundär- und READY-Farben
- dynamische QR-Version bis Version 10; aktuelle 81–83-Byte-URLs verwenden Version 5
- quadratischer, physisch scanbarer QR mit unveränderter Vier-Modul-Ruhezone
- prominentes `Mit dem Handy scannen` und Badge `KEINE APP NOETIG`
- adaptiver Produktname: 26 Pixel hoher Font 4, sofern der Titel in höchstens zwei Zeilen passt; sonst kräftiger Font-2-Fallback
- Preis und Status-Pill bleiben klar nachgeordnet; `READY` zeigt `NOCH ZU HABEN`
- QR sichtbar für `READY`, `CHECKOUT_STARTED`, `CANCELLED`; kein QR bei `RESERVED`, `PAID`, `SOLD`
- technische Footeranzeige `LIVE · SICHER VERBUNDEN` nur bei WLAN, gültiger TLS-Zeit, mindestens einem erfolgreichen Config-Abruf und maximal zehn Sekunden altem Erfolg
- sanfter 1,8-Sekunden-Puls zeichnet nur den kleinen Footerpunkt neu; bei fehlender Frische steht gedämpft `VERBINDUNG...`
- Binding-, WLAN-, TLS-, Backend- und Abschlussansichten folgen derselben visuellen Sprache

Die Displaygestaltung wurde auf echter Hardware als „fast perfekt“ akzeptiert. Offen bleibt ausschließlich Detailnacharbeit an Reservierungs-/Kauf-/Verkauft-Darstellungen, nicht die grundlegende Synchronisations- oder Layoutarchitektur.

## Firmware- und Backend-Security

- `firmware/qr_display_fw/src/secrets.h` enthält lokal `WIFI_LIST`, `QR2BUY_DEVICE_ID` und `QR2BUY_DEVICE_SECRET` und ist gitignored.
- `backend/.env` ist lokal und gitignored. Versionierbare Beispiele enthalten nur Platzhalter.
- Pairing- und Device-Secret wurden nach dem Logger-Fix rotiert; das alte Device-Secret wird produktiv mit 401 abgewiesen.
- `DEMO_HARDWARE_ENCRYPTION_KEY` musste wegen des Header-Logging-Vorfalls nicht rotiert werden und bleibt ausschließlich serverseitig.
- Pino redigiert Authorization-, Pairing- und Device-Header; Responses werden ohne eingebettetes Requestobjekt serialisiert.
- Token, vollständige sessiongebundene QR-URLs, WLAN-Passwörter und Secrets werden nicht geloggt.
- Reale Secret-Dateien sind nicht getrackt; `firmware/**/.pio/` bleibt ebenfalls ignoriert.

## DigitalOcean-Deployment

- Produktive DigitalOcean-App: `qr-backend`
- Backend-Komponente: `qr2buy-backend`, Source `backend`, Web Service, Port 8080, Route `/api` mit Preserve Full Path, Healthcheck `/api/health`
- Frontend-Komponente: `qr2buy-frontend`, Source `frontend`, Static Site, Build `npm ci && npm run build`, Output `dist`, Route `/`, SPA-Catchall `index.html`
- Deploy-Quelle: GitHub-Branch `main`; Push auf `origin/main` löst Auto-Deploy aus.
- Domains: `qr2buy.com` primär, `www.qr2buy.com` aktiv, HTTPS aktiv.
- `DEMO_PUBLIC_BASE_URL=https://qr2buy.com`

Relevante ENV-Namen ohne Werte:

- `MONGODB_URI`, `PUBLIC_BASE_URL`, `DEMO_PUBLIC_BASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_DEMO_SECRET_KEY`, `STRIPE_DEMO_WEBHOOK_SECRET`
- `DEMO_HARDWARE_PAIRING_SECRET`, `DEMO_HARDWARE_ENCRYPTION_KEY`, `DEMO_HARDWARE_DEVICE_SECRETS`
- `DEMO_SESSION_TTL_MINUTES`
- `ADMIN_USER`, `ADMIN_PASS`
- optional `DEMO_MAIL_TRANSPORT`, `DEMO_SMTP_HOST`, `DEMO_SMTP_PORT`, `DEMO_SMTP_USER`, `DEMO_SMTP_PASS`, `DEMO_SMTP_FROM`, `DEMO_SMTP_HELO_NAME`

Der exakte produktive Commit wird nach jedem Rollout gegen `origin/main` und den DigitalOcean-Deploymentstand geprüft; der Abschlussbericht der jeweiligen Änderung nennt den verifizierten Hash. Ein Commit kann seinen eigenen Hash technisch nicht zuverlässig im eigenen Inhalt festhalten.

## Verifizierter Teststand vom 4. September 2026

- Backend: 43/43 Tests grün
- Backend: alle Dateien unter `backend/src` mit `node --check` grün
- Backend: Import-Smoke für `backend/src/routes/demo.js` grün
- Backend: kein separates Lint- oder Build-Script vorhanden
- Frontend: 33/33 Tests grün
- Frontend: ESLint grün
- Frontend: Vite-Produktionsbuild grün
- Beide produktiven Stripe-Webhooks: HTTP 200 auf ein kontrolliertes Stripe-Sandbox-Event
- Beide produktiven Stripe-Webhooks: falsche Signaturen HTTP 400
- Produktive Backend-Logs nach dem Fix: keine aktuellen HTTP-500
- Produktiver Reservierungsflow und automatischer Reset auf `READY` live bestätigt
- Manueller Stripe-Sandbox-Checkout mit offizieller 4242-Testkarte inklusive Return, Webhook und bestätigtem `DemoSession`-Zahlungsstatus durch den Nutzer live bestätigt
- Firmware: 16/16 statische Vertragsprüfungen grün
- Firmware: PlatformIO-Build `esp32dev_spi_cs5_rst4_app` grün
- Firmwaregröße: 47.996 Byte RAM von 327.680 (14,6 %), 978.421 Byte Flash von 1.310.720 (74,6 %)
- Erwartete einzige Buildwarnung: `TOUCH_CS` ist nicht definiert; Touch-Funktionen werden nicht verwendet.
- `git diff --check` grün

## Verifizierter P0.2-Test- und Livestand vom 5. September 2026

- Backend: 50/50 Tests grün; alle `backend/src`-JavaScriptdateien mit `node --check` und Demo-/Stripe-/Checkout-Router-Import-Smoke grün
- Frontend: 38/38 Tests, ESLint und Vite-Produktionsbuild grün
- Firmware: 17/17 statische Vertragsprüfungen und PlatformIO-Build `esp32dev_spi_cs5_rst4_app` grün
- Firmwaregröße: 48.060 Byte RAM von 327.680 (14,7 %), 979.305 Byte Flash von 1.310.720 (74,7 %)
- Erwartete einzige Buildwarnung: `TOUCH_CS` ist nicht definiert; Touch-Funktionen werden nicht verwendet.
- DigitalOcean: funktionaler Commit `bcb9239` für Backend und Frontend `ACTIVE` bestätigt; `/`, `/de`, `/en` und `/api/health` liefern HTTP 200.
- Live-Interaction: `READY → SCANNED → READY` bestätigt; Commerce bleibt währenddessen `READY`, Hardware-Config übernimmt `SCANNED` und fällt nach der Zehn-Sekunden-TTL zurück.
- Live-Regression: Reservierung wechselt auf `RESERVED` und nach 20 Sekunden zurück auf `READY`; Checkout-Erzeugung im Stripe-Testmodus, `CHECKOUT_STARTED` und Abbruch auf `CANCELLED` sind bestätigt, ohne Zahlung.
- Reale Hardware: Firmware installiert; fortlaufende autorisierte Config-Abrufe mit HTTP 200 nach dem Rollout belegen automatische Wiederverbindung und aktives Polling ohne erneuten Flash.

## Offene Punkte

1. Den produktiv bestätigten P0.2-Scan-Zustand auf dem bereits geflashten realen TFT visuell abnehmen; die automatische Wiederverbindung und das Polling sind serverseitig bereits bestätigt.
2. Detaildarstellung der realen TFT-Zustände `RESERVED`, `PAID` und `SOLD` nacharbeiten und anschließend den kompletten physischen End-to-End-Ablauf erneut abnehmen.
3. Die bereits bestätigte Web-Journey bei der physischen TFT-Nacharbeit noch einmal zusammenhängend mit den realen Hardwareansichten für `RESERVED`, `PAID`, Reset und dem dauerhaften `SOLD`-Verhalten der Tanne abnehmen; ausschließlich Stripe-Sandbox verwenden.
4. Gehäuse, Stromversorgung, Kabelentlastung und weitere mechanische Prototypenarbeit für einen Pilotstand planen.
5. Backlight-Steuerung nur nach dokumentierter Verdrahtung an einen geeigneten GPIO ergänzen; aktuell keine Fake-PWM-Lösung.
6. `GTS Root R4` beziehungsweise die reale Zertifikatskette bei künftigen Hosting-/Zertifikatsänderungen vor einem Firmware-Rollout prüfen.
7. Optionale SMTP-Zustellung nur mit vollständiger TLS-Konfiguration und echtem Zustelltest aktivieren.
8. Legacy-Admin-/Device-Pfade mit Basic Auth, optionaler Klartext-Geräteauthentifizierung, SSE/WS und Auto-Provisioning bleiben getrennte MVP-Schulden; die sichere Demo-Hardwarekopplung verwendet sie nicht.
9. Wildcard-DNS und eine möglicherweise noch vorhandene ältere separate Frontend-App bei Gelegenheit aufräumen, ohne Mail-DNS zu verändern.

## Historische Meilensteine

- `367f548`: erster Online-Config-Firmwarepfad
- `a3b8c64`: session-isolierte Live-Demo
- `51f361b`: gehärtete öffentliche Checkout-Origin
- `8de5efa`: Hardware-Synchronisierung Stufe 1–3
- `a7bca06`: Logger-Redaction und GTS-Root-R4-Fix
- `072a9f5`: dokumentierte Secret-Rotation; Ausgangs-HEAD vor dem finalen Displayabschluss
