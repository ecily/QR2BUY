# qr2buy.com – operativer Projektkontext

Stand: 7. September 2026. Dieses Dokument ist die operative Source of Truth für den aktuellen qr2buy-Projektstand.

Aktuell: P0.3.3b ist real abgenommen. Beide Prototypen laufen gleichzeitig als permanente Merchant-Geräte mit `assigned=false`. CS5 verwendet Rotation 1, NOCS wegen der physischen Einbaulage Rotation 3 (+180°), jeweils 320×240. Beide DisplayAssignments bleiben PENDING. Nächster Schritt: reale Produkt↔Schild-Verifikation und kontrollierte Aktivierung.

P0.3.4-Code mit Commit `01c23ff` auf main/origin/main und für Backend/Frontend produktiv ACTIVE. Reale Bindung noch nicht begonnen: weiterhin STOP bei der Operator-Zugangsprüfung (HTTP 401 auch nach lokaler Hinterlegung von ADMIN_USER/ADMIN_PASS). Der lokale Benutzername stimmt mit der DigitalOcean-Konfiguration überein; erfolgreicher Operator-Zugang noch nicht belegt. Letzter verifizierter Gerätestand: beide Firmware 0.3.2, PENDING und assigned=false; seither kein Flash, keine Preview, keine Aktivierung. QR2B-000002 bleibt bis zu einem separaten Go unverändert.

### P0.3.4 – verifizierter Rollout und aktueller STOP

- DigitalOcean-Deployment `8d533015-41d1-4f76-b050-f6f8509af36b` ACTIVE; Backend und Frontend verwenden `01c23ffd75efbf2db66640278ce7d8345ad32685`. Health, `/`, `/de`, `/en` und `/binding/QR2B-000001` HTTP 200. `/device/QR2B-000001` und `/device/QR2B-000002` HTTP 303; unbekanntes Gerät HTTP 404.
- Ingress `/device` mit erhaltenem Pfad auf Backend ergänzt; fester Operator-Scope `merchant-demo-001` als Backend-Runtime-Konfiguration gesetzt. Bestehende Routen und ENV-Einträge erhalten.
- Neue DemoSession HTTP 201 und Abruf HTTP 200; Produktions-DB über ihren Session-Hash zugeordnet. DemoHardwareBinding-Liveprüfung im angehaltenen Lauf noch offen.
- Beide authentifizierten Merchant-Device-Konfigurationen HTTP 200, assigned=false und ohne Preview; beide DisplayAssignments PENDING. DB bestätigt beide Firmwareversionen 0.3.2 und laufende Heartbeats; BindingPreview-Collection leer.
- Drei vorhandene Pilotprodukte besitzen noch keinen productBindingId. Die vorbereitete explizite Migration wurde noch nicht ausgeführt. Kein Seed, keine Produkt-/Assignment-Mutation und kein COM-Port-Zugriff in diesem Rollout-Schritt.
- Operator-Kontextaufruf mit fehlenden lokalen Zugangswerten wurde erwartbar mit HTTP 401 abgewiesen. Fortsetzung benötigt einen funktionierenden bestehenden Operator-Zugang; keine Zugangsdaten im Chat ausgeben. Danach fehlen Produktcode-Vorbereitung, Firmware-Update ausschließlich COM3 sowie reale Smartphone-/TFT-Abnahme und Aktivierung ausschließlich Schild 1.
- Diese STOP-Dokumentation ist lokal; der freigegebene Abschlusscommit für die erfolgreiche reale Abnahme steht noch aus. Die folgenden lokalen Implementierungsabschnitte dokumentieren den Vor-Commit-Teststand.

### Operator-Zugang – Prüfung nach STOP

- Autorisierter Restart ausschließlich von `qr2buy-backend` ohne ENV-/Spec-Änderung durchgeführt: Deployment `a334fe97-3750-4df0-b3f5-2f4ad005e5e7`, erstellt 2026-09-07 19:59:11 UTC, ACTIVE 19:59:59 UTC, Backend-Code `01c23ff`. Gesamte App-Spec unverändert gegenüber dem vorherigen Deployment; ADMIN_USER/ADMIN_PASS weiterhin direkt im Backend mit Runtime einschließendem Scope. Health danach HTTP 200.
- Direkter Auth-Test nach diesem Restart: lokale Credentials weiterhin HTTP 401 `unauthorized`, falsches Passwort HTTP 401, ohne Auth HTTP 401 `auth required`. Damit besteht der Credential-Mismatch auch nach neuem Rollout; die vermutete Ursache „nur noch nicht neu gestartetes Deployment“ ist nicht bestätigt. Kein weiterer Konfigurationsversuch, keine Rotation, kein Flash, keine Preview, keine Assignment-Änderung. STOP bleibt bestehen. Dieser Dokumentationsstand wird entsprechend Auftrag separat committed/gepusht; die nachfolgenden Einträge bleiben als Diagnosehistorie erhalten.

- Vertiefte reine Auth-Diagnose nach gemeldeter manueller Passwortänderung: direkte GET-Anfrage an `/api/binding/operator/devices/QR2B-000001` ohne Redirect folgt nachweislich bis zum Basic-Auth-Vergleich und liefert mit lokalen Credentials HTTP 401 `unauthorized`, mit falschem Passwort ebenso, ohne Header HTTP 401 `auth required`. Frontend/Browser nicht beteiligt. Dieselbe Middleware autorisiert lokal mit explizit aus `backend/.env` geladenen Werten. Keine ADMIN-Shell-ENV, keine zweite ENV-Ladung im Test, keine Steuer-/Formatzeichen, äußeren Anführungszeichen oder äußeren Leerzeichen in den geparsten Werten erkannt.
- ADMIN_USER und ADMIN_PASS sind in der Komponente `qr2buy-backend` (nicht App-Level/Frontend) mit `RUN_AND_BUILD_TIME` gesetzt, also einschließlich Runtime. Aktuelle App-Spec und aktive Deployment-Spec enthalten identische gespeicherte ADMIN-Einträge. Aktives Deployment weiterhin `8d533015-41d1-4f76-b050-f6f8509af36b`, erstellt 2026-09-07 14:04:13 UTC, ACTIVE seit spätestens 14:06:01 UTC, Commit `01c23ff`; App zuletzt aktualisiert 14:06:14 UTC. Lokale ENV zuletzt geändert 14:28:20 UTC. Kein neuerer/laufender Rollout vorhanden; ein Rollout nach der gemeldeten Secret-Änderung ist nicht belegt. Der genaue Secret-Änderungszeitpunkt ist nicht verfügbar.
- Direkte Instanzprüfung via DigitalOcean Console/Exec HTTP 403 (fehlende Berechtigung). Nichtleere Runtime-ENV ergibt sich indirekt aus dem erreichten Middleware-Pfad: fehlende ADMIN-Werte würden vorher HTTP 503 erzeugen. Ein unmittelbarer Prozessvergleich ist nicht möglich; die genaue Ursache einer nicht wirksam gewordenen UI-Änderung bleibt offen. Keine Rotation, kein Deployment, keine funktionalen Änderungen. Minimaler nächster Schritt: Speicherung der bereits beabsichtigten Änderung genau in dieser Backend-Komponente prüfen und deren wirksamen Rollout sicherstellen; anschließend direkte Auth-Matrix erneut prüfen. STOP für Hardware/Binding bleibt bestehen.

- Erneuter Versuch nach Nutzerbestätigung „hinterlegt“: beide lokalen ENV-Werte vorhanden, produktiver Operator-Kontext trotzdem HTTP 401. Benutzername entspricht der aktuellen DigitalOcean-App-Spec. Keine doppelten ADMIN-Einträge, keine führenden/nachgestellten Leerzeichen und kein versehentlich übernommener verschlüsselter SECRET-Envelope erkannt. Das Passwort kann nicht gegen den verschlüsselten produktiven Wert verglichen werden. Absichtlich falsche und fehlende Credentials weiterhin jeweils HTTP 401. Keine Auth-/ENV-Änderung vorgenommen; Binding bleibt angehalten. Die folgenden Punkte beschreiben die vorangegangene Prüfung vor Hinterlegung.

- `backend/.env` existiert und ist gitignored; ADMIN_USER/ADMIN_PASS fehlen dort. Keine weitere lokale Backend-ENV mit vorhandenem Zugang gefunden. `.env.example` enthält bereits ausschließlich Platzhalter.
- DigitalOcean hat ADMIN_USER und ADMIN_PASS bereits gesetzt; ADMIN_PASS ist vom Typ SECRET und über die App-Spec nur als verschlüsselter Wert verfügbar. Produktive Werte wurden nicht überschrieben; keine inkonsistenten neuen lokalen Credentials erzeugt.
- Binding verwendet `merchantDomainAuth` aus `backend/src/routes/merchant.js`, anschließend `basicAuth` aus `backend/src/middleware/basicAuth.js`. Beide ENV-Werte werden im Backend benötigt, lokal und produktiv. Der Merchant-Guard sperrt bei fehlender Konfiguration mit HTTP 503 und verhindert damit den allgemeinen Entwicklungs-Fallback. Produktiv liefern fehlende und absichtlich falsche Credentials jeweils bestätigt HTTP 401.
- Basic Auth bleibt ausschließlich temporäre interne Operator-Sicherung für Demo/Pilot, kein Händler-Login, Rollenmodell oder Onboarding. Frontend überträgt Authorization im Header und hält es nur im Arbeitsspeicher; keine URL-/Storage-Ablage. Backend-Logger redigiert Authorization und serialisiert keine Credential-Header. Ein erfolgreicher Zugang und ein wertbasierter Bundle-/Log-Abgleich sind mangels verfügbarem bestehendem Passwort noch nicht belegt.
- Weiter STOP: Für eine sichere konsistente lokale Konfiguration muss der bestehende Zugang direkt in der ignorierten `backend/.env` hinterlegt werden, niemals im Chat. Alternativ bedarf es einer ausdrücklich abgestimmten Rotation des bestehenden globalen Operator-Zugangs. Kein Flash, keine Preview oder Aktivierung; vorhandener Kontext-Diff erhalten, kein Commit/Push.

## Verbindliche Arbeitsregeln

- Bei jeder künftigen Coding-/Codex-Arbeit zuerst diese Datei und danach den aktuellen Git-Status lesen.
- Ausschließlich das Projekt `qr2buy.com` im Repo `C:\coding\qr2buy` bearbeiten; keinen Kontext aus anderen Projekten übernehmen.
- Nach materiellen, verifizierten Änderungen dieses Dokument schlank aktualisieren.
- Git-, Test-, Hardware- und Deploymentstände nur als bestätigt dokumentieren, wenn sie tatsächlich geprüft wurden.
- Reale Secrets niemals lesen, ausgeben, loggen oder committen. Lokale ENV- und Firmware-Secret-Dateien bleiben ignoriert.
- Historische Dokumente unter `docs/` beschreiben frühere Planungs-/Auditstände; bei Widersprüchen gilt diese Datei.

## System und produktive URLs

qr2buy verbindet ein physisches QR-Verkaufsschild mit einer mobilen Produkt-, Reservierungs- und Kauf-Journey. MongoDB Atlas hält den Serverzustand; Express stellt API und Demo bereit; React/Vite rendert Frontpage und Produktseiten; ein ESP32 pollt die autorisierte Hardware-Projektion und steuert ein ILI9341-TFT.

Produktiv bestätigt:

