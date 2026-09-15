# qr2buy.com – operativer Projektkontext

Stand: 15. September 2026. Dieses Dokument ist die operative Source of Truth für den aktuellen qr2buy-Projektstand.

### P0.3.6 – Pilot-UX und öffentlicher Händlerzugang (15. September 2026)

Dieser Abschnitt hat Vorrang vor den historischen UX-offen-Angaben weiter unten. Web-Änderungen sind getestet, committed, gepusht und produktiv ausgerollt. **Kein Flash, keine produktiven Preview-/Binding-/Assignment-Änderungen.**

- **Interne ID aus normaler UX entfernt:** Ursache war die ungefilterte Ausgabe aller Address-Werte einschließlich Mongo-Subdokument-ID. Geschäfts- und Standortadressen zeigen nur fachliche Adressfelder; Datenmodelle bleiben unverändert.
- **Länderauswahl:** Dropdown mit 249 ISO-alpha-2-Werten und lokalisierten DE-/EN-Ländernamen; bekannte bestehende Codes werden normalisiert, unbekannte Altwerte als Option erhalten. Speicherung weiterhin ISO-Code, keine Maps-/Geocoding-Abhängigkeit.
- **Bestand 0:** Merchant-Firmware 0.3.6 zeigt „Momentan ausverkauft“ und „Dieses Produkt ist derzeit nicht verfuegbar.“ ohne Buyer-QR. Öffentliche Produktseite kommuniziert vorübergehende Nichtverfügbarkeit. Aktiver Bestand >0 bleibt unverändert.
- **Offer active=false:** Neue Firmware zeigt „Angebot pausiert“, Produktbindung bleibt ACTIVE/assigned=true, kein QR. Backend unterscheidet dafür PAUSED ausschließlich für die explizit unterstützte Firmware 0.3.6; alte/ unbekannte Versionen behalten den bisherigen sicheren assigned=false-Fallback. Portal behält das gebundene Produkt und kennzeichnet das pausierte Angebot. Öffentliche pausierte Offers bleiben unveröffentlicht (404). active=true stellt die normale Darstellung wieder her. Binding unterstützt 0.3.4 und 0.3.6; keine automatische Aktivierung bestehender Zuordnungen.
- **Öffentliche Frontpage:** Primärer Händlerregistrierungs-CTA, sekundärer Login, Login im Header und kurzer Händlerabschnitt; DE/EN, bestehende Demo-Navigation erhalten. Texte, Metadaten und Käuferfluss erklären die tatsächlich verfügbare Produkt-/Preis-/Bestandssynchronisierung. Merchant-Checkout, echte Reservierungen, Stripe Connect und Auszahlungen sind weiterhin nicht implementiert; Sandbox-Demo klar getrennt.
- **Tests:** Frontend 54/54, Backend 122/122 (einschließlich Mongo-Integration), Browser/E2E 28/28, Firmware 25/25 einschließlich kompiliertem Host-Parser; keine Skips. ESLint, Frontendbuild, CS5- und NOCS-Merchant-Build erfolgreich. Browserfälle DE/EN bei 320/375/390/430 CSS-Pixeln: Registrierung/Login, private IDs, Länderwerte/Speicherung, Portal und Buyer-Zustände. Neue Tests laufen mit isolierten Daten/Mocks, keine produktiven Zustandswechsel. Zusätzlich sichtbare Chrome-Prüfung der DE-/EN-Frontpage. Vorhandene Ablauf-/Retry-Regressionstests aus der vorherigen Untersuchung bleiben erhalten und sind im vollständigen Teststand enthalten.
- **Firmware-Flash offen:** Beide Geräte benötigen für die neuen physischen Texte später Firmware **0.3.6**: Schild 1 / QR2B-000001, CS5, COM3; Schild 2 / QR2B-000002, NOCS / CS=-1, zuletzt eindeutig COM5. Vor jedem separat freigegebenen Flash Ports erneut prüfen und explizit setzen; ein älterer NOCS-Konfigurationsport ist kein Uploadziel. Keine Credentials-/Identitätsänderungen. Standardbuild DE; EN-Texte über `QR2BUY_DISPLAY_LANGUAGE_EN`, keine dynamische Portal-Sprachumschaltung am Schild. Physische Darstellung von 0.3.6 noch nicht abgenommen.
- **Vor Rollout nur lesend geprüft:** Beide Geräte weiterhin ACTIVE und Firmware 0.3.4; beide DisplayAssignments ACTIVE/verifiziert/unbeendet; Offer unverändert **31,90 EUR / Bestand 5 / active=true**. Letzte gelesene Heartbeats 10:12:38Z bzw. 10:12:10Z; Onlinezustand zum späteren Prüfzeitpunkt separat bewerten. Keine Device-Config-GETs mit Heartbeat-Schreibwirkung.
- **Nächster Meilenstein:** Pilot-Review der Web-UX; danach separat autorisierter gezielter Firmware-Flash und physische Abnahme der beiden Verfügbarkeitszustände. Noch kein Commerce-Ausbau.

#### Verifizierter Rollout und Live-Smoke, ca. 12:16 MESZ

- Funktionscommit **`97ac18a9ac970889d3ee19c10495da979005a1e7`** auf main gepusht. DigitalOcean-App `98a0580a-65ee-4e45-b929-3617463966d2`, Deployment **`0bc9048c-54b7-4d41-9ab1-468b2529797e` ACTIVE**, Backend/Frontend beide auf diesem Commit, alle 7 Schritte erfolgreich. Dieser nachfolgende Dokumentationscommit enthält keinen Funktionscode; sein gegebenenfalls automatisch ausgelöster Rollout wird bis zum Abschluss überwacht.
- Health, DE-/EN-Frontpage, Login, Registrierung und öffentliche Offer-API HTTP 200. Produktiv ausgeliefertes Frontendbundle `index-DxJOde9I.js` entspricht dem lokal geprüften Build. Chrome zeigt die neuen Händler-CTAs und die Abgrenzung zur Sandbox in beiden Sprachen.
- Angemeldetes echtes Portal zeigt „Mein Geschäft“ ohne interne ID. Länder-Dropdown produktiv lesend geöffnet: 249 Länder plus Leerauswahl, AT = Österreich; bestehender leerer Geschäftswert unverändert. Formular ohne Speichern abgebrochen. Kein produktives PATCH/Offer-Update oder neuer Account.
- Beide Schilder im neu geladenen Portal **Online / Aktiv / Firmware 0.3.4**, gleiches Produkt, **31,90 EUR / Bestand 5**. Letzte sichtbare Kontakte 12:15:44 bzw. 12:15:16 MESZ. Vorher-/Nachher-Vergleich: MerchantAssignments, DisplayAssignments und Offer vollständig identisch; bei Device-Dokumenten ausschließlich reguläre lastSeenAt-/updatedAt-Heartbeat-Fortschreibung. Kein direkter Config-GET durch den Agenten.
- Öffentliche Buyer-Seite im Chrome: **Testprodukt qr2buy / 31,90 EUR / Verfügbar**, Kauf und Reservierung ausdrücklich nicht freigeschaltet. Keine Live-Bestands-/Pausierungswechsel zu Testzwecken durchgeführt.
- **Bereit für Pilot-Review: ja, Web-UX.** Vollständige physische Abnahme der neuen Texte erfordert den später separat freigegebenen Flash beider Geräte auf 0.3.6. Bekannter moderater Frontend-Dev-Abhängigkeitsbefund aus dem vorherigen Stand bleibt separat offen; keine Dependency- oder Security-Einstellungen in diesem Schritt verändert.

### Manuelle Live-Abnahme abgeschlossen – produktiver Endzustand (15. September 2026)

Die manuelle Live-Abnahme des realen Merchant-/Standort-/Produkt-/Binding-Flows mit beiden physischen Schildern ist vom Nutzer erfolgreich bestätigt. Die nachfolgende Prüfung erfolgte ausschließlich lesend über das angemeldete Händlerportal, interne Merchant-GETs und die öffentliche Buyer-Seite/API. Keine Funktionalität, Assignments oder produktiven Daten geändert; kein Preview-Start, Binding, Deploy oder Flash in diesem Dokumentationsauftrag.

