# qr2buy.com – Landingpage-Konzept / Landing Page Concept

> **Historisches Konzeptdokument.** Die Abschnitte zur rein frontend-seitigen Demo beschreiben den frühen Entwurf und nicht mehr die aktuelle Implementierung. Der produktive Stand mit `DemoSession`, Backend-Reservierung, Stripe-Sandbox und Hardwarekopplung ist in [`QR2BUY_CONTEXT.md`](./QR2BUY_CONTEXT.md) verbindlich dokumentiert.

## Ziel / Goal

Die Landingpage macht qr2buy in wenigen Sekunden verständlich: Ein reales Produkt im Schaufenster, in der Auslage oder auf einer Verkaufsfläche wird per QR-Code direkt kaufbar oder reservierbar.

The landing page explains qr2buy within seconds: a real product in a window, display area or selling space becomes directly buyable or reservable through a QR code.

Zielgruppen sind Pilotkund:innen, kleine und mittlere Händler, Commercial Co-Founder, Businesspartner und Early-Investor:innen. Die Seite soll warm, lokal, kompetent und modern wirken – nicht wie ein kaltes SaaS-Dashboard oder ein billiger QR-Code-Generator.

The audience includes pilot customers, small and mid-sized retailers, commercial co-founders, business partners and early investors. The tone is warm, local, competent and modern – not a cold SaaS dashboard or a cheap QR-code tool.

## Pain / Need

- Nach Ladenschluss bleiben Kaufimpulse ungenutzt.
- Bei hohem Andrang können Kund:innen nicht warten.
- Sichtbare Einzelstücke werden später online gesucht und möglicherweise anderswo gekauft.
- Einzelstücke und Lagerware brauchen unterschiedliche Bestandslogik.
- Ein physisches Preisschild zeigt nicht zuverlässig, ob ein Produkt noch verfügbar ist.

- Purchase intent is lost after closing time.
- Busy stores cannot serve every interested visitor immediately.
- Visible products may be bought elsewhere later.
- One-off pieces and stocked products need different inventory logic.
- A physical price tag cannot reliably show live availability.

## USP / Core promise

**Dein Schaufenster verkauft weiter. / Your window keeps selling.**

qr2buy verbindet physisches Produkt, digitales QR-Preisschild, Produktseite, Kauf oder Reservierung, Abholung oder Lieferung und einen sichtbaren Live-Status. Es ist kein normaler QR-Code-Generator und kein App-Zwang: Die Kamera reicht.

qr2buy connects the physical product, a digital QR price tag, a product page, buying or reserving, collection or delivery and a visible live status. It is not a regular QR-code generator and requires no app: the phone camera is enough.

### Geschärfte Kernbotschaft / Sharpened core message

Nach der zweiten Fragerunde steht nicht der QR-Code, sondern Vertrauen im Mittelpunkt: **Kaufen und Verkaufen dürfen keine Frage von Öffnungszeiten sein.** Ein Mensch sieht ein Produkt, scannt ohne App, wird verlässlich zur Zahlung geführt und erhält gemeinsam mit dem Händler erst nach bestätigter Zahlung Klarheit. Das digitale Preisschild reagiert sichtbar.

After the second round of questions, trust – not the QR code – is the center of the message: **Buying and selling should not depend on opening hours.** A person sees a product, scans without an app, is guided reliably to payment and gets clarity together with the seller only after payment is confirmed. The digital price display reacts visibly.

## Payment precision / Zahlungspräzisierung

qr2buy ist keine Bank und gibt keine Garantieversprechen zu Käuferrechten oder Zahlungen ab. Stripe ist der Zahlungsdienstleister. Die Landingpage formuliert deshalb vorsichtig: Die Zahlung wird professionell abgewickelt; qr2buy reagiert erst nach bestätigter Zahlung und informiert dann Käufer, Verkäufer und Preisschild über den bestätigten Status.

qr2buy is not a bank and makes no guarantee claims about buyer rights or payments. Stripe is the payment service provider. The landing page therefore uses precise language: payment is handled professionally; qr2buy reacts only after confirmed payment and then informs the buyer, seller and display of the confirmed status.

## Tonalität / Tone

Klar, menschlich, startup-tauglich, kleinunternehmerfreundlich, kompetent und sympathisch. Keine übertriebenen Umsatzversprechen, keine erfundenen Compliance- oder Feature-Zusagen und keine fertige Preistabelle. Die MVP-/Pilotphase wird offen benannt.

Clear, human, startup-ready, friendly to small businesses, competent and approachable. Avoid exaggerated revenue promises, invented compliance claims or a premature pricing table. Be transparent about the MVP and pilot phase.

## Sprachlogik / Language

Die Landingpage erkennt die Browser-Locale: Englisch wird bei einer `en`-Locale gewählt, sonst Deutsch. Deutsch ist der Fallback. Der DE/EN-Schalter bleibt jederzeit sichtbar und erhält die ausgewählte Demo-Auswahl. Beide Sprachvarianten werden gemeinsam gepflegt; keine verstreuten unübersetzten Texte im Demo-Modul.

