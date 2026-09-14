# P0.3.5 – lokale Stabilisierung, 14. September 2026

Scope: vorhandene Implementierung stabilisieren, keine neuen Funktionen. Ausgangs-HEAD `6f86c6d366411452ab854660bdd9c2f8c4aefc2e`. Kein Commit, Push, Deploy, produktiver DB-Zugriff, Account-Linking, Assignment-Wechsel oder Flash in diesem Auftrag.

## Erfasster Arbeitsbaum

Alle 12 bereits modifizierten und 12 ungetrackten Dateien bleiben erhalten. Zuordnung (Pfade relativ zum Repository):

| Dateien | Bereich |
| --- | --- |
| `backend/.env.example` | Auth-/Session-Konfiguration, explizite Owner-Link-Gates |
| `backend/package.json`, `backend/package-lock.json` | Auth-/Session-Abhängigkeiten und qs-Security-Fix |
| `backend/src/index.js` | API-Mount, Cookie-/Parser-Logging-Schutz |
| `backend/src/merchant/accounts.js` | Accounts, Registrierung, Argon2id, explizites Linking |
| `backend/src/merchant/session.js` | Mongo-Sessions, Cookie, CSRF, Merchant-Guard |
| `backend/src/merchant/portal.js` | Scope, Products, Offers, Devices, Locations, Stammdaten |
| `backend/src/routes/merchantPortal.js` | Auth-/Merchant-APIs und Session-Binding |
| `backend/src/scripts/linkMerchantOwner.js` | Separater Operator-Bootstrap, kein Startup-Linking |
| `backend/src/merchant/deviceService.js` | Offer-Bedingungen in Device-/Buyer-Projektion |
| `backend/test/merchantDevice.test.js`, `backend/test/merchantMongo.integration.test.js` | Regression der ergänzten Projektionen |
| `backend/test/merchantPortal.integration.test.js` | Echte Mongo-/HTTP-/Session-/Scope-Integration |
| `frontend/src/App.jsx` | Portal-/Operator-Routing |
| `frontend/src/binding.js`, `frontend/src/pages/DeviceBindingPage.jsx` | Händler-Session versus interner Operator-Einstieg |
| `frontend/src/merchantApi.js` | Cookie-/CSRF-Client, Return-Pfade, Geldbeträge |
| `frontend/src/merchantText.js` | DE/EN |
| `frontend/src/pages/MerchantPortal.jsx`, `frontend/src/pages/MerchantPortal.css` | Dashboard, Auth, Products/Offers, Devices, Locations, Settings |
| `frontend/test/merchantPortal.test.js` | Client-, Geld-, Sprach- und Redirect-Verträge |
| `frontend/e2e/binding.spec.js`, `frontend/e2e/merchant.spec.js` | Operator-/Händler-Browserregression |
| `docs/QR2BUY_CONTEXT.md` | Operative Dokumentation |

In dieser Stabilisierung bearbeitet: `backend/test/merchantPortal.integration.test.js`, `frontend/src/pages/MerchantPortal.jsx`, `frontend/e2e/merchant.spec.js`, `docs/QR2BUY_CONTEXT.md`; dieser Bericht neu. Paketdateien, Backend-Anwendungslogik, bestehender Binding-Service und Firmware gegenüber Auftragsbeginn unverändert.

## Acht ursprüngliche Backendfehler

Die Testnamen beziehen sich auf `merchantPortal.integration.test.js`. Alle Ursachen lagen in Testannahmen beziehungsweise Testaufbau; keine Abschwächung des Produktcodes erforderlich.