**Aktueller Endzustand hat Vorrang vor den historischen PENDING-/assigned=false-/Abnahme-offen-Angaben weiter unten.** Die zuvor fehlende Browserverbindung ist wieder verfügbar. Der frühere Wiederholungsfehler ist aktuell kein Abnahmeblocker mehr; seine damalige technische Ursache und ein spezifischer Funktionsfix sind damit nicht nachgewiesen.

#### Lesend verifizierter Endzustand, ca. 11:59 MESZ

- Reales angemeldetes Händlerportal: **ecily.com**, Standort **ecily - webentwicklung**. Öffentliches Angebot bestätigt denselben Merchant, Standort und das Produkt **Testprodukt qr2buy**.
- **QR2B-000001 / Schild 1:** Device status=ACTIVE, Firmware **0.3.4**, online. Gelesener Hardware-Heartbeat **2026-09-15T09:59:11.268Z**. DisplayAssignment ACTIVE, verifiedAt **2026-09-15T09:22:07.789Z**, endedAt=null.
- **QR2B-000002 / Schild 2:** Device status=ACTIVE, Firmware **0.3.4**, online. Gelesener Hardware-Heartbeat **2026-09-15T09:58:33.971Z**. DisplayAssignment ACTIVE, verifiedAt **2026-09-15T09:54:38.397Z**, endedAt=null.
- Beide bestätigten DisplayAssignments referenzieren dasselbe Produkt `72ffd96c-972b-4bd3-a3df-f670d8ca6c06` und Offer `9c0d9bc4-029f-4728-8119-c2249194b3bd`. Portal zeigt bei beiden **Aktiv**, dasselbe Produkt, denselben Preis und Bestand 5. Beide **assigned=true** laut manueller Hardware-Abnahme, gestützt durch die aktuellen ACTIVE-Zuordnungen und gültige Produkt-/Offer-Projektion. Kein direkter Device-Config-GET, da dieser Heartbeat-Schreibwirkung hätte; daher keine Behauptung eines separat gelesenen rohen assigned-Felds.
- **Preisabweichung ausdrücklich festgehalten:** Nutzerzusammenfassung nennt **22,90 EUR**. Tatsächlich produktiv gelesen wurden **31,90 EUR (priceMinor=3190), EUR, Bestand 5, active=true** – übereinstimmend im neu geladenen Produktportal, bei beiden Schildern, in der internen Offer-API und auf der öffentlichen Buyer-Seite/API. Keine eigenmächtige Preiskorrektur. 22,90 EUR ist damit kein verifizierter aktueller Endpreis.
- Buyer-Seite **https://qr2buy.com/o/1b4f57d6dec9f6b5705de678fe75b847** und zugehörige öffentliche Offer-API: **HTTP 200**. Reale Browseransicht zeigt **Testprodukt qr2buy**, **31,90 EUR**, **Verfügbar**. Öffentliche API bestätigt Bestand 5. Online-Kauf und Reservierung werden weiterhin ausdrücklich als noch nicht freigeschaltet angezeigt.

#### Vom Nutzer manuell erfolgreich abgenommen

- Reales Händlerkonto und realer Standort funktionieren; Testprodukt und Offer aktiv.
- Beide physischen Displays laufen mit Firmware 0.3.4, sind ACTIVE/assigned=true und zeigen dasselbe Produkt und denselben Preis. Damit ist auch die nach dem COM5-Flash zunächst offene physische Displayabnahme von Schild 2 abgeschlossen.
- Preisänderungen im Händlerportal aktualisieren beide Displays; Buyer-QR funktioniert und öffentliche Buyer-Seite zeigt denselben Preis.
- Bestand **5 → 4** aktualisiert das Display live; **0** führt zum Nicht-verfügbar-/Ausverkauft-Zustand; **>0** reaktiviert Display und Buyer-Seite.
- **Offer active=false** deaktiviert das Angebot; **active=true** reaktiviert es.
- Diese Zustandswechsel wurden vom Nutzer durchgeführt und bestätigt. Im Dokumentationsauftrag wurden sie nicht erneut ausgelöst. Keine Zahlungs-/Checkout-Abnahme aus diesen Ergebnissen ableiten.

#### Offene UX-Punkte – dokumentiert, nicht umgesetzt

1. Bei Bestand 0 sind **„VERKAUFT“ / „Der QR-Code ist jetzt deaktiviert“** funktional korrekt, aber zu technisch/negativ. Käuferverständliche Verfügbarkeitskommunikation über Display und Buyer-Seite ausarbeiten.
2. Bei **active=false** zeigt das Display **„Kein Produkt zugewiesen“**, obwohl die Bindung fortbesteht. Gewünschte Unterscheidung: **„Angebot pausiert“** statt unzugeordnet; pausiert, ausverkauft und ungebunden getrennt darstellen.
3. Interne **Merchant-ID** war unter **„Mein Geschäft“** sichtbar; aus der normalen Händler-UX entfernen, technische Diagnose bei Bedarf separat halten.
4. Technische Ländercode-Eingabe wie **AT** später durch Länder-Dropdown mit sauberer Normalisierung verbessern.

**Nächster empfohlener Produktmeilenstein:** Händler-/Buyer-/Display-UX für einen kleinen realen Pilotbetrieb abschließen: die vier UX-Befunde priorisiert beheben und die bestehende Zwei-Schild-Journey erneut manuell abnehmen. Danach Merchant-Checkout/Reservierung als eigenen, gesondert spezifizierten Meilenstein planen; die bestehende Buyer-Seite ist noch eine lesende Angebotsseite.

#### Hardwarestand und Arbeitsgrenzen

- Schild 1 bleibt CS5/Rotation 1, COM3. Schild 2 ist NOCS/CS=-1/Rotation 3; aktuelle USB-Zuordnung **COM5** durch Absteckvergleich und MAC **ec:e3:34:b2:b5:f8** bestätigt. Historische COM4-Angaben und der lokale NOCS-Standardport gelten nicht als aktuelles Uploadziel.
- Vorangegangener separat autorisierter Schild-2-Flash: **24/24 Firmwaretests**, NOCS-Build SUCCESS, explizit **--upload-port COM5**, Upload mit Hashverifikation erfolgreich. Credential-Datei unverändert; COM3 unberührt. Nachfolgende Aktivierung beider Schilder erfolgte manuell durch den Nutzer.
- Dieser Auftrag verändert ausschließlich dieses Kontextdokument. Vorhandene lokale Teständerungen bleiben erhalten. Keine Veröffentlichung oder weitere Hardware-/Binding-Aktion beauftragt.

### Historie: Binding-Wiederholungsfehler – damalige Untersuchung (14. September 2026)

Nutzer meldet einen fehlgeschlagenen erneuten Preview-Start auf `https://qr2buy.com/binding/QR2B-000001` gegen 18:15 MESZ. Ursache noch nicht belegt; kein Fix/Deploy und keine produktive Preview oder Aktivierung durch diese Untersuchung.