- `https://qr2buy.com/`
- `https://www.qr2buy.com/`
- `https://qr2buy.com/api/health`
- `https://qr2buy.com/p/demo`
- `https://qr2buy.com/api/public/products/by-short/demo`
- `/demo/p/:productKey#session=<TOKEN>` für die sessiongebundene Live-Demo; das Token steht ausschließlich im Fragment.

## Frontpage und session-isolierte Live-Demo

Die produktive React/Vite-Frontpage ist responsiv, deutsch/englisch lokalisiert und konsequent auf kleine und mittlere Händler mit Schaufenstern oder anderen nach Ladenschluss sichtbaren Produkten ausgerichtet. Ihre Kernstory: Ein Passant sieht bei geschlossener Tür ein konkretes Produkt und kann es per QR-Scan ohne App und ohne Mitarbeiter vor Ort kaufen oder reservieren. qr2buy wird ausdrücklich nicht als Supermarkt- oder Massensortimentslösung dargestellt.

Der Hero lautet deutsch „Dein Schaufenster verkauft weiter – auch wenn du längst geschlossen hast.“ und englisch „Your shop window keeps selling – long after you have closed.“; der Browser-/SEO-/OG-/Twitter-Titel lautet sprachabhängig `qr2buy – Scannen. Kaufen. Verkauft.` beziehungsweise `qr2buy – Scan. Buy. Sold.`. `/de` und `/en` liefern die jeweilige Sprache deterministisch; der Sprachwechsel hält Dokumenttitel, HTML-Sprache, Description, Canonical URL und Open-Graph-Felder synchron. Die Live-Demo steht direkt nach dem Hero. Danach folgen eine konkrete Samstagabend-Problemszene, der Haupt-USP „Das Verkaufsschild zeigt nicht nur den Preis. Es verkauft.“, die Abgrenzung zum normalen, nur eine Website öffnenden QR-Code, Wiederverwendbarkeit, Käufervertrauen, KMU-Einsatzorte, Ablauf, realer Hardwarebeweis und abschließende Pilot-CTA.

Die verbindliche Primärmarke besteht aus der bestehenden Bildmarke links und der Wortmarke `qr2buy` rechts und wird über eine gemeinsame Frontend-Komponente in Header, Footer, Demo-Display und mobiler Demo verwendet. Das Favicon verwendet ausschließlich diese kontrastoptimierte Bildmarke als SVG sowie PNG in 16, 32 und 48 Pixeln; ein Apple-Touch-Icon liegt in 180 Pixeln vor. Es gibt kein Webmanifest/PWA und daher keine künstlich ergänzten Manifest-Icons. Ein geeignetes bestehendes Social-Preview-Bild ist nicht vorhanden; `og:image` und `twitter:image` bleiben bewusst aus, statt ein Platzhalterbild zu veröffentlichen.

Die Einsatzorte-Sektion ist visuell konsolidiert: sieben kurze DE/EN-Branchenkarten stehen auf Desktop bewusst als zentriertes 4+3-Raster, auf Tablet zweispaltig mit zentrierter Schlusskarte und auf Mobile einspaltig. Dunkle Überschriften und Sekundärtexte auf warmen hellen Karten sichern den Kontrast zum dunkelgrünen Abschnitt.

Die Seite behauptet keine produktiv unbewiesene Flottenverwaltung, Massenskalierung, Bestandsverriegelung oder garantierte Sicherheit. E-Mail wird sachlich korrekt nur als optionaler Demo-Beleg nach einem bestätigten Testkauf beschrieben; der eigentliche Kauf-/Reservierungsstatus wird unmittelbar im Ablauf und am gekoppelten Display sichtbar.

Vor dem Start der Live-Demo bestätigt der Besucher ausdrücklich den ausschließlich ungefährlichen Stripe-Testmodus. Erst danach wird die persönliche DemoSession erzeugt beziehungsweise restauriert und die Interaktion freigegeben. Dieser Bestätigungsmarker liegt nur in `sessionStorage`, nicht in `localStorage`; es entstehen weiterhin weder eine reale Abbuchung noch eine echte Bestellung.

Die sichtbare Display-Simulation, QR-Produktseite und der physische Prototyp verwenden dieselbe serverseitige `DemoSession` als Statusquelle. Jede Frontpage erzeugt beziehungsweise restauriert eine eigene kryptografisch zufällige Session; MongoDB speichert nur den SHA-256-Hash des Tokens. Demo-Daten verändern keine normalen `Product`-, `Device`- oder `Order`-Datensätze.

Der serverseitige Katalog `DEMO_PRODUCTS` ist die Produkt-Source-of-Truth:

| productKey | Deutsch | Preis | Verhalten |
| --- | --- | ---: | --- |
| `bag` | Handgemachte Ledertasche | 129,00 EUR | wiederverwendbar |
| `book` | Roman „Stadtlichter“ | 24,90 EUR | wiederverwendbar |
| `print` | Gerahmter Kunstdruck | 390,00 EUR | wiederverwendbar |
| `tree` | Nordmanntanne Nr. 17 | 59,00 EUR | konkretes Einzelstück |

Das Statusmodell lautet `READY`, `CHECKOUT_STARTED`, `CANCELLED`, `RESERVED`, `PAID`, `SOLD`. Session und Produktstatus werden per sessiongebundenem SSE plus Polling synchronisiert. Reservierung erfolgt serverseitig ohne Stripe. Der Kauf nutzt ausschließlich Stripe-Sandbox; nur ein signierter, serverseitig erneut verifizierter Test-Webhook darf `PAID` setzen. Stripe-Live-Keys und Live-Events werden abgewiesen.

Wiederverwendbare Produkte kehren nach `RESERVED`, `PAID` oder `CANCELLED` nach 20 Sekunden session- und produktbezogen zu `READY` zurück. Die konkrete Tanne bleibt bei Reservierung dauerhaft `RESERVED`; nach bestätigter Testzahlung folgt auf `PAID` nach 20 Sekunden dauerhaft `SOLD`. Event-Versionen verhindern mehrdeutige UI-Aktualisierungen. Der Checkout ist als Demo gekennzeichnet, erzeugt keine reale Abbuchung/Bestellung und verwendet eine öffentliche HTTPS-Rücksprung-Origin.

Wichtige Demo-Routen:

- `POST /api/demo/sessions`
- `GET /api/demo/sessions/:token`
- `GET /api/demo/sessions/:token/products/:productKey`
- `POST /api/demo/sessions/:token/products/:productKey/interaction`
- `POST /api/demo/sessions/:token/products/:productKey/reserve`
- `POST /api/demo/sessions/:token/products/:productKey/checkout`
- `POST /api/demo/sessions/:token/products/:productKey/cancel`
- `GET /api/demo/sessions/:token/events`
- `POST /api/demo/stripe/webhook`

Ein optionaler qr2buy-eigener SMTP-over-TLS-Dienst kann nach `PAID` höchstens einen klar als Demo gekennzeichneten HTML-Beleg senden. Er ist standardmäßig deaktiviert; E-Mail-Adressen werden nicht in MongoDB gespeichert oder per SSE verteilt.

## P0.2 Mobile Käufer-Journey – produktiver Stand

Der erste P0.2-Schritt ist seit dem 5. September 2026 produktiv; der funktionale Stand wurde mit Commit `bcb9239` live bestätigt. Die zugehörige Firmware war bereits zuvor auf die reale Hardware geflasht. Die mobile Demo-Produktseite priorisiert unmittelbar die vorhandene Produktvisualisierung, Verfügbarkeit, Produktname, Preis, den primären CTA `Jetzt kaufen`, den sekundären CTA `Reservieren` und einen kompakten DE/EN-Vertrauensblock. Der Katalog enthält aktuell keine echten Produktbilder; deshalb bleibt die bestehende farbcodierte Visualisierung erhalten und es wurden keine Bilder erfunden.

Ein validierter QR-Aufruf meldet einmalig `POST /api/demo/sessions/:token/products/:productKey/interaction`. `DemoProductState` speichert dafür getrennt vom Commerce-Status `lastScannedAt` und `interactionExpiresAt`; das produktive Scanfenster beträgt 120 Sekunden. Wiederholungen im frischen Zeitfenster werden atomar ohne weitere DB-Schreibvorgänge, Broadcasts oder TTL-Verlängerung dedupliziert; das Frontend übernimmt dafür die vom Backend gelieferte Ablaufzeit und besitzt keine eigene Scan-TTL. Ungültige Session-Token und unbekannte Produkte erzeugen keinen Interaction-State; ein eigenes Rate-Limit schützt den Endpunkt. Der Session-Token bleibt in den bestehenden URL-Logs redigiert.

Die Anzeigepriorität lautet `SOLD`/`PAID`/`RESERVED` vor `CHECKOUT_STARTED`, danach frischer Scan und danach `READY`; die Projektion zeigt `SCANNED` nur bei unverändertem Commerce-Status `READY`. Frontpage-Simulation und Hardware-Config nutzen dieselbe Projektion. Bei Checkout-Start, Reservierung, Abbruch, Zahlung, Verkauf und zeitgesteuertem Commerce-Reset werden die Interaction-Felder explizit gelöscht, sodass kein alter Scan nach einem Reset wieder erscheint. Die Firmware zeigt bei frischem Scan `SCAN ERKANNT` und `Bitte am Smartphone fortfahren`, behält Produktname, Preis, QR-Geometrie und LIVE-Footer und folgt ohne eigene Scan-TTL ausschließlich der Hardware-Config. Der kontrastreiche SCANNED-Overlay ist auf dem realen TFT bestätigt; produktiv bestätigt sind außerdem die getrennte `SCANNED`-/`READY`-Projektion und fortlaufende autorisierte Hardware-Abrufe mit HTTP 200.

### P0.2 Teil 2 – Mobile Kauf-/Reservierungs-Journey

Produktiv ausgerollt ist die finale Mobile-Hierarchie für 320 bis 430 Pixel: kompakte Produktvisualisierung, Demo-/Händlerkontext, Verfügbarkeit, prominenter Produktname und Preis, `Jetzt kaufen`, `Reservieren` und ein direkt an der Entscheidung sichtbarer Trust-Block. Die Seite bleibt die digitale Verlängerung genau des physischen Produkts und erhält weder Warenkorb, Shop-Navigation, Login noch Cross-Selling.

Der Kaufpfad zeigt vor dem unveränderten Stripe-Sandbox-Checkout eine kompakte Zusammenfassung aus Produkt und Preis sowie die offizielle Testkarte; nur der bestehende serverseitig verifizierte Stripe-Webhook darf `PAID` setzen. Die Reservierung bleibt mit der vorhandenen Backendlogik ohne Formular oder neue Kundendatenarchitektur direkt: wiederverwendbare Produkte nennen die bestehende 20-Sekunden-Demodauer, das Einzelstück bleibt entsprechend der bestehenden Logik reserviert. `PAID` und `RESERVED` bestätigen Produkt, Status und die synchrone Reaktion des Verkaufsschilds; E-Mail-Zustellung wird nur bei tatsächlich bestätigtem Mailstatus behauptet.

Abbruch, Nichtverfügbarkeit und Netzwerkfehler werden in DE/EN ohne technische Codes erklärt. Der Trust-Bereich nennt App-Freiheit, Stripe, Live-Schildbestätigung und den klar abgegrenzten Testmodus ohne echte Abbuchung. DemoSession, 120-Sekunden-SCAN-TTL, Statusprioritäten, SSE/Polling, Hardware-Config, Reservierungslogik und Stripe-Webhooks bleiben unverändert.

### Checkout-Fehlerjourney – implementiert und lokal verifiziert

