# Prototyp 3 – Merchant-Vorbereitung, 15. Oktober 2026

## CURRENT - Phase 2 STOP: Frontendversuch vor Deploy abgebrochen (15. Oktober 2026)

Phase-2-Versuch **acb78784-25bf-418f-80d3-0799a477043d**, angelegt 12:47:20 UTC, nach unerwarteter Deploy-Planung aktiv abgebrochen, Status **CANCELED**. Deploy-Schritt einschliesslich Backend-Deploy/Wait blieb PENDING, wurde nicht gestartet. **Kein Frontendrelease und kein Backend-Redeploy abgeschlossen.** Weiterhin aktives Deployment **c67fad83-5e90-45c6-a1ae-be0e58955e77**, Backend **c9aefac5abba6487ed07c5d47d77ee95335ec8a2**, Frontend **502d5391d61b306f34c242d2b372c173dfc7bb2d**. Kein weiterer Veroeffentlichungsversuch und kein Rollback notwendig.

Wichtige neue Plattformbeobachtung: update_all_source_versions:false und bytegleich unveraenderte Backend-Spec bewahren den Backend-Quellstand, schliessen bei dieser App aber einen erneuten Backend-Deploy-Schritt nicht aus. Im vorbereiteten Plan der Frontend-Spec-Aenderung wurde qr2buy-backend erneut als Deploy-Komponente aufgefuehrt. Deshalb STOP gemaess ausdruecklichem Verbot jedes Backend-Deployments und Abbruch bereits waehrend BUILDING. Die fruehere Einschaetzung einer vollstaendigen Komponentenisolation ist damit widerlegt; Quell-/Konfigurationsisolation allein reicht nicht. Nach spaeteren neuen Erkenntnissen nicht blind erneut denselben App-Update ausfuehren.

Vorher exakte aktuelle App-/Frontend-Spec und Phase-1-Deployment unter firmware/qr_display_fw/.pio/p3-validation/p01-frontend-deploy-20261015/app-before.dpapi gesichert (ignoriert, DPAPI CurrentUser, restriktive Benutzer/SYSTEM/Administratoren-ACL, Roundtrip geprueft). Einmaliger PUT, ausschliesslich Frontend-github.branch auf wip/p3-merchant-integration und deploy_on_push:false; Backend-Spec bytegleich. **Konfigurierter Sollstand jetzt beide Quellen wip/p3-merchant-integration, Auto-Deploy bei beiden deaktiviert; aktiver Frontend-Iststand weiterhin main-Code 502d539.** Diese Soll-/Istabweichung besteht bewusst nach Abbruch fort. Kein blindes Zurueckschreiben der gesicherten Spec, weil auch das einen unerlaubten Backend-Redeploy ausloesen koennte. main/Git-Remote unveraendert; niemals main als Ausloeser pushen.

Der abgebrochene Plan verwendete fuer Frontend c9aefac aus dem bereits vorhandenen gemeinsamen Branch-Quellstand statt neuem Dokumentations-HEAD 98afe5d; Frontendquellen zwischen 1c7a691/c9aefac/98afe5d bytegleich. Es wurde kein ungepruefter Frontendcode verwendet. Sicherheitspruefung gegen echte lokale Credentialliterale in versionierten Dateien und gebautem JS/CSS unauffaellig; keine Credentialheader oder Buildartefakte versioniert. Lint und frischer Produktionsbuild PASS, erwartetes neues JS index-Dm5e4-UI.js, CSS index-CA8cwU5g.css. Neue Assets NICHT produktiv aktiv. Zehn isolierte Claim-/Browser-Recoverytests PASS; diese sind lokale Negativtests und keine Liveabnahme des neuen Portals.

Nach Abbruch: Health HTTP 200/production, Backend-Runtimehashes und komplette Backend-Spec unveraendert, Unique-Indizes 3/3 PASS. Frontend HTML-Hash und Assetverweise exakt vorhergleich (aktives altes JS index-BsbPPmiU.js, CSS index-CA8cwU5g.css). Vorhandene authentifizierte Browser-Portaluebersicht ecily.com vor Eingriff gelesen, funktionsfaehig; kein Login umgangen oder neue Session aus DB uebernommen. Neuer Erstzuordnungsflow/DE-EN-/Responsive-/Fehlerzustands-Liveabnahme BLOCKED, da Release nicht aktiv. Kein produktiver Claimstart/Confirm, keine Haendler-/Produktbindung oder Stripe-Transaktion.

Bestandsschutz: Device 1/2 ACTIVE, READY, Firmware 0.3.11, Credential v1 ACTIVE, Bindings unveraendert; Preise/Bestaende 20.00 EUR/8 und 19.90 EUR/12. Device 3 PROVISIONED/0.3.11/v1 ACTIVE, keine Merchant-/DisplayAssignment oder Preview. Alle drei normale echte Heartbeats. Alle Geschaefts-/Credential-/Binding-Collections unveraendert, managed_devices nur regulaere Heartbeat-Zeitstempel ausgenommen. Einzig merchant_sessions-Hash abweichend; lesender Mongo-Change-Stream seit Preflight beweist ausschliesslich Updates des Felds expires durch normale authentifizierte Portal-Lesezugriffe, keine Sessioninhalts-/CSRF-/Credentialaenderung. Kontrollaudit null mutierende Mongo-Befehle. Kein Firmware-Flash oder bestehende Geraete geoeffnet.

**NO-GO fuer Firmware-0.3.12-Flash und Fortsetzung von Phase 2 unter der Grenze kein Backend-Deployment.** Naechster separater Auftrag muss einen nachweislich komponentenisolierten Static-Frontend-Pfad pruefen oder einen kontrollierten Redeploy des unveraenderten gesunden Backends ausdruecklich mitfreigeben. Keine Architektur-/Deploymentaenderung dafuer in diesem Auftrag. Backend-Rollbackbranch 3d9cb86 bleibt remote bereit; kein DB-/Credential-/Firmware-Rollback. Dokumentationscommit ausschliesslich auf Arbeitsbranch synchronisieren, beide Auto-Deploys vorher/nachher als deaktiviert verifizieren.

## CURRENT - Phase 1 Backend produktiv ACTIVE (15. Oktober 2026)

Ausdruecklich freigegebenes ausschliessliches Backend-Deployment erfolgreich: **c67fad83-5e90-45c6-a1ae-be0e58955e77**, angelegt 12:37:50 UTC, ACTIVE vor erster Nachpruefung 12:39:55 UTC. Backend **c9aefac5abba6487ed07c5d47d77ee95335ec8a2**, funktional gepruefter Stand 1c7a691. Frontend unveraendert **502d5391d61b306f34c242d2b372c173dfc7bb2d**. Kein main-Push/Merge, Frontend-Release, Flash, Claim oder Binding vorgenommen. Phase 2 NICHT ausgefuehrt oder freigegeben.

Vor Eingriff: exakte App-Spec und aktives Deployment 6e265a0c-e589-4321-a0e7-b14547115064 im ignorierten lokalen Auditverzeichnis firmware/qr_display_fw/.pio/p3-validation/p01-backend-deploy-20261015 gesichert (app-before.dpapi, Windows-DPAPI CurrentUser, restriktive ACL aktueller Benutzer/SYSTEM/Administratoren, Entschluesselungs-Roundtrip geprueft). Keine Klartext-App-Spec oder Secrets in Git/Logs. Rollback remote 3d9cb86 und main 502d539 unmittelbar verifiziert. PUT auf bestehende App mit update_all_source_versions:false; ausschliesslich qr2buy-backend.github.branch auf wip/p3-merchant-integration und dessen deploy_on_push auf false gesetzt. Frontend-Spec bytegleich, weiterhin main/Auto-Deploy true. Deploy-Fortschritt enthielt nur Backend als Deploymentkomponente, Frontendquellcommit blieb alt. Frontend-HTTP-HTML-Hash und Assetverweise vor/nachher exakt gleich. Kein zweiter Deploymentaufruf.

