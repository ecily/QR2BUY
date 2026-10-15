# P0.1 – sichere Erstzuordnung nach Reviewfix, 15. Oktober 2026

Operative Source of Truth: [QR2BUY_CONTEXT.md](QR2BUY_CONTEXT.md). Branch `wip/p3-merchant-integration`, Ausgangscommit `472a11a`. **Nur lokal umgesetzt/getestet; kein Deployment, Flash oder produktiver Claim.** Dieser Vertrag ersetzt den Entwurf mit geräteweiter Zehnminutensperre. Vollständige globale Wiederverwendbarkeit bleibt ein gesonderter, noch nicht erfüllter Auftrag.

## Physischer Portalablauf

1. Provisioniertes neutrales Schild erhält ausschließlich über den credential-authentifizierten HTTPS-Poll einen **32-stelligen hexadezimalen Setupcode**. Die neue lokale Firmware 0.3.12 zeigt Geräte-ID und Code in zwei Zeilen mit je 16 Zeichen, ohne Käufer-QR/Produkt/Preis. Kein Setupcode in der Portalantwort.
2. Im authentifizierten Händlerportal unter Geräte: ID, eigenen ACTIVE-Standort und direkt vom TFT abgelesenen Setupcode eingeben. **ID/MAC und beliebiges Händlerkonto reichen nicht zum Claimstart.**
3. Nach gültigem Setupnachweis zeigt das TFT Händler, Standort und einen **sechsstelligen Bestätigungscode**. Nutzer prüft tatsächlich die Namen und bestätigt den Code. Kein physischer Schritt wird simuliert.
4. Erfolg atomar: erste ACTIVE MerchantAssignment, Gerät ACTIVE/activatedAt, Audit. ID/MAC/Hardwareprofil/Credentialwert/-version bleiben erhalten. Technische usageType INTERNAL erzeugt keine Kauf-/Miet-/Eigentumsrechte. Keine DisplayAssignment, Produkt-/Offer-/Bestandsänderung; anschließend neutral „Kein Produkt zugewiesen“. Produktbindung später separat.

Setupcode: 128-Bit-HMAC-Ausschnitt mit eigenem Namespace, Device-ID, Credentialversion und aktuellem 120-Sekunden-Zeitfenster. Vorhandener Pepper bleibt im Backend. Ablauf am Fensterende, **höchstens 120 Sekunden**, eventuell kürzer; keine Annahme eines alten Fensters. Bestätigungscode: separat 120 Sekunden ab Claimstart, gebunden an Gerät/Claim-ID/Nonce/Account/Händler/Standort/Credentialversion. Setupcode ist kein Device-Credential und wird nicht in Claimdaten gespeichert.

Dies beweist Zugriff auf die aktuelle Anzeige, keine Standortmessung oder Hardwareattestation gegen Weitergabe/Relay. Bei ausgelesenen Device-Secrets ist Operatorrotation/Widerruf erforderlich. Fortlaufender tatsächlicher TFT-Zugriff kann weiterhin Einrichtungskonflikte verursachen. Der P1-Angriff ohne TFT-Zugriff wird hingegen vor Claimanlage abgewiesen.

## Sicherheit und Wiederaufnahme