Ein am 6. September 2026 beobachteter Checkout-Abbruch lag nach erfolgreicher qr2buy-Session-Erzeugung: Der produktive Checkout-Request lieferte HTTP 201, Stripe bestätigte eine gültige erreichbare Testsession mit URL, `livemode=false`, `open` und `unpaid`; ein Cancel-Request oder Webhook folgte nicht. Der konkrete Browser-/Transportgrund ist ohne Client-Telemetrie nicht weiter belegbar. qr2buy unterscheidet deshalb vier sichere Klassen: Startfehler fällt auf `READY` mit Retry zurück; bestätigter Abbruch wird `CANCELLED`; unklarer beziehungsweise noch ausstehender Stripe-Status bleibt ohne Retry `CHECKOUT_STARTED`; nur der verifizierte Webhook setzt `PAID`/`SOLD`.

Neue Checkout-Sessions laufen bei Stripe explizit nach 31 Minuten ab; der lokale Checkout-Timeout greift erst nach 32 Minuten. Vor `CANCELLED` lässt das Backend die zugehörige offene Stripe-Session serverseitig ablaufen und bindet die atomare Statusänderung an deren ID. Schlägt diese Entwertung fehl, bleibt `CHECKOUT_STARTED` maßgeblich und ein paralleler Retry gesperrt. Auch eine erzeugte, aber nicht an die DemoSession anhängbare Stripe-Session wird vor einem Rollback entwertet; ist das nicht bestätigbar, erfolgt kein unsicherer Rückfall auf `READY`.

Mobile Produktseite, Frontpage-Simulation und Firmware besitzen für `CANCELLED` dieselbe ruhige Aussage: Zahlung nicht abgeschlossen, nichts abgebucht, erneuter Versuch möglich. Ein Checkout-Startfehler nennt den nicht ladbaren sicheren Zahlungsbereich und erlaubt Retry; ein unklarer Zustand zeigt ausschließlich die laufende Prüfung. Der physische `CANCELLED`-Overlay benötigt nach dem Deployment einen Firmware-Flash und eine reale TFT-Abnahme. Lokal bestätigt sind 57/57 Backendtests, 42/42 Frontendtests samt ESLint/Produktionsbuild sowie 20/20 Firmware-Vertragstests und der PlatformIO-Build; dieser Abschnitt ist bis zur produktiven Verifikation nicht als live bestätigt.

## Stripe-Sandbox und Webhooks

Alle öffentlich angebotenen Checkout-Pfade sind auf Stripe-Testmodus begrenzt. Zwei getrennte, signaturgeprüfte Raw-Body-Webhooks verarbeiten ausschließlich ihre jeweilige Projektion:

- `POST /api/demo/stripe/webhook` verarbeitet nur `flow=qr2buy_demo` für `DemoSession`, akzeptiert `checkout.session.completed` und `checkout.session.async_payment_succeeded`, verifiziert den Checkout erneut bei Stripe und setzt erst danach atomar `PAID`. Unbekannte, unbezahlte und fremde Events werden ohne Statusänderung quittiert; Live-Events und falsche Signaturen werden abgewiesen.
- `POST /api/stripe/webhook` gehört zum älteren `/p/:shortId`-Buyer-Flow und aktualisiert ausschließlich normale `Product`-, `Device`- und `Order`-Modelle für `system=qr2buy`. Demo- und unbekannte Events werden mit 2xx ignoriert. Fulfillment setzt einen bezahlten Test-Checkout voraus, ist über die Checkout-Session-ID idempotent und speichert nur eine redigierte Sessionprojektion statt des vollständigen Stripe-Objekts.

Die frühere Stripe-Zustellung an `https://lionfish-app-zidqr.ondigitalocean.app/api/stripe/webhook` erzeugte 42 HTTP-500-Antworten, weil dieser Legacy-Endpoint aktiv blieb, während `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` im produktiven Service nicht gesetzt waren. Der kanonische Legacy-Endpoint ist `https://qr2buy.com/api/stripe/webhook`; er verwendet einen eigenen Signing Secret. Der Demo-Endpoint verwendet weiterhin getrennt `STRIPE_DEMO_SECRET_KEY` und `STRIPE_DEMO_WEBHOOK_SECRET`. Webhooks, nicht Browser-Returns, sind die maßgebliche Bestätigung für bezahlte Zustände.

Am 4. September 2026 hat der Nutzer nach dem Webhook-Fix erneut einen vollständigen manuellen Sandbox-Checkout mit der offiziellen Stripe-Testkarte `4242 4242 4242 4242` erfolgreich durchgeführt. Damit sind produktiv die Frontpage-Demo, die mobile Demo-Produktseite, der ausschließlich simulierte Stripe-Testcheckout ohne echte Zahlung oder Bestellung, der Checkout-Return, die Webhook-Verarbeitung und der bestätigte Zahlungsstatus der zugehörigen `DemoSession` belegt. Frontpage und mobile Journey reagierten korrekt. Hardware-Synchronisierung, produktiver Reservierungsflow und der vertragsgemäße automatische Reset auf `READY` waren bereits separat bestätigt; diese manuelle Abnahme wird nicht als neue Detailabnahme aller physischen TFT-Statusansichten ausgelegt.

Aktuell sind genau diese Stripe-Test-Webhooks verbindlich:

- `https://qr2buy.com/api/stripe/webhook` für den Legacy-Buyer-Flow der normalen `Product`-, `Device`- und `Order`-Modelle
- `https://qr2buy.com/api/demo/stripe/webhook` für die session-isolierte Frontpage-/Hardware-Demo über `DemoSession`

Beide akzeptieren mindestens `checkout.session.completed` und `checkout.session.async_payment_succeeded`, verlangen eine gültige Stripe-Signatur, beantworten ungültige Signaturen mit HTTP 400 und erfolgreiche legitime Zustellungen mit HTTP 2xx. Der alte `lionfish-app-zidqr.ondigitalocean.app`-Endpoint darf nicht erneut als Stripe-Destination konfiguriert werden. Die zugehörigen ENV-Namen sind `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_DEMO_SECRET_KEY` und `STRIPE_DEMO_WEBHOOK_SECRET`; alle vier müssen im produktiven DigitalOcean-Backend als Secrets gesetzt sein. Ein ausschließlich lokal grüner Test ersetzt diese produktive Konfiguration nicht.

### Stripe Regression Guard

Vor jeder Änderung an Checkout, Stripe, Webhooks oder `DemoSession` sind zu prüfen:

1. beide verbindlichen produktiven Webhook-Endpunkte,
2. alle vier zugehörigen DigitalOcean-Stripe-ENV als Secrets,
3. Stripe-Testmodus und niemals Live-Modus für die Demo,
4. zwingende Webhook-Signaturprüfung,
5. `pending_webhooks: 0` beziehungsweise erfolgreiche Zustellung nach einem kontrollierten Testevent,
6. keine HTTP-500 in den Backend-Logs,
7. Frontpage- und Mobile-Status nach Checkout,
8. der Reservierungsflow,
9. der Hardware-Config-State und
10. dass keine alte DigitalOcean-Webhook-URL erneut aktiviert wurde.

Der signierte Stripe-Webhook bleibt die maßgebliche serverseitige Kaufbestätigung; der Browser-Return allein genügt nicht.

## Hardware-Binding und Hardware-API

`DemoHardwareBinding` koppelt `demo-device` nach ausdrücklichem Operator-Pairing an genau eine aktive `DemoSession`, einen `productKey` und eine Locale. Ein autorisiertes Rebinding derselben `deviceId` ersetzt das vorherige Binding atomar. Produktwechsel der gekoppelten Frontpage werden per PATCH übertragen. Es gibt keinen parallelen Hardware-Produktkatalog; Produktname, Preis, Status und QR werden aus `DemoSession` plus `DEMO_PRODUCTS` projiziert.

API-Vertrag:

- `POST /api/demo/sessions/:token/hardware-binding`
  - Header: `x-demo-pairing-secret`
  - Body: `deviceId`, `productKey`, `locale`
  - Erstellt beziehungsweise ersetzt das Binding und liefert die aktuelle Hardware-Projektion.
- `PATCH /api/demo/sessions/:token/hardware-binding`
  - Body: `deviceId`, `productKey`, optional `locale`
  - Aktualisiert ausschließlich das Binding derselben autorisierten Session.
- `GET /api/demo/hardware/config?deviceId=demo-device`
  - Header: `x-device-secret`
  - Ohne gültiges Device-Secret fail-closed mit 401.
  - Ohne aktives Binding regulär HTTP 200 mit `{ "ok": true, "bound": false }`.
  - Mit Binding: `ok`, `bound`, `deviceId`, `productKey`, `text`, `priceText`, `status`, `interactionState`, `interactionExpiresAt`, `qr`, `eventVersion`, `resetAt`, `expiresAt`.

Bindings besitzen einen TTL-Index und laufen mit ihrer DemoSession ab. Das Session-Token wird im Binding ausschließlich AES-256-GCM-verschlüsselt gespeichert; der Schlüssel kommt nur aus ENV. Binding und Hardware-Polling besitzen getrennte Rate-Limits.

## P0.3.1 Merchant-/Device-Fundament – produktiv ausgerollt

Neben der unveränderten öffentlichen `DemoSession`-Marketing-Demo existiert lokal eine eigenständige Merchant-Domain für das spätere echte Händlersystem. Die bisherigen normalen `Product`-/`Device`-Modelle bleiben als Legacy-Commerce-Pfad bestehen, weil sie Preis und Gerät historisch direkt 1:1 koppeln, Geräte optional unsicher auto-provisionieren und daher nicht als Grundlage der neuen Zuordnungs- und Angebotshistorie dienen.

Die neue Domain trennt `Merchant`, `Location`, permanente `ManagedDevice`-Identität, `MerchantProduct`-Stammdaten und standortbezogene `Offer`-Verkaufsbedingungen. Geldbeträge liegen ohne binäre Fließkommawerte als ganzzahliges `priceMinor` in der kleinsten Währungseinheit am Offer, beispielsweise `2490` EUR-Cent für 24,90 EUR; `currency`, numerischer Bestand, Kauf-/Reservierbarkeit und Bedingungen gehören ebenfalls zum Offer. `inventorySource=QR2BUY|EXTERNAL` und eine optionale externe Referenz halten eine spätere, ausdrücklich noch nicht implementierte ERP-/Warenwirtschaftsanbindung offen.

`DeviceMerchantAssignment` historisiert Händler-, Standort- und Nutzungszuordnung mit `INTERNAL`, `PILOT`, `RENTAL` oder `SOLD`; pro Device erzwingt ein partieller Unique-Index höchstens eine aktive Zuordnung. `DisplayAssignment` bildet `PENDING → ACTIVE → REPLACED|ENDED` ab. Ein Device darf höchstens ein aktives Offer zeigen, während ein Produkt auf mehreren Devices aktiv sein darf. Aktivierung verlangt eine Vor-Ort-Verifikationsmethode; reine Remote-Änderungen bleiben später auf Preis, Bestand, Kauf-/Reservierbarkeit und Bedingungen begrenzt. Händlerwechsel und aktive Displayablösung laufen transaktional und erhalten die Historie.

Die zwei permanenten Prototypidentitäten sind für den kontrollierten Seed vorbereitet: `QR2B-000001` / `ESP32_ILI9341_CS5` / `Schild 1` und `QR2B-000002` / `ESP32_ILI9341_NOCS` / `Schild 2`. Ihre bekannten ESP32-MACs dienen ausschließlich als eindeutige Hardware-UID, nie als Authentifizierungssecret. Beide werden als `PILOT` demselben Demo-Händler und Standort zugeordnet. Drei getrennte Merchant-Produkte und Offers sind vorgesehen; Displayzuordnungen bleiben zunächst bewusst `PENDING`, bis eine echte Vor-Ort-Bestätigung erfolgt.

