import { useEffect, useMemo, useState } from "react";

const DEMO_URL = "/p/demo";

const copy = {
  de: {
    nav: { demo: "Demo", useCases: "Für wen?", partner: "Partner werden", about: "Hinter qr2buy" },
    eyebrow: "Vertrauen nach dem Scan",
    hero: "Kaufen und Verkaufen dürfen keine Frage von Öffnungszeiten sein.",
    heroText: "qr2buy macht Produkte im Schaufenster sofort kaufbar oder reservierbar – ohne App, direkt am Handy und mit verlässlicher Rückmeldung nach bestätigter Zahlung.",
    heroTrust: "Erst wenn die Zahlung bestätigt ist, informiert qr2buy Käufer, Verkäufer und das digitale Preisschild. So wird aus Interesse ein klarer, nachvollziehbarer Kaufmoment.",
    buyerLabel: "Für Käufer",
    buyerText: "Sehen. Scannen. Sicher kaufen oder reservieren.",
    sellerLabel: "Für Händler",
    sellerText: "Nach Hause gehen – und sichtbare Produkte trotzdem weiter verkaufen.",
    heroBadges: ["Live-System", "Hardware-Prototyp", "Demo-Ablauf mit Zahlungslogik"],
    demoCta: "Demo ansehen",
    partnerCta: "Partner werden",
    pilotNote: "Funktionierender MVP · Pilotphase",
    heroPoints: ["Kein App-Zwang", "Kauf oder Reservierung", "Bestandsschutz am Display"],
    demoEyebrow: "Interaktive Demo",
    demoTitle: "Vom Produkt im Fenster zum nächsten Schritt.",
    demoText: "Wähle ein Produkt und simuliere, wie sich Preisschild, Bestand und Status verändern. Dies ist eine Demo – es wird nichts gekauft und nichts abgebucht.",
    displayOnline: "LIVE DISPLAY",
    scanHint: "Scannen oder antippen",
    available: "Noch zu haben",
    reserved: "Für dich reserviert",
    sold: "Schon verkauft",
    stock: "Bestand",
    onePiece: "Einzelstück",
    buy: "Kauf simulieren",
    reserve: "Reservierung simulieren",
    reset: "Demo-Status zurücksetzen",
    demoNotice: "Demo-Modus: keine echte Bestellung, keine Zahlung.",
    demoJourney: ["Interesse", "Scan", "Bestätigung", "Preisschild reagiert"],
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
    partnerEyebrow: "Gemeinsam in den Markt",
    partnerTitle: "Technik steht. Jetzt suchen wir Menschen, die mitbauen wollen.",
    partnerText: "ecily arbeitet an digitalen Produktideen. qr2buy ist live, hat einen Hardware-Prototyp und zeigt einen konkreten Demo-Ablauf. Gesucht werden Menschen, die Verantwortung für Markt, Vertrieb, Pilotkunden und Wachstum übernehmen.",
    equity: "Equity-basiertes Partnering möglich",
    talk: "Über Partnerschaft sprechen",
    pilotEyebrow: "Pilotphase",
    pilotTitle: "Hast du ein Schaufenster, eine Auslage oder eine saisonale Verkaufsfläche?",
    pilotText: "Wenn du ein Schaufenster, eine Auslage oder eine saisonale Verkaufsfläche hast, testen wir gemeinsam, ob deine sichtbaren Produkte auch außerhalb deiner Anwesenheit kaufbar werden.",
    pilotCta: "Pilot anfragen",
    aboutEyebrow: "Hinter qr2buy",
    aboutText: "qr2buy entsteht aus langjähriger Management-, Business- und Produktentwicklungserfahrung. Der MVP ist live und wird jetzt mit Pilotpartnern weiter geschärft.",
    footer: "QR-Commerce für sichtbare Produkte.",
    language: "Sprache",
  },
  en: {
    nav: { demo: "Demo", useCases: "Who for?", partner: "Become a partner", about: "About qr2buy" },
    eyebrow: "Trust after the scan",
    hero: "Buying and selling should not depend on opening hours.",
    heroText: "qr2buy makes products in shop windows instantly buyable or reservable – no app required, directly on the phone, with reliable feedback after confirmed payment.",
    heroTrust: "Only after payment is confirmed does qr2buy notify the buyer, the seller and the digital price display. Interest becomes a clear, traceable purchase moment.",
    buyerLabel: "For buyers",
    buyerText: "See it. Scan it. Secure it.",
    sellerLabel: "For sellers",
    sellerText: "Go home – and keep selling visible products.",
    heroBadges: ["Live system", "Hardware prototype", "Payment-flow demo"],
    demoCta: "See the demo",
    partnerCta: "Become a partner",
    pilotNote: "Working MVP · Pilot phase",
    heroPoints: ["No app required", "Buy or reserve", "Inventory-aware display"],
    demoEyebrow: "Interactive demo",
    demoTitle: "From product in the window to the next step.",
    demoText: "Choose a product and simulate how the price tag, stock and status change. This is a demo – nothing is bought and nothing is charged.",
    displayOnline: "LIVE DISPLAY",
    scanHint: "Scan or tap",
    available: "Still available",
    reserved: "Reserved for you",
    sold: "Already sold",
    stock: "Stock",
    onePiece: "One-off piece",
    buy: "Simulate purchase",
    reserve: "Simulate reservation",
    reset: "Reset demo status",
    demoNotice: "Demo mode: no real order, no payment.",
    demoJourney: ["Interest", "Scan", "Confirmation", "Display reacts"],
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
    partnerEyebrow: "Build the market together",
    partnerTitle: "The technology is here. Now we are looking for people who want to build the market.",
    partnerText: "ecily is working on several digital product ideas. qr2buy is live, has a hardware prototype and demonstrates a concrete flow. We are looking for people ready to take responsibility for market, sales, pilot customers and growth.",
    equity: "Equity-based partnering possible",
    talk: "Talk about partnering",
    pilotEyebrow: "Pilot phase",
    pilotTitle: "Do you have a window, display area or seasonal selling space?",
    pilotText: "If you have a shop window, display area or seasonal selling space, we can test together whether your visible products can be bought even when you are not there.",
    pilotCta: "Ask about a pilot",
    aboutEyebrow: "About qr2buy",
    aboutText: "qr2buy grows from years of management, business and product development experience. The MVP is live and now being sharpened with pilot partners.",
    footer: "QR commerce for products in the real world.",
    language: "Language",
  },
};

