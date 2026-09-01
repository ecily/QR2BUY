import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  cancelDemoCheckout,
  createDemoCheckout,
  getDemoProduct,
  reserveDemoProduct
} from '../api.js';
import { blocksDemoActions } from '../demoDisplayState.js';

const copy = {
  de: {
    demo: 'Live-Demo · keine echte Zahlung',
    safeCore: 'Das ist eine sichere Live-Demo. Garantiert keine Abbuchung und keine echte Bestellung.',
    noOrder: 'Es entsteht keine echte Bestellung, Reservierung oder Lieferung.',
    browser: 'Keine App · kein Benutzerkonto',
    actionTrust: ['Keine echte Bestellung', 'Keine Abbuchung'],
    available: 'Verfügbar',
    demoStock: 'Fiktiver Demo-Bestand: {stock}',
    buy: 'Kaufen & liefern lassen',
    reserve: 'Zur Abholung reservieren',
    testTitle: 'Bereit für den sicheren Testcheckout?',
    sandbox: 'Der Checkout läuft ausschließlich in der Stripe-Sandbox.',
    testText: 'Verwende bitte nur die angezeigte Stripe-Testkarte. Gib keine echten Karten- oder Zahlungsdaten ein.',
    testData: 'Für Name und Lieferadresse kannst du beliebige erfundene Testdaten verwenden.',
    emailOptional: 'Eine echte E-Mail-Adresse ist nicht erforderlich. Möchtest du zusätzlich die Demo-Bestätigung und den Demo-Beleg erhalten, verwende eine erreichbare Adresse. Wir nutzen sie ausschließlich für diese eine Demo-Nachricht – ohne Marketing, Newsletter oder spätere Kontaktaufnahme.',
    cardLabel: 'Stripe-Testkarte',
    cardValue: '4242 4242 4242 4242',
    cardDetails: ['Beliebiges zukünftiges Ablaufdatum', 'Beliebige dreistellige CVC', 'Beliebiger Testname', 'Beliebige Testadresse'],
    copy: 'Kopieren',
    copied: 'Kopiert',
    continue: 'Sicheren Testcheckout öffnen',
    back: 'Zurück zum Produkt',
    loading: 'Live-Demo wird geladen …',
    waiting: 'Stripe bestätigt die Testzahlung serverseitig. Das kann einen Moment dauern.',
    paid: 'Testzahlung erfolgreich',
    noCharge: 'Garantiert keine Abbuchung',
    noDelivery: 'Keine echte Bestellung oder Lieferung',
    hardware: 'Das simulierte Hardwaredisplay zeigt die Bestätigung jetzt ebenfalls live an.',
    orderNumber: 'Demo-Auftragsnummer',
    mailAccepted: 'Deine Demo-Bestätigung und dein Demo-Beleg wurden an {email} gesendet.',
    mailNotConfirmed: 'Die Testzahlung war erfolgreich; für die Demo-E-Mail wurde keine Zustellung bestätigt.',
    reserved: 'Für dich reserviert',
    reservedDetail: 'Zur Abholung vorgemerkt – ausschließlich innerhalb dieser Live-Demo.',
    reset: 'Diese Demo wird in {seconds} Sekunden zurückgesetzt.',
    soldLabel: 'Verkauft',
    soldTitle: 'Diese Tanne wurde schon verkauft.',
    soldMore: 'Wir haben aber noch andere für dich.',
    soldWish: 'Schau dich um. Frohe Weihnachten!',
    reservedLabel: 'Reserviert',
    treeReserved: 'Diese Tanne ist bereits reserviert.',
    treeReservedMore: 'Andere Demo-Produkte sind weiterhin verfügbar.',
    chooseAnother: 'Zur Demo und Produktauswahl',
    cancelled: 'Der Testcheckout wurde abgebrochen. Es wurde nichts belastet.',
    retry: 'Erneut versuchen',
    invalid: 'Diese Demo-Session ist ungültig oder abgelaufen.',
    unavailable: 'Die Live-Demo ist gerade nicht verfügbar. Bitte versuche es gleich noch einmal.',
    busy: 'Dieses Demo-Produkt ist bereits verkauft, reserviert oder wird gerade verwendet.',
    home: 'Zur qr2buy-Startseite'
  },
  en: {
    demo: 'Live demo · no real payment',
    safeCore: 'This is a safe live demo. Guaranteed no charge and no real order.',
    noOrder: 'No real order, reservation or delivery is created.',
    browser: 'No app · no user account',
    actionTrust: ['No real order', 'No charge'],
    available: 'Available',
    demoStock: 'Fictional demo stock: {stock}',
    buy: 'Buy & have it delivered',
    reserve: 'Reserve for collection',
    testTitle: 'Ready for the secure test checkout?',
    sandbox: 'Checkout runs exclusively in the Stripe sandbox.',
    testText: 'Use only the Stripe test card shown below. Never enter real card or payment details.',
    testData: 'Use any fictional test details for the name and shipping address.',
    emailOptional: 'A real email address is not required. If you would also like the demo confirmation and demo receipt, use an address you can access. We use it only for this single demo message – no marketing, newsletter or later contact.',
    cardLabel: 'Stripe test card',
    cardValue: '4242 4242 4242 4242',
    cardDetails: ['Any future expiry date', 'Any three-digit CVC', 'Any test name', 'Any test address'],
    copy: 'Copy',
    copied: 'Copied',
    continue: 'Open secure test checkout',
    back: 'Back to product',
    loading: 'Loading the live demo …',
    waiting: 'Stripe is confirming the test payment on the server. This can take a moment.',
    paid: 'Test payment successful',
    noCharge: 'Guaranteed no charge',
    noDelivery: 'No real order or delivery',
    hardware: 'The simulated hardware display is now showing the confirmation live as well.',
    orderNumber: 'Demo order number',
    mailAccepted: 'Your demo confirmation and demo receipt were sent to {email}.',
    mailNotConfirmed: 'The test payment succeeded; delivery of the demo email was not confirmed.',
    reserved: 'Reserved for you',
    reservedDetail: 'Set aside for collection – only within this live demo.',
    reset: 'This demo resets in {seconds} seconds.',
    soldLabel: 'Sold',
    soldTitle: 'This tree has already been sold.',
    soldMore: 'We still have others for you.',
    soldWish: 'Take a look around. Merry Christmas!',
    reservedLabel: 'Reserved',
    treeReserved: 'This tree is already reserved.',
    treeReservedMore: 'Other demo products are still available.',
    chooseAnother: 'Back to demo and product selection',
    cancelled: 'The test checkout was cancelled. Nothing was charged.',
    retry: 'Try again',
    invalid: 'This demo session is invalid or has expired.',
    unavailable: 'The live demo is temporarily unavailable. Please try again shortly.',
    busy: 'This demo product is already sold, reserved or currently in use.',
    home: 'Back to qr2buy'
  }
};

