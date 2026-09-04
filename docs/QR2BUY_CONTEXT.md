# qr2buy.com – operativer Projektkontext

## Projektdefinition und Grenzen

qr2buy.com ist ein QR-Commerce-System für physische Produkte. Ein Produkt wird über einen QR-Code auf einem Display erreichbar und online kaufbar. Dieses Dokument ist die operative Source of Truth für das Projekt.

- Repo: `C:\coding\qr2buy`
- GitHub: `https://github.com/ecily/QR2BUY.git`
- Branch: `main`
- Audit-Zeitpunkt: 2026-07-26
- Geltungsbereich: ausschließlich qr2buy.com; keine Übernahme von Konzepten oder Code aus anderen Projekten.
- Audit-Regel: Dokumentation ja, keine Feature-Implementierung oder Refactorings im Audit.

## MVP-Zielbild

MongoDB Atlas → DigitalOcean Backend → ESP32 holt Geräte-Config → TFT zeigt QR → Kund:in scannt → `/p/:shortId` öffnet Produktseite → Checkout über Stripe.

Pilot-Use-Case ist Schaufenster-/Auslagen-Commerce. Die Firmware darf kurzfristig direkt die DigitalOcean-Backend-URL verwenden; langfristig soll die öffentliche Domain als zentrale URL dienen.

## Aktueller Systemstand

- Backend ist als Express/Mongoose-Service vorhanden; Health-Endpunkt online: `https://lionfish-app-zidqr.ondigitalocean.app/api/health`.
- Öffentlicher Demo-Produkt-Endpunkt ist implementiert und extern als funktionierend bekannt: `/api/public/products/by-short/demo`.
- Frontend ist eine React/Vite-SPA mit zweisprachiger Landingpage, session-isolierter Live-Demo, Admin-Ansicht sowie realer und Demo-Produktroute.
- Firmware hat einen funktionierenden SPI-Pfad und einen Online-Config-App-Pfad.
- Hardware-Referenz: ESP32, SPI, CS GPIO5, RST GPIO4, DC GPIO15, MOSI GPIO23, MISO GPIO19, SCLK GPIO18, COM3.
- qr2buy.com ist technisch live.
- Gemeinsame DigitalOcean-App: `qr2buy-backend` als Web Service und `qr2buy-frontend` als Static Site.
- Erfolgreiche Live-Tests: `https://qr2buy.com/`, `https://qr2buy.com/p/demo`, `https://qr2buy.com/api/health`, `https://qr2buy.com/api/public/products/by-short/demo`, `https://www.qr2buy.com/` und `https://www.qr2buy.com/p/demo`.

## Backend

Start: `npm start` (`node src/index.js`), Entwicklung: `npm run dev`, Demo-Daten: `npm run seed`. Konfiguration erfolgt über nicht zu dokumentierende ENV-Werte; Mongo fällt lokal auf eine lokale `qr2buy`-Datenbank zurück.

Routen:

- `GET /api/health`, `GET /api/events`, WebSocket `/ws`
- Public: `GET /api/public/products/by-short/:shortId`, `GET /api/public/products/:id`, `GET /api/public/status/by-short/:shortId`
- Admin, Basic Auth: Product-/Device-CRUD, Link/Unlink und Status-Override unter `/api/admin/*`
- Checkout: `POST /api/checkout/:productId`, `POST /api/checkout/by-short/:shortId`, `GET /api/checkout/verify`
- Stripe: `POST /api/stripe/webhook`
- Live-Demo: Session, Status, Produkt, Reservierung, Checkout, Cancel und SSE unter `/api/demo/*`; separater Webhook `POST /api/demo/stripe/webhook`
- Firmware: `GET /api/config?deviceId=...`; Legacy: `GET /api/config` ohne Device-ID und `POST /api/updateDisplay`

Modelle sind `Product`, `Device`, `Order`, die isolierte `DemoSession` sowie der Legacy-Singleton `DisplayState`. Product und Device können einander verlinken; Status ist `AVAILABLE` oder `SOLD`. Device-Secret ist im MVP noch als Klartextfeld modelliert. Der Config-Endpunkt provisioniert unbekannte Geräte automatisch und aktualisiert `lastSeenAt`.

Admin nutzt `ADMIN_USER`/`ADMIN_PASS`; in Nicht-Production existiert ein Dev-Fallback. Stripe Checkout und Webhook sind implementiert, aber nur mit korrekt gesetzten Server-Secrets produktionsbereit. Webhook-Signatur wird in Production verlangt.