- Backend-Runtime-Logs: Preview-POSTs um 18:05:50 und 18:09:12 MESZ beide HTTP 200. Im Zeitraum 18:12–18:20 nur erfolgreiche Binding-/Session-GETs um 18:12:33, kein weiterer Preview-POST. Seit 18:00 keine protokollierten HTTP-Fehler oder Duplicate-Key-Hinweise. Status/Response des beobachteten Fehlers unbekannt; Browser-/Gatewayfehler nicht ausgeschlossen.
- Lesender DB-Abgleich um 18:21 MESZ: Schild 1 beim realen Merchant ACTIVE/PILOT; reales DisplayAssignment PENDING, verifiedAt=null, kein ACTIVE DisplayAssignment, somit assigned=false. Preview status=PREVIEW, updatedAt=18:09:12, expiresAt=18:11:12, attempts=0, confirmedAt=null. Keine gültige Preview. Firmware 0.3.4, letzter Hardware-Heartbeat 18:20:47. Demo-DisplayAssignment ENDED.
- Explizit erweiterter lokaler Mongo-Regressionstest: Ablauf und Wiederholung für dasselbe Device/Produkt ohne Cleanup erfolgreich, neue Preview-ID/Nonce, alte Preview-ID/Code abgewiesen, Merchant-Isolation, weiterhin assigned=false/PENDING und keine Aktivierung. Binding-Integration **19/19 grün gegen unveränderten Anwendungscode**. Der gespeicherte abgelaufene PREVIEW-Zustand blockiert diesen Test nicht; dies belegt noch keine behobene Live-Ursache.
- UI bildet auch Netzwerk-/JSON-/Sessionfehler auf denselben generischen Text ab. Für den gezielten Fix fehlt die konkrete Browserfehlermeldung bzw. fehlgeschlagene Anfrage. Bestehender Nutzerbrowser bisher nicht verbunden. Kein neuer produktiver Preview-Start zur Reproduktion. Fixauftrag und Hardware-Abnahme offen.
- Erneuter lesender Abgleich am 14.09. um **18:30:50 MESZ**: derselbe reale PENDING-Datensatz `6aa81b5e86af3dc50cf6fa82`, verifiedAt=null; kein ACTIVE DisplayAssignment und weiterhin assigned=false. Preview `6aa81b5e6cd9bb1e972aa49e` unverändert abgelaufen, attempts=0/confirmedAt=null. Hardware-Heartbeat 18:30:04, Firmware 0.3.4. Produktive Preview-Indizes ausschließlich `_id` und unique deviceId, kein TTL-Löschindex; Ablauf wird logisch geprüft, Start ersetzt denselben Datensatz transaktional. Display-Unique-Constraint gilt nur für ACTIVE. Kein manueller Cleanup nötig, um den lokalen Ablauf zu wiederholen.
- Zusätzlich echter Händler-HTTP-/Mongo-Sessiontest in `backend/test/merchantPortal.integration.test.js`: Preview 1 → Ablauf mit injizierter Uhr → 409 preview_expired → Portal-/Session-/Binding-GETs → Preview 2 HTTP 200. Neuer Preview-Identifier/Nonce, alte Preview-Bestätigung 404, fremder Merchant 404, fehlendes CSRF/fremde Origin 403; weiterhin genau ein PENDING/verifiedAt=null und assigned=false. Separater Browserregressionstest in `frontend/e2e/merchant.spec.js` prüft Ablauf/Retry und Seiten-Neuladen/Retry ohne Aktivierung mit isolierten API-Antworten. **Beide neuen Tests bestehen gegen unveränderten Anwendungscode**, daher kein Nachweis eines behobenen Livefehlers.
- Vollständige lokale Prüfung dieses Untersuchungsstands: Backend **120/120**, Frontend **52/52**, Browser **20/20**, keine Skips; ESLint, Frontendbuild und git diff --check grün. Backend npm audit 0; Frontend weiterhin ein bekannter moderater Dev-Befund `@humanfs/node`. Firmwarevertrag unverändert, kein erneuter Firmwarelauf oder Flash. Nutzerbrowser-Verbindung erneut geprüft, Browserliste leer. Runtime-Logs erneut nur zwei erfolgreiche Preview-POSTs; kein protokollierter fehlgeschlagener Wiederholungs-POST, keine Conflict-/Replay-/Duplicate-Key-Hinweise. Response-Bodies werden vom Logger nicht erfasst; beobachteter Fehlerstatus/-body weiter unbekannt.
- Kein Funktionsfix, Commit, Push oder Deployment in dieser Fortsetzung. Bestehendes Deployment `d84dacbf-c896-44b6-a02f-fb27bb409bdf` ACTIVE, Backend/Frontend beide `71b1b90ffab16933413bbf2ff51f45cd8dc27a63`, Health HTTP 200. Nur lokale Tests und Kontext ergänzt. **Fixabnahme noch nicht bereit**; Fortsetzung benötigt die fehlgeschlagene Browseranfrage oder eine verbundene Browseransicht des Fehlers, ohne Secret-/Cookie-/Challenge-Ausgabe.

### Pilotgeräte zum realen Merchant reassigned (14. September 2026)

Aktuelle Nutzerentscheidung: **keine Multi-Merchant-Membership im MVP**. Account und Merchant-Bezug bleiben unverändert. Beide vorhandenen Geräte sind jetzt dem realen Merchant `abd5bc60-76bb-40a6-a3b9-19983254485b` / „ecily.com“ und dessen ACTIVE Location `19b9930f-41bd-4a69-bfed-56d1ccb0bfeb` / „ecily - webentwicklung“ zugeordnet.

- Produktiv erfolgreich am **14.09.2026 15:53:38.937 UTC** in **einer gemeinsamen Snapshot-/Majority-Transaktion** für beide Geräte. Bestehender `createMerchantDomainService().assignDeviceToMerchant` mit gemeinsamem injiziertem Transaction-Runner genutzt; alte PENDING-DisplayAssignments zusätzlich innerhalb derselben Transaktion beendet. Feste Quell-/Ziel-IDs, vollständiger Vorabgleich und transaktionsinterne Integritätsprüfungen; kein halbfertiger Einzelgerätewechsel.
- Schild 1 / QR2B-000001: altes MerchantAssignment `6a9eaec8e6e4edd02e00a644` ENDED; neues `6aa8188382faae2d4f3fa03d` ACTIVE/PILOT beim realen Merchant/Standort. Schild 2 / QR2B-000002: altes `6a9eaec8e6e4edd02e00a646` ENDED; neues `6aa8188482faae2d4f3fa047` ACTIVE/PILOT. Alte validUntil und neue validFrom entsprechen demselben Wechselzeitpunkt, neue validUntil=null. Genau vier historische/aktuelle MerchantAssignments, keine doppelten ACTIVE-Zuordnungen.
- Alte DisplayAssignments `6a9eaec8e6e4edd02e00a654` / `6a9eaec8e6e4edd02e00a656` beide **ENDED**, endedAt zum Wechselzeitpunkt, verifiedAt weiterhin null. Keine neue DisplayAssignment, keine ACTIVE/PENDING-Displayzuordnung und keine Preview. Beide Geräte damit nach Device-Vertrag **assigned=false**; kein produktiver Device-Config-Abruf mit Heartbeat-Schreibwirkung.
- Dieselben zwei Device-Dokumente mit unveränderten Mongo-IDs, deviceId/hardwareUid, Namen, Firmware und Heartbeats. Ausschließlich die vom bestehenden Service vorgesehene interne bindingRevision wurde pro Gerät um 1 erhöht und updatedAt aktualisiert, um konkurrierende Bindings zu sperren. Credentials vollständig unverändert. Schild 1 Firmware 0.3.4, Schild 2 0.3.2; letzte Heartbeats weiterhin vom 12.09., beide offline.
- Reale und Demo-Merchants, Locations, Products/Offers, Accountdaten (ohne Passwort-Hash gelesen), Credentials und leere Preview-Collection vor/nach verglichen: unverändert. „Testprodukt qr2buy“, Offer 19,90 EUR / Bestand 5 sowie drei Demo-Produkte/Offers erhalten. Keine Account-Verknüpfung, Kopie, Löschung oder Credential-Rotation.
- Produktive interne Merchant-Lese-API HTTP 200: realer Merchant genau Schild 1/2 mit zwei ACTIVE/PILOT-Assignments; Demo-Merchant keine aktiven Devices/Assignments mehr. Derselbe `listDevices`-Service wie in der Portal-API liefert im realen Scope beide Geräte, online=false, assignmentStatus=NONE, product/offer=null; Demo-Scope leer.
- **Browser-/Portalprüfung mit dem bestehenden Nutzerlogin offen:** Browser-Verbindung und Browserliste geprüft, kein Browser verfügbar. Keine Session aus DB/Browser entnommen oder Login nachgebildet. Sichtbarkeit durch produktive Scope-/Projektionsprüfung sowie lokalen authentifizierten HTTP-Test belegt, nicht durch eine beobachtete reale Portalansicht. Nutzer kann `/merchant/devices` neu laden und beide Schilder manuell prüfen.
- Lokaler Probelauf gegen eigenes Mongo-Replikaset: absichtlicher Fehler nach erstem Gerätewechsel rollt sämtliche Collections zurück; gemeinsamer Wechsel, Historie, unveränderte Credentials, assigned=false, Scope-/Offline-Projektion und authentifizierte Merchant-API ohne Basic Auth bestätigt. Wiederholung vollständiger No-op. Relevante bestehende Merchant-/Device-/Portal-/Mongo-Tests **42/42**, keine Skips. Hilfsskripte/Testausgaben ausschließlich ignoriert; kein Anwendungscode geändert.