const products = [
  { id: "bag", name: { de: "Handgemachte Ledertasche", en: "Handmade leather bag" }, place: { de: "Boutique · Einzelstück", en: "Boutique · one-off piece" }, price: "129 €", stock: 1, kind: "single", color: "clay" },
  { id: "book", name: { de: "Roman ‚Stadtlichter‘", en: "Novel ‘City Lights’" }, place: { de: "Buchhandlung · Lagerware", en: "Bookshop · stock item" }, price: "24,90 €", stock: 8, kind: "stock", color: "sage" },
  { id: "print", name: { de: "Gerahmter Kunstdruck", en: "Framed art print" }, place: { de: "Galerie · limitiert", en: "Gallery · limited" }, price: "390 €", stock: 1, kind: "single", color: "ink" },
  { id: "tree", name: { de: "Nordmanntanne Nr. 17", en: "Nordmann fir no. 17" }, place: { de: "Saisonaler Stand", en: "Seasonal stand" }, price: "59 €", stock: 1, kind: "single", color: "pine" },
];

const qrPattern = [
  "111111100101101111111", "100000101110101000001", "101110101011101011101", "101110100100101011101", "101110101111101011101", "100000101010101000001", "111111101010101111111", "000000001101100000000", "110110111001011101101", "011011001111100110010", "101101111001011011101", "001011010110101100110", "111100101011010111001", "000000001101001100110", "111111101011111001010", "100000101100001111100", "101110101011101001101", "101110100101100110011", "101110101110111010101", "100000101001001101110", "111111101110111001001"
].join("").split("");

function Logo() {
  return <span className="landing-logo"><span className="landing-logo__mark" aria-hidden="true"><i /><i /><i /><i /></span><span>qr2buy</span></span>;
}

function StatusPill({ status, t }) {
  const label = status === "sold" ? t.sold : status === "reserved" ? t.reserved : t.available;
  return <span className={`demo-status demo-status--${status}`}><span className="demo-status__dot" />{label}</span>;
}

function QrMockup() {
  return <a className="qr-mockup" href={DEMO_URL} aria-label="Open the qr2buy demo product page">
    <span className="qr-mockup__grid" aria-hidden="true">{qrPattern.map((cell, index) => <i key={index} className={cell === "1" ? "is-dark" : ""} />)}</span>
    <span className="qr-mockup__caption">qr2buy.com/p/demo</span>
  </a>;
}