## Frontend

Die API-Basis ist same-origin `/api`. Routen: `/`, `/p/:shortId`, `/demo/p/:productKey`, `/admin`, `/dashboard`, `/success` und `/cancel`. Die reale Produktseite lädt öffentliche Produktdaten und startet den bestehenden Checkout. Die getrennte Demo-Produktseite lädt ausschließlich den serverseitigen Demo-Katalog. Admin lädt Produkte/Geräte, legt sie an, verlinkt sie und setzt Status. SSE `/api/events` wird für das Legacy-Dashboard genutzt; die Live-Demo besitzt sessiongebundene SSE-Kanäle.

Vite erzeugt `frontend/dist`. Die produktive Static Site läuft unter `/` mit SPA-Catchall `index.html`; `/p/demo` ist live erreichbar. Die Landingpage ist pitchbar umgesetzt und auf den USP geschärft: Kaufen und Verkaufen dürfen keine Frage von Öffnungszeiten sein; qr2buy wird als Vertrauenssystem zwischen Käufer und Händler erklärt. Die Seite präzisiert, dass Stripe der Zahlungsdienstleister ist und qr2buy erst nach bestätigter Zahlung reagiert. DE/EN-Locale-Erkennung, manueller Switch, session-isolierte Live-Demo und responsive Breakpoints sind vorhanden. Die neue Live-Demo ist seit dem 1. September 2026 auf `qr2buy.com` deployed.

Die primäre Frontpage-Zielgruppe sind Händler und Standbetreiber. Ihr Kernproblem ist der Verkauf ohne ständig anwesendes Personal beziehungsweise außerhalb regulärer Öffnungszeiten. Direkt nach dem Hero folgt die als reale Hardware-Simulation eingeordnete Live-Demo; Hardwarebeweis, wirtschaftlicher Nutzen, individueller Pilot und FAQ stehen erst danach. Unmittelbar oberhalb des interaktiven Displays macht ein kontrastreicher Sicherheitsstreifen Stripe-Sandbox, offizielle Testkarte, ausgeschlossene Abbuchung und ausgeschlossene echte Bestellung unübersehbar. Nutzenargumente bleiben ohne erfundene Kennzahlen oder ROI-Versprechen. Der Pilot wird individuell mit ecily geplant und kann je nach Rahmen kostenlos oder gefördert umgesetzt werden; alle zentralen CTAs führen zu `https://ecily.com/de/start-up`.

Die Demo bleibt technisch unverändert session- und produktisoliert. Das große Gerät ist ausdrücklich als Simulation des physischen qr2buy-Displays beschriftet; fiktive Produkte, fiktive Bestände und Stripe-Sandbox werden klar getrennt von der belegbaren realen Hardware dargestellt. Reale Hardwarefotos und ein kurzes Hardwarevideo sind bewusst der nächsten visuellen UX-Runde vorbehalten; es gibt derzeit keine generierten Medien oder leeren Platzhalter.

## Session-isolierte Live-Demo (produktiv deployed)

Die bisher rein lokale Landingpage-Simulation wurde durch einen getrennten End-to-End-Demo-Pfad ersetzt. Jede geöffnete Frontpage erzeugt ein kryptografisch zufälliges Token; MongoDB speichert nur dessen SHA-256-Hash. Das Token verbindet den scanbaren QR-Code und `/demo/p/:productKey` genau mit dieser Frontpage-Session. Vier Demo-Produkte und ihre Preise kommen aus einem serverseitigen Katalog. Demo-Aktionen importieren oder verändern weder `Product` noch `Device` oder `Order`.

`DemoSession` speichert pro Produkt `READY`, `CHECKOUT_STARTED`, `PAID`, `SOLD`, `RESERVED` oder `CANCELLED`, Event-Version, Checkout-Zuordnung und Reset-Zeit. Ein TTL-Index entfernt Sessions standardmäßig nach zwei Stunden. Wiederverwendbare Produkte werden nach 20 Sekunden session- und produktbezogen zurückgesetzt. Die konkrete Nordmanntanne Nr. 17 wechselt nach `PAID` zunächst durch dieselbe 20-Sekunden-Bestätigung und danach dauerhaft auf `SOLD`; ihre Reservierung bleibt innerhalb der Session dauerhaft `RESERVED`. Andere Sessions starten unabhängig mit `READY`.