| Test | Konkrete Ursache | Minimaler sachlicher Fix |
| --- | --- | --- |
| atomic registration, normalized email, Argon2id hash, no secret projection, session fixation prevented | Regex verlangt `m,t,p`; echte Argon2-Bibliothek serialisiert `m,p,t`. Abbruch vor Abschluss des Merchant-A-Fixtures. | Algorithmus, Version und Parametermenge getrennt prüfen; echte Passwortverifikation mit richtigem und falschem Passwort. Keine Hash-/Passwortausgabe in Assertions. |
| second merchant is separate; profile/location update whitelist and isolation | DELETE ohne JSON/Origin/CSRF wird vor Routing korrekt mit 403 gesperrt, Test erwartet 404. | Ungeschützten Request explizit mit 403 prüfen; gültigen CSRF-/JSON-Request gegen nicht vorhandene DELETE-Route mit 404 prüfen. |
| offers integer money, stock, flags, own product/location and immutable identity | `locationA` fehlt wegen früherem Fixture-Abbruch; Offer-Erstellung liefert 400. | Eigene Accounts, Locations und Products pro Test vorbereiten. |
| only provisioned own devices; rename leaves technical identity and credentials untouched | Fehlende `locationA` erzeugt DeviceMerchantAssignment-Validierungsfehler. | Eigene Accounts/Locations als explizite Voraussetzung. |
| session binding uses existing challenge service; foreign device/product blocked; no Basic Auth | Frühere Offer-/Device-Vorbereitung fehlgeschlagen; Binding-Kontext 404. | Eigene Products, Offers, Devices und Credential bereitstellen. |
| remote price/stock/terms project immediately to device and public offer, no checkout | `offerA` undefiniert; vorausgesetzte Aktivierung fand im vorherigen Test nicht statt. | Eigene vollständige lokale Binding-Voraussetzung einschließlich Challenge-Bestätigung. |
| disabled/suspended accounts fail closed; logout invalidates; successful login rotates again | `merchantA` blieb Account-Dokument statt Merchant-ID; Deaktivierung traf den beabsichtigten Account nicht, Guard antwortete weiter 200. | Eigenen registrierten Account mit eindeutiger Merchant-ID verwenden. |
| merchant portal: real Mongo sessions, registration, CRUD, scope and physical binding | Übergeordneter Test zählt wegen sieben fehlgeschlagener Subtests ebenfalls rot. | Kein eigener Produktfehler; wird mit den unabhängigen Subtests grün. |

Jeder Subtest bekommt eine neue zufällig benannte Datenbank im eigenen Loopback-Replikaset, eigene HTTP-App mit frischen Rate-Limitern, Session-Store und Clients. Explizite Fixture-Stufen ersetzen Testreihenfolge-Abhängigkeiten. Collections/Unique-Indizes werden pro Datenbank angelegt; nach jedem Subtest werden Server/Store geschlossen, die ausschließlich lokale Testdatenbank entfernt und die Verbindung beendet. Das Replikaset endet im äußeren `finally`.

Zusätzliche Assertions in bestehenden Tests prüfen CSRF-Token eines fremden Clients, Nicht-JSON-Requests, Offline-Projektion ab veraltetem Heartbeat, fremden Device-GET und Schild-2-Projektion. Vorhandene Owner-Link-Prüfung bestätigt Idempotenz, Merchant-Scope und unveränderte Merchant-/Location-/Device-Anzahlen.

## Browserfehler und Fixes

Alle acht ursprünglichen Fälle (`merchant de/en 320/375/390/430: register, CRUD, session binding, logout`) scheiterten identisch bei der Standortauswahl. Live-DOM-Diagnose zeigte `label.textContent = Standort—Window` beziehungsweise `Location—Window`: das Label umschloss auch das Select samt Optionen. Der exakte Label-Locator fand deshalb keinen Treffer. Kein fehlender Standort, kein Scope-/Routerfehler.

Fix im Formular: eigenständige sichtbare Labels mit `htmlFor` und passender Select-ID für Standort und Währung. Optionswerte, Scope und Bearbeitbarkeit bleiben unverändert. Keine Selector-Ausnahme und keine Timeout-Erhöhung.