Die minimale Lese-API unter `/api/merchant-domain/merchants/:merchantId/...` liefert Merchant, Locations, Devices, Products, Offers und aktuelle Assignments. Sie ist nicht öffentlich und reagiert ohne vollständig konfigurierte Admin-Credentials fail-closed. Diese Basic-Auth-Schicht ist ausschließlich ein interner Übergangsschutz und ausdrücklich kein finales Händler-Login; Merchant-Authentifizierung, Onboarding, Rollen und Sessions bilden einen eigenen Folgemeilenstein. Der idempotente Seed `npm run seed:merchant-demo` verändert nur seine stabilen Demo-IDs, verweigert Identitätskonflikte und benötigt `MERCHANT_DEMO_SEED_ENABLED=true`; Produktion erfordert zusätzlich eine zweite ausdrückliche Freigabe. Er wurde weder gegen eine lokale noch gegen die produktive MongoDB ausgeführt; insbesondere ist er kein Bestandteil des produktiven Start- oder Auto-Deploy-Pfads.

Für die spätere echte Device-API gilt verbindlich: Jedes physische Schild authentifiziert ausschließlich seine permanente `deviceId` mit einem eigenen rotierbaren Credential. Credentials dürfen niemals im Klartext gespeichert werden. Die MAC bleibt reine Hardware-UID und kein Secret; Händler und Standort werden serverseitig aus der aktuellen Assignment-Historie ermittelt. Dadurch benötigen Händler-, Standort- oder Nutzungswechsel keinen Firmware-Reflash. Credential-Provisioning, Hashing beziehungsweise gleichwertig sichere Verifikation und Rotation sind der nächste technische Meilenstein und noch nicht implementiert.

Feature-Commit `84ea988` ist auf `origin/main` und produktiv erreichbar. Live bestätigt sind HTTP 200 für `/`, `/de`, `/en` und `/api/health`, eine neu erzeugte DemoSession mit `bag` im Commerce-Status `READY` sowie der Fail-closed-Schutz der neuen Merchant-API mit HTTP 401 ohne Authentifizierung. Vor dem Commit waren Backend 68/68 Tests plus Syntax- und Import-Smoke, Frontend unverändert 42/42 plus ESLint und Produktionsbuild sowie der aktuelle Firmware-Workspace 21/21 plus PlatformIO-Build `esp32dev_spi_cs5_rst4_app` grün. Es erfolgte kein Firmware-Flash für P0.3.1.

## Physischer Hardware-Prototyp

- Controller: ESP32 Dev Module, Arduino-Framework über PlatformIO
- Display: ILI9341, physisch 240×320 Pixel, aktiv als 320×240 Landscape mit `setRotation(1)`
- Bus: SPI
- Bestätigte Pins: CS GPIO5, RST GPIO4, DC GPIO15, MOSI GPIO23, MISO GPIO19, SCLK GPIO18
- Aktives Environment: `esp32dev_spi_cs5_rst4_app`
- Aktiver Quellpfad: `firmware/qr_display_fw/src/static_app.cpp`
- Lokaler Port/Monitor: COM3, 115200 Baud
- Backlight: kein steuerbarer GPIO dokumentiert; `TFT_BL = -1`. Softwaredimmung ist erst nach sicher dokumentierter Hardwareverdrahtung zulässig.

Die reale Hardware wurde erfolgreich geflasht und getestet. Bestätigt sind WLAN, NTP/TLS, Hardware-Config HTTP 200 mit rotiertem Device-Secret, explizites Frontpage-Pairing, physischer Produktwechsel `bag → tree` innerhalb ungefähr des Drei-Sekunden-Pollingintervalls, scanbarer QR und das Laden der korrekten mobilen Zielseite. Reservierung und Stripe-Testkauf wurden grundsätzlich erfolgreich durchlaufen. Die Detaildarstellung von `RESERVED`, `PAID` und `SOLD` auf dem realen TFT ist noch nicht als vollständig perfektioniert abgenommen und bleibt bewusste Nacharbeit.

## Finale Firmware-Funktion und Display

Die Firmware testet alle Einträge der lokalen `WIFI_LIST` nacheinander mit je 15 Sekunden Timeout, verwendet das erste erreichbare WLAN und führt bei Verbindungsverlust einen nicht blockierenden Runtime-Reconnect aus. SSIDs dürfen im Serial Monitor erscheinen, Passwörter nie. Ein Hintergrund-Task pollt alle drei Sekunden. Temporäre WLAN-/HTTP-Fehler überschreiben keinen bereits gültigen Produktzustand.

TLS wird mit `WiFiClientSecure`, verifizierter Systemzeit und dem offiziellen selbstsignierten `GTS Root R4` validiert. `client.setCACert(QR2BUY_ROOT_CA)` bleibt aktiv; `setInsecure()` ist verboten. Der Trust Anchor muss bei einer künftigen Änderung der von `qr2buy.com` ausgelieferten Zertifikatskette erneut geprüft werden.

Der real akzeptierte Displaystand:

- 320×240 Landscape, zweispaltig: QR und Scan-USP links, Produktinformationen rechts
- warme qr2buy-Farbwelt mit kontrastoptimierten RGB565-Haupt-, Sekundär- und READY-Farben
- dynamische QR-Version bis Version 10; aktuelle 81–83-Byte-URLs verwenden Version 5
- quadratischer, physisch scanbarer QR mit unveränderter Vier-Modul-Ruhezone
- prominentes `Mit dem Handy scannen` und Badge `KEINE APP NOETIG`
- adaptiver Produktname: 26 Pixel hoher Font 4, sofern der Titel in höchstens zwei Zeilen passt; sonst kräftiger Font-2-Fallback
- Preis und Status-Pill bleiben klar nachgeordnet; `READY` zeigt `NOCH ZU HABEN`
- QR sichtbar für `READY`, `CHECKOUT_STARTED`, `CANCELLED`; kein QR bei `RESERVED`, `PAID`, `SOLD`
- technische Footeranzeige `LIVE · SICHER VERBUNDEN` nur bei WLAN, gültiger TLS-Zeit, mindestens einem erfolgreichen Config-Abruf und maximal zehn Sekunden altem Erfolg
- sanfter 1,8-Sekunden-Puls zeichnet nur den kleinen Footerpunkt neu; bei fehlender Frische steht gedämpft `VERBINDUNG...`
- Binding-, WLAN-, TLS-, Backend- und Abschlussansichten folgen derselben visuellen Sprache

Die Displaygestaltung wurde auf echter Hardware als „fast perfekt“ akzeptiert. Offen bleibt ausschließlich Detailnacharbeit an Reservierungs-/Kauf-/Verkauft-Darstellungen, nicht die grundlegende Synchronisations- oder Layoutarchitektur.

## Firmware- und Backend-Security

- `firmware/qr_display_fw/src/secrets.h` enthält lokal `WIFI_LIST`, `QR2BUY_DEVICE_ID` und `QR2BUY_DEVICE_SECRET` und ist gitignored.
- `backend/.env` ist lokal und gitignored. Versionierbare Beispiele enthalten nur Platzhalter.
- Pairing- und Device-Secret wurden nach dem Logger-Fix rotiert; das alte Device-Secret wird produktiv mit 401 abgewiesen.
- `DEMO_HARDWARE_ENCRYPTION_KEY` musste wegen des Header-Logging-Vorfalls nicht rotiert werden und bleibt ausschließlich serverseitig.
- Pino redigiert Authorization-, Pairing- und Device-Header; Responses werden ohne eingebettetes Requestobjekt serialisiert.
- Token, vollständige sessiongebundene QR-URLs, WLAN-Passwörter und Secrets werden nicht geloggt.
- Reale Secret-Dateien sind nicht getrackt; `firmware/**/.pio/` bleibt ebenfalls ignoriert.

## DigitalOcean-Deployment

- Produktive DigitalOcean-App: `qr-backend`
- Backend-Komponente: `qr2buy-backend`, Source `backend`, Web Service, Port 8080, Route `/api` mit Preserve Full Path, Healthcheck `/api/health`
- Frontend-Komponente: `qr2buy-frontend`, Source `frontend`, Static Site, Build `npm ci && npm run build`, Output `dist`, Route `/`, SPA-Catchall `index.html`
- Deploy-Quelle: GitHub-Branch `main`; Push auf `origin/main` löst Auto-Deploy aus.
- Domains: `qr2buy.com` primär, `www.qr2buy.com` aktiv, HTTPS aktiv.
- `DEMO_PUBLIC_BASE_URL=https://qr2buy.com`

Relevante ENV-Namen ohne Werte:

- `MONGODB_URI`, `PUBLIC_BASE_URL`, `DEMO_PUBLIC_BASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_DEMO_SECRET_KEY`, `STRIPE_DEMO_WEBHOOK_SECRET`
- `DEMO_HARDWARE_PAIRING_SECRET`, `DEMO_HARDWARE_ENCRYPTION_KEY`, `DEMO_HARDWARE_DEVICE_SECRETS`
- `DEMO_SESSION_TTL_MINUTES`
- `ADMIN_USER`, `ADMIN_PASS`
- optional `DEMO_MAIL_TRANSPORT`, `DEMO_SMTP_HOST`, `DEMO_SMTP_PORT`, `DEMO_SMTP_USER`, `DEMO_SMTP_PASS`, `DEMO_SMTP_FROM`, `DEMO_SMTP_HELO_NAME`

Der exakte produktive Commit wird nach jedem Rollout gegen `origin/main` und den DigitalOcean-Deploymentstand geprüft; der Abschlussbericht der jeweiligen Änderung nennt den verifizierten Hash. Ein Commit kann seinen eigenen Hash technisch nicht zuverlässig im eigenen Inhalt festhalten.

## Verifizierter Teststand vom 4. September 2026

- Backend: 43/43 Tests grün
- Backend: alle Dateien unter `backend/src` mit `node --check` grün
- Backend: Import-Smoke für `backend/src/routes/demo.js` grün
- Backend: kein separates Lint- oder Build-Script vorhanden
- Frontend: 33/33 Tests grün
- Frontend: ESLint grün
- Frontend: Vite-Produktionsbuild grün
- Beide produktiven Stripe-Webhooks: HTTP 200 auf ein kontrolliertes Stripe-Sandbox-Event
- Beide produktiven Stripe-Webhooks: falsche Signaturen HTTP 400
- Produktive Backend-Logs nach dem Fix: keine aktuellen HTTP-500
- Produktiver Reservierungsflow und automatischer Reset auf `READY` live bestätigt
- Manueller Stripe-Sandbox-Checkout mit offizieller 4242-Testkarte inklusive Return, Webhook und bestätigtem `DemoSession`-Zahlungsstatus durch den Nutzer live bestätigt
- Firmware: 16/16 statische Vertragsprüfungen grün
- Firmware: PlatformIO-Build `esp32dev_spi_cs5_rst4_app` grün
- Firmwaregröße: 47.996 Byte RAM von 327.680 (14,6 %), 978.421 Byte Flash von 1.310.720 (74,6 %)
- Erwartete einzige Buildwarnung: `TOUCH_CS` ist nicht definiert; Touch-Funktionen werden nicht verwendet.
- `git diff --check` grün

## Verifizierter P0.2-Test- und Livestand vom 5. September 2026

