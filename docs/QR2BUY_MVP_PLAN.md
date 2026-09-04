# qr2buy.com – aktueller MVP-Arbeitsplan

Die operative Source of Truth ist [`QR2BUY_CONTEXT.md`](./QR2BUY_CONTEXT.md). Dieser Plan enthält nur die nächsten Arbeitspakete; frühere erledigte Einzelaufgaben sind über Git nachvollziehbar.

## Bestätigter MVP-Kern

- Produktive DE/EN-Frontpage und session-isolierte Live-Demo
- Serverkatalog mit `bag`, `book`, `print`, `tree`
- Reservierung und Stripe-Sandbox-Checkout mit signiertem Webhook
- Explizite, secret-geschützte Kopplung von `demo-device` an eine `DemoSession`
- Physischer ESP32-/ILI9341-Prototyp mit verifiziertem TLS, Drei-Sekunden-Polling und real bestätigter Produkt-Synchronisierung
- Scanbares 320×240-Landscape-Verkaufsschild
- DigitalOcean-Auto-Deploy von `main`

## Nächste Arbeiten

1. `RESERVED`, `PAID` und `SOLD` auf dem realen TFT visuell nacharbeiten.
2. Den vollständigen physischen Reservierungs-/Stripe-Sandbox-/Webhook-/Reset-/SOLD-Ablauf zusammenhängend abnehmen und dokumentieren.
3. Gehäuse, Stromversorgung und Kabelentlastung für einen Pilotprototyp planen.
4. Optionalen SMTP-Demo-Beleg nur nach vollständiger TLS-Konfiguration real zustellen und prüfen.
5. Legacy-Admin-/Device-Authentifizierung, Auto-Provisioning und alte SSE/WS-Pfade separat härten beziehungsweise bereinigen.
6. Wildcard-DNS und eine möglicherweise verbliebene alte Frontend-App kontrolliert prüfen.

## Bewusste Grenzen

Keine Live-Zahlungen, keine Mehrmandantenfähigkeit, kein OTA, kein vollwertiges Inventar, keine komplexen Varianten/Warenkörbe und keine erfundenen Produktionszusagen. Eine Backlight-Steuerung wird erst nach dokumentierter GPIO-Verdrahtung umgesetzt.