Live-Nachpruefung 12:40:44 UTC: /api/health HTTP 200/ok/production, native Mongo-Lesepruefung und alle drei Unique-Indizes PASS. Bekannte Runtime-Dateien inklusive Claim-/Auth-/Bindingservice hashgleich zum Releasecommit. Pepper/Sessionsecret/Origin sicher verfuegbar, Werte nicht ausgegeben. Fehlende Devicecredentials und fehlende Portalsession sowie Claimstart/-confirm ohne Session erwartungsgemaess HTTP 401. Keine authentifizierte Claim-/Kauf-/Reservierungsprobe; device_claims und device_claim_attempts weiterhin leer. Beide public-offer APIs HTTP 200 und mit nativen Projektionen konsistent. Runtime-Logfenster: 51 erfolgreiche Device-Config-HTTP-200-Antworten, eine erwartete HTTP-401-Antwort der eigenen Negativprobe, keine HTTP-5xx oder Error-Level-Eintraege. Keine kuenstlichen authentifizierten Device-Polls zur Erzeugung von Heartbeats.

Alle drei realen Geraete nach Aktivierung mit frischen Heartbeats (P1 12:40:38, P2 12:40:28, P3 12:40:37 UTC), Firmware jeweils 0.3.11, Credential jeweils v1 ACTIVE. Device 1: Testprodukt qr2buy, 20.00 EUR, Bestand 8, READY. Device 2: Der Herr der Ringe, **19.90 EUR, Bestand 12**, READY. Diese Istwerte waren bereits unmittelbar vor Deployment vorhanden und wurden unveraendert bestaetigt; abweichende aeltere Produkt-/Preis-/Bestandsangaben sind historische Checkpoints. Beide mit genau einer aktiven Merchant-/verifizierten Displayzuordnung. Device 3 PROVISIONED, MAC f4:2d:c9:6b:c2:90, ohne Merchant-/DisplayAssignment oder Preview, neutral. Technische API-/Datenprojektion bestaetigt; keine neue physische Displayabnahme behauptet.

Vorher-/Nachhervergleich ueber alle 22 bestehenden Collections: Dokumentzahlen und Hashes identisch; bei managed_devices nur regulaere lastSeenAt/updatedAt-Heartbeatfelder ausgenommen. Identitaeten, Credentialverifier, Bindings, Offers, Produkte/Bestaende, Reservierungen und Bestellungen unveraendert. Kein Stripe-Aufruf oder manuelle DB-Mutation. Kontrollaudit ueberwacht: null mutierende Mongo-Befehle. API-Negativchecks legten keine Claim-/Sessiondokumente an, anschliessender Bestand erneut identisch.

Rollback **rollback/p01-firmware-0312 / 3d9cb86** remote verfuegbar; kompatibel 0.3.11/0.3.12 und Loggingfix, bisheriger reproduzierbarer Patch/Manifest unveraendert. Bei belegter Backendbeeintraechtigung nur Backendquelle kontrolliert auf diesen Branch setzen, update_all_source_versions:false und Frontendquellstand erhalten; keine Rueckkehr zum unkompatiblen nackten 502d539 fuer spaetere 0.3.12-Geraete. Kein Rollback erforderlich/ausgefuehrt. Kein DB-/Credential-/Firmware-Rollback.

**Technisches GO fuer separat freizugebende Phase 2 (Frontend)**. Backend-Auto-Deploy ist jetzt deaktiviert, sodass reine Dokumentationssynchronisierung auf wip keinen neuen Backendrollout ausloest. Frontend bleibt bis eigener Freigabe auf main/502d539; main-Auto-Deploy weiterhin beachten. Zukuenftig nur Frontendquelle kontrolliert aktualisieren, Backend auf aktivem c9aefac halten, Remote-HEAD/Codegleichheit und Quellhashes vorher erneut pruefen. Physischer 0.3.12-Flash/Setup-/Erstzuordnungsablauf sowie globale Wiederverwendbarkeit bleiben separate Aufgaben. Dieser nachfolgende Dokumentationscommit wird ausschliesslich auf dem Arbeitsbranch synchronisiert; keine weitere Veroeffentlichung von Runtime-Code.

## CURRENT - Release und Rollback remote bereitgestellt (15. Oktober 2026)

Nutzerfreigabe ausschliesslich fuer gleichnamige Branch-Pushes umgesetzt: Releasecode 1c7a6918b4ff60b053925c32b3a880f4b878a020 auf origin/wip/p3-merchant-integration und Rollback 3d9cb86be9e9e57c58f5a62d6a2b14e9b71afb4a auf origin/rollback/p01-firmware-0312. Atomarer Push mit expliziten RefSpecs, keine Tags, kein Force-Push. Beide Hashes per git ls-remote bestaetigt; Rollbackbranch zusaetzlich erfolgreich von origin gefetcht. Secret-/Buildartefaktpruefung beider Branchhistorien unauffaellig. Dieser nachfolgende reine Dokumentationscommit wird ebenfalls auf den Releasebranch synchronisiert; Code-/Teststand bleibt 1c7a691.

main lokal/remote unveraendert 502d5391d61b306f34c242d2b372c173dfc7bb2d. DigitalOcean-App 98a0580a-65ee-4e45-b929-3617463966d2: Backend und Frontend ausschliesslich main mit Auto-Deploy aktiviert. Keine GitHub-Workflows in den beiden veroeffentlichten Git-Baeumen, kein aktiver pre-push-Hook. Vorher/nachher dasselbe aktive Deployment 6e265a0c-e589-4321-a0e7-b14547115064 vom 07.10.2026, beide Komponenten 502d539, kein Pending oder neuer Deploymentdatensatz. Keine App-Spec-/Konfigurationsaenderung, kein Deployment, Flash, Assignment oder produktiver Datenzugriff.

Kleinster spaeterer kontrollierter Rollout (separate Konfigurations-/Deploymentfreigabe erforderlich): gepruefte App-Spec vorbereiten, automatische main-Deployments beider Komponenten kontrolliert deaktivieren und Komponentenquellen getrennt fuehren; jede Spec-Aenderung als potenziell deploymentausloesend behandeln. Zuerst ausschliesslich Backend auf den exakt geprueften Releasebranch/Commit bringen, Frontend nachweislich auf 502d539 halten; Ist-Quellhashes und Device-0.3.11-Polling/Heartbeats/Bindings pruefen. Erst danach Frontend auf denselben geprueften Releasecode bringen. Kein Merge/main-Push als Ausloeser fuer gleichzeitiges Update. Firmware bleibt bis separater Flashfreigabe 0.3.11; niemals 0.3.12 vor kompatiblem Backend. Vor jeder Ausfuehrung Remote-HEADs erneut mit freigegebenen Hashes vergleichen. Rueckzug: Frontend/Claim-UI zuerst auf alten Stand, offene Requests/TTL klaeren, Backend auf bereitstehenden Rollbackbranch 3d9cb86; keine DB-/Credential-/Bindingruecksetzung.

Der zuletzt festgestellte Blocker fehlender Remote-Rollbackverfuegbarkeit ist behoben. Technisches GO fuer die separate Freigabe eines kontrollierten Backend-dann-Frontend-Rollouts; keine pauschale main-Auto-Deploymentfreigabe. Letzte vollstaendige Releasepruefung: Backend 285/285, Frontend 65/65, Browser 91/91, Firmware 32/32, drei Merchant-Builds sowie Lint/Produktionsbuild PASS; hier nur Dokumentationsnachtrag, keine erneute Codeaenderung. Physische 0.3.12-/Erstzuordnungsabnahme und globale Transfer-/Release-/Commerce-Themen bleiben separate Grenzen. Neuester Checkpoint ersetzt aeltere Aussagen zur nur lokalen Verfuegbarkeit.

## CURRENT - Rollback mit Loggingfix verifiziert (15. Oktober 2026)

Aktueller lokaler Rollbackbranch rollback/p01-firmware-0312: **3d9cb86be9e9e57c58f5a62d6a2b14e9b71afb4a**. Ersetzt fuer jeden kuenftigen Rueckzug das historische Ziel 6d13148; unveraendertes 502d539 bleibt ungeeignet fuer 0.3.12. Basis weiterhin 502d5391d61b306f34c242d2b372c173dfc7bb2d. Arbeitsbranch wip/p3-merchant-integration, Ausgangsstand c5519b3. Nur lokale Aenderungen und isolierte Tests; keine produktiven Zugriffe/Datenaenderungen, kein Push/Merge/Deployment/Flash.