Nach Freilegung der restlichen Journey reproduzierte der vollständige Lauf zwei zusätzliche Test-Rennen: fünf Fälle prüften `confirmed` unmittelbar nach Klick vor der asynchronen Antwort; zwei Fälle klickten nach Settings-Navigation noch auf die alten zwei Standort-Edit-Buttons. Der Test wartet jetzt auf die sichtbare Zielüberschrift und auf „Schild aktiviert“/„Display activated“, bevor er Folgeschritte beziehungsweise den bestätigten Request prüft. Auch die Offer-Assertion wartet auf den abgeschlossenen Speichervorgang (Editor geschlossen). Keine Sleeps, Skips oder höheren Timeouts.

## Geprüfte Produktgrenzen

- Auth: Registrierung mit transaktionalem Merchant/Location, echte Argon2id-Hashes; Login rotiert die serverseitige Mongo-Session, Logout invalidiert sie. Secure/HttpOnly/SameSite=Lax/Path=/ für Production; Synchronizer-CSRF plus Origin/JSON-Prüfung. Kein Browser-Token, keine normale Basic-Auth-Journey. Interne Operator-Routen bleiben separat.
- Scope: aus Session und aktuellem ACTIVE OWNER/Merchant abgeleitet; fremde IDs, Body-/Query-Scope-Injection und deaktivierte Accounts werden abgewiesen.
- Products/Offers: optionale EAN, Erstellen/Ändern, Integer-priceMinor und Bestand, Kauf-/Reservierflags, eigener Standort/Produkt und unveränderliche bestehende Offer-Identität. Keine neue Geschäftslogik.
- Devices: nur aktuelle eigene Zuordnungen; Rename ohne Änderung von deviceId/hardwareUid/Credentials, Offline aus lastSeenAt, fremdes Gerät abgewiesen.
- Locations/Settings: eigene Anlage und Bearbeitung, fremde Location gesperrt; im Browser beide Sprachen und vier mobile Breiten.
- Binding: vorhandener P0.3.4-Service über Merchant-Session; fremdes Produkt/Gerät gesperrt, Challenge nur in isolierter Testumgebung bestätigt. Keine produktive Aktivierung.
- Pilot: separates explizites Owner-Link-Skript; kein automatisches Linking und keine produktive Account-Erstellung.
- Dependencies: qs 6.16.0, body-parser 1.20.8, Express 4.22.2 bleiben im vorhandenen lokalen Diff; keine neuen Lockfile-Änderungen durch Stabilisierung.

## Finale Regression

Nach beiden Fixblöcken komplette Regression ausgeführt. Final: Backend 119/119 (Portal 14/14 einschließlich Parent), Frontend 52/52, Browser 19/19, Firmware 24/24 einschließlich kompiliertem Host-Parser; keine Skips. Backend-Syntax 40 Dateien, Import-Smoke 35 Module, Backend npm audit 0 Findings, ESLint, Frontendbuild und CS5-/NOCS-Builds grün. 320-Pixel-Geräteansicht zusätzlich visuell geprüft. Keine neue Demo-Regression in den vorhandenen Demo-/Stripe-/Hardware-Vertragstests.

## Grenzen der Abnahme

Browser-Journeys verwenden isolierte API-Antworten; echte Backend-/Mongo-/Cookie-Flows werden separat mit Loopback-HTTP und Mongo-Replikaset integriert geprüft. Eine produktive HTTPS-/Smartphone-/TFT-Abnahme oder bereits ausgerollte Händlerfunktion wird daraus nicht behauptet. Bestehende Grenzen bleiben: Rate-Limits pro Prozess, nur OWNER, keine Teamverwaltung und keine nachträgliche Änderung der Offer-Standortidentität. Der bekannte moderate Frontend-Dev-Befund in `@humanfs/node` ist außerhalb dieses Fixes. Der qs-Fix ist lokal und noch nicht deployed.