Der dargestellte Lagerstand ist ausschließlich eine glaubwürdige Demo-Simulation und kein Inventarsystem: Tanne 1 mit weiteren Tannen, gerahmtes Stadtbild 1 mit weiteren Motiven und Ledertasche 3 mit weiteren Modellen. Nur die konkrete Tanne wird innerhalb ihrer Session dauerhaft blockiert. Demo-Daten bleiben vollständig getrennt von `Product`, `Order`, `Device` und realem Bestand.

Das simulierte Hardware-Display der Frontpage leitet seinen Inhalt direkt aus demselben session- und produktgebundenen SSE-Status ab. `READY` und `CHECKOUT_STARTED` zeigen weiterhin Produkt, Preis und QR-Code. Bei `PAID`, `RESERVED` oder `SOLD` wird ausschließlich der innere Displayinhalt durch eine lokalisierte Bestätigung ersetzt; der QR-Code wird dabei nicht gerendert. Wiederverwendbare Produkte kehren nach serverseitigem Reset zur normalen Ansicht zurück, während die konkrete Tanne dauerhaft als verkauft beziehungsweise reserviert sichtbar und weiterhin auswählbar bleibt.

Neue Routen:

- `POST /api/demo/sessions`
- `GET /api/demo/sessions/:token`
- `GET /api/demo/sessions/:token/products/:productKey`
- `POST /api/demo/sessions/:token/products/:productKey/reserve`
- `POST /api/demo/sessions/:token/products/:productKey/checkout`
- `POST /api/demo/sessions/:token/products/:productKey/cancel`
- `GET /api/demo/sessions/:token/events`
- `POST /api/demo/stripe/webhook`

Hardware-Synchronisierung Stufe 1 ist im Backend produktiv deployed und durch Tests sowie Live-Smoke bestätigt. Ein TTL-gebundenes `DemoHardwareBinding` koppelt genau eine autorisierte `deviceId` an eine bestehende `DemoSession` und einen `productKey`; die `DemoSession` bleibt alleinige Status- und Produktzustandsquelle. Session-Tokens werden ausschließlich mit AES-256-GCM und einem ENV-Schlüssel verschlüsselt gespeichert. Pairing und Hardware-Abruf besitzen getrennte ENV-Secrets und Rate-Limits. Die neuen Routen sind `POST`/`PATCH /api/demo/sessions/:token/hardware-binding` sowie `GET /api/demo/hardware/config?deviceId=...`; fehlende oder abgelaufene Bindings liefern regulär `{ ok: true, bound: false }`.

Hardware-Synchronisierung Stufe 2 ist im Frontend produktiv deployed und durch Tests, Lint, Produktionsbuild und Live-Smoke bestätigt. Die Frontpage stellt ihre gültige DemoSession aus `sessionStorage` wieder her und erzeugt nur bei fehlendem, ungültigem oder abgelaufenem Token eine neue. Ein bewusst sekundäres DE/EN-Operator-Werkzeug koppelt `demo-device` erst nach manueller Pairing-Code-Eingabe; das Secret wird ausschließlich als Request-Header verwendet und weder persistiert noch geloggt. Bei bestehender Kopplung synchronisiert die Frontpage tatsächliche Produkt- oder Locale-Wechsel per PATCH; Fehler trennen nur den Hardwarestatus und lassen Demo-Journey, SSE und Polling weiterlaufen.

Die Mobile-Journey kennzeichnet QR-Produktseite, Vorstufe, Checkout-Rückkehr und Bestätigung durchgehend freundlich als Live-Demo ohne Abbuchung, echte Bestellung oder Lieferung. Sie nennt Stripe-Sandbox, Testkarte und frei erfundene Namens-/Adressdaten in DE und EN. Eine erreichbare E-Mail-Adresse ist nur für die optionale einmalige Demo-Bestätigung sinnvoll und ist mit keiner Marketingeinwilligung verbunden.