The page detects the browser locale: English is selected for an `en` locale, German is the fallback otherwise. The DE/EN switch remains visible and keeps the selected demo product. Both languages are maintained together; the demo does not mix untranslated copy.

## Responsive-Anforderung / Responsive requirement

Mobile-first mit vollständigen Zuständen für Mobile, Tablet, Laptop und Desktop. Navigation, Hero, Demo, Karten, Buttons und Partnerbereich dürfen nicht überlaufen. Die Demo wird auf kleinen Viewports untereinander angeordnet; QR-Mockup und Display bleiben sichtbar und touch-freundlich. `prefers-reduced-motion` wird berücksichtigt.

Mobile-first with complete states for mobile, tablet, laptop and desktop. Navigation, hero, demo, cards, buttons and partner section must not overflow. On small viewports the demo stacks vertically; the QR mockup and display remain visible and touch-friendly. `prefers-reduced-motion` is respected.

## Landingpage-Struktur / Page structure

1. Header mit typografischer qr2buy-Wortmarke, Navigation und DE/EN-Schalter.
2. Hero mit „Kaufen und Verkaufen dürfen keine Frage von Öffnungszeiten sein.“, Trust-Text, Live-Beweisen, Käufer-/Verkäufer-Aussage und zwei CTAs.
3. Interaktive Demo mit stilisiertem Preisschild, QR-Link auf `/p/demo`, Produktwahl, Kauf-/Reservierungssimulation und Statuswechsel.
4. Pain-/Need-Karten für Ladenschluss, volle Geschäfte und Einzelstücke.
5. USP-Abschnitt „Mehr als ein QR-Code“.
6. Drei Schritte: Anbringen, Scannen, Handeln.
7. Use Cases: Boutique, Buchhandlung, Galerie, Pop-up und saisonaler Stand.
8. Partnerbereich für Commercial Co-Founder / Businesspartner.
9. Pilotkunden-CTA.
10. Founder-Abschnitt „Hinter qr2buy“ und Footer.

## Demo-Konzept / Demo concept

Die Demo ist bewusst frontend-seitig simuliert. Sie verändert nur lokalen React-State und ruft keine Kauf-, Reservierungs- oder Stripe-API auf. Der Hinweis „keine echte Bestellung, keine Zahlung“ ist direkt am Demo-Modul sichtbar. Die Journey wird als Interesse → Scan → Bestätigung → Preisschild reagiert dargestellt.

The demo is intentionally frontend-only. It changes local React state and calls no purchase, reservation or Stripe API. The notice “no real order, no payment” is visible beside the demo controls. The journey is shown as interest → scan → confirmation → display reacts.

Sichtbare Zustände / visible states:

- `AVAILABLE` → „Noch zu haben“ / “Still available”
- `RESERVED` → „Für dich reserviert“ / “Reserved for you”
- `SOLD` → „Schon verkauft“ / “Already sold”

Die Produktwahl umfasst ein Einzelstück, Lagerware, einen limitierten Kunstdruck und einen saisonalen Stand. Kaufen bzw. Reservieren verändert den sichtbaren Status. Bei Lagerware reduziert sich der Demo-Bestand.

## Demo-Produkte / Demo products

| Szenario | Deutsch | English | Logik |
| --- | --- | --- | --- |
| Boutique | Handgemachte Ledertasche · 129 € | Handmade leather bag · €129 | Bestand 1, Kauf → verkauft |
| Buchhandlung | Roman „Stadtlichter“ · 24,90 € | Novel “City Lights” · €24.90 | Bestand 8, Kauf/Reservierung reduziert Bestand |
| Galerie | Gerahmter Kunstdruck · 390 € | Framed art print · €390 | Bestand 1, Reservierung → reserviert |
| Saisonaler Stand | Nordmanntanne Nr. 17 · 59 € | Nordmann fir no. 17 · €59 | Bestand 1, Abholung/Lieferung später ausbauen |

Der Christbaum-Use-Case wird auf der Landingpage nur kurz erwähnt und nicht als Hauptcase inszeniert.

## Logo-/Wortmarkenrichtung / Logo direction

Empfohlen wird eine typografische Wortmarke `qr2buy` in dunklem Tannengrün mit einem kleinen, abgerundeten QR-inspirierten Zwei-mal-zwei-Marker. Sie soll handelsnah, freundlich und kompetent wirken. Im ersten Schritt reicht die CSS/HTML-Wortmarke; ein eigenes Grafikfile oder externes Logo ist nicht nötig.

The recommended direction is a typographic `qr2buy` wordmark in deep pine green with a small rounded two-by-two QR-inspired marker. It should feel retail-friendly, approachable and competent. A CSS/HTML wordmark is sufficient for the first step; no graphic asset or external logo is needed.

## Partner-/Founder-Positionierung / Partner and founder positioning