function ProductDemo({ lang, t }) {
  const [selectedId, setSelectedId] = useState("book");
  const [demoState, setDemoState] = useState({});
  const product = products.find((item) => item.id === selectedId) || products[0];
  const state = demoState[selectedId] || { status: "available", stock: product.stock };

  const act = (nextStatus) => {
    if (state.status === "sold") return;
    setDemoState((current) => ({
      ...current,
      [selectedId]: {
        status: nextStatus,
        stock: product.kind === "stock" ? Math.max(0, state.stock - 1) : state.stock,
      },
    }));
  };

  const reset = () => setDemoState((current) => ({ ...current, [selectedId]: { status: "available", stock: product.stock } }));
  const displayStock = state.stock === 1 && product.kind === "single" ? t.onePiece : `${state.stock}`;
  const title = product.name[lang];

  return <section className="landing-section landing-demo" id="demo">
    <div className="landing-shell">
      <div className="landing-section-heading landing-section-heading--split">
        <div><span className="landing-eyebrow">{t.demoEyebrow}</span><h2>{t.demoTitle}</h2></div>
        <p>{t.demoText}</p>
      </div>
      <div className="demo-layout">
        <div className="display-card">
          <div className="display-card__top"><Logo /><span>{t.displayOnline} <b /></span></div>
          <div className="display-card__screen">
            <div className="display-card__qr"><QrMockup /></div>
            <div className="display-card__product"><span className="display-card__label">{product.place[lang]}</span><strong>{title}</strong><span className="display-card__price">{product.price}</span><StatusPill status={state.status} t={t} /><span className="display-card__stock">{t.stock}: {displayStock}</span></div>
          </div>
          <div className="display-card__footer"><span>QR2BUY DISPLAY</span><span>v1.0 · LIVE</span></div>
        </div>
        <div className="demo-control">
          <div className="demo-control__head"><div><span className="landing-eyebrow">{t.selected}</span><h3>{title}</h3></div><button className="text-button" onClick={reset}>{t.reset}</button></div>
          <div className="product-picker" role="listbox" aria-label={t.selected}>
            {products.map((item) => <button key={item.id} className={`product-option ${item.id === selectedId ? "is-selected" : ""}`} onClick={() => setSelectedId(item.id)} role="option" aria-selected={item.id === selectedId}><span className={`product-option__swatch product-option__swatch--${item.color}`} /><span><strong>{item.name[lang]}</strong><small>{item.place[lang]}</small></span><b>{item.price}</b></button>)}
          </div>
          <div className="demo-actions"><button className="demo-button demo-button--primary" onClick={() => act("sold")} disabled={state.status === "sold"}>{t.buy}</button><button className="demo-button demo-button--secondary" onClick={() => act("reserved")} disabled={state.status !== "available"}>{t.reserve}</button></div>
          <div className="demo-journey" aria-label={t.demoEyebrow}>{t.demoJourney.map((step, index) => <span key={step}><b>{index + 1}</b>{step}{index < t.demoJourney.length - 1 && <i>→</i>}</span>)}</div>
          <p className="demo-notice"><span>i</span>{t.demoNotice}</p>
        </div>
      </div>
    </div>
  </section>;
}