- Uebernommen aus 8054116: zentrale sichere URL-Redaktion, keine Querystrings/dynamischen Werte in Logs, sichere HTTP-/Checkout-Fehlerlogs, synthetische Loggingregression. Keine Claim-/Setupfunktion im Rollback. Gegen 6d13148 ausschliesslich index.js, routes/checkout.js und zwei Testdateien geaendert; Auth, Credentialmodell, Bindings und 0.3.11/0.3.12-Freigaben unveraendert.
- Isoliertes Mongo mit exakt den drei produktiven Claim-Unique-Indizes: alte Geraeteoperationen sowie 0.3.11/0.3.12-Polling funktionieren; synthetische bestehende Claim-Audits, Haendlersperrzaehler und Indexdefinitionen bleiben unveraendert. Keine produktiven Testdokumente oder DDL.
- Reproduzierbarer kompletter Git-Baum: 3a5852e141b3146f76c96cefc8acae2ac5f9caf6. Patch-SHA256: 04950cff2621c769475c4509098346939a76c4604a8eeb5990d71035367b7961. Patch/Manifest unter backend/rollback/p01-firmware-0312.* aktualisiert, kanonisches LF. Manifest enthaelt zusaetzlich SHA256 fuer alle sechs gegen Basis geaenderten Dateien. Test rekonstruiert exakten Baum mit separatem Git-Index, prueft Dateiumfang/Hashes, bytegleiche Loggingquellen und unveraenderte Auth-/Repository-/Modellquellen gegen Basis. Keine Dependency-/Lockfileaenderung.
- Kompatibilitaetsmatrix: CS5/NOCS, Firmware 0.3.11/0.3.12, READY/RESERVED/OUT_OF_STOCK/SOLD/PAUSED/CHECKOUT_STARTED/PAID, Notify an/aus, Authfehler und neutral PROVISIONED ohne Produkt. Echte Rollback-Servicequelle gegen aktuellen Service geprueft; 0.3.12-neutral faellt bei Rueckzug bewusst auf assigned=false statt Setup zurueck.
- Tests: vollstaendige Backendtestsuite direkt auf Rollbackbranch PASS (Exit 0); Mongo-Indexerhaltung 7/7; gezielte Logging-/Device-/Mongo-/Rollbacktests auf Arbeitsbranch 29/29 PASS. Vollstaendige Backendregression des Arbeitsbranches ebenfalls PASS (npm test -- --test-reporter=dot, Exit 0). Keine Skips im gezielten Lauf.

Die drei produktiven Claim-Unique-Indizes sind laut bestaetigtem Indexanlagecheckpoint c5519b3 vorhanden; kein erneuter Livezugriff in diesem Auftrag. Indizes/Audits/Credentials/Assignments bleiben beim Rollback erhalten, keine Datenbankruecksetzung. Rueckzugsreihenfolge: Claim-UI zuerst zuruecknehmen, laufende/unklare Requests kontrolliert auswerten und gegebenenfalls Challenge-TTL abwarten, dann Backend auf obigen neuen Rollbackcommit. Kein automatischer Firmware-Downgrade oder Credentialwechsel.

**GO nur fuer abschliessendes Deployment-Review**, keine Deployment-/Flash-/Erstzuordnungsfreigabe. Neue 0.3.12-Screens und physischer Claimablauf bleiben offen; globale Transfer-/Release-/Commerce-Isolation ist weiterhin gesonderter Scope. Aeltere Zeitpunkte und Commitangaben unten sind Historie; dieser Checkpoint ist fuer das Rollbackziel verbindlich.

Operative Source of Truth: [QR2BUY_CONTEXT.md](QR2BUY_CONTEXT.md). **Produktiv registriert, Merchant-Firmware 0.3.11 geflasht, neutraler UNBOUND-Zustand technisch und vom Nutzer physisch abgenommen. Noch keine Händler-/Produktbindung.**

## P0.1 Reviewfix – lokal umgesetzt, weiterhin keine produktive P3-Zuordnung

Ausgangscommit `472a11a`, Branch `wip/p3-merchant-integration`. Alle vier Reviewbefunde lokal bearbeitet; maßgeblich ist der aktualisierte [Erstzuordnungsvertrag](QR2BUY_DEVICE_FIRST_ASSIGNMENT.md), nicht der erste Entwurf darunter.

- Start nur mit 128-Bit-Setupcode direkt vom TFT, maximal 120 Sekunden gültig. Geräte-ID und fremdes Händlerkonto allein können keine Challenge mehr anlegen. Separater Händler-/Standortvergleich mit sechsstelliger Bestätigung bleibt erforderlich. Fehlversuche je Gerät/Händler; B sperrt A nicht mehr. Drei Angriffszyklen und Legacy-/Replayfälle getestet.
- Browser nach Ablehnung wieder editierbar; unklare Antwort/20-Sekunden-Timeout behält denselben requestKey. Ergebnisprüfung, verlorene Bestätigung, Ablauf und Neustart ohne Reload getestet. Keine Bestätigung simuliert.
- Zielnamen server-/firmwareseitig exakt auf ASCII plus ÄÖÜäöü und 64 UTF-8-Byte begrenzt, keine Ersetzung; Sonderzeichen-/Grenztests vorhanden. Neue 0.3.12-Setupanzeige mit ID und 32 Zeichen in zwei Zeilen; noch nicht physisch abgenommen.
- Konkreter lokaler Rollbackbranch `rollback/p01-firmware-0312` / `6d13148e08b3c63c3e4668b559c9f466eaa4cce8`, kein Claim, aber 0.3.11/0.3.12-kompatible normale Backendverträge. Exakte Rekonstruktion aus geprüftem Patch/Manifest sowie Zustände/Notify/Auth automatisiert getestet. Kein Rückfall auf unverändertes 502d539 empfohlen.
- Drei explizite Unique-Indizes verpflichtend; rein lesender Prüf-CLI vorbereitet und gegen Loopback ausgeführt. Fehlende Indizes blockieren Deployment und Claimservice. Keine produktive Indexprüfung/-anlage erfolgt; neue Modelle legen sie nicht automatisch an.
- Finale Regression: Backend **284/284**, Frontend **65/65**, Browser/E2E **91/91**, Firmware/C++-Host **32/32**; alle drei Merchant-Builds SUCCESS, Frontend-Lint/Produktionsbuild und gezielte Claim-/Rollback-Nachtests PASS, keine Skips. Header aller drei Geräte hashgleich. Kein Gerät geöffnet/geflasht, keine produktive Mutation oder Credentials/Bindings geändert. Produktiv laut letztem Checkpoint weiterhin P3 PROVISIONED/ungebunden, v1 ACTIVE, 0.3.11 und neutral physisch abgenommen.

**GO nur für erneutes finales Review.** Keine Deployment-, Flash- oder Erstzuordnungsfreigabe. Später erst freigegebene ENV-/Indexprüfung/Rollout, danach ausdrücklich autorisierter P3-Flash mit aktuellem MAC-/Port-/Buildnachweis und realer neuer Setup-/Claim-/TTL-Abnahme. Ältere 0.3.12-Binaries aus 472a11a nicht verwenden. P1/P2 unverändert; keine Produktbindung/Transferumsetzung.

## Historie: erster P0.1-Entwurf vor Reviewfix – keine produktive P3-Zuordnung

15. Oktober 2026, Branch `wip/p3-merchant-integration`, Ausgangscommit `8cf1455`. Dieser Abschnitt ersetzt ausschließlich die ältere Aussage, dass noch kein Erstzuordnungsflow implementiert sei. **P3 bleibt laut letztem Produktivcheckpoint PROVISIONED/ungebunden, Credential v1 ACTIVE, physisch abgenommene neutrale Firmware 0.3.11. Kein erneuter Produktivzugriff in diesem Auftrag.**

Neue globale Funktion: authentifiziertes Portal → Geräte-ID/eigener Standort → Händler-/Standort-Challenge auf tatsächlichem TFT → Code dort ablesen und bestätigen → atomare ACTIVE-Erstzuordnung ohne Produkt. Kein Code an Portalclient, keine Übernahme bereits verwendeter Geräte, keine Änderung von Identität/Credential oder Produkt/Offer/Bestand. Getrennt vom vorhandenen Produktflow; Ablauf, Replay, Race, Rollback, Wiederholungen und geräteweite Fehlversuchsgrenze berücksichtigt. Details: [P0.1 Sicherheitsvertrag und Abnahmeplan](QR2BUY_DEVICE_FIRST_ASSIGNMENT.md).