**Bereit für manuelle Portal-Abnahme: ja. Hardware-Abnahme weiterhin offen. STOP vor Einschalten, Flash, Preview, Product↔Device-Binding, Challenge-Bestätigung, DisplayAssignment-Aktivierung und Checkout.** Kein Commit/Push/Deploy in diesem Datenauftrag; Kontextkorrektur bleibt lokal.

### Owner-Linking – historischer Architektur-STOP, keine produktive Änderung (14. September 2026)

Aktueller Stand nach manueller Nutzerabnahme und ausschließlich lesender produktiver Prüfung: genau ein realer MerchantAccount vorhanden, accountId `b7c1a691-bd6f-43bd-ba15-ce412756a361`, ACTIVE/OWNER, erstellt 14.09.2026 15:22:41 UTC. Sein Merchant ist `abd5bc60-76bb-40a6-a3b9-19983254485b` / „ecily.com“, ACTIVE. Vorhanden sind die eigene ACTIVE Location „ecily - webentwicklung“, „Testprodukt qr2buy“ und ein aktives Offer mit priceMinor=1990 EUR / Bestand 5. Registrierung/Login/Logout und Isolation wurden vom Nutzer manuell bestätigt; die frühere Aussage „0 Accounts“ ist historisch.

**Owner-Linking zu merchant-demo-001 nicht durchgeführt.** Der explizit vorgegebene STOP-Fall liegt vor: MerchantAccount besitzt genau eine required/immutable merchantId, eine eindeutige E-Mail und keine zusätzliche Membership. Der Session-Guard verwendet ausschließlich account.merchantId. `linkMerchantOwner` erzeugt einen neuen Owner nur für eine bisher nicht verwendete E-Mail, ist für denselben bestehenden Scope idempotent und weist einen bestehenden Account mit anderem Merchant ausdrücklich als `account scope conflict` ab. Es ist kein Mechanismus für zusätzlichen Merchant-Zugriff und kein unterstützter Account-Wechsel. Das Skript wurde produktiv nicht aufgerufen; kein Passwort benötigt, gelesen oder gesetzt.

- ecily.com-Merchant, Location, Produkt und Offer unverändert erhalten; keine Kopie, Zusammenführung, Löschung oder Migration.
- merchant-demo-001 und location-demo-001 ACTIVE. Genau zwei ManagedDevices und zwei DeviceMerchantAssignments, beide ACTIVE/PILOT beim Demo-Merchant. Beide DisplayAssignments PENDING / verifiedAt=null; BindingPreview-Collection leer.
- Schild 1 Firmware 0.3.4, Schild 2 Firmware 0.3.2; letzte Heartbeats unverändert vom 12.09., beide offline. Keine Device-API-Abrufe mit Heartbeat-Schreibwirkung und kein Hardwarezugriff.
- Der reale Account erhält weiterhin keinen Zugriff auf Schild 1/2. Kein Portal-Smoke unter diesem Account durchgeführt; keine Session übernommen oder erzeugt. Die fehlende Sichtbarkeit folgt aus dem bestätigten Account-Scope und den DeviceMerchantAssignments.
- Nächster Schritt erfordert eine ausdrücklich beauftragte Architekturentscheidung: zusätzliche Merchant-Memberships mit gesichertem Scope-Wechsel, falls beide bestehenden Händlerbereiche mit demselben Account erreichbar bleiben sollen. Keine Umsetzung in diesem Auftrag; kein blindes Überschreiben der merchantId. Portal-/Hardware-Abnahme mit den Pilotgeräten bleibt blockiert.
- Relevante lokale Portal-/Auth-/Owner-Linking-/Device-/Mongo-Isolationstests erneut **31/31**, keine Skips; git diff --check grün. Produktive Backend-/Frontend-Commits weiterhin `71b1b90ffab16933413bbf2ff51f45cd8dc27a63`, ACTIVE. Ausschließlich dieses Kontextdokument lokal geändert; kein Commit/Push/Deploy im STOP-Schritt. Keine Passwörter, Hashes, Session-Tokens oder Credentials dokumentiert.

### P0.3.5 – produktiv ausgerollt, manuelle Nutzerabnahme offen (14. September 2026)

Dieser Abschnitt dokumentiert den Rollout vor der oben beschriebenen manuellen Registrierung. Der Nutzer hatte Commit/Push/Deployment einschließlich notwendiger Auth-/Session-Infrastruktur ausdrücklich freigegeben. Keine Händler-/Hardware-Abnahme durch den Agenten, keine produktive Registrierung oder Owner-Verknüpfung durch den Agenten, keine Produktbindung, kein Flash und kein Checkout.

- **Versionierung:** Feature-Commit `73ed4d57c2f85841df9413428db68a00e50a7aa7`, `feat(merchant): add merchant onboarding portal and session-based binding`, auf `main` committed/gepusht; Remote-HEAD bestätigt und Arbeitsbaum danach sauber. 25 ausschließlich klassifizierte P0.3.5-/Security-/Test-/Dokumentationsdateien. qs/body-parser sind Bestandteil genau dieses getesteten Diffs. Der nachfolgende reine Dokumentationscommit ändert keinen Funktionscode; dessen eigener Hash und finaler Deploymentstand werden im Abschlussbericht genannt.
- **Finale Prüfung vor Commit:** Backend 119/119, Frontend 52/52, Browser 19/19, Firmware 24/24 einschließlich Host-Parser; keine Skips. Backend-Syntax 40, Imports 35, ESLint, Frontendbuild, CS5-/NOCS-Builds und Backend npm audit (0 Findings) grün. Diff-/Secret-/Dateiprüfung ohne Befund; keine echten ENV-/Credential-Dateien oder Test-/Buildartefakte versioniert. `.env.example` enthält ausschließlich Konfigurationsnamen und Platzhalter.
- **DigitalOcean:** Deployment `8ee2361c-2a6e-4d37-8d6d-b5fd67101a33` ACTIVE, Backend und Frontend auf Feature-Commit `73ed4d5` bestätigt, beide Build-/Deploy-Schritte SUCCESS. Der zuvor automatisch durch Push gestartete Rollout wurde durch den Konfigurationsrollout ersetzt. Eigener zufälliger `MERCHANT_SESSION_SECRET` als Backend-SECRET mit RUN_TIME und `MERCHANT_PUBLIC_ORIGIN=https://qr2buy.com` ergänzt; übrige Spec/ENV einschließlich Stripe unverändert. Kein Account-Passwort gesetzt.
- **Live-Smoke:** Health, `/`, `/de`, `/en`, `/demo/p/bag`, `/merchant/login` und `/merchant/register` HTTP 200. Echter isolierter Headless-Edge-Aufruf zeigt Login-/Registrierungsformular; `/merchant/devices` führt ohne Session zu `/merchant/login` mit korrektem Return-Ziel. Keine Basic-Auth-Form und keine JavaScript-Seitenfehler. Geschützte Auth-/Merchant-GETs ohne Login HTTP 401, ohne WWW-Authenticate-Challenge. Marketing-Hardware-API weiterhin 200 / bound=false; keine DemoSession oder Stripe-Checkout angelegt.
- **Session/CSRF live:** anonyme CSRF-Session über mehrere HTTPS-Requests stabil, zugehöriger Mongo-Datensatz und TTL-Index bestätigt. Cookie `__Host-qr2buy-merchant` mit Secure, HttpOnly, SameSite=Lax, Path=/. Fehlendes CSRF-Token und fremde Origin beim Logout jeweils 403; gültiger anonymer Logout 200 und zugehöriger Session-Datensatz entfernt. Keine Authentifizierung als Händler. `merchant_accounts` und notwendige Unique-Indizes vorhanden, **0 Accounts**; Session-Store betriebsfähig.
- **Bestandsdaten:** SHA-256-Vergleich aller Dokumente vor/nach Rollout für merchants, merchant_locations, managed_devices, device_merchant_assignments, merchant_products, merchant_offers, display_assignments und device_credentials jeweils identisch. `merchant-demo-001` und `location-demo-001` ACTIVE; beide DeviceMerchantAssignments ACTIVE/PILOT; 3 Products, 3 Offers. Beide DisplayAssignments **PENDING**, verifiedAt=null; keine Aktivierung und keine Preview durch diesen Auftrag.
- **Geräte:** Schild 1 / QR2B-000001 weiterhin Firmware 0.3.4, letzter Heartbeat 12.09.2026 14:35:22.711 UTC; Schild 2 / QR2B-000002 weiterhin Firmware 0.3.2, letzter Heartbeat 12.09.2026 13:22:34.365 UTC. Beide zum Prüfzeitpunkt offline. Keine Merchant-Device-Config-Aufrufe, die Heartbeats künstlich aktualisieren, und keine COM-Port-Zugriffe.
- **Betrieb/Security:** geprüfte Backend-Runtime-Logs: ein Serverstart, Mongo verbunden, keine offensichtlichen Runtime-Errors/HTTP-500. qs 6.16.0 und body-parser 1.20.8 im erfolgreich gebauten und ausgerollten Lockfile; der Backend-Security-Fix ist damit produktiv. Bekannter Frontend-Dev-Befund bleibt separat dokumentiert.