- Bestehende ACTIVE-OWNER-/Merchant-Session, Cookie-/Origin-/JSON-/CSRF-Prüfung; Händler aus Session. Eigener ACTIVE-Standort wird transaktional erneut geprüft. Kein übergebbarer Merchant-/MAC-/Credential-Managementscope.
- Ausschließlich PROVISIONED, ACTIVE Credential, Kontakt höchstens 120 Sekunden alt und Firmware 0.3.12. Jegliche MerchantAssignment/DisplayAssignment oder BindingPreview schließt den Flow aus, auch beendete Historie. Kein Release/Transfer/Produkt-Unbind.
- Start: `POST /api/merchant/device-claims` strikt mit `deviceId`, `locationId`, zufälligem 128-Bit-`requestKey`, `setupCode`. Confirm: `POST /api/merchant/device-claims/:claimId/confirm` strikt mit sechsstelliger `code`. Codes nur im Body, nicht URL oder Browserpersistenz. Portalantwort ohne Codes/Nonce/Credentials. Requestbodies werden nicht geloggt, Claim-URLs redigiert; Firmware protokolliert nur Zustandsklassen.
- Genau eine aktuelle Challenge pro Gerät. ManagedDevice-Transaktionssperre serialisiert Claims, Domain-/Produktzuordnung und Credentialrotation/-widerruf. Aktivierung, Assignment und Audit gemeinsam in Snapshot-/Majority-Transaktion; kein Übernehmen bereits verwendeter Geräte.
- **Budget je Gerät UND Händler:** fünf falsche Bestätigungscodes im Zehnminutenfenster ab erstem Fehler. Persistente `device_claim_attempts`; anderer Account desselben Händlers oder Challenge-/Prozessneustart setzt nichts zurück. B-Sperre sperrt A nicht. Eine noch laufende Challenge eines gesperrten B darf mit aktuellem physischem Setupnachweis ersetzt werden; alte Claim-ID danach ungültig. Ungültige Setupcodes verändern weder Gerät, Claim noch Budget.
- Bestehender IP-Limiter und 15 Anfragen pro Account/Minute/Prozess bleiben. Der entscheidende Schutz gegen blindes Challenge-Erneuern ist der 128-Bit-Setupnachweis; bloßes Aufteilen des alten sechsstelligen Limits wäre unzureichend.
- Gleicher gültiger Start verlängert/ersetzt die Challenge nicht. Wiederaufnahme desselben Vorgangs darf nach Setupcode-Ablauf dessen bestehendes Ergebnis liefern; neue Starts brauchen aktuellen Setupcode. Erfolg bleibt idempotent, ohne zweite Zuordnung/neue Aktivierungszeit. Alte Entwurfs-Challenges ohne `proofVersion=2` werden nicht angezeigt/bestätigt. Kein produktiver Backfill/Löschen erforderlich.
- Definitiver Startfehler gibt das Formular frei und löscht den verbrauchten Setupcode. Unklare Antwort oder Timeout (20 Sekunden) erhält Anfrage/Scope/Setupcode/requestKey. „Ergebnis erneut prüfen“ wiederholt exakt diesen Start, ohne nochmals sechsstelligen Code zu bestätigen. So kann eine verlorene erfolgreiche Bestätigungsantwort auch nach Ablauf als CONFIRMED rekonstruiert werden. Serverbestätigter Ablauf und normaler Ablauf erlauben Neustart ohne Reload; bei weiterhin unbekannter Startantwort ist nach 140 Sekunden expliziter lokaler Neustart möglich. Ein später Serverrequest überschreibt keinen aktiven Claim und scheitert spätestens am alten Setupcode. Serverzeit bleibt maßgeblich.
- Bestätigungs-Audit mit Akteur/Scope/Namen/Credentialversion/Zeit/Assignmentreferenz bleibt ohne TTL erhalten. Alte globale Fehlerfelder werden nicht mehr als Sperre verwendet. Kein vollständiger Transferaudit behauptet.

## Exakte TFT-Zielnamen

Server UND Firmwareparsing akzeptieren druckbares ASCII U+0020–U+007E und **ÄÖÜäöü**, höchstens **64 UTF-8-Byte**, nichtleer, ohne führendes/nachlaufendes Leerzeichen. Keine stille Normalisierung, Kürzung oder Ersetzung. `ß` ausgeschlossen, weil der bisherige Renderer es in `ss` umsetzt. Andere Akzente, kombinierende Zeichen, Emoji, CJK, Steuer-/Bidi-/Zero-Width-Zeichen und ungültiges UTF-8 ausgeschlossen. Fehler `claim_name_unsupported`, keine Stammdatenänderung. ASCII-Sonderzeichen, Umlaute und Längengrenzen in beiden Implementierungen getestet.

## Pflichtgate: Datenbank-Indizes

| Collection | vollständiger Unique-Schlüssel |
| --- | --- |
| device_claims | deviceId: 1 |
| device_claims | claimId: 1 |
| device_claim_attempts | deviceId: 1, merchantId: 1 |