**Neue lokale Merchant-Firmware 0.3.12 erforderlich, kein Flash ausgeführt.** Die drei Merchant-Environments bauen; physische 0.3.11-Geräte bleiben unverändert und kompatibel, können den neuen Claim-Screen noch nicht anzeigen. Zuerst Backend/Frontend nach gesonderter Freigabe veröffentlichen und neue Claim-Indizes prüfen. Danach ausschließlich P3 per aktuell bestätigtem Port/MAC auf 0.3.12 bringen und neutral/Claim/Offline-TTL real abnehmen; eigene Flashfreigabe erforderlich. Anschließend Nutzer unter ecily.com / ecily - webentwicklung tatsächlichen TFT-Code eingeben lassen. Keine simulierte Bestätigung; Produktbindung erst separat.

Finale Regression: Backend **280/280**, Frontend **65/65**, Browser/E2E **85/85**, Firmware/C++-Host **31/31**; alle drei Merchant-Builds SUCCESS, Frontend-Lint/Produktionsbuild und Backend-Syntax (11 Dateien) PASS, keine Skips. Ausschließlich isolierte Testdaten; P1/P2-Header hashgleich, keine bestehenden Geräte geöffnet. **NO-GO für sofortige reale Erstzuordnung mit dem aktuellen 0.3.11-Gerät.** Globaler Händlertransfer, Release, Produktfreigabe und Commerce-/Alt-QR-Übergang bleiben offen und sind hier nicht implementiert.

## Historischer Befund: Händlerzuordnung BLOCKED / globale Wiederverwendbarkeit – Audit 15. Oktober 2026

**Die vollständige Wiederverwendbarkeit ist eine globale Produktanforderung für alle qr2buy-Schilder, einschließlich Device 1/2 und aller zukünftigen Modelle.** Verbindliche Anforderungen stehen im obersten globalen Abschnitt der Source of Truth. P3 ist der geplante nächste Nachweisträger, keine Sonderlösung. Keine produktiven Datenänderungen oder Händlerwechsel in diesem Audit.

### Aktuelle P3-Händlerzuordnung

Ausgangsbranch wip/p3-merchant-integration, HEAD 9cc8e28, sauber. Produktiv lesend: QR2B-000003, MAC f4:2d:c9:6b:c2:90, PROVISIONED, Firmware 0.3.11, Credential Version 1 ACTIVE, Heartbeat beim Lesen 31 Sekunden alt. MerchantAssignments, DisplayAssignments und BindingPreviews jeweils 0. Zielhändler ecily.com / abd5bc60-76bb-40a6-a3b9-19983254485b und dessen Standort ecily - webentwicklung / 19b9930f-41bd-4a69-bfed-56d1ccb0bfeb sind ACTIVE und korrekt verknüpft.

**BLOCKED:** MerchantPortal.jsx und /api/merchant-Geräterouten bieten nur Lesen, Rename und bestehenden Produkt-Bindingflow. listDevices zeigt ausschließlich bereits aktuell zugeordnete Geräte; es gibt weder Claim-/Erstzuordnungsroute noch Geräteaktivierung, Release oder Transfer. bindingScope verlangt zudem ACTIVE und gültige aktuelle MerchantAssignment; publicDevice kennzeichnet PROVISIONED nicht als verfügbar. Die lokale Portal-/Domainquelle ist identisch mit dem dokumentierten produktiven 502d539-Stand. Interner assignDeviceToMerchant-Service ist kein Portalflow und wird nicht ersatzweise ausgeführt. Kein fehlender Nutzerklick, sondern fehlende Funktion. Die nachträgliche globale Ergänzung verbietet ausdrücklich produktive Änderungen.

Tatsächliche Displayabnahme bleibt die zuletzt bestätigte neutrale Ansicht ohne QR; Backendzustand weiterhin neutral. Keine neue physische Sichtprüfung, kein COM-Zugriff, keine Preview/Codebestätigung und keine Produktbindung durchgeführt. Es kann keine erfolgreiche neue Händleranzeige behauptet werden.

### Implementierung, Tests und reale Abnahme

| Anforderung | Implementiert | Automatisiert belegt | Physisch abgenommen |
| --- | --- | --- | --- |
| Permanente Identität und Credential ohne Flash erhalten | Generische Backend-Assignments; Firmware pollt unter derselben ID | merchantMongo: Händlerneuzuordnung ohne Credentialänderung; Domain-Historie | Produkt-Rebinding innerhalb eines Händlers auf P1/P2; vollständiger unabhängiger A→B-Lebenszyklus offen |
| Rotation/Widerruf bei Sicherheitsvorfällen | Separater Credentialservice | Echte Mongo-Rotation, alte Token/Version ungültig | Keine neue reale Rotationsabnahme in diesem Audit |
| Produktbindung ersetzen | Portal-Session, Preview, TFT-Code, transaktional ACTIVE→REPLACED | Binding/Portal-Integration, TTL/Replay/Ownershipwechsel, Fremdscope | P1/P2 innerhalb ecily bestätigt; P3 noch kein Produkt |
| Produktbindung eigenständig lösen | Kein dedizierter Unbindflow; interner Händlerwechsel beendet ACTIVE DisplayAssignment | Kein eigenständiger Portal-Unbindnachweis | Offen |
| Händler-/Standortwechsel | Interner Domainservice beendet alte ACTIVE-Assignments und erzeugt neue, ohne Credentialwechsel | Domain- und echte Mongo-Neuzuordnung; vorherige physische Challenge nach Ownershipwechsel unbrauchbar | Historischer Operatorwechsel Demo→ecily, kein abgenommener unabhängiger Händler-A→B-Portalzyklus |
| Release/Neutralisieren ohne unmittelbaren neuen Händler | Kein eigener Service-/Portal-Lifecycle; unassigned-Projektion bei fehlender gültiger Zuordnung vorhanden | UNBOUND-Parser/Auth und neutrale P3-Registrierung geprüft | P3 neutraler Ausgangszustand bestätigt; Rückgabe eines gebundenen Schilds offen |
| Entzug aktueller A-Geräterechte / B-Isolation | Portal-/Binding-Scope aus aktueller MerchantAssignment; Händlerdaten merchant-scoped | Fremdscope-/Merchant-Isolation und Assignmentwechsel in Einzeltests | Vollständige reale Prüfung mit alten A-Sessions und unabhängigem B fehlt |
| Alte Reservierungen/Käufe/Checkouts | Existierende offer-/merchant-scoped Modelle, Bestands-/Webhookschutz | Normale Commerce-/Isolationstests; kein durchgängiger Transfer mit laufendem Checkout/verspätetem Webhook nachgewiesen | Offen |
| Alte Käufer-QRs | /o/:publicOfferId gehört zum Offer; bleibt nach Gerätewechsel lesbar, solange Offer verfügbar | merchantMongo prüft bewusst fortbestehende alte URL | Sichere Wechsel-/Invalidierungsstrategie nicht entschieden oder abgenommen |
| Nachvollziehbarkeit | Assignmentstatus/Zeiten und Display-Verifikationsdaten erhalten | Historie/Unique-ACTIVE/Transaktionen geprüft | Vollständiges Transferaudit mit Akteur, Grund, Zustimmung und Abnahme offen |

Belege im vorhandenen Code/Testbestand geprüft, **keine neue Testsuite ausgeführt**. Letzter vollständiger Lauf bleibt 273/273 Backend und 30/30 Firmware; dies ist keine neue Gesamtabnahme aller globalen Anforderungen.

### Fehlende Funktionen und sicherheitsrelevante Grenzen

