import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { bindDemoHardware, createDemoSession, getDemoSession, updateDemoHardwareBinding } from "../api.js";
import {
  bindHardwareForSession,
  clearHardwareBinding,
  createFreshDemoSession,
  HARDWARE_OPERATOR_COPY,
  readHardwareBinding,
  restoreOrCreateDemoSession,
  syncHardwareSelection
} from "../demoHardwareBinding.js";
import { getHardwareDisplayMode } from "../demoDisplayState.js";
import { confirmDemoSafety, hasDemoSafetyConfirmation } from "../demoSafetyGate.js";
import BrandLogo from "../components/BrandLogo.jsx";

const ECILY_STARTUP_URLS = {
  de: "https://ecily.com/de/start-up",
  en: "https://ecily.com/en/start-up",
};

const copy = {
  de: {
    nav: { demo: "Demo", useCases: "Für wen?", partner: "Partner werden", about: "Hinter qr2buy" },
    eyebrow: "Ein ecily.com Projekt",
    hero: "Kaufen und Verkaufen dürfen keine Frage von Öffnungszeiten sein.",
    heroText: "qr2buy macht Produkte im Schaufenster sofort kaufbar oder reservierbar – ohne App, direkt am Handy und mit verlässlicher Rückmeldung nach bestätigter Zahlung.",
    heroTrust: "Erst wenn die Zahlung bestätigt ist, informiert qr2buy Käufer, Verkäufer und das digitale Preisschild. So wird aus Interesse ein klarer, nachvollziehbarer Kaufmoment.",
    buyerLabel: "Für Käufer",
    buyerText: "Sehen. Scannen. Sicher kaufen oder reservieren.",
    sellerLabel: "Für Händler",
    sellerText: "Nach Hause gehen – und trotzdem weiter verkaufen, auch am Wochenende.",
    heroBadges: ["Live MVP", "Hardware-Prototyp", "Demo-Ablauf"],
    demoCta: "Demo ansehen",
    partnerCta: "Mit ecily über qr2buy sprechen",
    pilotNote: "Funktionierender MVP · Pilotphase",
    heroPoints: ["Kein App-Zwang", "Kauf oder Reservierung", "Bestandsschutz am Display"],
    demoEyebrow: "Interaktive Demo",
    demoTitle: "Live ausprobieren – nur dein Handy, keine App.",
    demoText: "Scanne ein Produkt. Kaufe es im sicheren Stripe-Testmodus oder reserviere es zur Abholung.",
    displayOnline: "LIVE DISPLAY",
    scanHint: "Mit dem Handy scannen",
    noApp: "Keine App nötig",
    openHere: "Demo auf diesem Gerät öffnen",
    liveBadge: "Live-Demo · keine echte Zahlung",
    available: "Noch zu haben",
    reserved: "Für dich reserviert",
    sold: "Schon verkauft",
    stock: "Bestand",
    onePiece: "Einzelstück",
    demoStock: "Fiktiver Demo-Bestand",
    buy: "Kauf simulieren",
    reserve: "Reservierung simulieren",
    reset: "Demo-Status zurücksetzen",
    demoNotice: "Es entsteht keine echte Bestellung. Bitte verwende ausschließlich Testdaten.",
    demoJourney: ["Interesse", "Scan", "Bestätigung", "Preisschild reagiert"],
    demoCompleteTitle: "Ein Produkt. Ein Scan. Eine klare Rückmeldung.",
    demoCompleteText: "Du hast gerade gesehen, wie qr2buy funktioniert. Wenn du das Potential siehst und mitbauen willst, sprich mit ecily.",
    paidLive: "Danke! Wir haben deinen Auftrag erhalten! Viel Freude mit deinem Produkt.",
    reservedLive: "Reserviert! Wir haben deine Demo-Reservierung erhalten.",
    displayPaidTitle: "Zahlung bestätigt",
    displayPaidMessage: "Danke! Viel Freude mit deinem Produkt.",
    displayReservedTitle: "Für dich reserviert",
    displayReservedMessage: "Zur Abholung vorgemerkt.",
    displaySoldLabel: "VERKAUFT",
    displaySoldTitle: "Diese Tanne wurde schon verkauft.",
    displaySoldMore: "Wir haben aber noch andere für dich.",
    displaySoldWish: "Schau dich um. Frohe Weihnachten!",
    displayTreeReservedLabel: "RESERVIERT",
    displayTreeReservedTitle: "Diese Tanne ist bereits reserviert.",
    displayTreeReservedMore: "Andere Produkte warten noch auf dich.",
    stripeConfirmed: "Stripe hat den Testkauf serverseitig bestätigt.",
    resetsIn: "Diese Demo wird in {seconds} Sekunden zurückgesetzt.",
    connecting: "Sichere Live-Demo wird vorbereitet …",
    demoError: "Die Live-Demo ist gerade nicht verfügbar.",
    retry: "Erneut versuchen",
    connectionLive: "Live verbunden",
    connectionPolling: "Verbindung wird wiederhergestellt",
    checkoutStarted: "Testcheckout geöffnet",
    cancelled: "Testcheckout abgebrochen",
    scanDetected: "SCAN ERKANNT",
    continueOnPhone: "Bitte am Smartphone fortfahren",
    selected: "Ausgewählt",
    scenariosEyebrow: "Warum das zählt",
    scenariosTitle: "Wenn Interesse da ist, soll der Kauf nicht warten.",
    scenarios: [
      ["Nach Ladenschluss", "Die Auslage bleibt offen für Kaufimpulse – auch wenn die Tür zu ist."],
      ["Bei vollem Geschäft", "Kund:innen scannen selbst und kommen ohne Warteschlange zum nächsten Schritt."],
      ["Bei Einzelstücken", "Ein Statuswechsel schützt vor Doppelverkäufen und macht Knappheit sichtbar."],
    ],
    whyEyebrow: "Mehr als ein QR-Code",
    whyTitle: "Nicht nur ein QR-Code. Ein verlässlicher Kaufmoment.",
    whyText: "Ein normales Preisschild zeigt nur den Preis. Ein normaler QR-Code führt irgendwohin. qr2buy verbindet das konkrete Produkt mit Kauf oder Reservierung und macht die bestätigte Veränderung sofort sichtbar.",
    whyItems: ["Normales Preisschild: zeigt nur den Preis", "Normaler QR-Code: führt irgendwohin", "qr2buy: kennt Produkt und Status", "Bestätigte Zahlung: Käufer, Verkäufer und Preisschild wissen Bescheid"],
    stepsEyebrow: "So funktioniert es",
    steps: [["1", "Anbringen", "QR-Preisschild beim Produkt platzieren."], ["2", "Scannen", "Kamera öffnen – kein Download, kein Account."], ["3", "Handeln", "Kaufen oder reservieren, während der Status live mitgeht."]],
    casesEyebrow: "Für lokale Verkaufsflächen",
    casesTitle: "Ein System, viele Situationen.",
    cases: [["Boutique", "Einzelstücke im Schaufenster"], ["Buchhandlung", "Lagerware trotz voller Kassa"], ["Galerie", "Originale und limitierte Stücke"], ["Pop-up", "Verkaufen ohne zusätzliche Infrastruktur"], ["Saisonaler Stand", "Abholung oder Lieferung sichtbar machen"]],
    marketEyebrow: "Die Marktchance",
    marketTitle: "Verkaufen wird unabhängig von Öffnungszeiten.",
    marketText: "Wenn Menschen etwas genau jetzt sehen und haben wollen, muss der Kaufmoment nicht bis morgen warten. Kleine Händler können so Chancen zurückholen, die sonst an große Onlineplattformen verloren gehen. Bevor ein Kunde später bei Amazon kauft, kann der lokale Händler den Kaufmoment direkt abschließen.",
    hardwareEyebrow: "Hardware, die zum Handel passt",
    hardwareTitle: "Leistbare digitale Preisschilder statt Papier.",
    hardwareText: "Papier ist billig, aber statisch. Tablets sind dynamisch, aber zu teuer. qr2buy setzt auf einfache, robuste und leistbare Display-Hardware – mit Produktname, Preis, Status, QR und kurzer Info im Mittelpunkt.",
    adminEyebrow: "Nicht nur Frontend",
    adminTitle: "Produktseite, Händlerbereich, Datenbank und Preisschild greifen zusammen.",
    adminText: "Der geschützte Händlerbereich im Demo-MVP zeigt, wohin qr2buy wächst: Produkte, Preise, Bestand und Preisschild-Anzeige an einem Ort verwalten – ohne Enterprise-Versprechen, aber mit einem konkreten Fundament.",
    partnerEyebrow: "Gemeinsam in den Markt",
    partnerTitle: "Technik steht. Jetzt suchen wir Menschen, die mitbauen wollen.",
    partnerText: "ecily arbeitet an mehreren digitalen Produktideen. qr2buy ist live, technisch funktionsfähig, hat einen Hardware-Prototyp und zeigt einen konkreten Demo-Ablauf. Gesucht werden Menschen, die Verantwortung für Markt, Vertrieb, Pilotkunden und Wachstum übernehmen.",
    equity: "Equity-basiertes Partnering möglich",
    talk: "Mit ecily über qr2buy sprechen",
    pilotEyebrow: "Pilotphase",
    pilotTitle: "Hast du ein Schaufenster, eine Auslage oder eine saisonale Verkaufsfläche?",
    pilotText: "Wenn du ein Schaufenster, eine Auslage oder eine saisonale Verkaufsfläche hast, testen wir gemeinsam, ob deine sichtbaren Produkte auch außerhalb deiner Anwesenheit kaufbar werden.",
    pilotCta: "Mit ecily über qr2buy sprechen",
    aboutEyebrow: "Hinter qr2buy",
    aboutText: "qr2buy entsteht aus langjähriger Management-, Business- und Produktentwicklungserfahrung. Der MVP ist live und wird jetzt mit Pilotpartnern weiter geschärft.",
    footer: "QR-Commerce für sichtbare Produkte.",
    language: "Sprache",
  },
  en: {
    nav: { demo: "Demo", useCases: "Who for?", partner: "Become a partner", about: "About qr2buy" },
    eyebrow: "An ecily.com project",
    hero: "Buying and selling should not depend on opening hours.",
    heroText: "qr2buy makes products in shop windows instantly buyable or reservable – no app required, directly on the phone, with reliable feedback after confirmed payment.",
    heroTrust: "Only after payment is confirmed does qr2buy notify the buyer, the seller and the digital price display. Interest becomes a clear, traceable purchase moment.",
    buyerLabel: "For buyers",
    buyerText: "See it. Scan it. Secure it.",
    sellerLabel: "For sellers",
    sellerText: "Go home – and keep selling, even at the weekend.",
    heroBadges: ["Live MVP", "Hardware prototype", "Demo flow"],
    demoCta: "See the demo",
    partnerCta: "Talk to ecily about qr2buy",
    pilotNote: "Working MVP · Pilot phase",
    heroPoints: ["No app required", "Buy or reserve", "Inventory-aware display"],
    demoEyebrow: "Interactive demo",
    demoTitle: "Try it live – just your phone, no app.",
    demoText: "Scan a product. Buy it in secure Stripe test mode or reserve it for collection.",
    displayOnline: "LIVE DISPLAY",
    scanHint: "Scan with your phone",
    noApp: "No app required",
    openHere: "Open demo on this device",
    liveBadge: "Live demo · no real payment",
    available: "Still available",
    reserved: "Reserved for you",
    sold: "Already sold",
    stock: "Stock",
    onePiece: "One-off piece",
    demoStock: "Fictional demo stock",
    buy: "Simulate purchase",
    reserve: "Simulate reservation",
    reset: "Reset demo status",
    demoNotice: "No real order is created. Please use test data only.",
    demoJourney: ["Interest", "Scan", "Confirmation", "Display reacts"],
    demoCompleteTitle: "One product. One scan. Clear feedback.",
    demoCompleteText: "You have just seen how qr2buy works. If you see the potential and want to help build it, talk to ecily.",
    paidLive: "Thank you! We received your request. Enjoy your product.",
    reservedLive: "Reserved! We received your demo reservation.",
    displayPaidTitle: "Payment confirmed",
    displayPaidMessage: "Thank you! Enjoy your product.",
    displayReservedTitle: "Reserved for you",
    displayReservedMessage: "Set aside for collection.",
    displaySoldLabel: "SOLD",
    displaySoldTitle: "This tree has already been sold.",
    displaySoldMore: "We still have others for you.",
    displaySoldWish: "Take a look around. Merry Christmas!",
    displayTreeReservedLabel: "RESERVED",
    displayTreeReservedTitle: "This tree is already reserved.",
    displayTreeReservedMore: "Other products are still waiting for you.",
    stripeConfirmed: "Stripe confirmed the test purchase on the server.",
    resetsIn: "This demo resets in {seconds} seconds.",
    connecting: "Preparing your secure live demo …",
    demoError: "The live demo is temporarily unavailable.",
    retry: "Try again",
    connectionLive: "Live connection active",
    connectionPolling: "Restoring live connection",
    checkoutStarted: "Test checkout opened",
    cancelled: "Test checkout cancelled",
    scanDetected: "SCAN DETECTED",
    continueOnPhone: "Please continue on your phone",
    selected: "Selected",
    scenariosEyebrow: "Why it matters",
    scenariosTitle: "When interest is there, the purchase should not have to wait.",
    scenarios: [["After closing", "The window keeps capturing purchase intent even when the door is closed."], ["During busy hours", "Customers scan themselves and move forward without waiting in line."], ["For one-off pieces", "A live status change prevents double sales and makes scarcity clear."]],
    whyEyebrow: "More than a QR code",
    whyTitle: "More than a QR code. A reliable purchase moment.",
    whyText: "A regular price tag only shows the price. A regular QR code leads somewhere. qr2buy connects the specific product to buying or reserving and makes the confirmed change visible right away.",
    whyItems: ["Regular price tag: only shows the price", "Regular QR code: leads somewhere", "qr2buy: knows the product and its status", "Confirmed payment: buyer, seller and display know"],
    stepsEyebrow: "How it works",
    steps: [["1", "Place", "Put the QR price tag beside the product."], ["2", "Scan", "Use the camera – no download, no account."], ["3", "Act", "Buy or reserve while the live status keeps up."]],
    casesEyebrow: "For local selling spaces",
    casesTitle: "One system, many situations.",
    cases: [["Boutique", "One-off pieces in the window"], ["Bookshop", "Stock moving despite a busy till"], ["Gallery", "Originals and limited editions"], ["Pop-up", "Sell without extra infrastructure"], ["Seasonal stand", "Make collection or delivery clear"]],
    marketEyebrow: "The opportunity",
    marketTitle: "Selling becomes independent of opening hours.",
    marketText: "When people see something and want it right now, the purchase does not have to wait until tomorrow. Small retailers can recover opportunities that might otherwise move to large online platforms. Before a customer later buys on Amazon, a local retailer can close that moment directly.",
    hardwareEyebrow: "Hardware that fits retail",
    hardwareTitle: "Affordable digital price displays instead of paper.",
    hardwareText: "Paper is cheap but static. Tablets are dynamic but too expensive. qr2buy aims for simple, robust and affordable display hardware – with the product, price, status, QR and short information in focus.",
    adminEyebrow: "Not just frontend",
    adminTitle: "Product page, merchant area, database and display work together.",
    adminText: "The protected merchant area in the demo MVP shows where qr2buy is going: manage products, prices, stock and display content in one place – without enterprise claims, but with a concrete foundation.",
    partnerEyebrow: "Build the market together",
    partnerTitle: "The technology is here. Now we are looking for people who want to build the market.",
    partnerText: "ecily is working on several digital product ideas. qr2buy is live, technically working, has a hardware prototype and demonstrates a concrete flow. We are looking for people ready to take responsibility for market, sales, pilot customers and growth.",
    equity: "Equity-based partnering possible",
    talk: "Talk to ecily about qr2buy",
    pilotEyebrow: "Pilot phase",
    pilotTitle: "Do you have a window, display area or seasonal selling space?",
    pilotText: "If you have a shop window, display area or seasonal selling space, we can test together whether your visible products can be bought even when you are not there.",
    pilotCta: "Talk to ecily about qr2buy",
    aboutEyebrow: "About qr2buy",
    aboutText: "qr2buy grows from years of management, business and product development experience. The MVP is live and now being sharpened with pilot partners.",
    footer: "QR commerce for products in the real world.",
    language: "Language",
  },
};