- Backend: 50/50 Tests grün; alle `backend/src`-JavaScriptdateien mit `node --check` und Demo-/Stripe-/Checkout-Router-Import-Smoke grün
- Frontend: 38/38 Tests, ESLint und Vite-Produktionsbuild grün
- Firmware: 17/17 statische Vertragsprüfungen und PlatformIO-Build `esp32dev_spi_cs5_rst4_app` grün
- Firmwaregröße: 48.060 Byte RAM von 327.680 (14,7 %), 979.305 Byte Flash von 1.310.720 (74,7 %)
- Erwartete einzige Buildwarnung: `TOUCH_CS` ist nicht definiert; Touch-Funktionen werden nicht verwendet.
- DigitalOcean: funktionaler Commit `bcb9239` für Backend und Frontend `ACTIVE` bestätigt; `/`, `/de`, `/en` und `/api/health` liefern HTTP 200.
- Live-Interaction: `READY → SCANNED → READY` bestätigt; Commerce bleibt währenddessen `READY`, Hardware-Config übernimmt `SCANNED` und fällt nach der Zehn-Sekunden-TTL zurück.
- Live-Regression: Reservierung wechselt auf `RESERVED` und nach 20 Sekunden zurück auf `READY`; Checkout-Erzeugung im Stripe-Testmodus, `CHECKOUT_STARTED` und Abbruch auf `CANCELLED` sind bestätigt, ohne Zahlung.
- Reale Hardware: Firmware installiert; fortlaufende autorisierte Config-Abrufe mit HTTP 200 nach dem Rollout belegen automatische Wiederverbindung und aktives Polling ohne erneuten Flash.

## Verifizierter P0.2-Folgestand vom 5. September 2026

- Backend: 54/54 Tests grün; alle JavaScriptdateien unter `backend/src` mit `node --check` und Router-Import-Smoke grün
- Frontend: 40/40 Tests, ESLint und Vite-Produktionsbuild grün
- Firmware: 19/19 statische Vertragsprüfungen und PlatformIO-Build `esp32dev_spi_cs5_rst4_app` grün
- Firmwaregröße: 48.060 Byte RAM von 327.680 (14,7 %), 980.437 Byte Flash von 1.310.720 (74,8 %)
- Feature-Commit `981e0bf` ist auf `origin/main` und für `qr2buy-backend` sowie `qr2buy-frontend` in DigitalOcean `ACTIVE`; `/api/health` und die Frontpage liefern HTTP 200.
- Die 120-Sekunden-Scan-TTL, das explizite Löschen bei Commerce-Aktionen und die Backend-gesteuerte Frontend-Deduplizierung sind produktiv.
- Live bestätigt: `SCANNED` bleibt nach 30 und 60 Sekunden aktiv, fällt nach ungefähr 120 Sekunden auf `READY` zurück, wird sofort von `RESERVED` überschrieben und erscheint nach dem Reservierungs-Reset nicht erneut.
- Die Firmware benötigt für die TTL-Änderung keinen erneuten Flash; sie zeigt `SCANNED`, solange die Backend-Projektion diesen Zustand liefert.

## Verifizierter P0.2-Teil-2-Test- und Livestand vom 6. September 2026

- Backend unverändert: 54/54 Tests, Syntaxprüfung und Router-Import-Smoke grün
- Frontend: 41/41 Tests, ESLint und Vite-Produktionsbuild grün
- Firmware unverändert: 19/19 statische Vertragsprüfungen und PlatformIO-Build `esp32dev_spi_cs5_rst4_app` grün
- Firmwaregröße unverändert: 48.060 Byte RAM von 327.680 (14,7 %), 980.437 Byte Flash von 1.310.720 (74,8 %)
- `git diff --check` grün; keine Secrets, Secret-Zuweisungen oder unsicheren Token-/QR-Logs im Diff
- Feature-Commit `0566945` ist auf `origin/main` und für `qr2buy-backend` sowie `qr2buy-frontend` in DigitalOcean `ACTIVE`; `/`, `/de`, `/en` und `/api/health` liefern HTTP 200.
- Das produktive Frontend-Bundle enthält die neue DE/EN-Kauf-/Reservierungs-Journey und die kompakte Kaufzusammenfassung.
- Technisch live bestätigt: `READY → SCANNED → RESERVED → READY`, abgewiesene Doppelreservierung mit HTTP 409 sowie `READY → SCANNED → CHECKOUT_STARTED → CANCELLED → READY`; es wurde keine Zahlung ausgeführt.
- Mangels steuerbarer Browser-Sitzung bleiben die visuelle Viewport-Abnahme bei 320/375/390/430 Pixeln und ein interaktiver Stripe-Sandbox-Checkout bis `PAID` manuell offen.

## Verifizierter Checkout-Fehler- und Retrystand vom 6. September 2026

- Der funktionale Fix-Commit `19ab483` ist auf `origin/main` und im DigitalOcean-Rollout für Backend und Frontend `ACTIVE`; `/`, `/de`, `/en` und `/api/health` liefern HTTP 200. Das produktive Bundle enthält die DE/EN-Zustände für Startfehler, laufende Zahlungsprüfung und bestätigten Abbruch.
- Die reale Fehlerspur ist eingegrenzt: `tree`-Checkout HTTP 201 in 483 ms, gültige Stripe-Testsession mit URL, `open`, `unpaid`, `livemode=false`, kein Cancel und kein Webhook. Der Checkout-Link war per `curl` mit HTTP 200 erreichbar; ein .NET-TLS-Transport schlug beim selben Link fehl. Ein konkreter Browserfehler ist mangels Client-Telemetrie nicht beweisbar, Backend- oder Stripe-Session-Erzeugung waren aber nicht die Ursache. Die identifizierte alte Testsession wurde anschließend als `expired/unpaid` entwertet.
- Produktiv bestätigt ist `READY/SCANNED → CHECKOUT_STARTED → CANCELLED`, einschließlich Stripe `open/unpaid → expired/unpaid`, direktem Retry mit genau einer neuen Checkout-Session und erneutem sicheren Cancel. Neue Stripe-Sessions verwenden 31 Minuten Ablauf; qr2buy fällt erst nach 32 Minuten zurück. Bei nicht bestätigbarer Stripe-Entwertung bleibt `CHECKOUT_STARTED` ohne Retry bestehen.
- Hardware-Config lieferte für das gebundene `demo-device` `CANCELLED` ohne Interaction-State und nach 20 Sekunden wieder `READY` mit erhöhter Event-Version. Die neue physische `CANCELLED`-Overlay-Darstellung ist gebaut, aber noch nicht auf den ESP32 geflasht oder real am TFT abgenommen.
- Backend: 57/57 Tests, Syntaxprüfung und Demo-Router-Import-Smoke grün. Frontend: 42/42 Tests, ESLint und Produktionsbuild grün. Firmware: 20/20 Vertragsprüfungen und PlatformIO-Build grün; 48.060 Byte RAM (14,7 %) und 980.745 Byte Flash (74,8 %). `git diff --check` und Secretprüfung sind grün; produktive Logs enthalten keine Session-Token und im geprüften Rollout keine HTTP-500.
- Ein neuer interaktiver Checkout bis `PAID` und die visuelle Mobile-/Frontpage-Abnahme bleiben mangels verfügbarer Browserinstanz manuell offen. Die frühere produktive Webhook-/PAID-Abnahme bleibt gültig, ersetzt aber nicht diesen erneuten visuellen Lauf.

## PAID-Firmware – real abgenommen am 7. September 2026

- Der Nutzer hat den neuen PAID-Erfolgsbildschirm nach erfolgreichem realem Stripe-Sandbox-Testkauf auf Prototyp 1 ausdrücklich akzeptiert: `KAUF ERFOLGREICH`, `BEZAHLT`, korrektes Produkt und korrekter Preis sichtbar, positive grüne Erfolgsgestaltung, kein QR im PAID-Zustand und keine offensichtlichen Textabschneidungen oder Artefakte. Dies ist eine Nutzerabnahme am physischen TFT, keine aus statischen Tests abgeleitete Sichtprüfung.
- Bestätigter Hardwarestand: vollständige qr2buy-Demo-App, ESP32 mit CS5-Hardwarepfad, Environment `esp32dev_spi_cs5_rst4_app`, COM3, MAC `78:1c:3c:2c:82:50`. Der zuvor durchgeführte Upload war einschließlich Hashverifikation erfolgreich. Prototyp 2 wurde nicht verändert.
- Vor dem separaten PAID-Abschlusscommit erneut geprüft: 21/21 Firmware-Vertragstests, PlatformIO-Build und `git diff --check` grün. RAM: 48.060 Byte; Flash: 981.353 Byte. Der Firmware-Diff enthält ausschließlich den PAID-Screen und seine Tests, keine Secrets, QR-/Session-Token-Logs oder TLS-Abschwächung.
- Die vorherige UNBOUND-Diagnose beschrieb nur den Zustand unmittelbar nach dem Flash vor der inzwischen bestätigten Sandbox-Abnahme. Eine erneute vollständige visuelle Mobile-/Frontpage-Viewport-Abnahme und die separate CANCELLED-Abnahme werden daraus nicht abgeleitet.
- P0.3.2 beginnt erst nach geprüftem Push-/Deploymentabschluss dieses separaten Firmwarestands; kein Production-Seed und keine Merchant-Firmware-Umstellung sind damit verbunden.

Der separate Abschlusscommit `2b338ae` (`feat: finalize qr2buy hardware paid experience`) wurde auf `origin/main` gepusht; vor Beginn von P0.3.2 waren lokales `main`, Remote und sauberer Arbeitsbaum geprüft. DigitalOcean-Deployment `3c8ce507-24e8-457e-992e-4f57d67a7515` ist `ACTIVE`, Backend und Frontend verwenden diesen Commit. Live: `/`, `/de`, `/en`, `/api/health` HTTP 200; isolierte DemoSession HTTP 201, Snapshot HTTP 200 mit vier READY-Produkten; Hardware-Config ohne Auth HTTP 401. Vor P0.3.2 waren Backend 68/68 samt Syntax/Router-Imports und Frontend 42/42 samt ESLint/Build grün.

## P0.3.2 – historischer Abschluss vor der Provisionierung