1. Authentifizierter Portal-Lifecycle für Erstzuordnung/Aktivierung, Produkt-Unbind, Händler-Release, Standortwechsel und Übernahme fehlt. Ein geschützter interner Service allein autorisiert keine Händler-Selbstübernahme. Device-Credentials dürfen dem alten/neuen Händler nicht als Managementrecht dienen.
2. assignDeviceToMerchant prüft Existenz/Relationen, aber keine ACTIVE-Zielstatus, keinen physischen Besitz-/Übergabenachweis und keine Transferberechtigung. Er beendet nur ACTIVE Display-/MerchantAssignments; PENDING-/Previewhistorie wird nicht vollständig bereinigt. Aktuelle Preview-Auflösung/-Bestätigung schützt bereits vor Verwendung einer alten MerchantAssignment, ersetzt aber keinen vollständigen Releasevertrag. Kein öffentlich erreichbarer Exploit aus diesem ungemounteten Service behauptet.
3. Keine Transferorchestrierung für RESERVED, CHECKOUT_STARTED, PAID und verspätete Stripe-Webhooks. Bestehende Vorgänge müssen beim ursprünglichen Merchant/Offer bleiben; neues B-Produkt und B-Bestand dürfen niemals aus A-Vorgängen abgeleitet oder verändert werden. Zu entscheiden sind Übergabegates, laufende Transaktionen, Storno-/Expiry-Nachweise, Datenaufbewahrung und Anzeigepriorität. Historische A-Orders/Reservierungen dürfen A weiterhin gehören; Zugriff auf B bleibt verboten.
4. Käufer-QRs sind offerbezogen und können von mehreren Schildern geteilt werden. Alte URLs werden durch Gerätewechsel bewusst nicht automatisch ungültig und dürfen niemals auf B umgebogen werden. Pauschales Deaktivieren eines A-Offers könnte andere Schilder stören. Sichere QR-Gültigkeit/Invalidierung und physischer neutraler Zwischenzustand müssen deshalb vor Umsetzung ausdrücklich spezifiziert werden.
5. Firmware behält bei temporärem WLAN-/HTTP-Fehler eine bereits gültige normale Produktanzeige; nur LIVE-Frische erlischt, Preview hat eigene TTL. Bei Offline-Übergabe könnte deshalb alter Inhalt/QR sichtbar bleiben. Es fehlt ein durchgängig nachgewiesener Neutralisierungs-/Bestätigungsvertrag; keine sofortige physische Entkopplung allein aus einer DB-Transaktion behaupten.
6. Assignmenthistorie enthält Status/Zeiten/Nutzungsart; expliziter Transferakteur/-grund und durchgehende Release-/Übernahmefreigabe fehlen. Gleicher Account ist aktuell genau einem Merchant zugeordnet; kein unterstützter Merchant-Scopewechsel durch Überschreiben dieses Accounts. A und B für die Abnahme müssen unabhängig authentifiziert werden.

### Zukünftiger Testplan Händler A → neutral → Händler B

Erst nach gesondertem Implementierungs-/Testauftrag, zunächst isolierte Testdatenbank, danach gesondert freigegebener realer Lauf. **Jetzt weder neuen Händler anlegen noch P1/P2 oder Produktdaten verändern.**

1. Zwei unabhängige Accounts/Merchants mit eigenen Standorten/Produkten/Offers vorbereiten; Referenzgerät und unbeteiligtes Kontrollgerät. ID/MAC/Credential sowie Geschäfts-/Bestandssnapshots sichern, keine Secrets ausgeben.
2. Authentifiziert unter A erst zuordnen, physische Produkt-A-Challenge regulär bestätigen und QR/Preis/Bestand prüfen. Falscher Merchant, fremder Standort/Produkt, Replay, fehlendes CSRF und parallele Übergabe müssen abgewiesen werden.
3. Produktbindung lösen und Händler-/Standortfreigabe über den zukünftigen Flow ausführen. Neutralen Screen tatsächlich am Gerät bestätigen; Offline-/Netzausfallfälle, verzögerte Polls und alte QR-Fotos ausdrücklich prüfen. Alte Challenges nicht nutzbar; keine neue Übernahme, solange notwendige Übergabegates offen sind.
4. Alten A-Login offenhalten und damit Geräte-Read/Rename/Preview/Confirm/Release sowie B-Produkt-/Bestands-/Orderzugriffe negativ testen. A darf eigene historische Vorgänge weiterhin sehen/behandeln, aber weder Gerät aktuell steuern noch B-Daten lesen/verändern.
5. Unter B dasselbe Gerät übernehmen und B-Produkt mit eigener physischer Challenge binden, ohne Flash oder Identitäts-/Tokenwechsel. Buyer-QR, Produkt/Preis und Bestandsprojektion müssen ausschließlich B entsprechen. A-Daten/Bestände und Kontrollgerät bleiben unverändert.
6. Varianten mit aktiver Reservierung, offenem Checkout, erfolgreicher/verspäteter Zahlung, Abbruch, Ablauf und gleichzeitigem Webhook prüfen. Kein doppelter Abzug, keine Übertragung der A-Order/-Reservierung auf B; alte QR-Policy erfüllt und keine Änderung gemeinsam genutzter A-Offers ohne entsprechende Freigabe.
7. Gleichen Zyklus zurück B→neutral→A sowie andere Standorte/Produkte wiederholen. Audit/Unique-ACTIVE/Transaktionsrollback und verlorene Antworten prüfen. Sicherheitsrotation gesondert testen; normale Wiederverwendung erhält Credential. Vollständige physische Abnahme plus negative A/B-Portalprüfungen dokumentieren.

**Nächster Schritt vor P3-Produktbindung:** sicheren Portal-/Lifecyclevertrag separat spezifizieren/implementieren und testen. Danach P3 ausschließlich über den freigegebenen authentifizierten Flow für ecily.com / ecily - webentwicklung aktivieren/zuordnen; ohne Produktbindung neutral abnehmen. Erst in einem weiteren Auftrag Produkt wählen und echten TFT-Code bestätigen. Keine direkte DB-Abkürzung oder simulierte Nutzerbestätigung.

## Merchant-Flash und neutrale Abnahme SUCCESS – 15. Oktober 2026

Dieser Abschluss hat Vorrang vor allen historischen Aussagen darunter zu noch fehlendem Flash, Heartbeat oder physischer Merchant-Abnahme.

| Prüfung | Ergebnis |
| --- | --- |
| Ausgangsstand | wip/p3-merchant-integration, b4dd5f4, sauber |
| Identifizierter Port | COM3, bisherige USB-Instanz VID_10C4/PID_EA60/0001 |
| MAC-Abfrage vor Flash | f4:2d:c9:6b:c2:90, ESP32-D0WD-V3 Rev. 3.1 |
| Build | esp32dev_spi_cs5_rst4_device3_merchant_app, registriertes Credential v1, 0.3.11, CS5/Rotation 1 |
| Artefakt | obiger frischer Buildpfad; SHA-256 8406ec284043892150fa100eae024b8f2b3f37b7acaff8ff13259f501a97f225 vor/nach Upload identisch |
| Upload | explizit COM3, richtige MAC erneut bestätigt, SUCCESS und vier Flash-Hashprüfungen bestanden |
| Erststart / 115200 Baud | Merchant-Start, WLAN-Verbindung, NTP-Anforderung, 14 erfolgreiche authentifizierte HTTPS-200/UNBOUND-Configs in 50 Sekunden |
| Gezielter P3-Neustart | nur COM3 EN/RTS; automatische WLAN-Wiederverbindung, NTP-Anforderung, 11 erfolgreiche UNBOUND-Configs in 45 Sekunden |
| Renderer nach Neustart | mode=UNBOUND, einmal redraw=yes, zehnmal redraw=no, keine beobachteten Configfehler |
| Produktiv | PROVISIONED, Firmware 0.3.11, Credential v1 ACTIVE; eigene echte frische/fortschreitende Heartbeats, Onlineprojektion true |
| Bindings | MerchantAssignments=0, DisplayAssignments=0, BindingPreviews=0 |
| Physische Nutzerabnahme | „Ja, Anzeige ist korrekt“ auf konkrete Frage nach richtiger Orientierung, neutralem „Kein Produkt zugewiesen“, keinem Käufer-QR und keinen sichtbaren Artefakten |

MAC-Abfrage/Upload/serieller Monitor ausschließlich auf COM3. COM5/COM6 passiv gelistet, nie geöffnet/zurückgesetzt/geflasht. USB-Instanz und MAC gemeinsam verwendet, keine Auswahl allein anhand historischer Portnummer. Erster Tool-Aufruf via Python-Modul konnte esptool nicht importieren und hat kein Gerät geöffnet; anschließend vorhandenes PlatformIO-esptool-Skript korrekt verwendet.

NTP-Zeitanforderung wurde tatsächlich geloggt; erfolgreiche Configpolls passieren nur hinter gültigem Zeitgate mit WiFiClientSecure/GTS Root R4 und eigener Device-ID/Credentialversion. Damit sind WLAN, verwendbarer Zeit-/TLS-Pfad, Backendauthentifizierung und Polling technisch belegt. Kein unsicheres TLS, kein Operator-Config-GET, keine simulierten Heartbeats. lastSeenAt von 11:07:48.551Z auf 11:08:59.780Z fortgeschritten; beim Abschlusslesen 19 Sekunden alt. Keine Behauptung einer separaten NTP-Paket-/Zertifikatskettenmessung. WLAN-Wiederverbindung **nach Gerätestart** getestet; ein WLAN-Ausfall im laufenden Betrieb und das zweite Fallbacknetz wurden nicht gezielt getestet. Dafür keine Router-/WLAN-Änderung an anderen Geräten durchgeführt.