export default function LandingPage() {
  const initialLang = useMemo(() => (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en") ? "en" : "de"), []);
  const [lang, setLang] = useState(initialLang);
  const t = copy[lang];

  useEffect(() => {
    document.title = lang === "de" ? "qr2buy – Dein Schaufenster verkauft weiter." : "qr2buy – Your window keeps selling.";
    document.documentElement.lang = lang;
  }, [lang]);

  return <div className="landing-page">
    <header className="landing-header"><div className="landing-shell landing-header__inner"><a href="/" aria-label="qr2buy home"><Logo /></a><nav className="landing-nav"><a href="#demo">{t.nav.demo}</a><a href="#use-cases">{t.nav.useCases}</a><a href="#partner">{t.nav.partner}</a><a href="#about">{t.nav.about}</a></nav><div className="landing-header__actions"><div className="language-switch" aria-label={t.language}><button className={lang === "de" ? "is-active" : ""} onClick={() => setLang("de")}>DE</button><button className={lang === "en" ? "is-active" : ""} onClick={() => setLang("en")}>EN</button></div><a className="landing-button landing-button--small" href="#demo">{t.demoCta}</a></div></div></header>

    <main>
      <section className="landing-hero"><div className="landing-shell landing-hero__grid"><div className="landing-hero__copy"><span className="landing-eyebrow">{t.eyebrow}</span><h1>{t.hero}</h1><p className="landing-hero__lead">{t.heroText}</p><p className="landing-hero__trust">{t.heroTrust}</p><div className="landing-hero__actions"><a className="landing-button landing-button--primary" href="#demo">{t.demoCta}<span>↗</span></a><a className="landing-button landing-button--outline" href="#partner">{t.partnerCta}</a></div><p className="landing-hero__note"><span className="live-dot" />{t.pilotNote}</p><div className="landing-hero__badges">{t.heroBadges.map((badge) => <span key={badge}>{badge}</span>)}</div><div className="landing-hero__audience"><div><small>{t.buyerLabel}</small><strong>{t.buyerText}</strong></div><div><small>{t.sellerLabel}</small><strong>{t.sellerText}</strong></div></div></div><div className="hero-visual"><div className="hero-visual__glow" /><div className="hero-window"><div className="hero-window__bar"><span /><span /><span /><em>window / 01</em></div><div className="hero-window__scene"><div className="hero-window__shelf"><div className="hero-object hero-object--bag" /><div className="hero-object hero-object--book" /><div className="hero-object hero-object--print" /></div><div className="hero-tag"><span>qr2buy</span><strong>STADTLICHTER</strong><b>24,90 €</b><small>scan to shop</small></div><div className="hero-window__caption">CONFIRMED PAYMENT <span>→</span> DISPLAY REACTS</div></div></div></div></div></section>
      <ProductDemo lang={lang} t={t} />
      <section className="landing-section landing-pain"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.scenariosEyebrow}</span><h2>{t.scenariosTitle}</h2></div><div className="scenario-grid">{t.scenarios.map(([title, text], index) => <article className="scenario-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="landing-section landing-why"><div className="landing-shell landing-why__grid"><div><span className="landing-eyebrow">{t.whyEyebrow}</span><h2>{t.whyTitle}</h2><p className="landing-copy">{t.whyText}</p><a className="text-link" href="#how">{t.stepsEyebrow} <span>→</span></a></div><div className="why-list">{t.whyItems.map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong></div>)}</div></div></section>
      <section className="landing-section landing-steps" id="how"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.stepsEyebrow}</span><h2>Scan. Entscheiden. Weiter.</h2></div><div className="steps-grid">{t.steps.map(([number, title, text]) => <article key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="landing-section landing-cases" id="use-cases"><div className="landing-shell"><div className="landing-section-heading"><span className="landing-eyebrow">{t.casesEyebrow}</span><h2>{t.casesTitle}</h2></div><div className="case-grid">{t.cases.map(([title, text], index) => <div className={`case-card case-card--${index + 1}`} key={title}><span>0{index + 1}</span><strong>{title}</strong><small>{text}</small></div>)}</div></div></section>
      <section className="landing-section landing-partner" id="partner"><div className="landing-shell landing-partner__grid"><div className="partner-card"><span className="partner-card__stamp">MVP · LIVE</span><div className="partner-card__monogram">AF</div><span>Andreas Franz / ecily</span><small>Technical founder · product · business</small></div><div><span className="landing-eyebrow">{t.partnerEyebrow}</span><h2>{t.partnerTitle}</h2><p className="landing-copy">{t.partnerText}</p><p className="equity-note">{t.equity}</p><a className="landing-button landing-button--primary" href="mailto:andreas.franz@ecily.com?subject=qr2buy%20Partnerschaft">{t.talk}<span>↗</span></a></div></div></section>
      <section className="landing-section landing-pilot"><div className="landing-shell landing-pilot__inner"><span className="landing-eyebrow">{t.pilotEyebrow}</span><h2>{t.pilotTitle}</h2><p>{t.pilotText}</p><a className="landing-button landing-button--dark" href="mailto:andreas.franz@ecily.com?subject=qr2buy%20Pilotanfrage">{t.pilotCta}<span>↗</span></a></div></section>
      <section className="landing-section landing-about" id="about"><div className="landing-shell landing-about__grid"><div><span className="landing-eyebrow">{t.aboutEyebrow}</span><h2>Technik, die beim echten Produkt anfängt.</h2></div><p className="landing-copy">{t.aboutText}</p></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-shell landing-footer__inner"><div><Logo /><p>{t.footer}</p></div><div className="landing-footer__links"><a href="#demo">{t.nav.demo}</a><a href="#partner">{t.nav.partner}</a><a href="mailto:andreas.franz@ecily.com">Kontakt</a></div><span>© {new Date().getFullYear()} qr2buy</span></div></footer>
  </div>;
}
