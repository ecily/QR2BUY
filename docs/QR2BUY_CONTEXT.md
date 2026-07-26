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
- Frontend ist eine React/Vite-SPA mit Landingpage, Admin-Ansicht und Produktroute `/p/:shortId`.
- Firmware hat einen funktionierenden SPI-Pfad und einen Online-Config-App-Pfad.
- Hardware-Referenz: ESP32, SPI, CS GPIO5, RST GPIO4, DC GPIO15, MOSI GPIO23, MISO GPIO19, SCLK GPIO18, COM3.
- `qr2buy.com` zeigt noch nicht korrekt auf die DigitalOcean-App; DNS/Domain/HTTPS/Routing bleiben MVP-Punkte.
- Letzte lokale Domain-Prüfung: `qr2buy.com` und `www.qr2buy.com` lösen weiterhin auf `91.227.204.35` auf. HTTP liefert dort `nginx/1.6.2`; `/p/demo` ist 404. HTTPS/DO-HTTPS waren aus der lokalen Windows-curl-Umgebung wegen TLS-/Verbindungsfehlern nicht verifizierbar.

## Backend

Start: `npm start` (`node src/index.js`), Entwicklung: `npm run dev`, Demo-Daten: `npm run seed`. Konfiguration erfolgt über nicht zu dokumentierende ENV-Werte; Mongo fällt lokal auf eine lokale `qr2buy`-Datenbank zurück.

Routen:

- `GET /api/health`, `GET /api/events`, WebSocket `/ws`
- Public: `GET /api/public/products/by-short/:shortId`, `GET /api/public/products/:id`, `GET /api/public/status/by-short/:shortId`
- Admin, Basic Auth: Product-/Device-CRUD, Link/Unlink und Status-Override unter `/api/admin/*`
- Checkout: `POST /api/checkout/:productId`, `POST /api/checkout/by-short/:shortId`, `GET /api/checkout/verify`
- Stripe: `POST /api/stripe/webhook`
- Firmware: `GET /api/config?deviceId=...`; Legacy: `GET /api/config` ohne Device-ID und `POST /api/updateDisplay`

Modelle sind `Product`, `Device`, `Order` sowie der Legacy-Singleton `DisplayState`. Product und Device können einander verlinken; Status ist `AVAILABLE` oder `SOLD`. Device-Secret ist im MVP noch als Klartextfeld modelliert. Der Config-Endpunkt provisioniert unbekannte Geräte automatisch und aktualisiert `lastSeenAt`.

Admin nutzt `ADMIN_USER`/`ADMIN_PASS`; in Nicht-Production existiert ein Dev-Fallback. Stripe Checkout und Webhook sind implementiert, aber nur mit korrekt gesetzten Server-Secrets produktionsbereit. Webhook-Signatur wird in Production verlangt.

## Frontend

Die API-Basis kommt aus `VITE_API_BASE` und fällt lokal auf `/api` zurück. Routen: `/`, `/p/:shortId`, `/admin`. Die Produktseite lädt öffentliche Produktdaten, zeigt Status/Preis und startet Checkout; Admin lädt Produkte/Geräte, legt sie an, verlinkt sie und setzt Status. SSE `/api/events` wird für den Dashboard-Status genutzt.

Vite erzeugt `frontend/dist`. Für eine getrennte Static Site müssen `/` und `/p/*` per SPA-Fallback auf `index.html` zeigen; eine solche Deployment-Datei fehlt derzeit im Repo.

## Firmware und Hardware

Die bestätigten Environments sind `esp32dev_spi_cs5_rst4_app`, `esp32dev_spi_cs5_rst4_qr_diag` und `esp32dev_spi_cs5_rst4_tft_diag`. Der App-Pfad initialisiert TFT, verbindet WLAN, ruft die Config-URL ab, zeigt Zwischenzustände (`Verbinde WLAN`, `Lade Config`) sowie Fehlerzustände und rendert danach Produkttext, Status und QR.

