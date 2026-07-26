# qr2buy.com – MVP-Plan

## MVP-Ziel

Eine physische Ware im Schaufenster wird über einen scanbaren QR-Code auf dem ESP32-TFT geöffnet, auf der öffentlichen qr2buy-Domain angezeigt und über einen funktionierenden Stripe-Testcheckout gekauft. Nach erfolgreichem Webhook wird das Produkt als verkauft markiert.

## Muss-Flow

1. Produkt und Gerät im Admin anlegen und verlinken.
2. Backend liefert `/api/config?deviceId=...` mit Produktstatus und QR-URL.
3. ESP32 lädt die Config online und zeigt den QR-Code.
4. Scan öffnet `/p/:shortId` auf `qr2buy.com`.
5. Produktseite lädt öffentliche Daten und startet Checkout.
6. Stripe-WebHook bestätigt den Kauf; Product/Device werden `SOLD`.

## Nicht-MVP

Mehrmandantenfähigkeit, rollenbasierte Auth, OTA-Firmware-Updates, vollwertiges Geräte-Secret-Management, Lager-/Versandlogik, komplexe Varianten/Warenkörbe, Analytics, neue Display-Bus-Hardware und die Ablösung der Legacy-SSE/WS-Pfade.

## Priorisierte Aufgaben

1. **Erledigt:** Online-Config-Firmware committen und pushen (`367f548`).
2. **P0:** Domain/DNS/HTTPS/Routing auf DigitalOcean fertigstellen.
3. **P0:** Danach `https://qr2buy.com/p/demo` prüfen, `/api` same-origin prüfen und das Demo-Produkt auf der Produktseite mit Status `AVAILABLE` prüfen.
4. **P0:** DigitalOcean App Platform, Backend-Service und Frontend-Static-Site korrekt routen.
5. **P0:** SPA-Fallback für `/` und `/p/*` einrichten.
6. **P0:** Stripe-Testcheckout, Webhook-Signatur und `SOLD`-Status abnehmen.
7. **P1:** Firmware-App mit realer Demo-Config und Hardware-Demo testen.
8. **P1:** Backend-Minimaltests für Health, Public, Config und Checkout ergänzen.
9. **P1:** Geräteauthentifizierung und Secret-Speicherung vor Live-Betrieb härten.

## Letzte Domain-Prüfung

Am 2026-07-26 lösten `qr2buy.com` und `www.qr2buy.com` lokal weiterhin auf `91.227.204.35` auf. HTTP zeigte den bestehenden nginx/Apache-Host; `/p/demo` war 404. HTTPS und die DO-Backend-URL konnten aus der lokalen Windows-curl-Umgebung wegen TLS-/Verbindungsfehlern nicht belastbar geprüft werden. Der Frontend-Build war erfolgreich. Eine DigitalOcean App Spec ist im Repo nicht vorhanden.

Für die Aufschaltung manuell in DigitalOcean konfigurieren: `qr-frontend` aus `frontend` mit `npm ci && npm run build`, Output `dist`, Route `/` und SPA-Fallback auf `index.html`; `qr-backend` aus `backend` unter Route `/api`, Path Prefix erhalten, Healthcheck `/api/health`, Port `8080`. DNS-Ziele für Apex und `www` ausschließlich aus dem DigitalOcean-Domain-Dialog übernehmen.

## Abnahmekriterien

- `https://qr2buy.com/` und `https://qr2buy.com/p/demo` liefern die SPA.
- `https://qr2buy.com/api/health` ist erreichbar; API-Routing funktioniert ohne CORS-/Fallback-Verwechslung.
- ESP32 lädt seine Config und zeigt einen scanbaren QR-Code.
- Scan führt zur korrekten Produktseite mit Preis und Verfügbarkeitsstatus.
- Stripe-Testzahlung erzeugt den erwarteten Webhook und setzt Product/Device auf `SOLD`.
- Secrets bleiben ausschließlich in geschützten Deployment-/Gerätedateien.
- Ein erneuter Checkout für ein verkauftes Produkt wird abgewiesen.

## Demo-Szenario

Demo-Produkt `demo` und Demo-Gerät vorbereiten, Gerät auf `esp32dev_spi_cs5_rst4_app` flashen, WLAN/Config lokal sicher bereitstellen, TFT im Schaufenster starten, QR mit Smartphone scannen, Produktseite öffnen, Stripe-Testzahlung durchführen und anschließend den Statuswechsel im Admin bzw. auf der Produktseite zeigen.

## Offene Entscheidungen

- Wird Frontend als separate DigitalOcean Static Site oder zusammen mit dem Backend deployt?
- Soll die Firmware beim MVP weiterhin die direkte DO-URL oder bereits `qr2buy.com/api/config` nutzen?
- Welche minimale Produktionsauthentifizierung ersetzt Basic Auth?
- Wird ein Gerät automatisch provisioniert oder künftig vorab im Admin registriert?
- Welche Stripe-Rücksprung-/Erfolgsseite wird für die Demo verwendet?
