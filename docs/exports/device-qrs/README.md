# Permanente Geräte-Aufkleber

| Gerät | Unveränderbare URL | SVG | PNG |
| --- | --- | --- | --- |
| QR2B-000001 | https://qr2buy.com/device/QR2B-000001 | QR2B-000001-device-qr.svg | QR2B-000001-device-qr.png |
| QR2B-000002 | https://qr2buy.com/device/QR2B-000002 | QR2B-000002-device-qr.svg | QR2B-000002-device-qr.png |

- SVG: 50 × 55 mm inklusive gut lesbarer Geräte-ID; viewBox 900 × 990.
- PNG: 900 × 900 Pixel, reiner QR; Klartext-ID steht auf dem SVG-Aufkleber.
- Schwarz auf Weiß, vier Module Quiet Zone, Fehlerkorrektur M, keine Logos im Code.
- Ausdruck ohne Abschneiden der weißen Ränder. Die SVG-Vorlage möglichst bei 100 % drucken; reale Scanabnahme nach Anbringen bleibt erforderlich.
- Unabhängige Rückdekodierung mit OpenCV: beide PNGs und beide mit dem Browser gerenderten SVGs liefern exakt die URLs oben.
- Erzeugung: `cd frontend` und `node scripts/device-qrs.mjs`. SVG-Rasterisierung ist Teil von `npm run test:binding-ui`; lokale Prüfbilder bleiben im ignorierten `node_modules/.cache/binding-ui-results`.

Die Aufkleber identifizieren nur das Gerät. Sie enthalten weder Secret, MAC, Mongo-ID noch Session-Token und autorisieren keine Bindung. Käufer-QRs bleiben separate `/o/:publicOfferId`-URLs.

P0.3.4 ist nur lokal implementiert. Vor der realen Nutzung sind der freigegebene Backend-/Frontend-Rollout und die `/device`-Ingress-Zuordnung erforderlich.
