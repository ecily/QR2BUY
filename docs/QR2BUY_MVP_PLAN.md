# qr2buy.com – aktueller MVP-Arbeitsplan

Operative Source of Truth: [QR2BUY_CONTEXT.md](QR2BUY_CONTEXT.md), verbindlicher Tagesabschluss **15.10.2026**. Dieser Plan ersetzt ältere Prioritäten, bewahrt aber offene Arbeiten.

## Nächste Arbeiten am 16.10.2026

1. Aktuellen Git-/Produktionsstand prüfen; P3 .13/PROVISIONED, P1/P2 .11/READY, Deployment a80d50ac…/aa82d5e, Auto-Deploy aus. Echte Adminanmeldung und Auswahl P3/ecily.com sind vom Nutzer bestätigt.
2. Nach ausdrücklicher Freigabe neue Adminfreigabe für P3/ecily.com, achtstelliger TFT-Setupcode, physischer Händler-/Standortvergleich ecily - webentwicklung und sechsstelliger Bestätigungscode innerhalb gemeinsamer maximal 120 Sekunden. Die heutige bereits erteilte Freigabe wurde widerrufen; keine offene Challenge/Zuordnung. Vollständiger Ablauf und IDs im zentralen Checkpoint.
3. Zuordnung ohne Produkt prüfen. Erst separat freigegeben eigenständiges Testprodukt/Offer anlegen und binden, READY/Käufer-QR physisch abnehmen; P1/P2 unverändert halten. Danach finaler Projektcheckpoint.

## Spätere eigenständige Meilensteine

- Globale Wiederverwendbarkeit aller Schilder: wiederholt Händler-/Standort-/Produktwechsel A → B → A ohne normalen Flash/Identitäts-/Credentialwechsel; vollständiger Rechteentzug, Neutralisierung, Audit sowie alte QR-/Reservierungs-/Checkout- und Geschäftsdaten-/Bestandsisolation. Noch nicht vollständig implementiert/abgenommen, kein Blocker der jetzigen P3-Erstintegration.
- Optionale Händler-App mit vollständigem 128-Bit-Setup-QR; weitergehende Adminrollen/MFA.
- Verbleibende zusammenhängende physische Commerce-/Offline-/CANCELLED-Abnahmen, Gehäuse/Stromversorgung/Kabelentlastung und sonstige im Kontext dokumentierte Betriebs-/Securityarbeiten separat priorisieren. Kein Testkauf aus dem P3-Zuordnungsschritt.

## Bewusste Grenzen

Keine neue Ausführungsfreigabe durch diesen Plan, keine Live-Zahlungen, kein OTA oder Vollinventarversprechen. DigitalOcean deployt aktuell **nicht automatisch**: beide Auto-Deploys deaktiviert, main bleibt 502d539; produktiver Release aa82d5e liegt auf dem Arbeitsbranch. Keine neue Firmware oder neue Credentials für die normale P3-Erstzuordnung nötig. Physische Abnahme nicht aus Softwaretests ableiten.