**Bereit für manuelle Portal-Nutzerabnahme: ja.** Einstieg: https://qr2buy.com/merchant/register beziehungsweise https://qr2buy.com/merchant/login. Der Nutzer prüft Registrierung/Login/Logout, Dashboard, eigene Stammdaten/Standorte und Products/Offers selbst. Eine neue Registrierung erzeugt einen eigenen Merchant und erhält **nicht automatisch** Zugriff auf `merchant-demo-001` oder Schild 1/2. Für die spätere Pilot-Abnahme ist die explizite Owner-Verknüpfung mit der vom Nutzer bestimmten Account-Identität ein separater autorisierter Schritt. Hardware-/Binding-Abnahme bleibt offen; Schild 2 benötigt dafür außerdem später ein gesondert freigegebenes Firmware-Update. STOP vor Account-Linking, Assignment-Aktivierung, Flash und Checkout.

### P0.3.5 – historische lokale Stabilisierung, bereit für Review (14. September 2026)

Dieser Abschnitt dokumentiert die lokale Stabilisierung vor dem oben bestätigten Rollout. Damals kein Commit, Push, Deploy, produktiver DB-Zugriff, Owner-Linking, Assignment-Wechsel oder Flash; damaliger HEAD `6f86c6d366411452ab854660bdd9c2f8c4aefc2e`, bestehender Arbeitsbaum erhalten.

- Vorhandene Implementierung geprüft: MerchantAccount mit Argon2id, transaktionale Registrierung einschließlich Merchant/Location, Login/Logout mit rotierenden serverseitigen Mongo-Sessions, CSRF-/Origin-/JSON-Schutz und Merchant-Scope aus aktuellem Account. Production-Cookie Secure/HttpOnly/SameSite=Lax; normale Händler-Journey über Merchant-Session, Basic Auth ausschließlich interner Support-/Operatorpfad.
- Dashboard, Products/Offers mit Integer-priceMinor/numerischem Bestand und optionaler EAN, Devices/Rename/Offline-Projektion, Locations/Stammdaten sowie Binding über den unveränderten P0.3.4-Service lokal geprüft. Fremde Merchant-/Location-/Product-/Device-IDs werden gesperrt. Explizites Owner-Linking an bestehenden Merchant lokal idempotent geprüft; kein automatisches oder produktives Linking.
- Backendtest-Fix: jeder Portal-Subtest mit eigener zufälliger Loopback-Datenbank, eigenen Indizes/App/Session-Store/Clients und expliziten Fixtures; keine Abhängigkeit von vorherigen Testergebnissen. Argon2-Parameter reihenfolgeunabhängig und echtes Verify positiv/negativ geprüft. DELETE ohne CSRF erwartet korrekt 403, gültiger Request gegen nicht vorhandene DELETE-Route 404. Keine Security-Abschwächung.
- Browser-Fix: Standort-/Währungslabels explizit vom Select-Optionsinhalt getrennt und per htmlFor/ID verbunden. Danach freigelegte Test-Rennen durch Warten auf sichtbare Zielüberschrift, abgeschlossenen Speichervorgang und Aktivierungsbestätigung korrigiert. Keine Timeout-Erhöhung, Sleeps oder Skips.
- Finale Regression nach Fixblöcken: Backend **119/119**, davon Portal-Integration **14/14** einschließlich Parent; Frontend **52/52**; Browser **19/19** (11 Operator-/Binding- und acht Händler-Journeys, DE/EN bei 320/375/390/430 Pixeln); Firmware **24/24** einschließlich kompiliertem Host-Parser. Null fehlgeschlagene/übersprungene Tests. 40 Backend-Syntaxprüfungen, 35 Modulimporte, ESLint, Frontendbuild und CS5-/NOCS-Merchant-Builds grün.
- Backend npm audit **0 Findings**. qs **6.16.0**, body-parser **1.20.8**, Express **4.22.2** im bestehenden lokalen Diff erhalten; keine weiteren Paket-/Lockfile-Änderungen in dieser Stabilisierung. Noch nicht deployed, daher keine Behauptung eines produktiven qs-Fixes. Bekannter moderater Frontend-Dev-Befund in `@humanfs/node` bleibt außerhalb dieses Auftrags.
- Reviewgrenzen: Browser mit isolierten API-Antworten, Backend mit echter Mongo-/HTTP-/Session-Integration. Keine neue produktive HTTPS-/Smartphone-/TFT-Abnahme. Bestehende Beschränkungen (OWNER, Rate-Limits pro Prozess, immutable Offer-Standortidentität) bleiben; keine neue Funktionalität ergänzt.
- In diesem Auftrag geändert: Portal-Integrationstest, MerchantPortal.jsx, Händler-Browsertest, dieses Dokument und neuer [Stabilisierungsbericht](QR2BUY_P035_STABILIZATION.md) mit vollständiger Klassifikation der 24 Ausgangsdateien und Einzelursachen der acht Backendfehler.

**P0.3.5 lokal abnahmebereit: ja, für Review. Noch nicht produktiv. STOP vor Commit/Push/Deploy, produktivem Account-Linking, Assignment-Aktivierung und Flash.**

### Bestandsaudit 14. September 2026 – historischer Ausgangspunkt für P0.3.5

Dieser Abschnitt dokumentiert den Ausgangspunkt vor der oben bestätigten Stabilisierung. Damaliger Auftrag ausschließlich Audit und Kontextkorrektur: keine Implementierung, Testreparatur, produktive Mutation, Seeds, Account-Verknüpfung, Assignment-Wechsel, Firmware-Flash oder Veröffentlichung.