Nicht sparse/partiell, einfache Collation. Claimmodelle setzen `autoCreate=false`, `autoIndex=false`: keine automatische produktive Anlage beim Appstart. Start UND Confirm prüfen rein lesend und scheitern ohne Indizes mit `503 claim_indexes_unavailable` vor einer Transaktion. Alte 0.3.11-Polls bleiben davon unabhängig. Nur additive Claim-/Budgetdaten und gesondert freizugebende DDL, keine Migration bestehender Geräte/Credentials/Bindings.

Wiederholbare Prüfung im geschützten Backendprozess: `QR2BUY_CLAIM_INDEX_CHECK=true node src/scripts/verifyDeviceClaimIndexes.js`. Verbindung nur aus bestehendem `MONGO_URL`/`MONGODB_URI`; keine .env-Datei laden. **Nur listIndexes, kein Modellimport/createIndexes/syncIndexes oder Datenmutation.** Ausgabe `{ok, missing}` oder generischer Fehler; Exit 0 ausschließlich bei PASS. Fehlende Collection, ungeeigneter Index oder nicht sicher prüfbare Konfiguration ist **Deploymentblocker**. Hier ausschließlich gegen Loopback-Testdatenbank ausgeführt; produktive Prüfung/Indexänderung noch nicht freigegeben oder erledigt.

## Konkreter Rollback

Lokaler Branch **`rollback/p01-firmware-0312`**, Commit **`6d13148e08b3c63c3e4668b559c9f466eaa4cce8`**. Basis `502d5391d61b306f34c242d2b372c173dfc7bb2d`, exakt zwei Backenddateien verändert: `binding.js` und `deviceService.js`, zusätzliche 0.3.12-Freigaben für Produktbinding/PAUSED/Notify. Keine Claim-/Setup-APIs oder Claim-UI im Ziel. 0.3.11 unverändert unterstützt. **502d539 allein ist kein vollständiges 0.3.12-Rollbackziel.**

Artefakte im Arbeitsbranch: `backend/rollback/p01-firmware-0312.patch` und `.json` mit Basis/Ziel/exaktem Git-Baum/Patchhash. Patch UTF-8 mit kanonischem LF, CRLF beim Lesen normalisiert, Anwendung mit `--unidiff-zero`; damit reproduzierbar unter Windows und Linux. Automatisierter Test rekonstruiert mit separatem ignoriertem Git-Index den gesamten exakten Rollbackbaum, auch ohne gefetchten Rollbackbranch, und erlaubt nur die zwei vorgesehenen Änderungen. Tatsächlicher Rollback-Device-Service wird für CS5/NOCS, 0.3.11/0.3.12, READY/RESERVED/OUT_OF_STOCK/SOLD/PAUSED/CHECKOUT_STARTED/PAID, Notify an/aus gegen aktuellen Service geprüft. Auth und neutrale PROVISIONED-Projektion ebenfalls geprüft; Bindingquelle bytegleich zur getesteten aktuellen Quelle. Kein Rollback veröffentlicht/ausgeführt.

Später, jeweils separat freigegeben: ENV/Indizes lesend prüfen; fehlende DDL nur nach eigener Freigabe; Rollbackartefakte bereitstellen; Backend veröffentlichen und reale 0.3.11-Geräte kontrollieren, dann Frontend. Erst danach ausschließlich P3 mit aktuellem Port/MAC, frischem Buildcommit/-hash und unverändertem Credential für gesondert autorisierten Flash auswählen. **Ältere 0.3.12-Kandidaten aus 472a11a zeigen keinen Setupcode und dürfen nicht verwendet werden.** Neue Setup-/Zielnamen-/TTL-/Offline-/Neutralanzeige physisch abnehmen, Codes nur vom Nutzer bestätigen. Keine Produktbindung.