function friendlyError(error, t) {
  const message = String(error?.message || '');
  if (message.includes('404')) return t.invalid;
  if (message.includes('409')) return t.busy;
  return t.unavailable;
}

function ProductVisual({ color, name }) {
  return <div className={`demo-product-visual demo-product-visual--${color}`} role="img" aria-label={name}><span>{name.slice(0, 1)}</span><i /></div>;
}

export default function DemoProductPage() {
  const { productKey } = useParams();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return fragment.get('session') || searchParams.get('session') || sessionStorage.getItem('qr2buy_demo_token') || '';
  }, [searchParams]);
  const checkoutReturn = searchParams.get('checkout') || '';
  const initialLang = useMemo(() => (navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'de'), []);
  const [lang, setLang] = useState(initialLang);
  const [view, setView] = useState('product');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(20);
  const cancelSent = useRef(false);
  const t = copy[lang];

  useEffect(() => { if (token) sessionStorage.setItem('qr2buy_demo_token', token); }, [token]);
  useEffect(() => {
    document.title = lang === 'de' ? 'qr2buy Live-Demo' : 'qr2buy live demo';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    let active = true;
    const applySnapshot = (snapshot) => {
      const state = snapshot?.session?.products?.find((item) => item.productKey === productKey);
      if (active && state) setData((current) => current ? {
        ...current,
        state: { ...state, maskedEmail: state.maskedEmail ?? current.state?.maskedEmail ?? null }
      } : current);
    };
    const load = async () => {
      try {
        const result = await getDemoProduct(token, productKey);
        if (!active) return;
        setData(result);
        setError('');
      } catch (requestError) {
        if (active) setError(friendlyError(requestError, t));
      }
    };
    load();
    const events = token ? new EventSource(`/api/demo/sessions/${encodeURIComponent(token)}/events`) : null;
    events?.addEventListener('snapshot', (event) => {
      try { applySnapshot(JSON.parse(event.data)); } catch { /* Polling remains the fallback. */ }
    });
    const poll = setInterval(load, checkoutReturn === 'return' ? 1500 : 3000);
    return () => { active = false; clearInterval(poll); events?.close(); };
  }, [checkoutReturn, productKey, token, t]);

  useEffect(() => {
    if (checkoutReturn !== 'cancelled' || cancelSent.current || !token) return;
    cancelSent.current = true;
    cancelDemoCheckout(token, productKey).then((snapshot) => {
      const state = snapshot.session.products.find((item) => item.productKey === productKey);
      setData((current) => ({ ...current, state }));
    }).catch(() => undefined);
  }, [checkoutReturn, productKey, token]);

  const status = data?.state?.status;
  const resetAt = data?.state?.resetAt;
  useEffect(() => {
    if (!resetAt) return undefined;
    const update = () => setSeconds(Math.max(0, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [resetAt]);

  async function reserve() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const snapshot = await reserveDemoProduct(token, productKey);
      const state = snapshot.session.products.find((item) => item.productKey === productKey);
      setData((current) => ({ ...current, state }));
    } catch (requestError) { setError(friendlyError(requestError, t)); }
    finally { setBusy(false); }
  }

  async function checkout() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await createDemoCheckout(token, productKey, lang);
      window.location.assign(result.url);
    } catch (requestError) { setError(friendlyError(requestError, t)); setBusy(false); }
  }

  async function copyCard() {
    await navigator.clipboard.writeText('4242424242424242');
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!data && !error) return <main className="demo-product-page"><div className="demo-mobile-card demo-mobile-card--loading" role="status"><span className="demo-loader" />{t.loading}</div></main>;
  if (!data) return <main className="demo-product-page"><div className="demo-mobile-card demo-mobile-error" role="alert"><strong>{error}</strong><Link to="/">{t.home}</Link></div></main>;

  const product = data.product;
  const name = product.name[lang];
  const price = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { style: 'currency', currency: product.currency }).format(product.price);
  const completed = ['PAID', 'RESERVED', 'SOLD'].includes(status);
  const permanentReservation = product.unique && status === 'RESERVED' && !resetAt;

  return <main className="demo-product-page">
    <div className="demo-mobile-topbar">
      <Link to="/" className="landing-logo"><span className="landing-logo__mark" aria-hidden="true"><i /><i /><i /><i /></span><span>qr2buy</span></Link>
      <div className="language-switch" aria-label="Language"><button className={lang === 'de' ? 'is-active' : ''} onClick={() => setLang('de')}>DE</button><button className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>EN</button></div>
    </div>

    <article className={`demo-mobile-card ${completed ? 'is-complete' : ''}`}>
      <span className="demo-live-badge">{t.demo}</span>
      <ProductVisual color={product.color} name={name} />
      <div className="demo-mobile-product-copy">
        <div className={`demo-product-availability demo-product-availability--${String(status || 'ready').toLowerCase()}`}><span />{status === 'SOLD' ? t.soldLabel : status === 'RESERVED' ? t.reservedLabel : t.available}</div>
        <small>{product.place[lang]}</small><h1>{name}</h1><strong className="demo-mobile-price">{price}</strong><p>{product.description[lang]}</p>
        <p className="demo-fictional-stock"><strong>{t.demoStock.replace('{stock}', product.stock)}</strong><span>{product.alternatives?.[lang]}</span></p>
      </div>

      {status === 'PAID' ? <div className="demo-mobile-success" role="status" aria-live="polite" aria-atomic="true">
        <div className="demo-success-icon" aria-hidden="true">✓</div><h2>{t.paid}</h2>
        <strong className="demo-success-assurance">{t.noCharge}</strong><p>{t.noDelivery}</p>
        <dl><div><dt>{t.orderNumber}</dt><dd>{data.state.demoOrderNumber}</dd></div><div><dt>{lang === 'de' ? 'Produkt' : 'Product'}</dt><dd>{name}</dd></div></dl>
        <p>{t.hardware}</p>
        {data.state.mailStatus === 'ACCEPTED' && data.state.maskedEmail && <p className="demo-mail-status demo-mail-status--accepted">{t.mailAccepted.replace('{email}', data.state.maskedEmail)}</p>}
        {['FAILED', 'UNAVAILABLE'].includes(data.state.mailStatus) && <p className="demo-mail-status">{t.mailNotConfirmed}</p>}
        {resetAt && <p className="demo-reset-note">{t.reset.replace('{seconds}', seconds)}</p>}
      </div> : status === 'SOLD' ? <div className="demo-mobile-unavailable" role="status" aria-live="polite">
        <strong>{t.soldLabel}</strong><h2>{t.soldTitle}</h2><p>{t.soldMore}</p><p>{t.soldWish}</p><Link to="/#demo">{t.chooseAnother}</Link>
      </div> : status === 'RESERVED' ? <div className="demo-mobile-unavailable demo-mobile-unavailable--reserved" role="status" aria-live="polite">
        <strong>{t.reservedLabel}</strong><h2>{permanentReservation ? t.treeReserved : t.reserved}</h2><p>{permanentReservation ? t.treeReservedMore : t.reservedDetail}</p>
        {resetAt && <p className="demo-reset-note">{t.reset.replace('{seconds}', seconds)}</p>}<Link to="/#demo">{t.chooseAnother}</Link>
      </div> : view === 'checkout' ? <div className="demo-checkout-notice">
        <span className="demo-sandbox-label">Stripe Sandbox</span><h2>{t.testTitle}</h2><strong>{t.safeCore}</strong><p>{t.sandbox}</p><p>{t.testText}</p><p>{t.testData}</p>
        <div className="demo-test-card"><small>{t.cardLabel}</small><div><code>{t.cardValue}</code><button onClick={copyCard}>{copied ? t.copied : t.copy}</button></div><ul>{t.cardDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul></div>
        <p className="demo-email-note">{t.emailOptional}</p>
        <button className="demo-commerce-button demo-commerce-button--primary" onClick={checkout} disabled={busy}>{busy ? t.loading : t.continue}</button>
        <button className="demo-commerce-button demo-commerce-button--text" onClick={() => setView('product')} disabled={busy}>{t.back}</button>
      </div> : <div className="demo-commerce-actions">
        {checkoutReturn === 'return' && status === 'CHECKOUT_STARTED' && <p className="demo-waiting" role="status" aria-live="polite">{t.waiting}</p>}
        {checkoutReturn === 'cancelled' && <p className="demo-cancelled" role="status">{t.cancelled}</p>}
        <div className="demo-action-trust"><strong>{t.safeCore}</strong><span>{t.browser}</span>{t.actionTrust.map((item) => <span key={item}>✓ {item}</span>)}</div>
        <button className="demo-commerce-button demo-commerce-button--primary" onClick={() => setView('checkout')} disabled={busy || status === 'CHECKOUT_STARTED' || blocksDemoActions(status)}>{checkoutReturn === 'cancelled' ? t.retry : t.buy}</button>
        <button className="demo-commerce-button demo-commerce-button--secondary" onClick={reserve} disabled={busy || status === 'CHECKOUT_STARTED' || blocksDemoActions(status)}>{t.reserve}</button>
      </div>}

      {error && <p className="demo-friendly-error" role="alert">{error}</p>}
      <div className="demo-mobile-trust"><strong>{t.demo}</strong><span>{t.noOrder}</span></div>
    </article>
  </main>;
}
