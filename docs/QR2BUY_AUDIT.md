# qr2buy.com – Projekt-Audit

> **Historische Momentaufnahme vom 26. Juli 2026.** Dieses Audit dokumentiert den damaligen Ausgangsstand und ist keine Beschreibung des heutigen Systems. Inzwischen umgesetzte Live-Demo-, Test-, Security-, Hardware-Binding- und Displaystände stehen ausschließlich in [`QR2BUY_CONTEXT.md`](./QR2BUY_CONTEXT.md); bei jedem Widerspruch gilt diese zentrale Source of Truth.

## Zusammenfassung

Das Repo enthält einen schlanken MVP-Kern mit Express/MongoDB-Backend, React/Vite-Frontend, funktionierendem SPI-TFT-/QR-Pfad und Online-Geräte-Config. Der DigitalOcean-/Domain-Livegang ist erfolgreich abgeschlossen. Stripe und der öffentliche Kauf müssen end-to-end weiterhin verifiziert werden.

## Geprüfte Bereiche und Dateien

Geprüft wurden Git-Status/Log/Struktur, `.gitignore`, Backend-Package und die relevanten Router/Modelle/Middleware/Skripte, Frontend-Package/Vite/App/API/Admin/Landing/CSS, PlatformIO-Konfiguration, Firmware-App/Diagnosepfade/Setup-Header/Beispieldatei sowie mögliche Deployment-Dateien. `firmware/qr_display_fw/src/secrets.h` und lokale ENV-Dateien wurden nicht gelesen oder angezeigt.

## Backend-Befunde

Express startet auf `PORT`/`HOST`, nutzt Helmet, CORS, JSON-Limit und Pino. MongoDB wird über ENV konfiguriert. Public Product Flow und Config Flow sind vorhanden. Admin-Routen sind durch Basic Auth geschützt. Checkout nutzt Stripe Sessions; der Webhook markiert Produkt/Gerät als `SOLD` und schreibt idempotent ein Order-Log. SSE, WebSocket und Legacy-Display-Routen bestehen parallel; `/api/config` ohne `deviceId` wird bewusst legacy behandelt.

Risiken: ungeschützte/optionale Geräte-Secret-Prüfung, Klartext-Device-Secret im Modell, Dev-Fallback `admin/admin`, breite CORS-Default-Konfiguration und fehlende automatisierte Tests. Der Legacy-Pfad erhöht die Komplexität, ist für die Migration aber dokumentiert.

## Frontend-Befunde

React Router stellt `/`, `/p/:shortId` und `/admin` bereit. API-Aufrufe laufen über `VITE_API_BASE` bzw. `/api`. Die Produktseite lädt öffentliche Daten und startet Checkout; Admin verwaltet Produkte/Geräte und deren Verknüpfung. Vite-Build und produktiver SPA-Fallback sind vorhanden; `/p/demo` ist live erreichbar.

## Firmware-Befunde

Der SPI-Pfad mit CS 5/RST 4 ist als funktionierend dokumentiert; QR-Diagnose ist scanbar. `esp32dev_spi_cs5_rst4_app` ruft die Online-Config ab und zeigt WLAN-, Lade-, Fehler- und Produkt/QR-Zustände. Der Firmware-Commit `367f548` wurde erfolgreich committed und gepusht. Die Builds von `esp32dev_spi_cs5_rst4_app`, `esp32dev_spi_cs5_rst4_qr_diag` und `esp32dev_spi_cs5_rst4_tft_diag` sind grün. Im Firmware-Diff gab es keine echten Secret-Treffer. Es traten nur die erwarteten `TOUCH_CS`-Warnungen von TFT_eSPI auf. Parallel-8080 und ältere TFT_eSPI-Setups bleiben Diagnose-/Fallbackpfade. Bekannte GPIO32/33-Warnungen gelten nur für relevante Legacy-TFT_eSPI-Pfade.