const merchantCopy = {
  de: {
    nav: { demo: "Live-Demo", benefits: "Nutzen", useCases: "Einsatzorte", pilot: "Pilot" },
    eyebrow: "Das digitale Verkaufsschild für Händler",
    hero: "Dein Schaufenster verkauft weiter – auch wenn du längst geschlossen hast.",
    heroText: "Mit qr2buy können Passanten sichtbare Produkte direkt kaufen oder reservieren. Einfach QR-Code scannen – keine App und kein Mitarbeiter vor Ort nötig.",
    heroTrust: "Aus einem einfachen Preisschild wird eine digitale Verkaufsstelle.",
    demoCta: "Live-Demo ausprobieren",
    howCta: "So funktioniert qr2buy",
    heroVisualCaption: "ECHTES SCHILD · DISPLAY REAGIERT",
    demoIntroHardware: "Die Darstellung hier simuliert das physische qr2buy-Verkaufsschild.",
    demoIntroHardwareDetail: "Der echte Hardware-Prototyp nutzt denselben Backend-Ablauf und reagiert ebenfalls auf Produktwechsel, Reservierungen und Käufe.",
    demoSteps: ["Produkt am Schild sehen", "Ohne App scannen", "Im Browser kaufen oder reservieren", "Physisches Schild reagiert"],
    demoEyebrow: "Live-Simulation",
    demoTitle: "Probier aus, wie dein Schaufenster nach Ladenschluss weiterverkauft.",
    demoText: "Diese Demo zeigt, wie ein reales qr2buy-Verkaufsschild funktioniert. Produkt, Preis, QR und Verkaufsstatus sind mit dem Backend verbunden und reagieren live.",
    demoSafetyLabel: "Stripe-Testmodus · garantiert keine Abbuchung",
    demoSafetyText: "Diese Live-Demo läuft ausschließlich in der Stripe-Sandbox. 4242 4242 4242 4242 ist eine offizielle Stripe-Testkarte – keine echte Kreditkarte. In dieser Demo kann niemals echtes Geld abgebucht und keine echte Bestellung ausgelöst werden.",
    demoSafetyGuide: "Nach dem QR-Scan führen wir dich Schritt für Schritt durch den sicheren Test.",
    demoSafetyConfirm: "Verstanden – ich starte den sicheren Test",
    demoSafetyConfirmed: "Alles klar. Die sichere Demo ist jetzt bereit.",
    demoSafetyWaiting: "Bestätige zuerst den Testmodus. Danach startet deine persönliche DemoSession.",
    displaySimulationLabel: "Demo des physischen Verkaufsschilds",
    displaySelectionHint: "Deine Produktauswahl steuert dieses Verkaufsschild.",
    selected: "Ausgewähltes Produkt",
    problemEyebrow: "Der verpasste Kaufmoment",
    problemTitle: "Kein verlorener Interessent nur wegen geschlossener Tür.",
    problemText: "Samstagabend. Jemand sieht dein Produkt im Schaufenster. Heute geht er weiter. Mit qr2buy kann er es direkt kaufen oder reservieren.",
    benefitsEyebrow: "Der Hauptnutzen",
    benefitsTitle: "Das Verkaufsschild zeigt nicht nur den Preis. Es verkauft.",
    benefitsText: "qr2buy macht den Kaufmoment nutzbar, während das Produkt bereits vor Augen ist.",
    benefits: [
      ["Keine App", "Die Smartphone-Kamera genügt."],
      ["24/7 kauf- oder reservierbar", "Auch wenn kein Mitarbeiter vor Ort ist."],
      ["Live-Bestätigung am Schild", "Das physische Schild reagiert sichtbar auf Kauf oder Reservierung."],
      ["Sofortige Bestätigung", "Der Status erscheint direkt; beim Kauf kann zusätzlich ein Demo-Beleg per E-Mail folgen."],
    ],
    compareEyebrow: "Der Unterschied",
    compareTitle: "Mehr als ein QR-Code.",
    compareStandardLabel: "Normaler QR-Code",
    compareStandardText: "Öffnet nur eine Website.",
    compareQr2buyLabel: "qr2buy",
    compareQr2buyText: "Verbindet Produkt, Preis, Checkout, Verfügbarkeit und den physischen Verkaufsstatus.",
    reuseEyebrow: "Wiederverwendbar statt statisch",
    reuseTitle: "Ein Schild. Immer wieder neue Produkte.",
    reuseText: "Produkt, Preis, QR und Status werden neu zugewiesen. Das physische Schild bleibt.",
    reuseTimeline: [["Heute", "Ledertasche"], ["Morgen", "Kunstdruck"], ["Nächste Woche", "Anderes Produkt"]],
    trustEyebrow: "Klarheit beim Kauf",
    trustTitle: "Der Käufer weiß genau, was er gerade kauft.",
    trustText: "Du siehst sofort, dass es geklappt hat: Das Schild vor dem Produkt bestätigt deinen Kauf oder deine Reservierung live.",
    trustItems: ["Derselbe Produktname auf Schild und Smartphone", "Preis und aktuelle Verfügbarkeit sichtbar", "Sicherer Checkout über einen etablierten Zahlungsanbieter", "Optionaler E-Mail-Beleg beim bestätigten Testkauf"],
    casesEyebrow: "Für kleine und mittlere Händler",
    casesTitle: "Für Geschäfte, deren Produkte auch nach Ladenschluss sichtbar bleiben.",
    casesText: "Besonders stark dort, wo Produkte gesehen werden, aber nicht immer ein Mitarbeiter danebensteht.",
    cases: [["Mode & Accessoires", "Produkte im Schaufenster direkt kauf- oder reservierbar machen."], ["Kunst & Galerie", "Originale und limitierte Arbeiten auch nach Ladenschluss verkaufen."], ["Design & Einrichtung", "Ausstellungsstücke im Showroom direkt kaufbar machen."], ["Fahrräder", "Sichtbare Modelle außerhalb der Öffnungszeiten reservierbar machen."], ["Pflanzen", "Ausgewählte Pflanzen direkt vor Ort verkaufen."], ["Hochwertige Einzelstücke", "Identität, Preis und Status eines konkreten Produkts sichtbar halten."], ["Showrooms", "Ausgestellte Produkte ohne permanente Betreuung verkaufen."]],
    howEyebrow: "So funktioniert qr2buy",
    howTitle: "Vom Blick ins Schaufenster bis zur Rückmeldung am Schild.",
    howSteps: [["1", "Produkt sehen", "Das physische Display zeigt Produkt, Preis, QR und Verfügbarkeit."], ["2", "Scannen", "Die Smartphone-Kamera öffnet die mobile Produktseite – ohne App."], ["3", "Kaufen oder reservieren", "Der Käufer schließt den Vorgang direkt im Browser ab."], ["4", "Status sehen", "Das physische Display übernimmt die bestätigte Änderung."]],
    hardwareEyebrow: "Hardwarebeweis",
    hardwareTitle: "Es funktioniert bereits auf echter Hardware.",
    hardwareText: "Der qr2buy-Prototyp verbindet ein echtes Farbdisplay mit dem Backend. Produktwechsel und Verkaufsstatus werden synchronisiert, der dargestellte QR-Code ist real scanbar.",
    hardwareFacts: ["Echtes Farbdisplay", "Live mit dem Backend verbunden", "Produktwechsel synchron", "QR real scanbar", "Reservierungs- und Kaufstatus am Display sichtbar"],
    pilotEyebrow: "Erste Pilotanwendungen",
    pilotTitle: "Willst du dein Schaufenster auch nach Ladenschluss verkaufen lassen?",
    pilotText: "Wir suchen Händler und Partner für erste reale Pilotanwendungen.",
    pilotCta: "Mit ecily über qr2buy sprechen",
    faqEyebrow: "Kurz beantwortet",
    faqTitle: "Häufige Fragen zu qr2buy",
    faq: [
      ["Ist die Demo eine echte Bestellung?", "Nein. Es gibt keine echte Bestellung und keine Abbuchung. Der Checkout läuft ausschließlich in der Stripe-Sandbox."],
      ["Was ist auf dieser Seite simuliert?", "Die Website simuliert das physische Schild mit fiktiven Produkten und Beständen. Der technische Ablauf zwischen Smartphone, Serverstatus und Display entspricht dem realen Hardwareablauf."],
      ["Gibt es das Verkaufsschild bereits als Hardware?", "Ja. Ein reales Hardwaredisplay und der vollständige technische Ablauf sind vorhanden."],
      ["Brauchen Kunden eine App?", "Nein. Die Kamera und ein moderner Browser reichen; ein Benutzerkonto ist nicht erforderlich."],
      ["Was passiert nach einem Kauf oder einer Reservierung?", "Der bestätigte Status wird an das physische Display übertragen und dort unmittelbar sichtbar."],
      ["Was kostet qr2buy?", "Der Preis wird passend zum Einsatzort und Umfang eines Pilotprojekts individuell geplant."],
      ["Wie kann ein Pilotprojekt aussehen?", "Wir planen mit dem Händler einen überschaubaren Test an einem konkreten Verkaufsort. Je nach Rahmen kann dieser kostenlos oder gefördert umgesetzt werden."],
    ],
    talk: "Mit ecily über qr2buy sprechen",
    footer: "Das physische QR-Verkaufsschild für Produkte am Verkaufsort.",
  },
  en: {
    nav: { demo: "Live demo", benefits: "Benefits", useCases: "Where it works", pilot: "Pilot" },
    eyebrow: "The digital sales display for merchants",
    hero: "Your shop window keeps selling – long after you have closed.",
    heroText: "With qr2buy, passers-by can buy or reserve visible products straight away. They simply scan the QR code – no app and no staff member on site required.",
    heroTrust: "A simple price tag becomes a digital point of sale.",
    demoCta: "Try the live demo",
    howCta: "How qr2buy works",
    heroVisualCaption: "REAL DISPLAY · STATUS REACTS",
    demoIntroHardware: "The display shown here simulates the physical qr2buy sales display.",
    demoIntroHardwareDetail: "The real hardware prototype uses the same backend flow and also responds to product changes, reservations and purchases.",
    demoSteps: ["See the product at the display", "Scan without an app", "Buy or reserve in the browser", "The physical display responds"],
    demoEyebrow: "Live simulation",
    demoTitle: "See how your shop window can keep selling after closing time.",
    demoText: "This demo shows how a real qr2buy sales display works. Product, price, QR code and sales status are connected to the backend and respond live.",
    demoSafetyLabel: "Stripe test mode · guaranteed no charge",
    demoSafetyText: "This live demo runs exclusively in the Stripe Sandbox. 4242 4242 4242 4242 is an official Stripe test card – not a real credit card. This demo can never charge real money or create a real order.",
    demoSafetyGuide: "After scanning the QR code, we guide you safely through every test step.",
    demoSafetyConfirm: "I understand – start the safe demo",
    demoSafetyConfirmed: "All set. The safe demo is now ready.",
    demoSafetyWaiting: "Confirm the test mode first. Your personal demo session will then begin.",
    displaySimulationLabel: "Demo of the physical sales display",
    displaySelectionHint: "Your product selection controls this sales display.",
    selected: "Selected product",
    problemEyebrow: "The missed buying moment",
    problemTitle: "Do not lose an interested buyer just because the door is closed.",
    problemText: "Saturday evening. Someone spots your product in the window. Today, they walk on. With qr2buy, they can buy or reserve it there and then.",
    benefitsEyebrow: "The core benefit",
    benefitsTitle: "The sales display does more than show the price. It sells.",
    benefitsText: "qr2buy captures the buying moment while the product is still right in front of the customer.",
    benefits: [
      ["No app", "The smartphone camera is all buyers need."],
      ["Buy or reserve 24/7", "Even when no staff member is on site."],
      ["Live confirmation on the display", "The physical display visibly responds to a purchase or reservation."],
      ["Immediate confirmation", "The status appears at once; a demo receipt can also follow by email after a purchase."],
    ],
    compareEyebrow: "The difference",
    compareTitle: "More than a QR code.",
    compareStandardLabel: "Regular QR code",
    compareStandardText: "Only opens a website.",
    compareQr2buyLabel: "qr2buy",
    compareQr2buyText: "Connects the product, price, checkout, availability and physical sales status.",
    reuseEyebrow: "Reusable, not static",
    reuseTitle: "One display. New products again and again.",
    reuseText: "Product, price, QR code and status are reassigned. The physical display stays.",
    reuseTimeline: [["Today", "Leather bag"], ["Tomorrow", "Art print"], ["Next week", "Another product"]],
    trustEyebrow: "Clarity at checkout",
    trustTitle: "Buyers know exactly what they are buying.",
    trustText: "You can see immediately that it worked: the display beside the product confirms your purchase or reservation live.",
    trustItems: ["The same product name on display and phone", "Price and current availability are visible", "Secure checkout through an established payment provider", "Optional email receipt after a confirmed test purchase"],
    casesEyebrow: "For small and medium-sized merchants",
    casesTitle: "For stores whose products remain visible after closing time.",
    casesText: "Especially useful where products attract attention but a staff member is not always standing beside them.",
    cases: [["Fashion & accessories", "Make shop-window products directly buyable or reservable."], ["Art & galleries", "Sell originals and limited works after closing time."], ["Design & interiors", "Make showroom pieces directly buyable."], ["Bicycles", "Let buyers reserve visible models outside opening hours."], ["Plants", "Sell selected plants directly where they are displayed."], ["Premium one-off pieces", "Keep a specific product’s identity, price and status visible."], ["Showrooms", "Sell displayed products without permanent staffing."]],
    howEyebrow: "How qr2buy works",
    howTitle: "From spotting a product to seeing feedback on the display.",
    howSteps: [["1", "See the product", "The physical display shows the product, price, QR code and availability."], ["2", "Scan", "The smartphone camera opens the mobile product page – no app required."], ["3", "Buy or reserve", "The buyer completes the action directly in the browser."], ["4", "See the status", "The physical display adopts the confirmed change."]],
    hardwareEyebrow: "Hardware proof",
    hardwareTitle: "It already works on real hardware.",
    hardwareText: "The qr2buy prototype connects a real colour display to the backend. Product changes and sales status are synchronised, and its QR code can be scanned in practice.",
    hardwareFacts: ["Real colour display", "Live backend connection", "Synchronised product changes", "QR code tested in practice", "Reservation and purchase status visible on the display"],
    pilotEyebrow: "First pilot applications",
    pilotTitle: "Want your shop window to keep selling after closing time?",
    pilotText: "We are looking for merchants and partners for the first real-world pilot applications.",
    pilotCta: "Talk to ecily about qr2buy",
    faqEyebrow: "Quick answers",
    faqTitle: "Frequently asked questions about qr2buy",
    faq: [
      ["Is the demo a real order?", "No. There is no real order and no charge. Checkout runs exclusively in the Stripe Sandbox."],
      ["What is simulated on this page?", "The website simulates the physical display using fictional products and stock. The technical flow between smartphone, server status and display matches the real hardware flow."],
      ["Does the sales display already exist as hardware?", "Yes. A real hardware display and the complete technical flow are available."],
      ["Do customers need an app?", "No. A camera and modern browser are enough; no user account is required."],
      ["What happens after a purchase or reservation?", "The confirmed status is sent to the physical display and becomes visible immediately."],
      ["What does qr2buy cost?", "Pricing is planned individually for the location and scope of each pilot project."],
      ["What could a pilot project look like?", "We plan a focused trial with the merchant at a specific point of sale. Depending on the framework, it may be free of charge or supported by funding."],
    ],
    talk: "Talk to ecily about qr2buy",
    footer: "The physical QR sales display for products at the point of sale.",
  },
};

