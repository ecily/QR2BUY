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
2. **Erledigt:** Gemeinsame DigitalOcean-App mit Frontend und Backend herstellen.
3. **Erledigt:** Backend-Routing unter `/api` mit Preserve Full Path.
4. **Erledigt:** SPA-Catchall `index.html` aktivieren.
5. **Erledigt:** `qr2buy.com` und `www.qr2buy.com` als aktive Custom Domains einrichten.
6. **Erledigt:** `/p/demo` live erreichbar machen.
7. **Erledigt:** API same-origin unter `/api` live erreichbar machen.
8. **Erledigt:** Demo-Produkt mit Status `AVAILABLE` live erreichbar machen.
9. **Erledigt:** Landing Page initial pitchbar machen: klare Headline, USP, Schaufenster-/Auslagen-Commerce, sichtbarer Demo-Flow, verständliche Darstellung von Hardware + QR + Produktseite und MVP-taugliche Optik.
10. **Erledigt:** DE/EN mit Browser-Locale-Fallback und manuellem Switch ergänzen.
11. **Erledigt:** Responsive CSS für Mobile, Tablet, Laptop und Desktop ergänzen und strukturell prüfen.
12. **Erledigt:** Hero, Einstieg und USP nach der zweiten Fragerunde auf Vertrauen, bestätigte Zahlung sowie Käufer-/Verkäufer-Klarheit schärfen.
13. **P0:** Landing Page nach User-Abnahme weiter schärfen.
14. **P1:** Demo-Produktseite optisch prüfen.
15. **P1:** Alte separate `qr-frontend`-App und mögliche Kostenbereinigung prüfen.
16. **P1:** Demo-Journey, Stripe-Testcheckout, Webhook-Signatur, SOLD und Reservierung technisch vertiefen.
17. **P2:** Backend-Minimaltests für Health, Public, Config und Checkout ergänzen.
18. **P2:** Geräteauthentifizierung und Secret-Speicherung vor Live-Betrieb härten.

## Produktionsstatus

Die Landingpage wurde nach der zweiten Fragerunde weiter auf Vertrauen und Öffnungszeiten ausgerichtet. ecily-Partnerlink, Demo-Abschluss, leistbare Display-Hardware, geschützter Händlerbereich sowie das Zusammenspiel von Produktseite, Backend, Datenbank und Display sind sichtbar. Nach der optischen Abnahme ist der nächste priorisierte Schritt die weitere technische Vertiefung von Demo-Journey, Stripe-Testcheckout, Webhook, SOLD und Reservierung.

Die gemeinsame DigitalOcean-App ist live. `qr2buy.com` ist technisch produktiv erreichbar; Frontend, `/p/demo`, `/api` und das Demo-Produkt funktionieren same-origin. Die Landingpage ist initial pitchbar, zweisprachig und mit einer frontend-seitigen Demo versehen. Der Deploy wurde live geprüft: Root, Produktseite, beide API-Endpunkte sowie die `www`-Varianten liefern HTTP 200. Der Wildcard-DNS-Record zeigt noch auf den alten Host und wird später geprüft. Mail-/MX-/TXT-/NS-Records wurden nicht verändert. Norton Safe Web war ein lokales Reputationsthema, kein App-Fehler.

## Letzte Domain-Prüfung

Der frühere lokale Befund mit `91.227.204.35` ist durch die aktive DigitalOcean-Domain-Konfiguration ersetzt. Die final bestätigten Live-URLs sind in der Produktionsabnahme dokumentiert.

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