## Security-Befunde ohne Secret-Werte

- `.gitignore` ignoriert `backend/.env`, `.env.*`, `backend/.env.example` sowie Firmware-Secret-/Credential-Dateien.
- Die drei geprüften Secret-Pfade werden durch `.gitignore` abgedeckt.
- Getrackt ist nur `firmware/qr_display_fw/src/secrets.example.h`; es enthält Platzhalter und keine echten Werte.
- Treffer der Indikatorprüfung betreffen ausschließlich ENV-Namen, Kommentare, Platzhalter und Codepfade; es wurden keine Secret-Werte dokumentiert.
- `backend/.env`, `src/secrets.h` und konkrete Datenbank-/Stripe-/WLAN-Werte wurden nicht gelesen oder ausgegeben.

Bewertung: Repository-Hygiene grün; Produktionsauthentifizierung und Geräte-Secret-Handling gelb/rot und vor Live-Betrieb zu härten.

## Deployment-Befunde

Die gemeinsame DigitalOcean-App enthält `qr2buy-backend` als Web Service unter `/api` mit Preserve Full Path und Healthcheck `/api/health` sowie `qr2buy-frontend` als Static Site unter `/` mit SPA-Catchall `index.html`. `qr2buy.com` ist Primary Domain, `www.qr2buy.com` ist aktiv. Der alte Apex-Record wurde ersetzt; der Wildcard-Record zeigt noch auf den alten Host. Eine App Spec ist nicht im Repo abgelegt.

## Produktionsabschluss

Grün: `qr2buy.com` live, `www.qr2buy.com` live, `/p/demo` live, `/api/health` live und Demo-Product-Endpoint live.

Gelb: Wildcard-DNS zeigt noch alt; alte separate `qr-frontend`-App wahrscheinlich noch vorhanden und später auf Bereinigung zu prüfen; Norton Safe Web bleibt ein lokales Reputationsthema; Landing Page ist noch nicht pitchbar genug.

Rot: Stripe-End-to-End sowie SOLD-/Checkout-/Reservation-Flow sind weiterhin offen.

## Build-/Test-Befunde

- Backend: kein `test`- oder `build`-Script; `npm run` bestätigt nur `start`, `dev`, `seed`. Kein Dependency-Install erforderlich, `node_modules` war vorhanden.
- Frontend: `npm run build` erfolgreich; Vite 7.1.9 erzeugte `dist`.
- Firmware: PlatformIO `run` für `esp32dev_spi_cs5_rst4_app`, `esp32dev_spi_cs5_rst4_qr_diag` und `esp32dev_spi_cs5_rst4_tft_diag` erfolgreich. Hardware-Upload wurde nicht ausgeführt; nur erwartete `TOUCH_CS`-Warnungen.
- `npm start` wurde nicht dauerhaft gestartet, da der Dienst eine externe MongoDB-Verbindung benötigt.

## Ampel

- **Grün:** Repo-Scope und Secret-Ignorierung; Backend-Health/Public-API; Frontend-Build; SPI-Firmware-Build; Domain, www, `/p/demo`, `/api/health` und Demo-Product-Endpoint live.
- **Gelb:** Wildcard-DNS alt; mögliche alte separate Frontend-App; Norton-Reputationsthema; Landing Page noch nicht pitchbar; Legacy/SSE/WS-Zusatzpfade; Basic Auth/Dev-Fallback; optionaler Device-Secret-Schutz; fehlende automatisierte Backend-Tests.
- **Rot:** echter Stripe-/Webhook-/SOLD-/Checkout-/Reservation-End-to-End-Nachweis offen.

## Empfehlungen

Nächster Produktfokus ist eine initial pitchbare Landing Page. Danach Demo-Produktseite, alte separate Frontend-App/Kosten und SOLD-/Reservieren-/Kaufen-Demo prüfen. Stripe-End-to-End, Security-Härtung und automatisierte Tests folgen vor Produktion.