Der Founder-Kontext steht nicht im Hero. Im Abschnitt „Hinter qr2buy“ wird knapp erklärt: Andreas Franz / ecily ist technischer Founder mit Management-, Business- und Produktentwicklungserfahrung; MVP, Hardware-Prototyp und Live-System sind vorhanden. Gesucht wird ein Commercial Co-Founder oder Businesspartner für Vertrieb, Marketing, Pilotkunden und Markteintritt. Es wird keine konkrete Beteiligungsquote genannt; zulässig ist „Equity-basiertes Partnering möglich“.

The founder context does not dominate the hero. “About qr2buy” briefly explains that Andreas Franz / ecily is the technical founder with management, business and product experience; the MVP, hardware prototype and live system exist. A commercial co-founder or business partner is sought for sales, marketing, pilot customers and market entry. No percentage is stated; “Equity-based partnering possible” is appropriate.

## Pilotkunden / Pilot customers

Die Pilotpositionierung richtet sich an Geschäfte mit Schaufenster, Auslage oder saisonaler Verkaufsfläche. Setup und Geschäftsmodell werden gemeinsam mit ersten Partnern entwickelt; es gibt noch keine Preistabelle.

The pilot message targets businesses with windows, displays or seasonal selling spaces. Setup and business model are developed with first partners; there is no pricing table yet.

## Nicht-MVP / Out of scope

Keine echte Zahlung, Bestellung, Rechnung oder Backend-Reservierung in der Landingpage-Demo. Keine neue QR-Abhängigkeit, keine Backend-Routen, keine Firmware-Änderung, keine automatische App-Löschung und kein umfassendes i18n-Framework. Authentifizierung, OTA, Mehrmandantenfähigkeit, Versandlogik und Live-Stripe-Abnahme bleiben spätere Themen.

No real payment, order, invoice or backend reservation in the landing page demo. No new QR dependency, backend routes, firmware changes, automatic app deletion or full i18n framework. Authentication, OTA, multi-tenancy, shipping logic and live Stripe acceptance remain later topics.

## Spätere Subseite / Later subpage

Der saisonale Use Case kann später als schlanke Subseite ausgebaut werden: `/de/use-cases/christbaumverkauf` und `/en/use-cases/christmas-tree-sales`. Für diesen Landingpage-Schritt wird keine Subseite gebaut.

The seasonal use case can later become a small subpage: `/de/use-cases/christbaumverkauf` and `/en/use-cases/christmas-tree-sales`. No subpage is built in this landing page step.

## Abnahmekriterien / Acceptance criteria

### Zweite Vertrauensschärfung / Second trust refinement

Die aktuelle Landingpage führt mit „Ein ecily.com Projekt“ und der Kernbotschaft „Kaufen und Verkaufen dürfen keine Frage von Öffnungszeiten sein.“ ein. Die primäre Aktion ist die Demo; die Partner-CTAs verweisen auf `https://ecily.com/de/start-up`. Nach einer simulierten Kauf- oder Reservierungsaktion folgt ein klarer Abschluss-CTA zu ecily.

The current landing page leads with “An ecily.com project” and the core message “Buying and selling should not depend on opening hours.” The primary action is the demo; partner CTAs link to `https://ecily.com/de/start-up`. After a simulated purchase or reservation, the demo provides a clear closing CTA to ecily.

Zusätzlich belegt die Seite die technische Richtung mit leistbarer, robuster Display-Hardware, einem geschützten Händlerbereich im Demo-MVP sowie dem Zusammenspiel von Produktseite, Backend, Datenbank und Display. Eine separate Marktchance nennt Amazon genau einmal außerhalb des Hero-Bereichs. Diese Aussagen bleiben auf MVP-/Prototyp-Niveau und versprechen keine Enterprise-Reife.

The page also shows the technical direction through affordable, robust display hardware, a protected merchant area in the demo MVP, and the connection between product page, backend, database and display. A separate opportunity section mentions Amazon once outside the hero. These statements remain at MVP/prototype level and do not claim enterprise readiness.

- `/` zeigt die neue Landingpage nach Deploy.
- Browser-Locale wählt plausibel DE oder EN; der Switch funktioniert jederzeit.
- Hero, Demo, Karten, Partner-CTA und Footer sind auf Mobile, Tablet, Laptop und Desktop nutzbar.
- Demo: Produkt wählen, Kauf simulieren, Reservierung simulieren, Status am Mockup ändern, Bestand bei Lagerware reduzieren und Einzelstück als reserviert/verkauft zeigen.
- Demo-Hinweis ist klar sichtbar; keine echte Zahlung oder Bestellung wird ausgelöst.
- QR-Fläche und CTA führen zu `/p/demo`.
- `/p/demo`, `/api/health` und `/api/public/products/by-short/demo` bleiben unverändert funktionsfähig.
- Frontend-Build ist erfolgreich.
- Keine Secrets in Docs oder Code.
- Nach User-Feedback werden Copy, Demo-Produktwahl und mobile Prioritäten nachgeschärft.