Die verkürzte Mobile-Journey führt vom QR-Scan direkt zu Produktentscheidung und einem kompakten Demo-Checkpoint im Produktbereich. Der primäre Übergang kopiert nach ausdrücklicher Nutzeraktion die Stripe-Testkartennummer und erzeugt erst danach den gehosteten Sandbox-Checkout. Scheitert Clipboard-Zugriff, bleiben Testkarte und verständliche Fehlermeldung sichtbar; Stripe öffnet sich dann ausschließlich über eine separate Nutzeraktion. Reservierungen laufen ohne zusätzliche Bestätigungsseite direkt serverseitig. Die mobile Erfolgsansicht erklärt knapp den bestätigten Smartphone-zu-Frontpage-Cycle und grenzt die Websimulation klar vom realen physischen Schild am Produkt ab. PAID-, RESERVED-, SOLD-, SSE-, Polling- und 20-Sekunden-Reset-Logik bleiben unverändert.

Demo-Checkout akzeptiert ausschließlich `STRIPE_DEMO_SECRET_KEY` mit Test-Key-Präfix. In Production werden QR-Rücksprungziele nur aus einer öffentlichen HTTPS-Origin erzeugt; lokale, private oder mit Zugangsdaten versehene Origins werden abgewiesen. Ist die optionale konfigurierte Origin syntaktisch ungültig, darf ausschließlich die ebenfalls validierte öffentliche HTTPS-Origin des aktuellen Requests einspringen. Er begrenzt Zahlungsarten auf `card`, deaktiviert Link per Session und schließt damit insbesondere Klarna aus. Produkt- und PaymentIntent-Beschreibung beginnen mit `qr2buy Live-Demo`; Success-URL und Client dürfen keinen Zahlungsstatus setzen. Der signierte Test-Webhook akzeptiert nur `livemode === false`, ruft die Checkout-Session zusätzlich serverseitig ab und setzt nur nach nachgewiesenem `paid` auf `PAID`.

Ein qr2buy-eigener Mail-Service kapselt optionales SMTP über verpflichtendes TLS; standardmäßig bleibt er deaktiviert, für Tests existiert ein Memory-Transport. Es wurde kein externer Anbieter ausgewählt. Erst der erfolgreiche idempotente Übergang zu `PAID` beansprucht genau einen Versandversuch pro Checkout. Wiederholte Webhooks versenden nicht erneut; Mailfehler ändern `PAID` nicht und werden nicht automatisch wiederholt. Die vollständige E-Mail wird ausschließlich aus der serverseitig verifizierten Stripe-Session im Arbeitsspeicher verwendet. MongoDB speichert nur den Versandstatus, keine Adresse. Eine nicht zustellfähige Maske lebt kurzzeitig im Prozessspeicher für die Mobile-Rückmeldung und wird nie per SSE übertragen. Logs, URLs und Fehlermeldungen enthalten keine E-Mail-Adresse.

Die Nachricht enthält einen hochwertigen HTML-Demo-Beleg statt PDF-Anhang, klar markiert als `DEMO-BELEG · KEINE ECHTE RECHNUNG · NICHT STEUERLICH GÜLTIG`, ohne Firmenanschrift, UID, Zahlungsforderung, Marketing oder Trackingpixel.

Benötigte Deployment-ENV-Namen ohne Werte:

- `STRIPE_DEMO_SECRET_KEY` – separater Stripe-Test-Secret-Key
- `STRIPE_DEMO_WEBHOOK_SECRET` – Signatur-Secret des Demo-Webhooks
- `DEMO_PUBLIC_BASE_URL` – optionaler öffentlicher Origin, sonst `PUBLIC_BASE_URL` beziehungsweise Request-Origin
- `DEMO_HARDWARE_PAIRING_SECRET` – Operator-Secret für die ausdrückliche Hardwarekopplung
- `DEMO_HARDWARE_ENCRYPTION_KEY` – 32-Byte-Schlüssel für AES-256-GCM-verschlüsselte Session-Tokens
- `DEMO_HARDWARE_DEVICE_SECRETS` – serverseitige Zuordnung autorisierter Geräte zu ihren Secrets
- `DEMO_SESSION_TTL_MINUTES` – optional, Standard 120 Minuten
- `DEMO_MAIL_TRANSPORT` – `disabled` oder `smtp`; standardmäßig deaktiviert
- `DEMO_SMTP_HOST`, `DEMO_SMTP_PORT`, `DEMO_SMTP_USER`, `DEMO_SMTP_PASS`, `DEMO_SMTP_FROM`, `DEMO_SMTP_HELO_NAME` – ausschließlich qr2buy-eigener SMTP-over-TLS-Transport