- Separate `DeviceCredential`-Collection mit HMAC-SHA-256-Verifier, 32-Byte-Pepper ausschließlich aus `DEVICE_CREDENTIAL_PEPPER`, Credential-Version, Erstellungs-/Rotationsdatum und Status; Operatorservice für Erzeugung, Rotation und Widerruf. Die Trennung verhindert Verifier-Ausgabe über die vorhandene Merchant-Device-Lese-API; kein Credential-Klartext in Mongo. Die lokalen Build-Tokens sind weiterhin nicht provisioniert.
- Neue `/api/device/config`-Route mit `x-device-id`, `x-device-secret`, `x-device-credential-version` und optional `x-firmware-version`; Merchant-/Location-/Display-/Offer-/Product-Auflösung in einem Mongo-Snapshot. Heartbeat auf 60 Sekunden gedrosselt, Firmwareänderungen separat erkannt; Online-Ableitung mit 120 Sekunden Frische. Fehlende/inaktive Zuordnung ergibt `assigned=false`. Authentifizierung, Rotation, Isolation und atomare Heartbeat-Updates sind jetzt auch gegen echte lokale Mongo-Operationen geprüft.
- Zufällige öffentliche Offer-ID und separater lesender `/o/:publicOfferId`-Buyer-Pfad samt `/api/public/merchant-offers/:publicOfferId`; kein Legacy- oder Demo-Checkout. Die Merchant-Projektion liefert derzeit READY beziehungsweise bei Nullbestand SOLD; weitere Commerce-Ereignisse sind nicht implementiert. Event-Version ist ein Änderungsfingerabdruck, kein monotoner Commerce-Zähler.
- Gemeinsamer Firmware-Quellpfad mit CS5-/NOCS-Merchant-Environments und verschachteltem C++-Parser vorbereitet. Zwei separate ignorierte lokale Device-Header für `QR2B-000001` / `QR2B-000002` mit unabhängigen kryptografisch erzeugten 32-Byte-Tokens angelegt; WLAN enthält Platzhalter, die Tokens sind nicht in Mongo provisioniert. Beispielheader enthalten nur Platzhalter.
- Behobene Testblocker: Der Rotationstest adaptiert `Device.findOne({ deviceId })` auf die String-Signatur des Test-Doubles; Service unverändert. Der Windows-Hosttest führt Compilerbefehle über eine anschließend entfernte Batchdatei aus. `merchant_config_host.cpp` wird tatsächlich mit MSVC kompiliert und ausgeführt; keine funktionale Firmwareänderung für die Testreparatur.
- Sichere Infrastrukturbehebung: Norton Web/Mail Shield signiert die tatsächlich geprüften npm-/PlatformIO-Hostverbindungen mit seiner Windows-vertrauten lokalen CA. PlatformIO-Python mit certifi scheitert dagegen an der Zertifikatsverifikation. Die bereits erfolgreich verwendeten lokalen TFT_eSPI-2.5.43-Kopien waren über alle 578 Dateien SHA-256-identisch; TFT_eSPI, QRCode und ArduinoJson wurden bytegleich in die ignorierten libdeps beider Merchant-Environments übernommen. Keine Bibliotheksversion geändert und keine Bibliothekskopie versioniert. Node 22.22.0 erreicht die npm-Registry mit `--use-system-ca` bei `authorized=true`; dieser Schalter wurde nur für die jeweiligen Prozesse über `NODE_OPTIONS` ergänzt. npm `strict-ssl=true`, keine globale Konfigurationsänderung, keine CA-Dateien im Repo und kein TLS-Bypass.
- Echte Testumgebung: `mongodb-memory-server@11.2.0` als exakt versionierte Dev-Abhängigkeit startet MongoDB 8.2.6 als eigenes lokales Replica Set auf `127.0.0.1`, mit zufälligem `qr2buy_test_<hex>`-DB-Namen. Der Test lädt keine `.env` und verwendet keine Atlas-/Produktions-URI. Er prüft beide Geräte mit getrennten Testcredentials, falsche Gerätezuordnung, ACTIVE/PENDING/fehlende Zuordnungen, Produkt-/Offer-Projektion, serverseitigen Händlerwechsel, alte/neue Credentials bei Rotation, Firmwareversion und echte Mongo-Schreibbefehle bei gedrosselten Heartbeats. Datenbank und temporäre Speicherverzeichnisse werden im `finally` entfernt; Löschung und Prozessstopp sind geprüft.
- Buyer-Prüfung gegen echte MongoDB/HTTP grün: zufällige öffentliche ID liefert die erwartete Leseprojektion; fehlende, unbekannte oder interne Mongo-ID liefert HTTP 404; inaktives Offer/gesperrter Merchant liefert HTTP 404 und keine aktive Device-Projektion. Eine alte öffentliche Offer-URL bleibt nach Gerätewechsel lesbar, solange das Offer aktiv bleibt; sie identifiziert das Offer, nicht das Gerät. `checkoutAvailable=false`, keine internen IDs, DemoSession-Token, Secrets oder Verifier in der öffentlichen Projektion.
- Finaler lokaler Teststand vom 7. September: Backend 86/86 inklusive sechs Mongo-Integrationstest-Ergebnissen und echtem Logger-Test; alle Backend-Quelldateien syntaktisch geprüft und Demo-/Stripe-/Checkout-/Merchant-/Device-Router-Imports grün. Frontend 43/43, ESLint und Vite-Build grün. Firmware 23/23 inklusive ausgeführtem C++-Parser; `esp32dev_spi_cs5_rst4_merchant_app` und `esp32dev_spi_nocs_rst4_merchant_app` beide SUCCESS. Erwartete Touch-Warnung: `TOUCH_CS` nicht definiert, Touch wird nicht verwendet.
- Security-/Dateiprüfung grün: beide lokalen Device-Tokens sind unabhängig, 32 Byte stark, gitignored und in keiner versionierbaren Datei enthalten. Keine hartcodierten Credentials oder TLS-Bypasses gefunden. Der echte Logger-Test bestätigt fehlende Credential-/Query-Leaks auch im Fehlerfall; API-Antworten enthalten keine Verifier. `git diff --check` grün; keine versionierbaren Temp-/Batch-/Cache-/Builddateien. Download-/Buildcaches bleiben lokal ignoriert.
- Vor Veröffentlichung erneut geprüft: Backend 86/86 einschließlich echter lokaler Mongo-Rotation, Frontend 43/43 samt ESLint/Build, Firmware 23/23 und beide Merchant-Builds grün. Unbekannte/unprovisionierte Geräte werden vor der HMAC-Berechnung mit 401 abgewiesen, auch wenn produktiv noch kein Merchant-Pepper gesetzt ist; dieser Randfall ist zusätzlich abgesichert.
- Feature-Commit `2ac8790` (`feat: add permanent qr2buy merchant device infrastructure`) wurde auf `origin/main` gepusht und am 7. September für Backend und Frontend produktiv verifiziert. DigitalOcean-Deployment `b0e47b6a-3168-4532-affa-8f3203ea7145` ist ACTIVE und beide Komponenten verwenden diesen Feature-Commit. Der anschließende reine Dokumentationscommit hält diesen verifizierten Funktionsstand fest.
- Live-Regression grün: `/`, `/de`, `/en`, `/api/health` und `/demo/p/bag` HTTP 200; neue isolierte Marketing-DemoSession HTTP 201; READY → SCANNED → RESERVED → READY sowie separater Stripe-Testcheckout HTTP 201, CHECKOUT_STARTED → CANCELLED → READY. Der Cancel-Pfad entwertet die offene Stripe-Testsession. Es wurde keine Zahlung abgeschickt; eine erneute visuelle Browser-/TFT-Abnahme bis PAID wird nicht behauptet. Beide Stripe-Webhooks weisen ungültige Signaturen mit HTTP 400 ab. Bestehendes DemoHardwareBinding nur lesend geprüft: autorisierter Abruf HTTP 200, gebundenes READY-Produkt konsistent zur mobilen API-Projektion; kein Rebinding.
- Neue Infrastruktur live fail-closed bestätigt: `QR2B-000001`, `QR2B-000002` und unbekannte ID mit formal gültigen falschen Credentials jeweils HTTP 401; fehlende Device-Credentials HTTP 401; geschützte Merchant-API ohne Auth HTTP 401; unbekannte öffentliche Offer-ID HTTP 404. In den geprüften 101 Backend-Logzeilen nach Rollout keine HTTP-500, Credential-Header oder unredigierten Session-URLs.
- Merchant-Domain-Infrastruktur ist live, Händlerdaten und permanente Devices sind nicht produktiv aktiviert. Kein Production-Seed, kein Händler produktiv angelegt, keine Device-Credentials produktiv provisioniert und kein Flash; Marketing-Demo bleibt separat. Der Backend-Start bleibt `npm start`, ohne Seed-Aufruf. P0.3.3 muss Pepper-/Credential-Provisionierung, kontrollierte Händler-/Standortdaten, WLAN-Konfiguration und reale Merchant-TFT-Abnahme gesondert behandeln. Die Implementierung unterstützt derzeit EUR/USD/GBP/CHF/JPY/KWD/BHD und die im Parser festgelegten Größenlimits; kein vollständiger Merchant-Checkout.

## P0.3.3a – erster Demo-Merchant produktiv provisioniert

- Am 7. September 2026 kontrolliert angelegt: `merchant-demo-001`, Anzeigename `qr2buy Demo Händler`, ACTIVE; `location-demo-001`, `Hauptstandort`, `Europe/Vienna`, ACTIVE. Kontakt ist der ausdrücklich nicht zustellbare Demo-Platzhalter `demo@example.invalid` und muss vor realer Kommunikation ersetzt werden. Keine erfundenen Rechts- oder Adressdaten.
- `QR2B-000001` / `Schild 1`: `ESP32_ILI9341_CS5`, Hardware-UID `78:1c:3c:2c:82:50`, ACTIVE. `QR2B-000002` / `Schild 2`: `ESP32_ILI9341_NOCS`, Hardware-UID `ec:e3:34:b2:b5:f8`, ACTIVE. Je genau eine ACTIVE/PILOT-DeviceMerchantAssignment zum genannten Merchant/Hauptstandort; keine COM-Ports als Geschäftsidentität.
- Je ein neues, unabhängiges Credential aus 32 kryptografischen Zufallsbytes, Version 1, ACTIVE. Mongo enthält ausschließlich HMAC-Verifier; Übereinstimmung mit den lokalen Credentials und fehlender Klartext in allen Merchant-Dokumenten geprüft. `DEVICE_CREDENTIAL_PEPPER` ist im Backend als DigitalOcean-SECRET gesetzt. Klartextcredentials stehen ausschließlich in den beiden ignorierten lokalen Device-Headern; beide übernehmen die vorhandene lokale WLAN-Liste und verwenden `https://qr2buy.com`. Marketing-Credential unverändert und verschieden.
- Drei eigenständige MerchantProducts und Offers, ohne DemoSession-/Legacy-Referenzen:

| Product-ID | Offer-ID | Name | priceMinor / Währung | Bestand |
| --- | --- | --- | --- | --- |
| `product-demo-bag` | `offer-demo-bag` | Handgemachte Ledertasche | 12900 EUR | 3 |
| `product-demo-book` | `offer-demo-book` | Roman „Stadtlichter“ | 2490 EUR | 2 |
| `product-demo-print` | `offer-demo-print` | Gerahmter Kunstdruck | 39000 EUR | 1 |