- **Git:** `main`, HEAD und per `git ls-remote` bestätigtes Remote-main sind `6f86c6d366411452ab854660bdd9c2f8c4aefc2e`. Arbeitsbaum nicht sauber: 12 modifizierte getrackte und 12 ungetrackte Dateien, nichts staged. Der qs-Fix und die nachfolgende P0.3.5-Implementierung liegen ausschließlich lokal. Dieser Audit ändert nur das Kontextdokument; bestehende Änderungen bleiben erhalten.
- **DigitalOcean:** App `qr-backend`, Deployment `46e4a033-7455-4ff9-901c-2a053ba987f9`, ACTIVE, erstellt 07.09.2026 20:08:04 UTC, aktualisiert 20:09:28 UTC; kein pending Deployment. Backend und Frontend verwenden beide den vollständigen HEAD-Hash oben. P0.3.4-Funktionsstand aus `01c23ff` ist darin enthalten. Health HTTP 200 mit `env=production`; `/`, `/de`, `/en`, `/demo/p/bag` und `/binding/QR2B-000001` HTTP 200. Beide permanenten `/device/QR2B-00000x`-Routen liefern 303 auf den jeweiligen Binding-Pfad.
- **Produktive DB-Zuordnung:** Mongo ausschließlich über den nativen Treiber gelesen, ohne Model-Initialisierung/Indexanlage. Die vollständigen Dokumente von Merchant, Location, beiden Devices, drei Products, drei Offers und beiden DisplayAssignments stimmen einschließlich Mongo-IDs mit den authentifizierten produktiven Merchant-Lese-APIs überein. DigitalOcean gibt die Mongo-ENV nur verschlüsselt zurück; kein Klartext-URI-Vergleich behauptet.
- **Merchant/Location:** `merchant-demo-001` / „qr2buy Demo Händler“ ACTIVE; `location-demo-001` / „Hauptstandort“ ACTIVE. Beide DeviceMerchantAssignments ACTIVE, PILOT, gültig seit 07.09.2026, ohne Enddatum, gleicher Merchant und Standort. Je Device existiert ein eigener Credential-Datensatz; Credentials wurden weder ausgegeben noch rotiert.
- **Schild 1:** `QR2B-000001`, „Schild 1“, ESP32_ILI9341_CS5, Gerätestatus ACTIVE, Firmware 0.3.4. Letzter Heartbeat **12.09.2026 14:35:22.711 UTC**; am Auditzeitpunkt **offline** nach der 120-Sekunden-Regel.
- **Schild 2:** `QR2B-000002`, „Schild 2“, ESP32_ILI9341_NOCS (CS=-1), Gerätestatus ACTIVE, Firmware 0.3.2. Letzter Heartbeat **12.09.2026 13:22:34.365 UTC**; am Auditzeitpunkt **offline**. Firmware 0.3.2 unterstützt den P0.3.4-Preview-Start noch nicht.
- **Zuordnungen:** Schild 1 → `product-demo-bag` / `offer-demo-bag`; Schild 2 → `product-demo-book` / `offer-demo-book`. Beide DisplayAssignments **PENDING**, `verifiedAt=null`, `endedAt=null`; keine ACTIVE-Zuordnung, BindingPreview-Collection leer. Damit nach dem produktiven Device-Vertrag beide **assigned=false**, aus DB und Code abgeleitet. Keine authentifizierten Merchant-Device-Config-Aufrufe, da diese selbst Heartbeats schreiben würden. Die beiden Heartbeats blieben zwischen 14:52:20 und 14:53:20 UTC unverändert.
- **Produkte/Offers:** drei ACTIVE MerchantProducts mit stabilen productBindingIds, EAN jeweils null. Drei aktive Offers, alle EUR, numerischer QR2BUY-Bestand, purchasable/reservable jeweils true: Ledertasche `priceMinor=12900`, Bestand 3; Stadtlichter `2490`, Bestand 2; Kunstdruck `39000`, Bestand 1. Die drei öffentlichen `/api/public/merchant-offers/:publicOfferId` liefern HTTP 200 mit identischen Preisen/Beständen und `checkoutAvailable=false`.
- **Marketing:** DemoSession, DemoHardwareBinding, mobile Buyer-Journey und Stripe-Testdemo bleiben getrennt von der Merchant-Domain und im produktiven Code vorhanden. Aktuell 0 DemoSessions und 0 DemoHardwareBindings; authentifizierte Marketing-Hardware-Config HTTP 200, `bound=false`. Die beiden Schilder sind Merchant-Geräte, kein aktuell gebundener Marketing-Renderer. Keine neue Session, Reservierung oder Stripe-Checkout im Audit erzeugt; heutige vollständige Marketing-/Zahlungs-E2E-Abnahme daher nicht behauptet.
- **P0.3.4:** live; Operator-Kontext mit vorhandenen lokalen Credentials HTTP 200, ohne Auth 401. Der frühere Basic-Auth-Mismatch ist nicht mehr der aktuelle Blocker. Reale Smartphone-/TFT-Vorschau, Codebestätigung und Aktivierung bleiben offen. Basic Auth bleibt Support/Operator; die normale Händler-Journey soll Merchant-Sessions verwenden.
- **P0.3.5:** lokal begonnen und umfangreich implementiert, **nicht abgenommen und nicht produktiv**: MerchantAccount, transaktionale Registrierung mit Merchant/Location, Argon2id, Mongo-Sessions, Login/Logout/CSRF, Händler-Scope, Dashboard, Stammdaten/Standorte, Products/Offers, Devices/Rename sowie Session-Binding; Operator-UI separat. Explizites Owner-Link-Skript vorhanden, produktiv nicht ausgeführt. Produktiv existieren weder `merchant_accounts` noch `merchant_sessions`; neue `/api/merchant-auth/me` und `/api/merchant/devices` liefern 404, Merchant-Session-ENV fehlen in der Backend-Komponente. Kein Merchant-Checkout, Connect, Echtgeld, Analytics, ERP oder Self-Service-Claim. Der lokale Session-Code erlaubt zusätzlich zu `MERCHANT_PUBLIC_ORIGIN` einen Fallback auf `PUBLIC_BASE_URL`; die ältere Beschreibung einer zwingend separaten Origin-ENV ist insoweit zu eng.
- **Aktuell erneut geprüft:** Backend **119 gezählte Tests: 111 bestanden, 8 fehlgeschlagen, 0 Skips**. Davon neue Portal-Integration 14 gezählt / 6 bestanden / 8 fehlgeschlagen einschließlich Parent; übrige 105/105 grün. Argon2-Test verlangt falsche Parameterreihenfolge und unterbricht gemeinsames Fixture; DELETE-Test erwartet 404 trotz vorgeschalteter korrekter 403-CSRF-Sperre. Folgefehler verhindern eine vollständige Funktionsaussage. Keine Tests oder Anwendung repariert. Frontend **52/52**, ESLint und Build grün; 40 Backend-Quelldateien Syntax grün. Firmware **24/24** inklusive kompiliertem Host-Parser, CS5- und NOCS-Merchant-Build jeweils SUCCESS; kein Flash.
- **Browserprüfung:** 19 Tests, **11 bestanden / 8 fehlgeschlagen**. Bestehende Binding-Prüfungen grün; alle acht neuen Portal-Journeys (DE/EN, 320/375/390/430 Pixel) laufen in `frontend/e2e/merchant.spec.js:46` bei `getByLabel('Standort' bzw. 'Location', { exact: true }).selectOption('L1')` ins Timeout. Keine vollständige Portal-CRUD-/Binding-/Logout-Abnahme daraus ableitbar. Locator-/Label-Ursache im nächsten lokalen Schritt klären, keine Reparatur in diesem Audit.
- **Dependencies:** aktueller lokaler Backend-Audit 0 Findings; installiert qs 6.16.0 / body-parser 1.20.8 / Express 4.22.2. Das Lockfile des produktiven Commits enthält weiterhin qs 6.15.3: der lokale Security-Fix ist noch nicht ausgerollt. Frontend-Audit weiterhin ein moderater Entwicklungsbefund in `@humanfs/node`, Fix verfügbar. Kein Dependency-Update in diesem Audit.
- **Hygiene:** `git diff --check` grün; Abgleich der 139 getrackten/ungetrackten versionierbaren Dateien gegen geladene lokale ENV-/Geräte-Secrets ohne Treffer. Test-/Buildartefakte ausschließlich in ignorierten Standardverzeichnissen; keine produktiven Secrets oder Challenge-Codes dokumentiert.
- **Exakt nächster sinnvoller Schritt:** separater lokaler Stabilisierungslauf für den vorhandenen P0.3.5-Stand: zuerst unabhängige Mongo-Test-Fixtures und semantische Argon2-/CSRF-Assertions, anschließend die roten Portal-Browserprüfungen diagnostizieren und korrigieren. Danach vollständige lokale Abnahme der Händler-Journey einschließlich Isolation, Session-Binding und DE/EN; bestehende Offer-Standortidentität bewusst bestätigen. Den noch unveröffentlichten qs-Fix bei der anschließenden Releaseplanung ausdrücklich berücksichtigen. Noch keine Erweiterung des Funktionsumfangs und keine produktive Aktivierung; späteres Pilot-Owner-Linking benötigt die ausdrücklich benannte echte Account-Identität.

P0.3.5 bereit für lokale Abnahme: **nein**. Historische Aussagen „beide online“ und „P0.3.5 nicht implementiert“ gelten nicht als aktueller Stand.