Rollback: zuerst Claim-UI zurücknehmen, laufende/unklare Requests kontrolliert auswerten, gegebenenfalls 120-Sekunden-TTL abwarten; Backend auf **6d13148**. Keine DB-Rücksetzung: bestätigte Assignments, Identitäten/Credentials, Budgets/Audits erhalten. Gebundene Geräte funktionieren weiter, neutrale Geräte zeigen wieder neutral statt Setup. Kein automatischer Firmware-Downgrade, Flash, Pepperwechsel oder manuelles Rückgängigmachen einer Zuordnung.

## Nachweise und verbleibende Grenzen

Finale Ergebniszahlen im neuesten Reviewfix-Checkpoint der Source of Truth. Drei Angriffszyklen, Legacy-Replay, Race/Idempotenz/Rotation/Rollback, Indexausfall und tatsächlicher Prüf-CLI gegen isoliertes Mongo getestet. Browser-Negativtests: Ablehnung, verlorener Start/Ablauf, Timeout, verlorene Bestätigung, Ablauf und unbekannter Neustart ohne Reload. Echter C++-Parser und Offlineablaufvertrag, bisherige QR-/PAID-/Produktpreview-Regression und drei Merchant-Builds geprüft.

**Keine Deployment-/Flash-/Erstzuordnungsfreigabe.** Reale Geräte weiterhin 0.3.11, P3 laut letztem Produktivcheckpoint PROVISIONED/ungebunden, Credential v1 ACTIVE. Keine neuen Livebehauptungen. P1/P2/Credentials/Bindings unverändert. Globale Transfer-/Release-/Unbind-/Alt-QR-/Commerce-Anforderungen bleiben offen. Neue Screens und manuelle 32-Zeichen-Eingabe sind noch physisch abzunehmen; automatisierte Tests ersetzen dies nicht.


## P0.1 ? URL-Log-Redaktion abgesichert (15. Oktober 2026)

Lokaler Folgefix zu e414e3e auf wip/p3-merchant-integration; ausschlie?lich Logging, keine ?nderung am Claim-Protokoll oder an Device-APIs. Die zentrale sanitizeRequestUrl-Funktion verwirft s?mtliche Querystrings/Fragmente und protokolliert ausschlie?lich bekannte statische Pfade oder redigierte Routenfamilien. Gro?-/Kleinschreibung, mehrfaches URL-Encoding, wiederholte Slashes, unbekannte dynamische Pfade, Dot-Segmente und ung?ltiges Encoding werden normalisiert oder geschlossen redigiert. Diagnosefelder HTTP-Methode, Status, bekannte Route/Routenfamilie und Remote-Adresse bleiben erhalten; unbekannte Pfade erscheinen als /[REDACTED]. Neue statische Diagnoserouten m?ssen ausdr?cklich in die Positivliste aufgenommen werden.

HTTP-Logger serialisiert keine rohen Exception-Texte/Stacks; auch der generische HTTP-Fehlerhandler und der Checkout-Verifikationslogger geben keine potentiell URL-/Credential-haltigen Exception-Details mehr aus. Request-Bodies werden weiterhin nicht protokolliert. Synthetische Regression pr?ft den best?tigten Gro?schreibungsfehler, kodierte Pfade/Werte, unbekannte Pfade, Querywerte und Fehlerantworten ?ber den tats?chlichen Pino-HTTP-Serializer sowie den produktiven Fehlerhandler. Keine echten Secrets verwendet.

Gezielte Backend-/Claim-/Device-/Mongo-/Rollbacktests: 38/38 PASS; erweiterter Loggingtest separat PASS. Vollst?ndige Backendregression (`npm test -- --test-reporter=dot`): PASS, Exit 0, einschlie?lich Commerce-/Portalregression gegen isolierte Testdatenbanken. Keine produktiven Zugriffe, Ger?te-/Credential-/Binding?nderungen, kein Flash, Push oder Deployment. Dieser Fix erteilt keine Deploymentfreigabe: die im letzten lesenden Review festgestellten drei fehlenden Claim-Unique-Indizes bleiben Blocker; neue 0.3.12-TFT-Screens bleiben physisch abzunehmen. Rollbackziel 6d13148 enth?lt diesen neuen Loggingfix nicht; dessen separate Absicherung ist vor einer sp?teren Verwendung zu bewerten, hier unver?ndert belassen.