- Alle Offers aktiv, `inventorySource=QR2BUY`, `purchasable=true`, `reservable=true`. Diese Felder beschreiben die Offer-Bedingungen; die öffentliche API liefert weiterhin ausdrücklich `checkoutAvailable=false`. Kein Merchant-Checkout implementiert oder aktiviert.
- Zwei DisplayAssignments vorbereitet: Schild 1 → Ledertasche, Schild 2 → Stadtlichter, beide **PENDING**, `verifiedAt=null`. Keine Vor-Ort-Verifikation erfunden. Beide echten Device-Credentials liefern produktiv HTTP 200 mit korrekter Device-ID und `assigned=false`. Der bestehende Vertrag liefert bei PENDING keine Merchant-/Location-/Produkt-/QR-Projektion; Merchant-/Location-Zuordnung separat direkt in Mongo bestätigt. Vertauschte Credentials in beiden Richtungen sowie zufällig falsche Secrets jeweils HTTP 401.
- Beide `lastSeenAt`-Werte wurden durch Operator-API-Prüfungen aktualisiert; unmittelbare Folgepolls ließen sowohl `lastSeenAt` als auch `updatedAt` unverändert. Firmwareversion-Aufnahme mit `p033a-api-probe` bestätigt. Dieser gespeicherte Wert und die Heartbeats stammen vom Operator-Prüflauf, **nicht** von geflashter Merchant-Hardware; kein realer Merchant-Geräte-Onlinestatus wird daraus abgeleitet.
- Drei unterschiedliche zufällige publicOfferIds geprüft: öffentliche API und `/o/:publicOfferId` HTTP 200, Produkt/Preis/Bestand und Merchant-/Standort-Anzeigenamen korrekt; keine internen IDs, Secrets, Verifier oder DemoSession-Token in der öffentlichen Projektion. Unbekannte Offer-ID HTTP 404, Merchant-API ohne Auth HTTP 401. QR-Ausgabe aus der Device-Config bleibt bis zur kontrollierten Aktivierung in P0.3.3b aus.
- Sicherer Ablauf: Ziel-DB vorab anhand einer frisch über die Live-API erzeugten DemoSession identifiziert; alle acht Merchant-Collections leer, Ziel-IDs konfliktfrei. Kein allgemeiner `seed:merchant-demo` ausgeführt. Ein erster Transaktionsversuch wurde vollständig zurückgerollt, weil Mongoose bei mehreren Dokumenten `ordered: true` verlangt; alle acht Collections danach erneut mit Bestand null bestätigt. Der korrigierte lokale Einmalaufruf legte anschließend genau 16 Dokumente in einer gemeinsamen Snapshot-/Majority-Transaktion an: 1 Merchant, 1 Location, 2 Devices, 2 Credentials, 2 MerchantAssignments, 3 Produkte, 3 Offers, 2 DisplayAssignments. Keine Löschungen, History-Überschreibungen oder Seed-Schreibzugriffe auf Marketing-/Legacy-Daten. Kein Anwendungscode geändert.
- Vor und nach Provisionierung vollständig grün: Backend 86/86 inklusive echter lokaler Mongo-Rotation, Syntax aller Backend-Quelldateien und fünf Router-Imports; Frontend 43/43, ESLint, Produktionsbuild; Firmware 23/23 einschließlich ausgeführtem MSVC-Parser. Beide Merchant-App-Environments SUCCESS mit den neuen lokalen WLAN-/Credential-Headern: CS5 48.140 Byte RAM / 995.901 Byte Flash; NOCS 48.140 / 995.321. Bekannte unkritische TOUCH_CS-Warnung bleibt.
- Live-Marketingregression nach Provisionierung: `/`, `/de`, `/en`, `/api/health`, `/demo/p/bag` HTTP 200; isolierte DemoSession HTTP 201, Scan/Reservierung und Reset, separater Stripe-Testcheckout HTTP 201 mit erfolgreichem Cancel und Reset. Keine Zahlung abgeschickt. Bestehendes DemoHardwareBinding ausschließlich gelesen; Hardware-/Mobile-Produktstatus konsistent. Beide Webhooks weisen ungültige Signaturen mit 400 ab. Keine erneute visuelle Browser-/TFT-Abnahme behauptet.
- Secret-/Datei-/TLS-Prüfung grün: lokale Credentials verschieden, gitignored, nicht in versionierbaren Dateien oder geprüften Live-Logs; keine Credential-Header, unredigierten Session-URLs oder HTTP-500 in den geprüften Rollout-Logs. Keine versionierbaren Temp-/Cache-/Builddateien oder TLS-Bypasses. Backend-Start weiterhin `npm start`, ohne Seed. DigitalOcean-Konfigurationsrollout `7bc1d1ed-51ca-4969-9e22-68b477338190` ACTIVE, Health 200; Anwendungscode unverändert bei `1ce506d`. Der folgende reine Dokumentationscommit hält diese Provisionierung fest.
- Nächster Schritt nach Review: **P0.3.3b**, kontrollierter Hardware-Switch beider Geräte und reale Vor-Ort-Verifikation vor Aktivierung der DisplayAssignments. Noch kein Merchant-Firmware-Flash, Dashboard, Self-Service-Onboarding oder Merchant-Checkout. Marketing-Demo bleibt getrennt.

## P0.3.3b – beide Merchant-Geräte real abgenommen

- Vorprüfung grün: Git sauber, `main == origin/main == bfddba6`, DigitalOcean ACTIVE, Health 200, beide produktiven Credentials und ACTIVE/PILOT-MerchantAssignments bestätigt, beide DisplayAssignments PENDING. Lokale Device-Header separat ignoriert, mit unterschiedlichen Credentials und der vorhandenen WLAN-Liste; keine Secret-Ausgabe.
- Erneut 23/23 Firmwaretests einschließlich kompiliertem/ausgeführtem C++-Parser sowie CS5- und NOCS-Merchant-Build SUCCESS. `git diff --check`, Credential-/Log- und TLS-Prüfung grün. Kein Anwendungscode geändert.
- Prototyp 1: MAC auf COM3 vor Flash als `78:1c:3c:2c:82:50` bestätigt. `esp32dev_spi_cs5_rst4_merchant_app --target upload --upload-port COM3` SUCCESS mit Hashverifikation. Anschließend ausschließlich COM3 seriell gelesen: fortlaufend erfolgreich geparste nicht zugeordnete Configs, stabiler UNBOUND-Renderzustand ohne wiederholtes Neuzeichnen. Der Erfolgslog liegt ausschließlich hinter HTTP 200; TLS-Zertifikatsprüfung bleibt aktiv. Mongo zeigt für `QR2B-000001` jetzt von der Hardware gemeldete `firmwareVersion=0.3.2` und frisches `lastSeenAt`, ohne Operator-Config-Abruf nach dem Flash.
- Prototyp 1 ist vom Nutzer ausdrücklich real abgenommen: unassigned-Zustand im Querformat, Branding korrekt, kein QR, keine Darstellungsfehler. Während der anschließenden Arbeit an Prototyp 2 wurde COM3 weder geöffnet noch geflasht oder zurückgesetzt.
- Prototyp 2: eigene lokale Credential-/Identitäts-/Origin-Konfiguration geprüft; erneut 23/23 Firmwaretests und NOCS-Build SUCCESS. MAC auf COM4 als `ec:e3:34:b2:b5:f8` bestätigt. Ausschließlich `esp32dev_spi_nocs_rst4_merchant_app --target upload --upload-port COM4` geflasht, SUCCESS einschließlich Hashverifikation. NOCS-Pins: MISO 19, MOSI 23, CLK 18, CS -1, DC 15, RST 4. Anschließend ausschließlich COM4 seriell gelesen: laufend erfolgreich geparste UNBOUND-Configs nach HTTP 200 mit aktiver TLS-Prüfung, ohne wiederholtes Neuzeichnen.
- Beide Geräte gleichzeitig real online bestätigt: ausschließlich lesende Mongo-Beobachtung über 70 Sekunden, ohne Operator-Device-API-Aufrufe während dieses Fensters. Beide individuellen Datensätze meldeten `firmwareVersion=0.3.2`, blieben unter 120 Sekunden Heartbeat-Alter und aktualisierten `lastSeenAt` jeweils genau einmal. Danach explizit beide eigenen Credentials HTTP 200 mit korrekter Device-ID und `assigned=false`; vertauschte Credentials jeweils HTTP 401. Beide DisplayAssignments weiterhin PENDING; keine Aktivierung.
- Marketing und Health nach Flash 2 HTTP 200; separate DemoHardware-API mit ursprünglichem Marketing-Credential HTTP 200, kein Binding verändert. DigitalOcean ACTIVE. Secretprüfung aller versionierbaren Dateien grün; kein funktionaler Code geändert.
- Reale Nacharbeit an Prototyp 2: Nutzer bestätigte korrekte Merchant-Anzeige, jedoch physisch um 180° verkehrt herum. Ausschließlich der NOCS-Setup-Header setzt deshalb `QR2BUY_DISPLAY_ROTATION=3`; die gemeinsame App verwendet diese Konfiguration mit unverändertem Default 1 für CS5. Compile-Time-Prüfung erlaubt nur Landscape 1/3. ILI9341-Treiber geprüft: beide ergeben 320×240, Rotation 3 dreht gegenüber 1 beide Achsen. Keine Duplikation der App, keine Änderung an Branding-, QR-, Layout- oder Status-Rendercode, Backend, Frontend, Credentials oder Assignments.
- Nach Rotationsänderung 23/23 Firmwaretests einschließlich Varianten-/Rotationsprüfungen und ausgeführtem C++-Parser grün; CS5 und NOCS Merchant-Builds SUCCESS. Größen unverändert: CS5 48.140 Byte RAM / 995.901 Byte Flash, NOCS 48.140 / 995.321. `git diff --check`, Secret- und TLS-Prüfung grün.
- Rotationsfix ausschließlich mit explizitem `--upload-port COM4` auf Prototyp 2 geflasht, SUCCESS samt Hashverifikation; MAC `ec:e3:34:b2:b5:f8` bestätigt. COM3 weder geöffnet noch geflasht oder zurückgesetzt. Nach Flash COM4-Serial mit stabilen erfolgreichen UNBOUND-Configs; beide Geräte direkt in Mongo weiterhin gleichzeitig online mit `firmwareVersion=0.3.2` und frischen individuellen Heartbeats, beide Assignments PENDING; Health HTTP 200.
- **Reale Abschlussabnahme:** Nutzer bestätigt Prototyp 2 nach Rotationsfix ausdrücklich als vollständig korrekt: jetzt richtig herum im Querformat, qr2buy-Branding, „Kein Produkt / zugewiesen“, kein QR und keine Artefakte. Prototyp 1 bleibt zuvor real abgenommen und unverändert. P0.3.3b damit abgeschlossen; Commit/Push des Rotationsfixes samt Dokumentation freigegeben. Nächster fachlicher Schritt bleibt die reale Produkt↔Schild-Verifikation; noch keine Assignment-Aktivierung und kein Merchant-Checkout.
- Marketing nach Flash 1 weiterhin separat: `/`, `/de`, `/en`, Health HTTP 200; neue unabhängige DemoSession mit vier READY-Produkten HTTP 201; DemoHardware-API mit ursprünglichem Marketing-Credential HTTP 200. Keine Binding-Änderung. Der vorher als `demo-device` arbeitende Prototyp 1 ist jetzt ein Merchant-Gerät und kein physischer Marketing-Renderer mehr.
- Spätere Vor-Ort-Aktivierung ist im bestehenden `createMerchantDomainService().verifyDisplayAssignment({ assignmentId, merchantId, verificationMethod, boundBy })` vorbereitet. Benötigt werden die PENDING-Assignment-ID, bestätigter Merchant-Scope, ein real durchgeführter `DEVICE_QR_AND_EAN`- oder `DEVICE_QR_AND_PRODUCT_CODE`-Nachweis und ein nachvollziehbarer Operator. Der Service prüft Scope/aktuelle MerchantAssignment transaktional, ersetzt gegebenenfalls bisherige ACTIVE-Zuordnungen historienerhaltend und setzt `verifiedAt`/ACTIVE. Er validiert selbst keine eingescannten Belege; ein kontrollierter einmaliger Operator-Flow muss deshalb zuerst physisches Gerät und tatsächlich danebenliegendes Produkt anhand Geräte-ID und eindeutigem Produktcode abgleichen und den Nachweis festhalten. Für die Pilotprodukte sind noch keine EANs/SKUs provisioniert. Keine Aktivierung in diesem Schritt; ein vorhandener Service ersetzt keine reale Vor-Ort-Prüfung.

## P0.3.4 – Vor-Ort-Binding lokal implementiert, noch nicht live aktiviert

