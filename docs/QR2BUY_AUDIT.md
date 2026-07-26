# qr2buy.com – Projekt-Audit

## Zusammenfassung

Das Repo enthält einen schlanken, technisch weit fortgeschrittenen MVP-Kern: Express/MongoDB-Backend, React/Vite-Frontend, funktionierenden SPI-TFT-/QR-Pfad und Online-Geräte-Config. Der größte Blocker ist die noch nicht sauber verbundene öffentliche Domain inklusive Deployment-Routing. Stripe und der öffentliche Kauf müssen end-to-end verifiziert werden.

## Geprüfte Bereiche und Dateien

Geprüft wurden Git-Status/Log/Struktur, `.gitignore`, Backend-Package und die relevanten Router/Modelle/Middleware/Skripte, Frontend-Package/Vite/App/API/Admin/Landing/CSS, PlatformIO-Konfiguration, Firmware-App/Diagnosepfade/Setup-Header/Beispieldatei sowie mögliche Deployment-Dateien. `firmware/qr_display_fw/src/secrets.h` und lokale ENV-Dateien wurden nicht gelesen oder angezeigt.

## Backend-Befunde

Express startet auf `PORT`/`HOST`, nutzt Helmet, CORS, JSON-Limit und Pino. MongoDB wird über ENV konfiguriert. Public Product Flow und Config Flow sind vorhanden. Admin-Routen sind durch Basic Auth geschützt. Checkout nutzt Stripe Sessions; der Webhook markiert Produkt/Gerät als `SOLD` und schreibt idempotent ein Order-Log. SSE, WebSocket und Legacy-Display-Routen bestehen parallel; `/api/config` ohne `deviceId` wird bewusst legacy behandelt.

Risiken: ungeschützte/optionale Geräte-Secret-Prüfung, Klartext-Device-Secret im Modell, Dev-Fallback `admin/admin`, breite CORS-Default-Konfiguration und fehlende automatisierte Tests. Der Legacy-Pfad erhöht die Komplexität, ist für die Migration aber dokumentiert.

## Frontend-Befunde

React Router stellt `/`, `/p/:shortId` und `/admin` bereit. API-Aufrufe laufen über `VITE_API_BASE` bzw. `/api`. Die Produktseite lädt öffentliche Daten und startet Checkout; Admin verwaltet Produkte/Geräte und deren Verknüpfung. Vite-Build ist vorhanden. Für getrenntes Static Hosting fehlt ein SPA-Fallback für `/p/*`.

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

Keine DigitalOcean App Spec, YAML/YML, `static.json`, `_redirects`, `netlify.toml` oder `vercel.json` gefunden. Zielarchitektur bleibt: Domain/WWW auf DigitalOcean App Platform, Frontend Static Site mit SPA-Fallback, `/api/*` Backend-Service, HTTPS aktiv. Firmware darf kurzfristig direkt die DO-Backend-URL verwenden.

## Build-/Test-Befunde

- Backend: kein `test`- oder `build`-Script; `npm run` bestätigt nur `start`, `dev`, `seed`. Kein Dependency-Install erforderlich, `node_modules` war vorhanden.
- Frontend: `npm run build` erfolgreich; Vite 7.1.9 erzeugte `dist`.
- Firmware: PlatformIO `run` für `esp32dev_spi_cs5_rst4_app`, `esp32dev_spi_cs5_rst4_qr_diag` und `esp32dev_spi_cs5_rst4_tft_diag` erfolgreich. Hardware-Upload wurde nicht ausgeführt; nur erwartete `TOUCH_CS`-Warnungen.
- `npm start` wurde nicht dauerhaft gestartet, da der Dienst eine externe MongoDB-Verbindung benötigt.

## Ampel

- **Grün:** Repo-Scope und Secret-Ignorierung; Backend-Health/Public-API; Frontend-Build; SPI-Firmware-Build und dokumentierter scanbarer QR-Pfad.
- **Gelb:** fehlende automatisierte Backend-Tests; Legacy/SSE/WS-Zusatzpfade; Basic Auth/Dev-Fallback; optionaler Device-Secret-Schutz; fehlende Deployment-Dateien.
- **Rot:** öffentliche Domain/DNS/HTTPS/Routing nicht fertig; echter Stripe-/Webhook-/SOLD-End-to-End-Nachweis offen.

## Empfehlungen

Zuerst Domain und Deployment-Routing fertigstellen, inklusive SPA-Fallback. Danach Demo-QR über die öffentliche Domain prüfen und Stripe-Testkauf mit Webhook durchspielen. Erst nach diesen Abnahmetests die Firmware-Konfiguration für die Demo festziehen; Security-Härtung und Tests folgen vor Produktion.