### P0.3.5 – lokale Implementierung vorhanden, Integrationstest STOP

Der erneute Auftrag autorisierte die vollständige lokale Implementierung nach dem Dependency-Fix. Es liegt jetzt ein ungeprüfter Implementierungsstand vor, keine freigegebene Abnahme. Keine Produktion verändert, keine Accounts produktiv verknüpft, kein Assignment aktiviert, kein Flash und kein Commit/Push/Deploy. Die nachfolgenden Dependency-/P0.3.4-Abschnitte bleiben historische Nachweise.

- Neue `MerchantAccount`-Collection getrennt vom Merchant: normalisierte eindeutige E-Mail, accountId, Argon2id-Hash (select:false), ACTIVE/DISABLED, OWNER mit vorbereiteten ADMIN/STAFF-Werten, merchantId-Relation, Zeitstempel/lastLoginAt. Aktuell nur OWNER im Session-Guard zugelassen. Registrierung legt Account/Merchant/erste Location transaktional an; keine Teamverwaltung.
- Passwort-Hashing mit argon2 0.45.1: Argon2id, 64 MiB, drei Durchläufe, Parallelismus 1. Server-Sessions über express-session/connect-mongo, eigene Collection `merchant_sessions`, 12 Stunden absolute Auth-Laufzeit, Rotation bei Anmeldung, Logout zerstört Session. Production-Cookie `__Host-qr2buy-merchant`, Secure/HttpOnly/SameSite=Lax/Path=/; keine Browser-Tokenablage. Separate `MERCHANT_SESSION_SECRET` und exakte `MERCHANT_PUBLIC_ORIGIN` aus ENV; fehlende Konfiguration fail-closed. Synchronizer-CSRF-Token, JSON- und Origin-Prüfung auch für Login/Registrierung; Rate-Limits pro Prozess/IP (noch kein verteilter Brute-Force-Schutz).
- Neue `/api/merchant-auth`- und `/api/merchant`-Routen leiten den Scope aus Session/aktuellem Account ab. Whitelists für Profile, Locations, Products, Offers und Device-Rename; keine Device-Claims, keine technische ID-/Credential-Änderung. Session-Binding nutzt denselben P0.3.4-Service mit physischem Code, ohne direkte Aktivierungs-CRUD-Route.
- Lokale DE/EN-Oberfläche `/merchant/*`: Registrierung/Login, Übersicht mit Bestandszählungen, Produkte und Preis & Verkauf, Standorte, Geschäftsdaten, Schilder mit Kontakt/Firmware/Zuordnung und Rename. Produkt- und Schild-Einstieg führen zum gemeinsamen Binding-Screen. Normale `/binding/:deviceId`-Journey nutzt Merchant-Session; interne Basic-Auth-UI separat unter `/operator/binding/:deviceId`, bestehende Operator-API erhalten. Marketing-Frontend unverändert.
- Geld bleibt integer priceMinor, Bestand QR2BUY. Externe Inventory ist nur vorbereitet; spätere ERP-Source-of-Truth erfordert Händlerzustimmung. HTTPS-Bildreferenz optional, kein Upload/Object-Storage implementiert. ReservationDuration/Bedingungen in Device-/Buyer-Projektion ergänzt; kein Merchant-Checkout/Stripe Connect/Analytics. Bestehende Offer-Produkt-/Standortidentität bleibt immutable: Standortwahl beim Anlegen, Standortwechsel über weiteres Angebot, nicht durch Mutation eines bestehenden Angebots. Diese Abweichung zur gewünschten nachträglichen Standortbearbeitung ist vor Abnahme zu bewerten.
- Explizites Bootstrap-Skript `src/scripts/linkMerchantOwner.js`: ENV-Gates, fester angegebener Merchant und angegebene E-Mail/Passwort, idempotent ohne Passwort-Reset, keine automatische Anmeldung/Verknüpfung im Startup. Nur Test-DB benutzt; keine echte E-Mail geraten. `merchant-demo-001`/`location-demo-001` produktiv unverändert. Gerätestand nur letzter realer Nachweis: #001 Firmware 0.3.4, #002 0.3.2, beide PENDING/assigned=false; in diesem Schritt nicht erneut produktiv abgefragt.
- Prüfung: ESLint grün. Neue Mongo-Integration mit eigenem Loopback-Replikaset ROT: 14 gezählte Tests (13 Subtests plus Parent), 6 bestanden, 8 fehlgeschlagen einschließlich Parent. Erste Ursache: Test erwartet Argon2-Parameterreihenfolge `m,t,p`, Bibliothek serialisiert `m,p,t`; dadurch wird das gemeinsam verwendete Merchant-A-Fixture nicht fertiggestellt und weitere Tests scheitern. Zweiter Testfehler: DELETE ohne JSON/Origin/CSRF wird korrekt schon mit 403 gesperrt, Test erwartet 404. Keine vollständige Aussage zur Korrektheit der neuen Funktionalität möglich. Test-Replikaset und temporäre DB im finally beendet/entfernt.
- Gemäß STOP-Regel keine Testreparatur nach dem roten Lauf vorgenommen. Noch offen: Integrationstests korrigieren/entkoppeln, vollständige Backendtests/Syntax/Imports/Audit, Frontendtests/Build/Browserabnahme, Firmwaretests/beide Builds und finaler Secret-Scan. Letzter Backend-Audit 0 Findings stammt vom Dependency-Fix vor dieser Umsetzung, nicht von einer neuen Abschlussprüfung. `git diff --check` grün.
- Geänderte/ergänzte Dateien: Backend `.env.example`, `package.json`, `package-lock.json`, `src/index.js`, `src/merchant/{accounts,portal,session,deviceService}.js`, `src/routes/merchantPortal.js`, `src/scripts/linkMerchantOwner.js`, `test/{merchantPortal.integration,merchantDevice,merchantMongo.integration}.test.js`; Frontend `src/App.jsx`, `src/binding.js`, `src/merchantApi.js`, `src/merchantText.js`, `src/pages/DeviceBindingPage.jsx`, `src/pages/MerchantPortal.{jsx,css}`, `test/merchantPortal.test.js`, `e2e/{binding,merchant}.spec.js`; dieses Kontextdokument. Bestehende lokale Dependency-/Kontext-Diffs erhalten.

P0.3.5 bereit für lokale Abnahme: **nein**.

### P0.3.5 – Dependency-Security-STOP lokal behoben, Funktionalität weiterhin offen

Der separat beauftragte qs-Fix ist lokal abgeschlossen. Danach ausdrücklich STOP: keine Registrierung, Sessions oder Dashboard implementieren und kein Commit/Push/Deploy. Die folgenden ursprünglichen STOP-Befunde bleiben als Historie erhalten.