Serielle Daten nur als sanitisierten Diagnoseklassen/Rendererzustände behalten; keine SSIDs, Passwörter, Token oder Configantwortbodies ausgegeben/gespeichert. Serielle Rendererbeobachtung und ausdrücklich bestätigte physische Nutzeransicht sind getrennte Nachweise. Abgenommen ist UNBOUND, kein P3-Produkt-/READY-/Commerce-Zustand.

Bestandsschutz: 13 Collections vor/nach verglichen; Device 3 aus managed_devices ausgenommen, reguläre lastSeenAt/updatedAt anderer Geräte normalisiert. Keine anderen Änderungen an Device 1/2, Credentials, Merchant-/Displayzuordnungen, Produkten/Offers/Beständen, Orders oder übrigen erfassten Geschäftsdaten. Lokale P1/P2-Header hashgleich. Eigene P3-Polls und Firmware-/Heartbeatfortschreibung sind die einzigen erwarteten produktiven Geräteänderungen. Keine Zuordnung, Stripe-Transaktion, Push, Merge oder Backend-/Frontenddeployment.

**GO für den nächsten separat freizugebenden kontrollierten Händler-/Standortzuordnungsschritt und anschließende Produktbindung.** P3 bleibt bis dahin PROVISIONED/neutral. Zielhändler, Standort und Produkt/Offer vorab festlegen; Binding erfordert ACTIVE-Gerät plus gültige MerchantAssignment. Kein Umgehen der bestehenden Freigabe-/Vor-Ort-Codeprüfung, keine automatische Aktivierung durch diesen Auftrag.

## Historie: WLAN und frischer Merchant-Build vor Flash

Dieser Nachtrag ersetzt sämtliche älteren P3-Angaben zu WLAN-Platzhaltern und noch fehlendem frischem Build. Ausgangscommit 1826a34 auf wip/p3-merchant-integration, sauber; keine produktive Datenprüfung/-mutation in diesem Schritt.

- **WLAN konfiguriert:** zwei bereits im Projekt verwendete Einträge aus der unabhängigen ignorierten `firmware/qr_display_fw/src/secrets.h`, ausschließlich WIFI_LIST, in den eigenen P3-Header übernommen. Keine Zugangsdaten erfunden, keine Geräte-Secrets übernommen, Device-1/2-Header weder als WLAN-Quelle verwendet noch verändert (Hashvergleich). Keine SSIDs/Passwörter ausgegeben. Fallbacklogik unverändert: je 15 Sekunden Versuch, anschließend Wiederholung/Runtime-Reconnect. Reale Erreichbarkeit noch nicht getestet.
- **Credential PASS:** registrierter eigener Token Version 1 unverändert, ID QR2B-000003/Origin/Format geprüft. Keine neue Registrierung oder Rotation. P3-Header bleibt gitignored und per geschützter DACL ausschließlich für aktuellen Nutzer/SYSTEM/Administratoren zugänglich. Nur WLAN-Liste und ihr lokaler Kommentar geändert.
- **Hardware PASS:** bestehendes CS5-Setup, ILI9341, GPIO18/23/15/4/5, Rotation 1, SPI 4 MHz; LED laut physischer Nutzerabnahme fest an 3V3, TFT_BL=-1. MISO/Touch unverbunden. Keine Pin-/Firmwareänderung.
- **Frischer Build SUCCESS:** vollständig neues leeres Ausgabeverzeichnis durch prozesslokales PLATFORMIO_BUILD_DIR; exakt das Merchant-Environment `esp32dev_spi_cs5_rst4_device3_merchant_app`, Version 0.3.11. RAM 48.204 Byte / Flash 1.002.797 Byte, nur bekannte unbenutzte TOUCH_CS-Warnung. Keine alten Objects/Binaries übernommen. Artefakte ignoriert und ohne breite Benutzergruppenrechte; firmware.bin nur aktueller Nutzer/SYSTEM/Administratoren. Keine produktiven Builds oder Device-1/2-Konfigurationen geändert.

Verifiziertes Artefakt relativ zu `firmware/qr_display_fw`:

```text
.pio/p3-validation/fresh-merchant-23ade50503914c598d370500e8eda6fd/esp32dev_spi_cs5_rst4_device3_merchant_app/firmware.bin
SHA-256: 8406ec284043892150fa100eae024b8f2b3f37b7acaff8ff13259f501a97f225
Dateigröße: 1009376 Byte
```

13 Isolationsprüfungen PASS: eigener registrierter Token und beide tatsächlich konfigurierten WLAN-Einträge im Binary, keine Device-1/2-ID, keine Farb-/Textdiagnose, Version 0.3.11, keine konfigurierten Platzhalter, Credentialdefinition und P1/P2-Header unverändert. Das Binary enthält einmal `YOUR_WIFI_SSID` aus der bestehenden Abwehrprüfung `hasConfiguredWifi`; diese Zeichenfolge ist **kein WLAN-Eintrag**. `YOUR_WIFI_PASSWORD`/`YOUR_DEVICE_SECRET` fehlen. Keine Source-/Dependencyänderung, deshalb keine erneute vollständige Backend-/Firmwaretestsuite; bestehender 273/273-/30/30-Stand bleibt der letzte vollständige Nachweis.

**GO für separat freizugebenden kontrollierten Merchant-Flash, noch nicht ausgeführt.** Windows zeigt aktuell COM3/COM5/COM6; nur passive Enumeration, keine aktuelle P3-MAC-Abfrage. Letzter P3-Port COM3 darf nicht blind verwendet werden. Nach ausdrücklichem Go zuerst physische Portzuordnung und MAC f4:2d:c9:6b:c2:90 bestätigen, dann ausschließlich P3-Environment mit explizitem bestätigtem Port und obigem Buildverzeichnis (PLATFORMIO_BUILD_DIR) verwenden. Bei Header-/Quelländerung neu bauen und Artefakthash neu verifizieren. Nach Flash Hashprüfung, tatsächliche 0.3.11-Heartbeats und neutralen UNBOUND-Screen ohne Käufer-QR abnehmen. Reale WLAN-/NTP-/TLS-Funktion erst dann nachweisbar. Keine Bindung, Datenmutation, Push/Merge oder Deployment freigegeben.

## Produktive Registrierung SUCCESS – 15. Oktober 2026

Dieser Abschnitt ersetzt alle historischen Angaben darunter zu noch fehlender Registrierung/unprovisioniertem Buildtoken.

| Feld | Produktiv lesend verifiziert |
| --- | --- |
| Device-ID / MAC | QR2B-000003 / f4:2d:c9:6b:c2:90 |
| Name / Hardwarevariante | Schild 3 / ESP32_ILI9341_CS5 |
| Gerätestatus | PROVISIONED, neutral/ungebunden |
| Credential | genau eines, Version 1, ACTIVE; Tokenzuordnung im Backend verifiziert |
| Angelegt | 2026-10-15T10:55:55.647Z |
| Firmware | erwartet 0.3.11; gemeldete Version null, noch kein Merchant-Flash |
| Heartbeat / Aktivierung | lastSeenAt=null, activatedAt=null |
| Zuordnungen | keine MerchantAssignments, DisplayAssignments oder BindingPreviews |

