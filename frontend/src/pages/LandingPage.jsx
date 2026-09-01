import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { createDemoSession, getDemoSession } from "../api.js";
import { getHardwareDisplayMode } from "../demoDisplayState.js";

const ECILY_STARTUP_URL = "https://ecily.com/de/start-up";

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

const products = [
  { key: "bag", name: { de: "Handgemachte Ledertasche", en: "Handmade leather bag" }, place: { de: "Boutique · Kleinserie", en: "Boutique · small collection" }, price: 129, currency: "EUR", color: "clay", stock: 3, alternatives: { de: "Weitere Taschenmodelle verfügbar", en: "Other bag styles available" } },
  { key: "book", name: { de: "Roman ‚Stadtlichter‘", en: "Novel ‘City Lights’" }, place: { de: "Buchhandlung · Lagerware", en: "Bookshop · stock item" }, price: 24.9, currency: "EUR", color: "sage", stock: 8, alternatives: { de: "Weitere Exemplare verfügbar", en: "More copies available" } },
  { key: "print", name: { de: "Gerahmter Kunstdruck", en: "Framed art print" }, place: { de: "Galerie · limitiert", en: "Gallery · limited" }, price: 390, currency: "EUR", color: "ink", stock: 1, alternatives: { de: "Weitere Stadtbilder verfügbar", en: "Other city prints available" } },
  { key: "tree", name: { de: "Nordmanntanne Nr. 17", en: "Nordmann fir no. 17" }, place: { de: "Saisonaler Stand", en: "Seasonal stand" }, price: 59, currency: "EUR", color: "pine", stock: 1, alternatives: { de: "Weitere Tannen verfügbar", en: "Other trees available" }, unique: true },
];

function Logo() {
  return <span className="landing-logo"><span className="landing-logo__mark" aria-hidden="true"><i /><i /><i /><i /></span><span>qr2buy</span></span>;
}

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

function ProductDemo({ lang, t }) {
  const [selectedId, setSelectedId] = useState("book");
  const [live, setLive] = useState(null);
  const [error, setError] = useState(false);
  const [connected, setConnected] = useState(false);
  const started = useRef(false);
  const eventVersions = useRef(new Map());
  const catalog = live?.products || products;
  const product = catalog.find((item) => item.key === selectedId) || catalog[0];
  const state = live?.session?.products?.find((item) => item.productKey === selectedId) || { status: "READY" };
  const title = product.name[lang];
  const price = new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { style: "currency", currency: product.currency }).format(product.price);
  const demoUrl = live?.token ? `${window.location.origin}/demo/p/${product.key}#session=${encodeURIComponent(live.token)}` : "";
  const complete = ["PAID", "RESERVED", "SOLD"].includes(state.status);
  const displayMode = getHardwareDisplayMode(state.status);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createDemoSession().then(setLive).catch(() => setError(true));
  }, []);

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

  const retry = () => {
    setError(false);
    createDemoSession().then(setLive).catch(() => setError(true));
  };

  return <section className="landing-section landing-demo" id="demo">
    <div className="landing-shell">
      <div className="landing-section-heading landing-section-heading--split">
        <div><span className="landing-eyebrow">{t.liveBadge}</span><h2>{t.demoTitle}</h2></div>
        <p>{t.demoText}</p>
      </div>
      {!live && !error && <div className="demo-session-loading" role="status"><span className="demo-loader" />{t.connecting}</div>}
      {error && <div className="demo-session-error" role="alert"><span>{t.demoError}</span><button onClick={retry}>{t.retry}</button></div>}
      {live && <>
      <div className="demo-layout">
        <div className="display-card">
          <div className="display-card__top"><Logo /><span>{connected ? t.connectionLive : t.connectionPolling} <b className={connected ? "" : "is-reconnecting"} /></span></div>
          <div className={`display-card__screen ${displayMode !== "product" ? "display-card__screen--confirmation" : ""}`}>
            {displayMode === "product" ? <>
              <div className="display-card__qr"><QrMockup value={demoUrl} label={t.scanHint} /><small>{t.noApp}</small><a className="demo-open-mobile" href={demoUrl}>{t.openHere}</a></div>
              <div className="display-card__product"><span className="display-card__label">{product.place[lang]}</span><strong>{title}</strong><span className="display-card__price">{price}</span><StatusPill status={state.status} t={t} /><span className="display-card__stock">{t.demoStock}: {product.stock} · {product.alternatives?.[lang]}</span></div>
            </> : <HardwareDisplayConfirmation mode={displayMode} title={title} unique={product.unique} t={t} />}
          </div>
          <div className="display-card__footer"><span>QR2BUY DISPLAY</span><span>v1.0 · LIVE</span></div>
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
          {complete && <div className={`demo-complete demo-complete--${state.status.toLowerCase()}`} role="status" aria-live="polite">
            {state.status === "PAID" && <div className="demo-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>}
            <strong>{state.status === "SOLD" ? t.displaySoldTitle : state.status === "PAID" ? t.paidLive : product.unique ? t.displayTreeReservedTitle : t.reservedLive}</strong>
            {state.status === "PAID" && <p>{t.stripeConfirmed}</p>}
            {state.resetAt && <p className="demo-reset-live"><ResetCountdown resetAt={state.resetAt} t={t} /></p>}
            <a className="demo-complete__link" href={ECILY_STARTUP_URL} target="_blank" rel="noreferrer">{t.talk} <span>↗</span></a>
          </div>}
        </div>
      </div>
      </>}
    </div>
  </section>;
}