const products = [
  { key: "bag", name: { de: "Handgemachte Ledertasche", en: "Handmade leather bag" }, place: { de: "Boutique · Kleinserie", en: "Boutique · small collection" }, price: 129, currency: "EUR", color: "clay", stock: 3, alternatives: { de: "Weitere Taschenmodelle verfügbar", en: "Other bag styles available" } },
  { key: "book", name: { de: "Roman ‚Stadtlichter‘", en: "Novel ‘City Lights’" }, place: { de: "Buchhandlung · Lagerware", en: "Bookshop · stock item" }, price: 24.9, currency: "EUR", color: "sage", stock: 8, alternatives: { de: "Weitere Exemplare verfügbar", en: "More copies available" } },
  { key: "print", name: { de: "Gerahmter Kunstdruck", en: "Framed art print" }, place: { de: "Galerie · limitiert", en: "Gallery · limited" }, price: 390, currency: "EUR", color: "ink", stock: 1, alternatives: { de: "Weitere Stadtbilder verfügbar", en: "Other city prints available" } },
  { key: "tree", name: { de: "Nordmanntanne Nr. 17", en: "Nordmann fir no. 17" }, place: { de: "Saisonaler Stand", en: "Seasonal stand" }, price: 59, currency: "EUR", color: "pine", stock: 1, alternatives: { de: "Weitere Tannen verfügbar", en: "Other trees available" }, unique: true },
];