- Ausdrückliche Nutzerfreigabe; Ausgangsbranch wip/p3-merchant-integration / Commit f6c7e41d01b8028595512931530bcc9f1476d438, Arbeitsbaum sauber. Registrierungshelfer exakt aus diesem getesteten Commit, SHA-256 5b37aad7b9395acee7acc9a046f79e2b025a4b4eaa14b6bb091c115b0566dacb. Im geschützten Backendprozess unveränderte Quelle per speicherinternem VM-Modul ausgeführt, Hash vor Ausführung geprüft; vorhandenes produktives Authmodul verknüpft. Kein Helfer auf produktivem Datenträger abgelegt, kein Deployment.
- Erneute Vorprüfung im tatsächlichen Backendprozess: vorhandener Pepper gültig, Produktiv-Authquellen identisch mit 502d539, ID/MAC und alle P3-Records frei; Device 1/2 samt MAC, ACTIVE Credential Version 1 und je einer aktiven Händler-/verifizierten Displaybindung bestätigt. Keine Modell-/Indexinitialisierung.
- Genau ein neues zufälliges 32-Byte-Credential lokal unter bestehender geschützter P3-Header-DACL sicher vorgemerkt, fsync/rückgelesen und über echo-freies STDIN übergeben. Pepper blieb ausschließlich in Runtime-ENV. Erste Console-Verbindung erreichte kein Bereitschaftssignal: ohne Tokenerzeugung/DB-Schreibaufruf beendet; anschließend eindeutiger SUCCESS im vollständigen Lauf. Kein unklarer Commitausgang, keine Wiederholungsregistrierung.
- Im Registrierungsklienten exakt zwei beobachtete Inserts, ausschließlich die neue ID in managed_devices/device_credentials. Keine anderen Mutationen. Snapshot-/Majority-Transaktion bestätigt; danach passende Verifierauthentifizierung im Backendprozess ohne Device-Config-Aufruf und damit ohne künstlichen Heartbeat.
- Vorher-/Nachhervergleich über 13 Collections im Backend: bestehende Daten vollständig hashgleich, P3 aus den beiden Zielcollections ausgenommen. Unabhängiger nativer Mongo-Folgeabgleich bestätigt 12 Collections weiterhin identisch; managed_devices änderte sich zwischenzeitlich. Änderungsstrom seit 30 Sekunden vor Registrierung zeigt ausschließlich P3-Insert und reguläre Device-1/2-Heartbeatupdates (lastSeenAt/updatedAt), keine weiteren Devicefelder. Credentials, Bindings, Produkte, Offers, Bestände, Orders und übrige erfasste Geschäftsdaten unverändert. Keine bestehende Device-Config abgefragt; lokale P1/P2-Header hashgleich.
- Geschützter lokaler secrets.device3.h enthält jetzt das registrierte eigene Credential Version 1; DACL unverändert nur aktueller Nutzer, SYSTEM, Administratoren. Keine Secrets außerhalb dieser vorgesehenen Credentialdatei gespeichert oder ausgegeben. WLAN bleibt Platzhalter. Frühere Buildartefakte enthalten den alten unprovisionierten Buildtoken: **nicht hochladen**.

**Nächster Schritt:** eigene WLAN-Konfiguration sicher im P3-Header ergänzen, Merchant-Build neu erstellen, Port und MAC erneut prüfen. Merchant-Flash weiterhin nur nach gesonderter ausdrücklicher Freigabe. Keine Händler-/Standort-/Produktbindung und keine Offers/Bestände/Stripe geändert. Kein Push, Merge, Flash oder Backend-/Frontenddeployment.

## Historie: Provisioning-Helfer und Zugriff vor Registrierung geprüft

Dieser Nachtrag ersetzt die untenstehenden historischen Aussagen „Helfer nicht gebaut“, „Pepperzugang nicht geprüft“ und „Konfliktfreiheit nicht geprüft“. Keine produktive Registrierung erfolgt.

- Produktive Vorprüfung: ID QR2B-000003 und erwartete MAC frei; keine P3-Credentials/Assignments/Previews. Backend weiterhin auf 502d539; identischer produktiver Auth-/Device-/Modellcode. DB-Zuordnung anhand authentifizierter Merchant-GET-Antwort bestätigt. Replica Set, Sessions und notwendige Unique-Indizes vorhanden. Device 1/2 eindeutig identifiziert, Credentials und Bindings ACTIVE; Heartbeats veraltet, nicht als aktuell online behauptet.
- **Pepper PASS:** direkter geschützter DigitalOcean-Exec-/WebSocket-Kanal funktioniert; Node im Backend bestätigt ausschließlich boolesche Angaben zu Runtime-Pepper/Format und Mongo-Konfiguration. Pepper nie aus der Runtime-Umgebung herauskopiert, nie gespeichert oder ausgegeben. Zugang über doctl API-Token nur im lokalen Prozessspeicher; keine Token-/Console-URL-Ausgabe. Read-only Console-Probe ohne Produktionsdatenmutation.
- **Eingabekanal geprüft:** `stty -echo`, Node mit `readline({ input: process.stdin, terminal: false })`, Bereitschaftsmarker abwarten, dann JSON-Zeile senden; mit harmloser Testnachricht erfolgreich und ohne Echo. Danach Prozess beendet/Terminal-Echo wiederhergestellt. Keine echten Device-Credentials in dieser Probe. Für spätere Registrierung niemals Secret als Shell-/CLI-Argument, Base64-Kommando oder Antwort senden; Base64 allein ist kein Schutz.
- **Lokaler Header PASS:** geerbte Rechte entfernt, geschützte DACL nur aktueller Benutzer/SYSTEM/Administratoren. Inhalt und WLAN-Platzhalter unverändert. Neue Datei oder atomarer Dateiaustausch muss dieselbe DACL erneut setzen/prüfen; Git erhält diese Windows-ACL nicht. P1/P2-Dateien unverändert.

### Interner Helfervertrag

`backend/src/merchant/provisionPrototype3.js` exportiert ausschließlich `provisionPrototype3`; kein Router, automatischer Aufruf oder Endnutzerzugang. Der Helfer ist nur lokal committed und noch nicht im produktiven Dateisystem vorhanden. Für den genehmigten Einmallauf muss genau die geprüfte Quelle im bestehenden geschützten Backend-Kontext bereitgestellt werden; kein Backenddeployment erforderlich, kein automatischer Upload/Exec in dieser Vorbereitung.

Eingaben: verbundener nativer MongoClient, vorab verifizierter dbName, sicher vorgemerkter eigener 32-Byte-Hex-Token, confirmDeviceId=QR2B-000003, observedMac=f4:2d:c9:6b:c2:90. Pepper standardmäßig nur aus Runtime-ENV. Außerhalb eigener qr2buy_test_<hex>-DBs zwingend allowProduction=true; im echten Lauf zusätzlich production=true setzen. Diese interne Funktionsfreigabe ersetzt keine Nutzerfreigabe. Keine Tokens für P1/P2 wiederverwenden; deren aktuelle Verifier werden nur lesend auf Wiederverwendung geprüft.

Der Helfer prüft bestehende Unique-Indizes ohne Indexanlage. Innerhalb einer Snapshot-/Majority-Transaktion prüft er feste ID und MAC (auch Großschreibungsaltwerte), Credentials und jede vorhandene P3-Zuordnung. Er schreibt ausschließlich zwei neue Dokumente in managed_devices/device_credentials. Devicewerte entsprechen dem bestehenden Modell: PROVISIONED, CS5, Schild 3, bindingRevision=0, kein Heartbeat/Aktivierungsdatum, firmwareVersionExpected=0.3.11. MACs werden kanonisch kleingeschrieben; bestehende Modellschreibpfade normalisieren ebenfalls. Keine Updates, Upserts, Rotation, Löschung oder neue Merchant-/Location-/Produkt-/Offer-Daten.

Rückgabe ausschließlich PROVISIONED oder ALREADY_PROVISIONED plus öffentliche Geräte-ID. Letzteres nur bei exakt passendem neutralem Device/Credential und gleichem Verifier, ohne Zuordnungen; andernfalls harter Konflikt. Bei p3_outcome_uncertain oder p3_registration_unconfirmed denselben vorgemerkten Token sichern, **nicht flashen** und keinen neuen Token erzeugen. Nach Verbindungsklärung denselben Helfer mit demselben Token wiederholen: vorhandener passender Datensatz → No-op; kein Datensatz → atomare Anlage; Teilzustand/fremder Token → STOP. Fehlercodes sind sanitisiert, Rohfehler/Cause/Secret/Verifier werden nicht zurückgegeben.

### Tokenübergabe und Freigabegrenze

Vor dem späteren DB-Schreibaufruf einmalig einen neuen unabhängigen Token lokal unter der geprüften ACL vormerken; noch nicht als registriert/flashbereit kennzeichnen. Bestehenden Buildtoken nicht versehentlich mit einem neuen Retrytoken verwechseln. Nur der Token geht über den geschützten echo-freien Eingabekanal; der Pepper bleibt unverändert im Backendprozess. Nach bestätigtem Erfolg Verifierzuordnung/neutralen Zustand lesen und lokale Headerzuordnung kontrollieren. Bei Antwortverlust bleibt genau dieses lokale Token erhalten. Ohne eindeutig gesicherte lokale Datei keine Registrierung beginnen. Kein automatischer Dateiaustausch oder Tokenverlust nach DB-Commit.