- Vor dem freigegebenen Veröffentlichungscommit erneut vollständig bestätigt: Backend 105/105 samt Syntax und sechs Router-Imports; Frontend 48/48, ESLint, Produktionsbuild und 11/11 Browserprüfungen; Firmware 24/24 und beide Merchant-Builds SUCCESS. Beide PNGs und gerenderten SVGs erneut exakt rückdekodiert; Klartext-IDs vorhanden. Secret-/Ignore-/Temp-Dateiprüfung und `git diff --check` grün. Die folgende reale Abnahme ist ausschließlich für Schild 1/Ledertasche freigegeben; Schild 2 bleibt unverändert PENDING. Dieser Vor-Commit-Stand behauptet noch keinen produktiven Rollout oder eine reale Aktivierung.

- Dauerhafte öffentliche Geräte-URLs verbindlich: `https://qr2buy.com/device/QR2B-000001` und `https://qr2buy.com/device/QR2B-000002`. SVG-Aufkleber mit Klartext-ID und PNGs unter `docs/exports/device-qrs/`: SVG 50×55 mm, PNG 900×900 Pixel, vier Module Quiet Zone, Schwarz/Weiß, keine Logos im QR. Beide PNGs und beide tatsächlich im Browser gerenderten SVGs mit OpenCV exakt auf ihre jeweilige URL rückdekodiert. Keine MAC, Mongo-ID, Session-Token oder Credentials im QR.
- Öffentliche Backend-Einstiegsroute `/device/:deviceId`: bekannte aktive Geräte HTTP 303 auf `/binding/:deviceId`, unbekannte Geräte echte HTTP 404, inaktive Geräte verständliche HTTP-409-Seite. Öffentliche Identifikations-API liefert nur `deviceId` und Verfügbarkeit. Für den späteren DigitalOcean-Rollout muss `/device` zusätzlich mit erhaltenem Pfad auf das Backend zeigen; `/binding` gehört zum Frontend. Lokaler Vite-Proxy vorbereitet, keine Hosting-Konfiguration verändert.
- Minimaler DE/EN-Operator-Flow: vorhandene interne ADMIN-Auth plus festes `BINDING_OPERATOR_MERCHANT_ID` aus Server-ENV. Kein Merchant-Scope aus URL/Body akzeptiert. Fehlender Scope/Auth fail-closed. Zugangsdaten nur im Arbeitsspeicher der Seite, weder URL noch Browser-Speicher; keine neuen öffentlichen Managementfunktionen. Dies ist ein interner Operator-Pilot, kein Händlerkonto-System; globale Admin-Credentials dürfen nicht an Händler verteilt werden.
- Identifikation per optionaler EAN oder dauerhaftem zufälligem `MerchantProduct.productBindingId` mit eindeutigem Index. Auflösung ausschließlich innerhalb Merchant und aktivem Standort; genau ein Produkt und ein aktives Offer erforderlich. UI erlaubt Kamera-Scan über BarcodeDetector, alternativ Eingabe und bei Produktcodes Produktauswahl. Kamerafunktion hängt vom Smartphone-Browser ab. Bestehende Produktcodes werden nicht geändert; separater doppelt abgesicherter, idempotenter Migrationsbefehl `src/scripts/prepareProductBindingIds.js` für fehlende Codes ist nur gegen Test-Mongo geprüft, produktiv nicht ausgeführt.
- `BindingPreview` ist eine separate, auf einen Datensatz pro Gerät begrenzte Collection. Passende bestehende PENDING-Assignments werden wiederverwendet. Start erzeugt eine maximal 120 Sekunden gültige Vorschau, ohne ACTIVE zu verändern. Vorschau enthält Produkt/Preis und einen aus zufälliger Nonce, Geräte-/Preview-ID und ENV-Pepper abgeleiteten sechsstelligen Code. Dieser Code wird ausschließlich über die korrekt authentifizierte Device-Config ausgegeben, niemals in der Operator-Vorschauantwort. Die öffentliche Geräte-ID allein berechtigt zu keiner Bindung.
- Smartphone bestätigt Produkt, Preis und Schildname und verlangt den direkt vom TFT abgelesenen Code. Maximal fünf falsche Eingaben pro Preview plus HTTP-Rate-Limit. Bestätigung prüft TTL, Merchant-/Location-/Ownership-Historie, Gerätefrische, Firmwarefähigkeit und unveränderte Produkt-/Offer-Daten erneut. Gerätebezogene Transaktionssperre serialisiert parallele Starts/Bestätigungen und Merchant-Wechsel. PENDING → ACTIVE und bisheriges ACTIVE → REPLACED erfolgen gemeinsam; doppelte Bestätigung ist idempotent, alte/abgelaufene/abgebrochene Challenges können nicht aktivieren. Die vorhandene partielle Unique-Constraint verhindert zwei ACTIVE-Assignments.
- Abbruch lässt die bisherige Zuordnung unverändert und entfernt die Vorschau mit dem nächsten Poll; ohne bestehendes ACTIVE bleibt `assigned=false`. Ablauf wird sowohl im Backend als auch auf dem TFT durch absolute Ablaufzeit geprüft, auch bei WLAN-Ausfall. Danach darf bis zur nächsten gültigen Config ein unassigned-Screen erscheinen. Aktuelles SOLD/Nullbestand hat Vorrang vor Preview und sperrt Aktivierung; echte Merchant-Checkout-/Reservierungszustände sind weiterhin nicht implementiert und benötigen später entsprechende Prioritätsregeln.
- Gemeinsame Firmware 0.3.4 projiziert/prüft Binding-Preview getrennt vom normalen `assigned`-Vertrag. TFT: `ZUORDNUNG PRUEFEN`, Produktname, Preis, Bestätigungscode, kein Käufer-QR. Aktive Zuordnung liefert danach normalen READY/SOLD-Zustand mit separatem `/o/:publicOfferId`-Buyer-QR; keine DemoSession. Rotation CS5 1/NOCS 3 bleibt erhalten. Alte Firmware 0.3.2 wird für Preview-Starts ausdrücklich abgewiesen; kein Flash vorgenommen.
- Final lokal grün: Backend **105/105**, inklusive echter isolierter Mongo-Transaktionen, HTTP-Auth/404/Scope, EAN/Produktcode, TTL, Replay, fünf Fehlversuche, paralleler idempotenter Bestätigung, historienerhaltendem Replace, Ownership-Wechsel, Offeränderung, Geräteisolation, separaten Buyer-QRs und Produktcode-Migration. Bestehende DemoSession-/Stripe-/DemoHardwareBinding-/Merchant-Regressionen enthalten. Backend-Syntax und sechs Router-Import-Smokes grün; echter Logger-Test umfasst Binding-Body/Query/Auth-Redaction. Testdaten ausschließlich in eigenen Loopback-Replica-Sets, im finally entfernt; kein Laden der produktiven .env in Tests.
- Frontend **48/48**, ESLint und Produktionsbuild grün; zusätzlich **11/11** isolierte Headless-Edge-Browserprüfungen mit Test-API-Antworten: DE/EN bei 320/375/390/430 Pixeln, Login, Produktauswahl, EAN, Preview, Abbruch, Aktivierung, TTL, unbekannte/inaktive Geräte und SVG-Rasterisierung. 320-Pixel-Vorschau visuell geprüft. Der eingebundene Browser war nicht verfügbar; reproduzierbare lokale Browsertests verwenden exakt gepinntes `@playwright/test@1.55.1`, eigenen Browserprozess und ausschließlich Testdaten. Kein Zugriff auf Nutzer-Browserprofile.
- Firmware **24/24**, einschließlich tatsächlich kompiliertem/ausgeführtem C++-Parser mit Preview-/QR-/Geräteisolation und bestehenden Statusscreens; CS5-/NOCS-Merchant-Builds SUCCESS. Der erste Preview-Build erforderte bei zwei Renderaufrufen die explizite String-zu-C-String-Konvertierung; behoben und erneut geprüft. Keine TLS-Abschwächung oder Secret-/Code-Ausgabe in Firmwarelogs. Bekannte TOUCH_CS-Warnung bleibt.
- Secret-/Ignore-/Dateiprüfung und `git diff --check` grün; keine Device-Credentials in versionierbaren Dateien, keine versionierbaren Build-/Cache-Dateien. Ein bereits im Ausgangs-Lockfile vorhandener moderater npm-Auditbefund betrifft ausschließlich die unveränderte transitive Entwicklungsabhängigkeit `@humanfs/node@0.16.7` (rekursives Kopieren via Symlinks); nicht Teil des Binding-Laufzeitcodes. Kein pauschales Dependency-Update durchgeführt.
- Live-Abnahmeplan: `docs/QR2BUY_P034_LIVE_PLAN.md`. Nach gesonderter Freigabe zuerst Deployment/Ingress/Operator-Scope, kontrollierte Code-Migration und Firmware-Flash; dann physische Aufkleber anbringen, Schild 1/Ledertasche und danach Schild 2/Stadtlichter jeweils über Vorschau und realen Display-Code aktivieren. Der Code beweist Zugang zum Display; die korrekte physische Produktplatzierung bleibt die bewusste Vor-Ort-Bestätigung des Operators. Kein großes Dashboard, Onboarding, Analytics oder Merchant-Checkout gebaut. **STOP vor Veröffentlichung und produktiver Aktivierung.**

## Offene Punkte

1. Den produktiven P0.2-Teil-2-Mobile- und Checkout-Fehlerstand auf 320/375/390/430 Pixeln visuell manuell abnehmen und anschließend einen interaktiven Stripe-Sandbox-Testkauf bis zum webhookbestätigten `PAID`-Screen prüfen.
2. Der neue PAID-Erfolgsbildschirm auf Prototyp 1 ist real akzeptiert. Offen bleiben die separate CANCELLED-Abnahme, verbleibende Detaildarstellungen und ein vollständiger physischer End-to-End-Regressionslauf.
3. Die bereits bestätigte Web-Journey bei der physischen TFT-Nacharbeit noch einmal zusammenhängend mit den realen Hardwareansichten für `RESERVED`, `PAID`, Reset und dem dauerhaften `SOLD`-Verhalten der Tanne abnehmen; ausschließlich Stripe-Sandbox verwenden.
4. Gehäuse, Stromversorgung, Kabelentlastung und weitere mechanische Prototypenarbeit für einen Pilotstand planen.
5. Backlight-Steuerung nur nach dokumentierter Verdrahtung an einen geeigneten GPIO ergänzen; aktuell keine Fake-PWM-Lösung.
6. `GTS Root R4` beziehungsweise die reale Zertifikatskette bei künftigen Hosting-/Zertifikatsänderungen vor einem Firmware-Rollout prüfen.
7. Optionale SMTP-Zustellung nur mit vollständiger TLS-Konfiguration und echtem Zustelltest aktivieren.
8. Legacy-Admin-/Device-Pfade mit Basic Auth, optionaler Klartext-Geräteauthentifizierung, SSE/WS und Auto-Provisioning bleiben getrennte MVP-Schulden; die sichere Demo-Hardwarekopplung verwendet sie nicht.
9. Wildcard-DNS und eine möglicherweise noch vorhandene ältere separate Frontend-App bei Gelegenheit aufräumen, ohne Mail-DNS zu verändern.

## Historische Meilensteine

- `367f548`: erster Online-Config-Firmwarepfad
- `a3b8c64`: session-isolierte Live-Demo
- `51f361b`: gehärtete öffentliche Checkout-Origin
- `8de5efa`: Hardware-Synchronisierung Stufe 1–3
- `a7bca06`: Logger-Redaction und GTS-Root-R4-Fix
- `072a9f5`: dokumentierte Secret-Rotation; Ausgangs-HEAD vor dem finalen Displayabschluss