function StatusPill({ status, t }) {
  const normalized = ["PAID", "SOLD"].includes(status) ? "sold" : status === "RESERVED" ? "reserved" : status === "CHECKOUT_STARTED" ? "checkout" : status === "CANCELLED" ? "cancelled" : "available";
  const label = normalized === "sold" ? t.sold : normalized === "reserved" ? t.reserved : normalized === "checkout" ? t.checkoutStarted : normalized === "cancelled" ? t.cancelled : t.available;
  return <span className={`demo-status demo-status--${normalized}`}><span className="demo-status__dot" />{label}</span>;
}

function QrMockup({ value, label }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    if (!value) return undefined;
    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 4, width: 280, color: { dark: "#102820", light: "#ffffff" } })
      .then((result) => { if (active) setSrc(result); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [value]);

  return <a className="qr-mockup" href={value || undefined} aria-label={label}>
    {src ? <img src={src} alt="" /> : <span className="demo-loader" aria-hidden="true" />}
    <span className="qr-mockup__caption">{label}</span>
  </a>;
}

function ResetCountdown({ resetAt, t }) {
  const [seconds, setSeconds] = useState(20);
  useEffect(() => {
    if (!resetAt) return undefined;
    const update = () => setSeconds(Math.max(0, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [resetAt]);
  return <span>{t.resetsIn.replace("{seconds}", seconds)}</span>;
}

function HardwareDisplayConfirmation({ mode, title, unique, t }) {
  const paid = mode === "paid";
  const sold = mode === "sold";
  const permanentlyReserved = mode === "reserved" && unique;
  return <div className={`hardware-display-confirmation hardware-display-confirmation--${mode}`} role="status" aria-live="polite" aria-atomic="true">
    <span className="hardware-display-confirmation__icon" aria-hidden="true">{sold ? "×" : "✓"}</span>
    <span className="hardware-display-confirmation__state">{sold ? t.displaySoldLabel : permanentlyReserved ? t.displayTreeReservedLabel : ""}</span>
    <strong>{sold ? t.displaySoldTitle : permanentlyReserved ? t.displayTreeReservedTitle : paid ? t.displayPaidTitle : t.displayReservedTitle}</strong>
    <span className="hardware-display-confirmation__product">{title}</span>
    {sold ? <><p>{t.displaySoldMore}</p><p>{t.displaySoldWish}</p></> : <p>{permanentlyReserved ? t.displayTreeReservedMore : paid ? t.displayPaidMessage : t.displayReservedMessage}</p>}
  </div>;
}

function HardwareDisplayScan({ title, price, t }) {
  return <div className="hardware-display-scan" role="status" aria-live="polite" aria-atomic="true">
    <span>{t.scanDetected}</span>
    <strong>{t.continueOnPhone}</strong>
    <div><b>{title}</b><small>{price}</small></div>
  </div>;
}

function ProductDemo({ lang, t }) {
  const [safetyConfirmed, setSafetyConfirmed] = useState(() => hasDemoSafetyConfirmation(window.sessionStorage));
  const [selectedId, setSelectedId] = useState("book");
  const [live, setLive] = useState(null);
  const [error, setError] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState("disconnected");
  const [showHardwarePairing, setShowHardwarePairing] = useState(false);
  const [pairingSecret, setPairingSecret] = useState("");
  const [hardwareError, setHardwareError] = useState("");
  const started = useRef(false);
  const eventVersions = useRef(new Map());
  const lastHardwareSync = useRef(null);
  const catalog = live?.products || products;
  const product = catalog.find((item) => item.key === selectedId) || catalog[0];
  const state = live?.session?.products?.find((item) => item.productKey === selectedId) || { status: "READY" };
  const title = product.name[lang];
  const price = new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { style: "currency", currency: product.currency }).format(product.price);
  const demoUrl = live?.token ? `${window.location.origin}/demo/p/${product.key}#session=${encodeURIComponent(live.token)}` : "";
  const complete = ["PAID", "RESERVED", "SOLD"].includes(state.status);
  const displayMode = getHardwareDisplayMode(state.status, state.interactionState);

  useEffect(() => {
    if (!safetyConfirmed) return;
    if (started.current) return;
    started.current = true;
    restoreOrCreateDemoSession({ storage: window.sessionStorage, getSession: getDemoSession, createSession: createDemoSession })
      .then(({ live: nextLive, restored }) => {
        if (restored) {
          const binding = readHardwareBinding(window.sessionStorage);
          if (binding) {
            lastHardwareSync.current = binding;
            setSelectedId(binding.productKey);
            setHardwareStatus("connected");
          }
        }
        setLive(nextLive);
      })
      .catch(() => setError(true));
  }, [safetyConfirmed]);

  const acknowledgeSafety = () => {
    confirmDemoSafety(window.sessionStorage);
    setSafetyConfirmed(true);
  };

  useEffect(() => {
    if (!live?.token) return undefined;
    const token = live.token;
    let active = true;
    const applySnapshot = (snapshot) => {
      if (!active) return;
      const nextStates = snapshot?.session?.products || [];
      const activeProduct = nextStates.find((item) => {
        const previousVersion = eventVersions.current.get(item.productKey);
        return previousVersion !== undefined && item.eventVersion > previousVersion && ["CHECKOUT_STARTED", "PAID", "RESERVED", "SOLD"].includes(item.status);
      });
      eventVersions.current = new Map(nextStates.map((item) => [item.productKey, item.eventVersion]));
      if (activeProduct) setSelectedId(activeProduct.productKey);
      setLive((current) => ({ ...snapshot, token: current?.token || token }));
      setError(false);
    };
    const refresh = () => getDemoSession(token).then(applySnapshot).catch(() => setConnected(false));
    const events = new EventSource(`/api/demo/sessions/${encodeURIComponent(token)}/events`);
    events.onopen = () => { setConnected(true); refresh(); };
    events.onerror = () => setConnected(false);
    events.addEventListener("snapshot", (event) => {
      try { applySnapshot(JSON.parse(event.data)); } catch { setConnected(false); }
    });
    const poll = setInterval(refresh, 4000);
    return () => {
      active = false;
      clearInterval(poll);
      events.close();
    };
  }, [live?.token]);

  useEffect(() => {
    if (hardwareStatus !== "connected" || !live?.token) return undefined;
    let active = true;
    syncHardwareSelection({
      update: updateDemoHardwareBinding,
      storage: window.sessionStorage,
      token: live.token,
      current: lastHardwareSync.current,
      productKey: selectedId,
      locale: lang
    }).then(({ marker }) => {
      if (active) lastHardwareSync.current = marker;
    }).catch(() => {
      if (!active) return;
      clearHardwareBinding(window.sessionStorage);
      lastHardwareSync.current = null;
      setHardwareStatus("error");
      setHardwareError(t.hardwareSyncError);
    });
    return () => { active = false; };
  }, [hardwareStatus, lang, live?.token, selectedId, t.hardwareSyncError]);

  const retry = () => {
    setError(false);
    clearHardwareBinding(window.sessionStorage);
    lastHardwareSync.current = null;
    setHardwareStatus("disconnected");
    createFreshDemoSession({ storage: window.sessionStorage, createSession: createDemoSession }).then(setLive).catch(() => setError(true));
  };

  const pairHardware = async (event) => {
    event.preventDefault();
    if (!live?.token || !pairingSecret) return;
    setHardwareStatus("connecting");
    setHardwareError("");
    try {
      const { marker } = await bindHardwareForSession({
        bind: bindDemoHardware,
        storage: window.sessionStorage,
        token: live.token,
        pairingSecret,
        productKey: selectedId,
        locale: lang
      });
      lastHardwareSync.current = marker;
      setHardwareStatus("connected");
      setShowHardwarePairing(false);
    } catch {
      clearHardwareBinding(window.sessionStorage);
      lastHardwareSync.current = null;
      setHardwareStatus("error");
      setHardwareError(t.hardwarePairError);
    } finally {
      setPairingSecret("");
    }
  };

  return <section className="landing-section landing-demo" id="demo">
    <div className="landing-shell">
      <div className="landing-section-heading landing-section-heading--split">
        <div><span className="landing-eyebrow">{t.liveBadge}</span><h2>{t.demoTitle}</h2></div>
        <p>{t.demoText}</p>
      </div>
      <div className="demo-hardware-context"><p><strong>{t.demoIntroHardware}</strong></p><p>{t.demoIntroHardwareDetail}</p></div>
      <ol className="demo-flow-steps" aria-label={t.demoEyebrow}>{t.demoSteps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
      <div className={`demo-safety-strip ${safetyConfirmed ? "is-confirmed" : ""}`} role="note"><strong>{t.demoSafetyLabel}</strong><p>{t.demoSafetyText}</p><span>{t.demoSafetyGuide}</span>{!safetyConfirmed ? <button type="button" onClick={acknowledgeSafety}>{t.demoSafetyConfirm}</button> : <span className="demo-safety-confirmed" role="status"><i aria-hidden="true">✓</i>{t.demoSafetyConfirmed}</span>}</div>
      {!safetyConfirmed && <div className="demo-gated-preview" aria-disabled="true"><span className="demo-gated-preview__display"><BrandLogo /></span><strong>{t.demoSafetyWaiting}</strong></div>}
      {safetyConfirmed && !live && !error && <div className="demo-session-loading" role="status"><span className="demo-loader" />{t.connecting}</div>}
      {safetyConfirmed && error && <div className="demo-session-error" role="alert"><span>{t.demoError}</span><button onClick={retry}>{t.retry}</button></div>}
      {safetyConfirmed && live && <>
      <div className="demo-layout">
        <div className="display-column">
          <div className="display-simulation-label"><strong>{t.displaySimulationLabel}</strong><span>{t.displaySelectionHint}</span></div>
          <div className="display-card">
          <div className="display-card__top"><BrandLogo /><span>{connected ? t.connectionLive : t.connectionPolling} <b className={connected ? "" : "is-reconnecting"} /></span></div>
          <div className={`display-card__screen ${displayMode !== "product" ? "display-card__screen--confirmation" : ""}`}>
            {displayMode === "product" ? <>
              <div className="display-card__qr"><QrMockup value={demoUrl} label={t.scanHint} /><small>{t.noApp}</small><a className="demo-open-mobile" href={demoUrl}>{t.openHere}</a></div>
              <div className="display-card__product"><span className="display-card__label">{product.place[lang]}</span><strong>{title}</strong><span className="display-card__price">{price}</span><StatusPill status={state.status} t={t} /><span className="display-card__stock">{t.demoStock}: {product.stock} · {product.alternatives?.[lang]}</span></div>
            </> : displayMode === "scan" ? <HardwareDisplayScan title={title} price={price} t={t} /> : <HardwareDisplayConfirmation mode={displayMode} title={title} unique={product.unique} t={t} />}
          </div>
          <div className="display-card__footer"><span>QR2BUY DISPLAY</span><span>v1.0 · LIVE</span></div>
          </div>
        </div>
        <div className="demo-control">
          <div className="demo-control__head"><div><span className="landing-eyebrow">{t.selected}</span><h3>{title}</h3></div><span className="demo-live-chip"><i />{t.liveBadge}</span></div>
          <div className="product-picker" role="listbox" aria-label={t.selected}>
            {catalog.map((item) => {
              const itemStatus = live?.session?.products?.find((entry) => entry.productKey === item.key)?.status || "READY";
              return <button key={item.key} className={`product-option ${item.key === selectedId ? "is-selected" : ""}`} onClick={() => setSelectedId(item.key)} role="option" aria-selected={item.key === selectedId}><span className={`product-option__swatch product-option__swatch--${item.color}`} /><span><strong>{item.name[lang]}</strong><small>{item.place[lang]} · <StatusPill status={itemStatus} t={t} /></small></span><b>{new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { style: "currency", currency: item.currency }).format(item.price)}</b></button>;
            })}
          </div>
          <a className="demo-button demo-button--primary demo-open-desktop" href={demoUrl}>{t.openHere}</a>
          <div className="demo-journey" aria-label={t.demoEyebrow}>{t.demoJourney.map((step, index) => <span key={step}><b>{index + 1}</b>{step}{index < t.demoJourney.length - 1 && <i>→</i>}</span>)}</div>
          <p className="demo-notice"><span>i</span>{t.demoNotice}</p>
          <div className={`demo-hardware-operator demo-hardware-operator--${hardwareStatus}`}>
            <span className="demo-hardware-operator__label">{t.hardwareOperatorLabel}</span>
            {hardwareStatus === "connected" && <p className="demo-hardware-operator__status" role="status"><i />{t.hardwareConnected} · {title}</p>}
            {hardwareStatus === "connecting" && <p className="demo-hardware-operator__status" role="status">{t.hardwareConnecting}</p>}
            {hardwareError && <p className="demo-hardware-operator__error" role="alert">{hardwareError}</p>}
            {!showHardwarePairing && hardwareStatus !== "connecting" && hardwareStatus !== "connected" && <button type="button" className="demo-hardware-operator__toggle" onClick={() => { setShowHardwarePairing(true); setHardwareError(""); }}>{hardwareStatus === "error" ? t.hardwareRetryPairing : t.hardwarePair}</button>}
            {showHardwarePairing && hardwareStatus !== "connecting" && <form onSubmit={pairHardware}>
              <label htmlFor="demo-hardware-pairing-secret">{t.hardwarePairingPrompt}</label>
              <input id="demo-hardware-pairing-secret" type="password" value={pairingSecret} onChange={(event) => setPairingSecret(event.target.value)} autoComplete="off" required />
              <small>{t.hardwarePairingHint}</small>
              <div><button type="submit" disabled={!pairingSecret}>{t.hardwareConnect}</button><button type="button" onClick={() => { setPairingSecret(""); setShowHardwarePairing(false); }}>{t.hardwareCancel}</button></div>
            </form>}
          </div>
          {complete && <div className={`demo-complete demo-complete--${state.status.toLowerCase()}`} role="status" aria-live="polite">
            {state.status === "PAID" && <div className="demo-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>}
            <strong>{state.status === "SOLD" ? t.displaySoldTitle : state.status === "PAID" ? t.paidLive : product.unique ? t.displayTreeReservedTitle : t.reservedLive}</strong>
            {state.status === "PAID" && <p>{t.stripeConfirmed}</p>}
            {state.resetAt && <p className="demo-reset-live"><ResetCountdown resetAt={state.resetAt} t={t} /></p>}
            <a className="demo-complete__link" href={ECILY_STARTUP_URLS[lang]} target="_blank" rel="noreferrer">{t.talk} <span>↗</span></a>
          </div>}
        </div>
      </div>
      </>}
    </div>
  </section>;
}

export default function LandingPage({ initialLanguage }) {
  const initialLang = useMemo(() => initialLanguage || (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en") ? "en" : "de"), [initialLanguage]);
  const [lang, setLang] = useState(initialLang);
  const navigate = useNavigate();
  const t = { ...copy[lang], ...merchantCopy[lang], ...HARDWARE_OPERATOR_COPY[lang] };

  useEffect(() => {
    const title = lang === "de" ? "qr2buy – Scannen. Kaufen. Verkauft." : "qr2buy – Scan. Buy. Sold.";
    const description = lang === "de"
      ? "qr2buy macht sichtbare Produkte im Schaufenster auch außerhalb der Öffnungszeiten direkt kauf- oder reservierbar – ohne App und ohne Mitarbeiter vor Ort."
      : "qr2buy lets customers buy or reserve visible shop-window products even outside opening hours – no app and no staff member required.";
    const canonicalUrl = `https://qr2buy.com/${lang}`;
    document.title = title;
    document.documentElement.lang = lang;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);
    document.querySelector('meta[property="og:locale"]')?.setAttribute("content", lang === "de" ? "de_DE" : "en_US");
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", description);
  }, [lang]);

  const changeLanguage = (nextLanguage) => {
    setLang(nextLanguage);
    navigate(`/${nextLanguage}`, { replace: true });
  };

  return <div className="landing-page">
    <header className="landing-header"><div className="landing-shell landing-header__inner"><a href={`/${lang}`} aria-label="qr2buy home"><BrandLogo /></a><nav className="landing-nav" aria-label="Main navigation"><a href="#demo">{t.nav.demo}</a><a href="#benefits">{t.nav.benefits}</a><a href="#use-cases">{t.nav.useCases}</a><a href="#pilot">{t.nav.pilot}</a></nav><div className="landing-header__actions"><div className="language-switch" aria-label={t.language}><button className={lang === "de" ? "is-active" : ""} onClick={() => changeLanguage("de")} aria-pressed={lang === "de"}>DE</button><button className={lang === "en" ? "is-active" : ""} onClick={() => changeLanguage("en")} aria-pressed={lang === "en"}>EN</button></div><a className="landing-button landing-button--small" href="#demo">{t.demoCta}</a></div></div></header>

    <main>
      <section className="landing-hero"><div className="landing-shell landing-hero__grid"><div className="landing-hero__copy"><span className="landing-eyebrow">{t.eyebrow}</span><h1>{t.hero}</h1><p className="landing-hero__lead">{t.heroText}</p><div className="landing-hero__actions"><a className="landing-button landing-button--primary" href="#demo">{t.demoCta}<span aria-hidden="true">↓</span></a><a className="landing-button landing-button--outline" href="#how">{t.howCta}<span aria-hidden="true">↓</span></a></div><p className="landing-hero__trust">{t.heroTrust}</p></div><div className="hero-visual" aria-label={lang === "de" ? "Illustration eines physischen qr2buy-Verkaufsschilds direkt bei Produkten" : "Illustration of a physical qr2buy sales display beside products"}><div className="hero-visual__glow" /><div className="hero-window"><div className="hero-window__bar"><span /><span /><span /><em>physical point of sale</em></div><div className="hero-window__scene"><div className="hero-window__shelf"><div className="hero-object hero-object--bag" /><div className="hero-object hero-object--book" /><div className="hero-object hero-object--print" /></div><div className="hero-tag"><span>qr2buy</span><strong>STADTLICHTER</strong><b>24,90 €</b><small>{lang === "de" ? "Scannen & kaufen" : "Scan & buy"}</small></div><div className="hero-window__caption">{t.heroVisualCaption}</div></div></div></div></div></section>

      <ProductDemo lang={lang} t={t} />

      <section className="landing-section landing-problem"><div className="landing-shell problem-card"><span className="landing-eyebrow">{t.problemEyebrow}</span><h2>{t.problemTitle}</h2><p>{t.problemText}</p></div></section>

      <section className="landing-section landing-benefits" id="benefits"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.benefitsEyebrow}</span><h2>{t.benefitsTitle}</h2><p className="landing-copy landing-copy--large">{t.benefitsText}</p></div><div className="benefit-grid">{t.benefits.map(([title, text], index) => <article className="benefit-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="landing-section landing-compare"><div className="landing-shell compare-grid"><div><span className="landing-eyebrow">{t.compareEyebrow}</span><h2>{t.compareTitle}</h2></div><div className="compare-cards"><article><span>{t.compareStandardLabel}</span><strong>{t.compareStandardText}</strong></article><article className="is-qr2buy"><span>{t.compareQr2buyLabel}</span><strong>{t.compareQr2buyText}</strong></article></div></div></section>

      <section className="landing-section landing-reuse"><div className="landing-shell reuse-grid"><div><span className="landing-eyebrow">{t.reuseEyebrow}</span><h2>{t.reuseTitle}</h2><p className="landing-copy landing-copy--large">{t.reuseText}</p></div><ol className="reuse-timeline">{t.reuseTimeline.map(([when, product], index) => <li key={when}><span>{when}</span><strong>{product}</strong>{index < t.reuseTimeline.length - 1 && <i aria-hidden="true">→</i>}</li>)}</ol></div></section>

      <section className="landing-section landing-trust"><div className="landing-shell trust-grid"><div><span className="landing-eyebrow">{t.trustEyebrow}</span><h2>{t.trustTitle}</h2><p className="landing-copy landing-copy--large">{t.trustText}</p></div><ul className="trust-list">{t.trustItems.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></div></section>

      <section className="landing-section landing-cases" id="use-cases"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.casesEyebrow}</span><h2>{t.casesTitle}</h2><p className="landing-copy landing-copy--large">{t.casesText}</p></div><div className="merchant-case-grid">{t.cases.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="landing-section landing-how" id="how"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.howEyebrow}</span><h2>{t.howTitle}</h2></div><ol className="how-grid">{t.howSteps.map(([number, title, text]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></div></section>

      <section className="landing-section landing-hardware-proof"><div className="landing-shell hardware-proof-grid"><div><span className="landing-eyebrow">{t.hardwareEyebrow}</span><h2>{t.hardwareTitle}</h2><p className="landing-copy landing-copy--large">{t.hardwareText}</p></div><ul className="hardware-facts">{t.hardwareFacts.map((fact, index) => <li key={fact}><span aria-hidden="true">0{index + 1}</span><strong>{fact}</strong></li>)}</ul></div></section>

      <section className="landing-section landing-faq" id="faq"><div className="landing-shell faq-grid"><div className="landing-section-heading"><span className="landing-eyebrow">{t.faqEyebrow}</span><h2>{t.faqTitle}</h2></div><div className="faq-list">{t.faq.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="landing-section landing-pilot" id="pilot"><div className="landing-shell landing-pilot__inner"><span className="landing-eyebrow">{t.pilotEyebrow}</span><h2>{t.pilotTitle}</h2><p>{t.pilotText}</p><a className="landing-button landing-button--dark" href={ECILY_STARTUP_URLS[lang]} target="_blank" rel="noreferrer">{t.pilotCta}<span aria-hidden="true">↗</span></a></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-shell landing-footer__inner"><div><BrandLogo /><p>{t.footer}</p></div><div className="landing-footer__links"><a href="#demo">{t.nav.demo}</a><a href="#pilot">{t.nav.pilot}</a><a href={ECILY_STARTUP_URLS[lang]} target="_blank" rel="noreferrer">ecily</a></div><span>© {new Date().getFullYear()} qr2buy</span></div></footer>
  </div>;
}