Tests: neue Provisioning-Suite 13/13 inklusive Parent; final vollständiges Backend 273/273, Firmware 30/30. Positive Registrierung/Auth, ID/MAC/Orphans/Assignments, Fehler am zweiten Insert und Rollback nach beiden Inserts, identischer Retry, anderer Token, verlorene Commitbestätigung, unklar ohne Commit, parallele Kandidaten, Secret-Isolation/P1-P2-Wiederverwendung und Index-/Freigabegates geprüft. Nur eigene Loopback-DBs; kein Laden produktiver .env. Keine Firmwareänderung seit den drei erfolgreichen Merchant-Builds.

**Technisches GO für einen gesondert freizugebenden kontrollierten Registrierungslauf.** Gesamtworkflow noch nicht produktiv ausgeführt. Ziel/ID/MAC und geschützte Quelle/Tokenablage unmittelbar vorher erneut prüfen. WLAN bleibt offen, keine Flashfreigabe. Keine produktive Mutation, kein Push/Merge/Deployment in dieser Vorbereitung.

## Hardware und Build

- Nutzerabnahme: ESP32-D0WD-V3 Rev. 3.1, MAC `f4:2d:c9:6b:c2:90`; KMRTM28028-SPI, ILI9341, 240×320, Landscape Rotation 1.
- VCC und LED jeweils 3V3, GND gemeinsam, SCK18/MOSI23/DC15/RST4/CS5; MISO/Touch offen. Diese acht Verbindungen sind am P3 physisch bestätigt. Keine allgemeine elektrische Zusage für andere Module.
- Isolierter Farb-/Texttest unter `firmware/prototype3_display_test` wurde auf COM3 hashverifiziert geflasht und vom Nutzer physisch abgenommen. Dieser bisher unversionierte Test wird mit diesem Arbeitsstand gesichert.
- Neuer Merchant-Build: `esp32dev_spi_cs5_rst4_device3_merchant_app`; gemeinsame App, TFT-Setup von P1, Device-Profil 3 → `secrets.device3.h` → `QR2B-000003`.
- Profile 1/2 verwenden unverändert ihre getrennten Header; die Auswahl hängt jetzt ausdrücklich vom Profil ab, nicht von CS/NOCS. Compile-Time-Prüfungen sperren fremde IDs/unbekannte Profile. Keine Renderer-/Transportänderung; Wire-Version bleibt 0.3.11.
- Der lokale P3-Header enthält nur einen unabhängigen **unprovisionierten Buildtoken und WLAN-Platzhalter**. Das erzeugte Binary ist kein freigegebenes Flashartefakt. Beispielheader enthält ausschließlich Platzhalter. Ignore-Regeln schützen auch weitere nummerierte Geräteheader.

Lokaler Build aus `firmware/qr_display_fw`:

```powershell
& 'C:\Users\Nutzer\.platformio\penv\Scripts\platformio.exe' run -e esp32dev_spi_cs5_rst4_device3_merchant_app
```

Platform espressif32 7.0.1, Arduino/esp32dev, TFT_eSPI 2.5.43, ArduinoJson 7.4.3, bestehende QRCode-Gitabhängigkeit; SPI 4 MHz. Vorhandene lokale Libraries für P3 bytegleich aus dem ignorierten P1-libdeps übernommen, keine TLS-Abschwächung oder Dependencyänderung. QRCode bleibt historisch ungepinnt.

## Sichere neutrale Registrierung – noch freizugeben

Der Backendvertrag ist bereits geräteunabhängig: ManagedDevice, separates HMAC-SHA-256-Credential mit Pepper, `/api/device/config`. PROVISIONED ohne Assignment darf authentifiziert pollen und erhält assigned=false. Binding verlangt später ACTIVE und eine gültige Händler-/Standortzuordnung. MAC ist eindeutige Hardware-UID, kein Secret; die Device-API prüft Credentials, nicht die MAC des angeschlossenen Boards.

Vor jeder produktiven Mutation separat:

1. Zielsystem/Zieldatenbank und Zugriffsberechtigung zweifelsfrei rein lesend bestätigen, ohne DemoSession oder künstlichen Geräteheartbeat. Keine lokalen ENV-/Secretwerte ausgeben. Kein produktiver Modellimport mit automatischer Indexanlage.
2. Nach deviceId `QR2B-000003` und unabhängig nach hardwareUid `f4:2d:c9:6b:c2:90` suchen; keine bestehende Identität überschreiben. Bei beliebigem Konflikt stoppen und Ursache klären. Gegen Device 1/2 darf nicht rotiert oder neu provisioniert werden. Aktuellen Board-MAC-Nachweis unmittelbar vor Flash mit dieser UID vergleichen.
3. Bestehenden Backend-Pepper sicher verfügbar bestätigen, nicht ersetzen. Bestehende Device-1/2- und Assignment-/Geschäftsdaten für den Nachhervergleich rein lesend sichern, ohne Klartextsecrets.
4. Nach ausdrücklicher Registrierungsfreigabe genau ein neues ManagedDevice (PROVISIONED, CS5, Name Schild 3, feste MAC) und ein eigenes Credential Version 1 anlegen. Kein MerchantAssignment/DisplayAssignment/Preview, keine Produkte/Offers. Zufällige 32 Byte; Verifier nach bestehendem `credentialVerifier`-Vertrag, Klartext nur in geschütztem lokalen P3-Header.
5. Für diesen Einmalvorgang Device- und Credentialanlage gemeinsam transaktional und gegen konkurrierende ID-/MAC-Konflikte absichern. Der vorhandene `rotate`-Service ist kein atomarer Neugeräte-Provisioner: er setzt ein bereits existierendes Device voraus und könnte vorhandene Credentials rotieren. Keinen unkontrollierten Aufruf und keinen allgemeinen Demo-Seed verwenden. Ein produktiver Ausführungshelfer wurde hier bewusst nicht gebaut oder gestartet.
6. Lokale Dateiübergabe und Transaktionsabschluss müssen nachweisbar zusammenpassen; bei unklarem Ausgang keinen zweiten Token erzeugen und keinen Flash ausführen. Bei fehlgeschlagener Transaktion kein scheinbar provisioniertes Flashartefakt zurücklassen. Kein Credential in CLI-Argumenten, Logs oder Antworten.
7. Nachher genau Device 3 und Credential prüfen, keine Assignments; bestehende Geräte/Credentials/Bindings/Offers unverändert nachweisen. Credentials nicht durch künstliche Configaufrufe auf Device 1/2 testen.

Produktive Konfliktfreiheit, Pepperzugang und Livezustand sind in dieser Vorbereitung **nicht geprüft**. Das lokale Testcredential ist keine produktive Registrierung und wird später kontrolliert ersetzt, niemals vom anderen Gerät kopiert. WLAN nur für P3 separat sicher bereitstellen.

## Abnahme und nächste Grenze

- Drei Merchant-Builds SUCCESS. P1/P2-Header unverändert per SHA-256 verglichen; gemeinsame Laufzeit ab dem Identitätsblock unverändert gegen Ausgangs-HEAD geprüft.
- Firmware 30/30: echte C++-Parser-/Rendererprüfung, alle drei Identitäten, unbekannte/fremde Profile vom Compiler abgewiesen, P3 akzeptiert keine P1/P2-Projektionen; Ignore-Regeln inklusive Beispiele getestet.
- Vollständige Backend-Testsuite erfolgreich; Mongo/HTTP-Suite 7/7. Neues neutrales P3 mit 0.3.11 erhält HTTP 200/assigned=false; Credentialtausch in beide Richtungen 401, MAC-Unique-Constraint geprüft, vorhandene Testgeräte/Collections unverändert. Nur eigene Loopback-Datenbank; Cleanup bestätigt. Kein neuer Frontend-/Browserlauf, da keine Web-/Runtimeänderung.
- Keine produktive Registrierung, kein Merchant-Flash, keine bestehenden Gerätezugriffe, kein Deploy, Push, Merge oder Stripe-Vorgang.

Nach freigegebener Registrierung und gültiger WLAN-Konfiguration: neu bauen, bestehende Header unverändert prüfen, **Port erneut ermitteln und MAC vergleichen**, Firmwareartefakt dem P3-Build zuordnen. Erst mit ausdrücklicher Flashfreigabe ausschließlich dieses Environment und den frisch bestätigten Port hochladen; Hashverifikation, TLS-/Config-Logs und echte P3-Heartbeats beobachten. Zuerst physisch neutrales UNBOUND ohne Käufer-QR abnehmen. Händler-/Standortzuordnung, Produktbindung und Commerce-Tests sind weitere getrennte Schritte; Device 1/2 und deren Offers bleiben unangetastet.