## P0.1 - Produktive Claim-Unique-Indizes angelegt (15. Oktober 2026)

Explizit vom Nutzer freigegebene DDL am 15.10.2026, abgeschlossen 12:17:41 UTC (14:17:41 Europe/Berlin). Ausgangsbranch wip/p3-merchant-integration, Codecommit 805411608263c01d5a9edc5900c41a41a7b745a8. Ziel vor Eingriff eindeutig bestaetigt: DigitalOcean-App 98a0580a-65ee-4e45-b929-3617463966d2, Komponente qr2buy-backend, aktives Deployment 6e265a0c-e589-4321-a0e7-b14547115064, produktiver Backendcommit 502d5391d61b306f34c242d2b372c173dfc7bb2d, Produktions-Origin und Backend-Quelldateihash sowie alle drei bekannten Geraeteidentitaeten korrekt. Ausschliesslich bestehende Mongo-Konfiguration im geschuetzten Backendprozess verwendet; keine Secrets ausgegeben oder gespeichert.

Preflight unmittelbar vor der ersten und erneut vor jeder einzelnen Indexanlage: device_claims und device_claim_attempts initial nicht vorhanden, je 0 Dokumente, fehlende/null Indexfelder und Duplikatgruppen jeweils 0, keine vorhandenen kollidierenden Indizes oder Collectionoptionen. Keine Bereinigung erforderlich.

Produktiv erfolgreich angelegt und per listIndexes exakt nachgeprueft:
- device_claims: {deviceId:1}, Name deviceId_1.
- device_claims: {claimId:1}, Name claimId_1.
- device_claim_attempts: {deviceId:1,merchantId:1}, Name deviceId_1_merchantId_1.

Alle drei unique:true, binaere simple-Collation, nicht sparse, kein partialFilterExpression, kein TTL, nicht hidden. Durch Indexanlage entstanden die beiden Collections mit den normalen automatischen _id_-Indizes; keine separate Collection-DDL und keine Testdokumente. Anschliessend beide Collections weiterhin 0 Dokumente. Verifikation mit unveraendertem Quellcode von verifyDeviceClaimIndexes.js und claimIndexes.js aus 8054116: main() in separatem Node-Prozess mit QR2BUY_CLAIM_INDEX_CHECK=true, Module nur im Arbeitsspeicher und bestehende Laufzeitkonfiguration verwendet; Ergebnis {ok:true,missing:[]}, Exit 0. Keine Backenddateien produktiv abgelegt oder deployed.

Bestandsschutz: Vorher-/Nachher-Hashes und Dokumentzahlen aller 20 erfassten bestehenden Collections identisch, bei managed_devices ausschliesslich regulaere lastSeenAt/updatedAt-Heartbeat-Zeitstempel ausgenommen. Insbesondere Geraeteregistrierungen, Credentials, Merchant-/DisplayAssignments, Previews, Produkte, Offers, Bestaende, Reservierungen und Bestellungen unveraendert. Device 1/2 weiterhin ACTIVE, Device 3 PROVISIONED ohne Merchant-/Produktbindung, alle drei Credential v1 ACTIVE. Die eigene Mongo-Befehlsueberwachung erfasste ausschliesslich drei createIndexes-Schreibbefehle fuer die freigegebenen Ziele, keine Dokumentmutation. Kein Stripe-Aufruf, Flash, Assignment, Push, Merge oder Deployment.

Der bisherige Blocker fehlender Claim-Unique-Indizes ist damit BEHOBEN; aeltere Checkpoints beschreiben den historischen Zustand. Keine pauschale Deploymentfreigabe: Loggingfix 8054116 ist lokal, noch nicht deployed; das 0.3.12-kompatible Rollbackziel 6d13148 muss vor Verwendung um den Loggingfix ergaenzt und erneut getestet werden (separater Auftrag). Finaler Release-/Rollback-Review bleibt erforderlich. Neue 0.3.12-Setup-/Bestaetigungsscreens und physische Erstzuordnung sind weiterhin nicht abgenommen; produktiver Firmwarestand der Geraete wurde nicht geaendert.