`backend/.env.example` ist gezielt versionierbar und enthält ausschließlich sichere Platzhalter. Reale `.env`- und `.env.*`-Dateien bleiben ignoriert. SMTP wird nur bei vollständig vorhandener TLS-Konfiguration aktiviert; andernfalls bleibt der optionale Transport ohne Einfluss auf Checkout und Zahlungsstatus deaktiviert.

Lokaler Test: MongoDB bereitstellen, Backend und Frontend starten, Frontpage öffnen, QR mit einem zweiten Gerät scannen oder „Demo auf diesem Gerät öffnen“ verwenden. Für Stripe ausschließlich Testdaten verwenden. Der lokale Stripe-Listener muss Testevents an `/api/demo/stripe/webhook` weiterleiten und dessen Signatur-Secret sicher als ENV setzen. Reservierung benötigt kein Stripe. Frontpage und Produktseite gleichen den Zustand per SSE plus Polling ab.

Manuelle Stripe-Sandbox-Konfiguration: In den Testmodus-Branding-Einstellungen Business-/Display-Name und Logo auf qr2buy setzen, falls Checkout noch `www.ecily.com` zeigt. Stripe dokumentiert die Anzeige außerdem über `branding_settings.display_name`; wegen der im Projekt fest gesetzten älteren API-Version bleibt die Dashboard-Einstellung der verlässliche Weg bis zu einer separat geprüften API-Migration. Link wird bereits per Checkout-Session deaktiviert. In den Testmodus-Zahlungsmethoden zusätzlich prüfen, dass keine Wallet- oder beschleunigte Methode die sichtbare Testkartenführung umgeht.

Produktions-Webhook: Im Stripe-Sandbox-Dashboard muss ein öffentlicher Endpoint `https://qr2buy.com/api/demo/stripe/webhook` für `checkout.session.completed` und `checkout.session.async_payment_succeeded` bestehen. Dessen eigenes Signing Secret gehört als `STRIPE_DEMO_WEBHOOK_SECRET` ins Backend. Das von `stripe listen` ausgegebene lokale CLI-Secret ist für diesen öffentlichen Endpoint nicht gültig und darf in Production nicht verwendet werden.

Aktueller Nachweis: Die Cross-Device-Abnahme mit Smartphone-QR-Scan, mobiler Produktseite, Stripe-Testcheckout, signiertem Webhook, Rückmeldung auf Smartphone, Frontpage und simuliertem Hardwaredisplay sowie Reservierungs-, Zahlungs- und Reset-Zuständen war erfolgreich. Commit `a3b8c64` brachte die Demo auf `main`; `51f361b` härtete anschließend die validierte öffentliche Checkout-Origin ab. Am 1. September 2026 ab 18:10 Uhr MESZ waren Root, beide Mobile-Sprachrouten, Same-Origin- und direkter Backend-Healthcheck öffentlich erreichbar. Session-Erzeugung, vier `READY`-Produkte, öffentliche HTTPS-QR-Ziele mit Token ausschließlich im Fragment, session- und produktisolierte Reservierung per SSE, automatischer 20-Sekunden-Reset und Stripe-Sandbox-Checkout-Erzeugung waren live grün. Der Checkout lieferte ausschließlich eine HTTPS-Stripe-URL mit `cs_test_`; ein unsignierter Webhook wurde mit 400 abgewiesen.

Abschlussprüfung: 21 Backend-Tests, vollständige Backend-Syntaxprüfung, sicherer Production-Start-Smoke, 5 Frontend-Tests, Frontend-Lint, Produktionsbuild und `git diff --check` sind grün. Backend- und Frontend-Audit melden jeweils 0 Schwachstellen; seitdem wurden keine Abhängigkeiten geändert. Im ausgelieferten Build sind DE/EN, `aria-live` und `prefers-reduced-motion` vorhanden. In der Abschlusssitzung war kein steuerbarer Browser verfügbar; die erneute visuelle Desktop-/Mobile-Abnahme bleibt deshalb manuell. Ohne neue Testzahlung wurden außerdem weder die Herkunft des öffentlichen Dashboard-Webhook-Secrets noch der live signierte `PAID → SOLD`-Pfad erneut bewiesen. SMTP bleibt optional und benötigt nach vollständiger separater qr2buy-Konfiguration einen echten Zustelltest.

## Firmware und Hardware

Die bestätigten Environments sind `esp32dev_spi_cs5_rst4_app`, `esp32dev_spi_cs5_rst4_qr_diag` und `esp32dev_spi_cs5_rst4_tft_diag`. Der App-Pfad initialisiert TFT, verbindet WLAN, ruft die Config-URL ab, zeigt Zwischenzustände (`Verbinde WLAN`, `Lade Config`) sowie Fehlerzustände und rendert danach Produkttext, Status und QR.