Die Firmware-Online-Config ist mit `367f548 firmware: fetch qr config from backend` committed und gepusht. Alle drei genannten Environments bauen erfolgreich. Der Firmware-Diff enthielt keine echten Secret-Treffer; `firmware/qr_display_fw/src/secrets.h` ist ignoriert.

`display_diag.cpp` ist der bestätigte SPI-Diagnosepfad. `parallel8080_diag.cpp` und die Legacy-TFT_eSPI-Setups sind Diagnose-/Fallbackpfade; insbesondere GPIO32/33 verursachen bekannte TFT_eSPI-Maskenwarnungen. `src/secrets.h` wird nicht gelesen oder dokumentiert und bleibt ignoriert.

## Datenbank, Atlas und Deployment

MongoDB Atlas ist als Online-Datenbank vorgesehen; konkrete URIs und ENV-Werte werden nicht dokumentiert. Das Backend läuft online auf DigitalOcean. Im Repo fehlt eine DigitalOcean App Spec sowie eine explizite Static-Site-/SPA-Rewrite-Konfiguration.

Zielarchitektur: `qr2buy.com` und `www.qr2buy.com` auf DigitalOcean App Platform, `/` und `/p/*` auf Frontend Static Site mit SPA-Fallback, `/api/*` auf Backend Web Service, HTTPS aktiv. Firmware kann vorübergehend die direkte Backend-DO-URL nutzen.

Konkrete DigitalOcean-Konfiguration: Static-Site-Komponente `qr-frontend`, Source Directory `frontend`, Build `npm ci && npm run build`, Output `dist`, Route `/`, SPA-Catch-all auf `index.html`. Backend-Komponente `qr-backend`, Source Directory `backend`, Route `/api` mit erhaltenem Path Prefix, Healthcheck `/api/health`, Port `8080`. Eine App Spec ist im Repo nicht vorhanden. Die exakten DNS-Zielwerte müssen aus dem DigitalOcean-Domain-Dialog übernommen werden.

## Risiken und offene MVP-Tasks

1. **Rot:** Domain/DNS/HTTPS/Routing ist noch nicht korrekt produktiv verbunden.
2. **Rot:** Stripe-Live-Konfiguration und echter End-to-End-Kauf müssen mit sicheren Server-ENV-Werten verifiziert werden.
3. **Gelb:** Device-Config auto-provisioniert Geräte; Secret-Prüfung greift nur bei mitgesendetem Header, und Device-Secrets liegen unverschlüsselt im Modell.
4. **Gelb:** Admin-Basic-Auth und der Dev-Fallback sind für ein internes MVP brauchbar, aber nicht als endgültige Produktionsauthentifizierung.
5. **Gelb:** Deployment-/SPA-Fallback-Konfiguration fehlt im Repo.
6. **Grün:** Backend-Health, Demo-Public-Flow, SPI-Display und scanbarer QR-Diagnosepfad sind vorhanden.

## Nächste konkrete Schritte

1. DigitalOcean Routing, Domain, DNS und HTTPS für Frontend/API festlegen und verifizieren.
2. SPA-Fallback für `/p/*` und `/` im Deployment einrichten.
3. Demo-Produkt auf der öffentlichen Domain öffnen und QR-Scan bis Produktseite testen.
4. Stripe-Testcheckout inklusive Webhook und `SOLD`-Status verifizieren.
5. Erst danach Firmware auf die öffentliche Config-/Produkt-URL umstellen und Hardware-Demo durchführen.

## Arbeitsregeln für zukünftige Codex-Aufgaben

- Zuerst dieses Dokument lesen und den aktuellen Git-Status prüfen.
- Ausschließlich qr2buy.com bearbeiten.
- Bestehende uncommittete Firmware-Änderungen nicht überschreiben.
- Keine Secrets lesen, ausgeben, tracken oder committen; keine echten ENV-Werte dokumentieren.
- Änderungen schlank halten, keine ungefragten Refactorings.
- Nach Änderungen `git diff --check` und `git status` prüfen und den operativen Kontext aktualisieren.

## Letzter bekannter Git-Status

Branch `main` ist nach dem Firmware-Commit mit `origin/main` synchron. Aktueller Git-Status: ausschließlich `docs/` ist untracked.