export default function LandingPage() {
  const initialLang = useMemo(() => (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en") ? "en" : "de"), []);
  const [lang, setLang] = useState(initialLang);
  const t = copy[lang];

  useEffect(() => {
    document.title = lang === "de" ? "qr2buy – Kaufen und Verkaufen dürfen keine Frage von Öffnungszeiten sein." : "qr2buy – Buying and selling should not depend on opening hours.";
    document.documentElement.lang = lang;
  }, [lang]);

  return <div className="landing-page">
    <header className="landing-header"><div className="landing-shell landing-header__inner"><a href="/" aria-label="qr2buy home"><Logo /></a><nav className="landing-nav"><a href="#demo">{t.nav.demo}</a><a href="#use-cases">{t.nav.useCases}</a><a href="#partner">{t.nav.partner}</a><a href="#about">{t.nav.about}</a></nav><div className="landing-header__actions"><div className="language-switch" aria-label={t.language}><button className={lang === "de" ? "is-active" : ""} onClick={() => setLang("de")}>DE</button><button className={lang === "en" ? "is-active" : ""} onClick={() => setLang("en")}>EN</button></div><a className="landing-button landing-button--small" href="#demo">{t.demoCta}</a></div></div></header>

    <main>
      <section className="landing-hero"><div className="landing-shell landing-hero__grid"><div className="landing-hero__copy"><span className="landing-eyebrow">{t.eyebrow}</span><h1>{t.hero}</h1><p className="landing-hero__lead">{t.heroText}</p><p className="landing-hero__trust">{t.heroTrust}</p><div className="landing-hero__actions"><a className="landing-button landing-button--primary" href="#demo">{t.demoCta}<span>↗</span></a><a className="landing-button landing-button--outline" href="#partner">{t.partnerCta}</a></div><p className="landing-hero__note"><span className="live-dot" />{t.pilotNote}</p><div className="landing-hero__badges">{t.heroBadges.map((badge) => <span key={badge}>{badge}</span>)}</div><div className="landing-hero__audience"><div><small>{t.buyerLabel}</small><strong>{t.buyerText}</strong></div><div><small>{t.sellerLabel}</small><strong>{t.sellerText}</strong></div></div></div><div className="hero-visual"><div className="hero-visual__glow" /><div className="hero-window"><div className="hero-window__bar"><span /><span /><span /><em>window / 01</em></div><div className="hero-window__scene"><div className="hero-window__shelf"><div className="hero-object hero-object--bag" /><div className="hero-object hero-object--book" /><div className="hero-object hero-object--print" /></div><div className="hero-tag"><span>qr2buy</span><strong>STADTLICHTER</strong><b>24,90 €</b><small>scan to shop</small></div><div className="hero-window__caption">CONFIRMED PAYMENT <span>→</span> DISPLAY REACTS</div></div></div></div></div></section>
      <ProductDemo lang={lang} t={t} />
      <section className="landing-section landing-proof"><div className="landing-shell landing-proof__grid"><article className="proof-card proof-card--hardware"><span className="landing-eyebrow">{t.hardwareEyebrow}</span><h2>{t.hardwareTitle}</h2><p>{t.hardwareText}</p></article><article className="proof-card proof-card--admin"><span className="landing-eyebrow">{t.adminEyebrow}</span><h2>{t.adminTitle}</h2><p>{t.adminText}</p></article></div></section>
      <section className="landing-section landing-market"><div className="landing-shell landing-market__inner"><span className="landing-eyebrow">{t.marketEyebrow}</span><h2>{t.marketTitle}</h2><p>{t.marketText}</p></div></section>
      <section className="landing-section landing-pain"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.scenariosEyebrow}</span><h2>{t.scenariosTitle}</h2></div><div className="scenario-grid">{t.scenarios.map(([title, text], index) => <article className="scenario-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="landing-section landing-why"><div className="landing-shell landing-why__grid"><div><span className="landing-eyebrow">{t.whyEyebrow}</span><h2>{t.whyTitle}</h2><p className="landing-copy">{t.whyText}</p><a className="text-link" href="#how">{t.stepsEyebrow} <span>→</span></a></div><div className="why-list">{t.whyItems.map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong></div>)}</div></div></section>
      <section className="landing-section landing-steps" id="how"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.stepsEyebrow}</span><h2>{lang === "de" ? "Scan. Entscheiden. Weiter." : "Scan. Decide. Continue."}</h2></div><div className="steps-grid">{t.steps.map(([number, title, text]) => <article key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="landing-section landing-cases" id="use-cases"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.casesEyebrow}</span><h2>{t.casesTitle}</h2></div><div className="case-grid">{t.cases.map(([title, text], index) => <div className={`case-card case-card--${index + 1}`} key={title}><span>0{index + 1}</span><strong>{title}</strong><small>{text}</small></div>)}</div></div></section>
      <section className="landing-section landing-partner" id="partner"><div className="landing-shell landing-partner__grid"><div className="partner-card"><span className="partner-card__stamp">MVP · LIVE</span><div className="partner-card__monogram">AF</div><span>Andreas Franz / ecily</span><small>Technical founder · product · business</small></div><div><span className="landing-eyebrow">{t.partnerEyebrow}</span><h2>{t.partnerTitle}</h2><p className="landing-copy">{t.partnerText}</p><p className="equity-note">{t.equity}</p><a className="landing-button landing-button--primary" href={ECILY_STARTUP_URL} target="_blank" rel="noreferrer">{t.talk}<span>↗</span></a></div></div></section>
      <section className="landing-section landing-pilot"><div className="landing-shell landing-pilot__inner"><span className="landing-eyebrow">{t.pilotEyebrow}</span><h2>{t.pilotTitle}</h2><p>{t.pilotText}</p><a className="landing-button landing-button--dark" href={ECILY_STARTUP_URL} target="_blank" rel="noreferrer">{t.pilotCta}<span>↗</span></a></div></section>
      <section className="landing-section landing-about" id="about"><div className="landing-shell landing-about__grid"><div><span className="landing-eyebrow">{t.aboutEyebrow}</span><h2>Technik, die beim echten Produkt anfängt.</h2></div><p className="landing-copy">{t.aboutText}</p></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-shell landing-footer__inner"><div><Logo /><p>{t.footer}</p></div><div className="landing-footer__links"><a href="#demo">{t.nav.demo}</a><a href="#partner">{t.nav.partner}</a><a href="mailto:andreas.franz@ecily.com">Kontakt</a></div><span>© {new Date().getFullYear()} qr2buy</span></div></footer>
  </div>;
}