Die Firmware-Online-Config ist mit `367f548 firmware: fetch qr config from backend` committed und gepusht. Alle drei genannten Environments bauen erfolgreich. Der Firmware-Diff enthielt keine echten Secret-Treffer; `firmware/qr_display_fw/src/secrets.h` ist ignoriert.

Der aktive App-Pfad testet alle lokal in `WIFI_LIST` hinterlegten WLANs nacheinander mit einem Timeout pro Netz und verwendet die erste erfolgreiche Verbindung. Passwörter werden nicht protokolliert; bei vollständigem Fehlschlag bleibt der bestehende Displayzustand `WLAN Fehler` erhalten.

Hardware-Synchronisierung Stufe 3 ist auf `main` committed und im aktiven Environment `esp32dev_spi_cs5_rst4_app` durch neun statische Vertragsprüfungen sowie einen grünen Build bestätigt, aber noch nicht auf den ESP32 geflasht. Die Firmware pollt die gekoppelte Demo-Hardware-Projektion alle drei Sekunden in einem Hintergrund-Task, authentifiziert `demo-device` per lokalem Geräte-Secret und validiert TLS über die öffentliche GlobalSign-ECC-Root-CA nach nicht blockierender NTP-Zeitsynchronisierung. WLAN-Fallback und Runtime-Reconnect behalten den letzten gültigen Displayzustand. `bound:false`, Produktwechsel und alle Demo-Status werden backendgeführt gerendert; QR-Codes erscheinen nur für `READY`, `CHECKOUT_STARTED` und `CANCELLED` und wählen ihre Version längenabhängig bis Version 10. Der bestätigte Build mit lokal konfiguriertem Geräte-Secret nutzt 47.980 Byte RAM und 972.885 Byte Flash.

`display_diag.cpp` ist der bestätigte SPI-Diagnosepfad. `parallel8080_diag.cpp` und die Legacy-TFT_eSPI-Setups sind Diagnose-/Fallbackpfade; insbesondere GPIO32/33 verursachen bekannte TFT_eSPI-Maskenwarnungen. `src/secrets.h` wird nicht gelesen oder dokumentiert und bleibt ignoriert.

## Datenbank, Atlas und Deployment

MongoDB Atlas ist als Online-Datenbank vorgesehen; konkrete URIs und ENV-Werte werden nicht dokumentiert. Das Backend läuft online auf DigitalOcean. Die gemeinsame App verwendet Backend-Route `/api` mit Preserve Full Path und Healthcheck `/api/health`; die Frontend-Static-Site läuft auf `/` mit SPA-Catchall `index.html`.

Zielarchitektur: `qr2buy.com` und `www.qr2buy.com` auf DigitalOcean App Platform, `/` und `/p/*` auf Frontend Static Site mit SPA-Fallback, `/api/*` auf Backend Web Service, HTTPS aktiv. Firmware kann vorübergehend die direkte Backend-DO-URL nutzen.

Konkrete DigitalOcean-Konfiguration: Static-Site-Komponente `qr2buy-frontend`, Source Directory `frontend`, Build `npm ci && npm run build`, Output `dist`, Route `/`, SPA-Catchall `index.html`. Backend-Komponente `qr2buy-backend`, Source Directory `backend`, Route `/api` mit Preserve Full Path, Healthcheck `/api/health`, Port `8080`. Custom Domains sind aktiv: `qr2buy.com` als Primary und `www.qr2buy.com`. DNS: `@` zeigt auf die beiden DigitalOcean-A-Records `162.159.140.98` und `172.66.0.96`; `www` ist ein CNAME auf die DigitalOcean-App. Der alte `@`-Record `91.227.204.35` wurde ersetzt. Der Wildcard-Record `*` zeigt noch auf `91.227.204.35` und ist später zu prüfen. Mail-/MX-/TXT-/NS-Records blieben unverändert.

## Risiken und offene MVP-Tasks