- Ursache: `GHSA-x5fp-wj9c-mxmx` (Array-Limit-Umgehung, betroffen qs 6.14.2–6.15.3) und `GHSA-4mjr-xmp4-gh2g` (DoS durch angreiferkontrolliertes isBuffer, betroffen qs >=2.2.5 <6.16.0). Beide in qs 6.16.0 behoben. Quellen: https://github.com/advisories/GHSA-x5fp-wj9c-mxmx und https://github.com/advisories/GHSA-4mjr-xmp4-gh2g.
- Installierte Kette vorher: direkte Dependency Express 4.22.2 → qs 6.15.3 und transitiv body-parser 1.20.6 → qs 6.15.3; Stripe 16.12.0 verwendete dieselbe deduplizierte qs-Version. body-parser ist keine direkte Projekt-Dependency.
- Strategie: Registry geprüft; neueste verfügbare Express-4-Version bleibt 4.22.2 und verlangt qs `~6.15.1`, wodurch reguläre Auflösung die sichere Minor-Version ausschließt. Deshalb ausschließlich `overrides.express.qs = 6.16.0`. Reguläres `npm update body-parser qs` aktualisierte body-parser auf 1.20.8 und qs auf 6.16.0. body-parser verlangt jetzt `~6.16.0`; Stripe erlaubt dies bereits mit `^6.11.0`. Kein Express-/Stripe-Majorwechsel, kein Force, keine Audit-Ausnahme.
- Gegenüber Beginn dieses isolierten Fixes nur zwei Paketversionen geändert. Bereits zuvor ergänzte argon2/express-session/connect-mongo samt damaligen cookie-/cookie-signature-Patchupdates bleiben erhalten; keine weiteren Lockfile-Massenupdates.
- Backend `npm audit`: 0 kritisch, 0 hoch, 0 moderat, 0 niedrig; keine Advisories. Gesamte Backendtests 105/105, keine Skips; Syntaxprüfung aller 35 src-JavaScript-Dateien, Import-Smoke aller 31 Module außerhalb Start-/Seed-Skripten grün. Isolierte Mongo-Tests einschließlich Rotation, Binding, Isolation und Device API grün und aufgeräumt.
- Zusätzliche HTTP-Kompatibilitätsprüfung mit tatsächlichen Demo-/Legacy-Webhook-Routern und der Parser-Reihenfolge aus index.js: unveränderte Raw-Body-Signaturen mit Stripe-SDK-Testheader akzeptiert (200), veränderte Bytes/falsche Signaturen abgewiesen (400). JSON, ungültiges JSON, urlencoded und Rate-Limit 200→429 grün. Beide qs-Advisory-Reproduktionen mit begrenzten lokalen Testeingaben gegen die gepatchte Version erfolgreich geprüft. Keine Produktiv-/Stripe-Netzwerkaktion.
- Frontend 48/48 Tests, ESLint und Produktionsbuild grün; 11/11 Browserprüfungen DE/EN bei 320/375/390/430 Pixeln. Firmware 24/24 einschließlich kompiliertem Host-Parser; CS5- und NOCS-Merchant-App-Build SUCCESS. Keine Firmwareänderung und kein Flash.
- Getrennter bestehender Frontend-Dev-Befund: `@humanfs/node@0.16.7`, moderat, `GHSA-p498-v437-472g` (rekursives Kopieren folgt Symlinks), Fix laut Audit ab 0.16.8 verfügbar. Außerhalb der qs-/Backend-Bereinigung, Frontend-Lockfile unverändert; kein Befund aus dem ausgelieferten Frontend-Runtime-Code. Nicht als behoben oder grundsätzlich unlösbar eingestuft.
- Hygiene: Credential-Abgleich der drei geänderten Dateien ohne Treffer, ENV-/Geräte-Secrets ignoriert, `git diff --check` grün, keine ungetrackten Dateien. Test-/Buildausgaben ausschließlich in ignorierten Standardverzeichnissen. Bestehender Kontext-Diff erhalten. P0.3.5 kann fachlich nach erneutem Auftrag fortgesetzt werden; Accounts/Session-System/Dashboard weiterhin nicht implementiert.

Der neue Auftrag ersetzt die ausstehende reale Schild-1-Abnahme durch die ausschließlich lokale Umsetzung von Händler-Accounts, Session-Login und Dashboard. Keine Freigabe für Commit, Push, Deploy, Production-Migration, Account-Linking, Assignment-Aktivierung oder Flash.

- Gelesen: bestehende Merchant-Modelle und Services, Device-Credentials/-Projektion, transaktionaler Binding-Service, interne Basic-Auth-Routen, Registrierungsvoraussetzungen, Seed-/Produktcode-Skripte, Frontend-Routing und Binding-UI, vorhandene Mongo-/Browser-Teststruktur. Grundlage bleibt die bestehende Merchant-Domain; Marketing-Demo bleibt separat.
- Vorbereitung ausschließlich in Backend-Paketdateien: `argon2@0.45.1`, `express-session@1.19.0`, `connect-mongo@6.0.0` ergänzt. Noch keine Account-Modelle, Auth-Routen, Session-Konfiguration oder Händler-UI implementiert. Architekturabsicht: Argon2id, serverseitige Mongo-Sessions, sichere Cookies und separater Merchant-Scope; noch nicht umgesetzt oder abgenommen.
- STOP gemäß Auftrag: `npm audit` meldet drei moderate betroffene Pakete (qs, Express, body-parser), verursacht durch zwei qs-Advisories `GHSA-x5fp-wj9c-mxmx` und `GHSA-4mjr-xmp4-gh2g`. `qs@6.15.3`, `express@4.22.2` und `body-parser@1.20.6` waren bereits vor diesem Arbeitsschritt im HEAD-Lockfile vorhanden und blieben unverändert. Audit nennt eine verfügbare Behebung, unter anderem qs ab 6.16.0; kein pauschales Audit-Fix ausgeführt.
- Audit über vertrauenswürdigen Windows-System-CA-Store ausgeführt; kein TLS-Bypass. Keine Produktionsverbindung/-Mutation, keine Gerätezugriffe, keine neuen Testdaten und keine Credentials ausgegeben. Der vorhandene P0.3.4-Kontext-Diff bleibt erhalten. P0.3.5 ist nicht implementiert und nicht lokal abnahmebereit; vollständige Backend-/Frontend-/Firmware-Regression und Produktions-Bestandsaudit in diesem Schritt noch nicht durchgeführt.

Aktuell: P0.3.3b ist real abgenommen. P0.3.4-Operator-Auth ist jetzt produktiv grün; Schild 1 wurde ausschließlich auf COM3 auf Firmware 0.3.4 aktualisiert, Schild 2 bleibt Firmware 0.3.2. Beide gleichzeitig online, assigned=false und DisplayAssignments PENDING. CS5 weiterhin Rotation 1, NOCS Rotation 3 (+180°), jeweils 320×240. Nächster Schritt: reale Smartphone-/TFT-Vorschau und kontrollierte Aktivierung ausschließlich Schild 1.

P0.3.4-Funktionscode `01c23ff` produktiv; Diagnosehistorie bis Docs-Commit `6f86c6d` veröffentlicht. Nach erneuter Nutzerhinterlegung des Passworts und Nutzer-Redeploy ist der bisherige Auth-STOP aufgehoben: direkte Operator-GET-Anfrage mit lokalen Credentials HTTP 200, falsches Passwort und fehlende Auth jeweils HTTP 401. Keine Credentials ausgegeben oder durch den Agenten geändert. Reale Preview/Bestätigung und Aktivierung noch nicht abgenommen. QR2B-000002 bleibt bis zu einem separaten Go unverändert.

### Schild-1-Vorbereitung nach erfolgreicher Operator-Authentifizierung

- Permanente Route `/device/QR2B-000001` liefert korrekt HTTP 303 auf `/binding/QR2B-000001`; authentifizierter Kontext nennt „Schild 1“.
- Vorbereiteten Produktcode-Backfill explizit mit produktiven Gates im Prozess und festem Scope `merchant-demo-001` ausgeführt: drei fehlende stabile Produktcodes ergänzt. Keine Änderung an Offers, Credentials oder Assignments; Gates nicht in ENV-Datei oder DigitalOcean gesetzt. „Handgemachte Ledertasche“ ist im Operator-Kontext auswählbar.
- Firmware erneut 24/24 Tests grün, CS5-Merchant-Build SUCCESS; danach Upload explizit `--upload-port COM3` SUCCESS, korrekte Prototyp-1-MAC erkannt und Flash-Hash verifiziert. Kein COM4-Zugriff. Keine funktionalen Codeänderungen.
- Anschließend ausschließlich COM3 ohne zusätzlichen DTR/RTS-Reset überwacht: fünf erfolgreich geparste HTTPS-200-Unassigned-Abrufe. Mongo bestätigt Schild 1 Firmware 0.3.4, Schild 2 Firmware 0.3.2 und aktuelle Heartbeats beider. Beide Device-APIs HTTP 200, assigned=false, keine Preview; beide Assignments PENDING, BindingPreview-Collection leer.
- Reale Smartphone-/TFT-Prüfung steht aus: Nutzer öffnet den permanenten Schild-1-Link am Smartphone, wählt die Ledertasche und startet die maximal 120 Sekunden gültige Vorschau. Physischer Code wird ausschließlich vom TFT am Smartphone eingegeben, niemals aus Device-API/DB entnommen oder dokumentiert. Noch keine Aktivierung und kein Abschlusscommit für eine reale Abnahme.

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