1. **Grün:** Domain/DNS/HTTPS/Routing und Same-Origin-API sind technisch live.
2. **Gelb:** Der Stripe-Sandbox-Checkout wird live erzeugt; öffentlicher Dashboard-Webhook, signierter `PAID → SOLD`-Pfad und optionale SMTP-Zustellung müssen nach der Deploy-Korrektur noch einmal manuell ohne Live-Zahlung verifiziert werden. Das Projekt akzeptiert absichtlich keine Stripe-Live-Keys oder Live-Events.
3. **Gelb:** Device-Config auto-provisioniert Geräte; Secret-Prüfung greift nur bei mitgesendetem Header, und Device-Secrets liegen unverschlüsselt im Modell.
4. **Gelb:** Admin-Basic-Auth und der Dev-Fallback sind für ein internes MVP brauchbar, aber nicht als endgültige Produktionsauthentifizierung.
5. **Gelb:** Wildcard-DNS zeigt noch auf den alten Host; eine alte separate Frontend-App ist später auf Bereinigung zu prüfen.
6. **Grün:** Backend-Health, Demo-Public-Flow, SPI-Display und scanbarer QR-Diagnosepfad sind vorhanden.

## Nächste konkrete Schritte

1. Landing Page nach User-Abnahme weiter schärfen.
2. Demo-Produktseite optisch prüfen.
3. Alte separate `qr-frontend`-App und mögliche Kostenbereinigung prüfen.
4. SOLD-/Reservieren-/Kaufen-Demo priorisieren.
5. Öffentlichen Stripe-Sandbox-Webhook inklusive `PAID → SOLD` nach Deploy erneut verifizieren und sicherstellen, dass dessen Dashboard-Secret statt eines lokalen CLI-Secrets gesetzt ist.
6. Demo-Journey, Stripe, SOLD und Reservierung technisch vertiefen.
7. Christbaum-Subseite später als schlanke DE/EN-Subseite prüfen.

## Arbeitsregeln für zukünftige Codex-Aufgaben

- Zuerst dieses Dokument lesen und den aktuellen Git-Status prüfen.
- Ausschließlich qr2buy.com bearbeiten.
- Bestehende uncommittete Firmware-Änderungen nicht überschreiben.
- Keine Secrets lesen, ausgeben, tracken oder committen; keine echten ENV-Werte dokumentieren.
- Änderungen schlank halten, keine ungefragten Refactorings.
- Nach Änderungen `git diff --check` und `git status` prüfen und den operativen Kontext aktualisieren.

## Letzter bekannter Git-Status

Die Landingpage wurde in der zweiten Vertrauensrunde weiter geschärft: Öffnungszeiten, bestätigte Zahlung sowie klare Rückmeldung für Käufer, Verkäufer und Display stehen im Zentrum. Hero und Demo verlinken die Partneransprache zu `https://ecily.com/de/start-up`; zusätzlich dokumentiert die Seite leistbare Display-Hardware, den geschützten Händlerbereich im Demo-MVP und die technische Verbindung von Produktseite, Backend, Datenbank und Display. Amazon wird nur einmal in einem separaten Marktabschnitt erwähnt.

The landing page was refined in the second trust round: opening hours, confirmed payment and clear feedback for buyer, seller and display are central. Hero and demo partner CTAs link to `https://ecily.com/de/start-up`; the page also documents affordable display hardware, the protected merchant area in the demo MVP and the technical connection between product page, backend, database and display. Amazon is mentioned only once in a separate market section.

Hardware-Synchronisierung Stufe 1 bis 3 wurde mit Commit `8de5efa` auf `main` veröffentlicht. Die DigitalOcean-App `qr-backend` deployt daraus `qr2buy-backend` und `qr2buy-frontend`; beide Komponenten waren am 4. September 2026 ACTIVE. Die drei Hardware-ENV-Namen sind ausschließlich am Backend-Service gesetzt, `DEMO_PUBLIC_BASE_URL` ist `https://qr2buy.com`. Der Live-Smoke bestätigte Frontpage und Health mit HTTP 200, neue DemoSession und unveränderte `READY`-Ausgangszustände, den Hardware-Endpunkt ohne Geräte-Secret mit 401 sowie mit Geräte-Secret vor der Kopplung mit `{ ok: true, bound: false }`. Das autorisierte Live-Binding projizierte `bag`, danach per PATCH `tree` und abschließend wieder `bag`; die QR-Ziele verwiesen jeweils exakt auf dieselbe DemoSession. Es wurden weder Reservierung noch Zahlung ausgelöst. Lokale ENV- und Firmware-Secret-Dateien bleiben ignoriert; die Firmware ist weiterhin nicht geflasht.
