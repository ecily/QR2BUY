import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  cancelDemoCheckout,
  createDemoCheckout,
  getDemoProduct,
  reserveDemoProduct
} from '../api.js';
import { copyStripeTestCard, prepareStripeRedirect } from '../demoCheckoutTransition.js';
import { blocksDemoActions } from '../demoDisplayState.js';
import BrandLogo from '../components/BrandLogo.jsx';

const copy = {
  de: {
    demo: 'Live-Demo · keine echte Zahlung',
    scanContext: 'Du hast den QR-Code eines qr2buy-Verkaufsschilds gescannt. Beim echten physischen Schild funktioniert der Ablauf genauso – direkt am Produkt und ohne App.',
    scanSafety: 'In dieser Demo wird garantiert nichts abgebucht und keine echte Bestellung ausgelöst.',
    safeCore: 'Nur Demo – keine Abbuchung und keine echte Bestellung.',
    noOrder: 'Es entsteht keine echte Bestellung, Reservierung oder Lieferung.',
    browser: 'Keine App · kein Benutzerkonto',
    actionTrust: ['Keine echte Bestellung', 'Keine Abbuchung'],
    available: 'Verfügbar',
    demoStock: 'Fiktiver Demo-Bestand: {stock}',
    realAction: 'Im echten Einsatz kaufst oder reservierst du hier. Auf dieser öffentlichen Seite testest du nur den Ablauf.',
    buy: 'Testkauf starten',
    buyHint: 'Mit Stripe-Testkarte · garantiert keine Abbuchung',
    reserve: 'Demo-Reservierung testen',
    reserveHint: 'Keine echte Reservierung',
    testTitle: 'Ein letzter Demo-Schritt',
    checkpointSafety: 'Offizielle Stripe-Testkarte · garantiert keine Abbuchung',
    sandbox: 'Stripe bleibt vollständig im Testmodus.',
    testText: 'Bei Stripe verwendest du ausschließlich Testdaten. Es wird garantiert nichts abgebucht.',
    testData: 'Ablauf: 12/34 · CVC: 123 · beliebige Testadresse',
    emailOptional: 'Eine echte E-Mail-Adresse brauchst du nur, wenn du auch die Demo-Bestätigung erhalten möchtest.',
    cardLabel: 'Stripe-Testkarte',
    cardValue: '4242 4242 4242 4242',
    cardDetails: ['Ablauf 12/34', 'CVC 123', 'Beliebige Testadresse'],
    copy: 'Kopieren',
    copied: 'Kopiert',
    continue: 'Testkarte kopieren & Stripe öffnen',
    continueAfterCopy: 'Danach Stripe öffnen',
    copyFailed: 'Kopieren war nicht möglich. Markiere die Testkarte manuell.',
    copySuccess: 'Testkarte kopiert. Stripe wird geöffnet.',
    back: 'Zurück',
    loading: 'Live-Demo wird geladen …',
    waiting: 'Stripe bestätigt die Testzahlung serverseitig. Das kann einen Moment dauern.',
    paid: 'Demo erfolgreich · 0 € abgebucht',
    noCharge: 'Keine echte Bestellung.',
    successCycle: 'Das simulierte Verkaufsschild hat reagiert. Im echten Einsatz würde jetzt das physische Schild direkt beim Produkt aktualisiert.',
    hardware: 'Dein Smartphone hat den Testkauf über Stripe bestätigt und den vollständigen Demo-Cycle ausgelöst.',
    orderNumber: 'Demo-Auftragsnummer',
    mailAccepted: 'Deine Demo-Bestätigung und dein Demo-Beleg wurden an {email} gesendet.',
    mailNotConfirmed: 'Die Testzahlung war erfolgreich; für die Demo-E-Mail wurde keine Zustellung bestätigt.',
    reserved: 'Für dich reserviert',
    reservedDetail: 'Zur Abholung vorgemerkt – ausschließlich innerhalb dieser Live-Demo.',
    reservationHardware: 'Die Frontpage zeigt den neuen Status sofort. Im echten Einsatz aktualisiert sich das physische Schild direkt beim Produkt.',
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
    scanContext: 'You scanned the QR code of a qr2buy sales display. The real physical display works the same way – right at the product and without an app.',
    scanSafety: 'This demo never creates a real charge or a real order.',
    safeCore: 'Demo only – no charge and no real order.',
    noOrder: 'No real order, reservation or delivery is created.',
    browser: 'No app · no user account',
    actionTrust: ['No real order', 'No charge'],
    available: 'Available',
    demoStock: 'Fictional demo stock: {stock}',
    realAction: 'In real use, this is where you buy or reserve. On this public page, you are only testing the flow.',
    buy: 'Start test purchase',
    buyHint: 'With Stripe test card · guaranteed no charge',
    reserve: 'Try demo reservation',
    reserveHint: 'No real reservation',
    testTitle: 'One last demo step',
    checkpointSafety: 'Official Stripe test card · guaranteed no charge',
    sandbox: 'Stripe remains fully in test mode.',
    testText: 'Use test data only in Stripe. Nothing will be charged.',
    testData: 'Expiry: 12/34 · CVC: 123 · any test address',
    emailOptional: 'You only need a real email address if you would also like to receive the demo confirmation.',
    cardLabel: 'Stripe test card',
    cardValue: '4242 4242 4242 4242',
    cardDetails: ['Expiry 12/34', 'CVC 123', 'Any test address'],
    copy: 'Copy',
    copied: 'Copied',
    continue: 'Copy test card & open Stripe',
    continueAfterCopy: 'Then open Stripe',
    copyFailed: 'Copying was not possible. Select the test card manually.',
    copySuccess: 'Test card copied. Opening Stripe.',
    back: 'Back',
    loading: 'Loading the live demo …',
    waiting: 'Stripe is confirming the test payment on the server. This can take a moment.',
    paid: 'Demo successful · €0 charged',
    noCharge: 'No real order.',
    successCycle: 'The simulated sales display responded. In real use, the physical display right beside the product would now update.',
    hardware: 'Your smartphone confirmed the test purchase through Stripe and triggered the complete demo cycle.',
    orderNumber: 'Demo order number',
    mailAccepted: 'Your demo confirmation and demo receipt were sent to {email}.',
    mailNotConfirmed: 'The test payment succeeded; delivery of the demo email was not confirmed.',
    reserved: 'Reserved for you',
    reservedDetail: 'Set aside for collection – only within this live demo.',
    reservationHardware: 'The front page shows the new status immediately. In real use, the physical display beside the product updates.',
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
  const [clipboardStatus, setClipboardStatus] = useState('idle');
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

  async function openCheckout() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await createDemoCheckout(token, productKey, lang);
      window.location.assign(result.url);
    } catch (requestError) { setError(friendlyError(requestError, t)); setBusy(false); }
  }

  async function copyCard() {
    const success = await copyStripeTestCard(navigator.clipboard?.writeText
      ? (value) => navigator.clipboard.writeText(value)
      : null);
    setClipboardStatus(success ? 'success' : 'error');
    setCopied(success);
    if (success) setTimeout(() => setCopied(false), 1600);
  }

  async function copyAndOpenCheckout() {
    if (busy) return;
    setBusy(true); setError(''); setClipboardStatus('idle');
    try {
      const result = await prepareStripeRedirect({
        writeText: navigator.clipboard?.writeText ? (value) => navigator.clipboard.writeText(value) : null,
        createCheckout: () => createDemoCheckout(token, productKey, lang)
      });
      if (!result.copied) {
        setClipboardStatus('error');
        setBusy(false);
        return;
      }
      setClipboardStatus('success');
      window.location.assign(result.checkout.url);
    } catch (requestError) {
      setError(friendlyError(requestError, t));
      setBusy(false);
    }
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
      <Link to={`/${lang}`}><BrandLogo /></Link>
      <div className="language-switch" aria-label="Language"><button className={lang === 'de' ? 'is-active' : ''} onClick={() => setLang('de')} aria-pressed={lang === 'de'}>DE</button><button className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button></div>
    </div>

    <article className={`demo-mobile-card ${completed ? 'is-complete' : ''}`}>
      <span className="demo-live-badge">{t.demo}</span>
      <div className="demo-scan-context"><p>{t.scanContext}</p><strong>{t.scanSafety}</strong></div>
      <ProductVisual color={product.color} name={name} />
      <div className="demo-mobile-product-copy">
        <div className={`demo-product-availability demo-product-availability--${String(status || 'ready').toLowerCase()}`}><span />{status === 'SOLD' ? t.soldLabel : status === 'RESERVED' ? t.reservedLabel : t.available}</div>
        <small>{product.place[lang]}</small><h1>{name}</h1><strong className="demo-mobile-price">{price}</strong><p>{product.description[lang]}</p>
        <p className="demo-fictional-stock"><strong>{t.demoStock.replace('{stock}', product.stock)}</strong><span>{product.alternatives?.[lang]}</span></p>
      </div>

      {status === 'PAID' ? <div className="demo-mobile-success" role="status" aria-live="polite" aria-atomic="true">
        <div className="demo-success-icon" aria-hidden="true">✓</div><h2>{t.paid}</h2>
        <strong className="demo-success-assurance">{t.noCharge}</strong><p>{t.successCycle}</p>
        <dl><div><dt>{t.orderNumber}</dt><dd>{data.state.demoOrderNumber}</dd></div><div><dt>{lang === 'de' ? 'Produkt' : 'Product'}</dt><dd>{name}</dd></div></dl>
        <p>{t.hardware}</p>
        {data.state.mailStatus === 'ACCEPTED' && data.state.maskedEmail && <p className="demo-mail-status demo-mail-status--accepted">{t.mailAccepted.replace('{email}', data.state.maskedEmail)}</p>}
        {['FAILED', 'UNAVAILABLE'].includes(data.state.mailStatus) && <p className="demo-mail-status">{t.mailNotConfirmed}</p>}
        {resetAt && <p className="demo-reset-note">{t.reset.replace('{seconds}', seconds)}</p>}
      </div> : status === 'SOLD' ? <div className="demo-mobile-unavailable" role="status" aria-live="polite">
        <strong>{t.soldLabel}</strong><h2>{t.soldTitle}</h2><p>{t.soldMore}</p><p>{t.soldWish}</p><Link to="/#demo">{t.chooseAnother}</Link>
      </div> : status === 'RESERVED' ? <div className="demo-mobile-unavailable demo-mobile-unavailable--reserved" role="status" aria-live="polite">
        <strong>{t.reservedLabel}</strong><h2>{permanentReservation ? t.treeReserved : t.reserved}</h2><p>{permanentReservation ? t.treeReservedMore : t.reservedDetail}</p>
        <p>{t.reservationHardware}</p>
        {resetAt && <p className="demo-reset-note">{t.reset.replace('{seconds}', seconds)}</p>}<Link to="/#demo">{t.chooseAnother}</Link>
      </div> : view === 'checkout' ? <div className="demo-checkout-notice">
        <span className="demo-sandbox-label">Stripe Sandbox</span><h2>{t.testTitle}</h2><p className="demo-checkpoint-safety">{t.checkpointSafety}</p><strong>{t.testText}</strong><p>{t.sandbox}</p>
        <div className="demo-test-card"><small>{t.cardLabel}</small><div><code>{t.cardValue}</code><button onClick={copyCard}>{copied ? t.copied : t.copy}</button></div><ul>{t.cardDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul></div>
        <p className="demo-test-data">{t.testData}</p>
        <p className="demo-email-note">{t.emailOptional}</p>
        <p className={`demo-clipboard-status demo-clipboard-status--${clipboardStatus}`} role="status" aria-live="polite">{clipboardStatus === 'error' ? t.copyFailed : clipboardStatus === 'success' ? t.copySuccess : ''}</p>
        {clipboardStatus === 'error'
          ? <button className="demo-commerce-button demo-commerce-button--primary" onClick={openCheckout} disabled={busy}>{busy ? t.loading : t.continueAfterCopy}</button>
          : <button className="demo-commerce-button demo-commerce-button--primary" onClick={copyAndOpenCheckout} disabled={busy}>{busy ? t.loading : t.continue}</button>}
        <button className="demo-commerce-button demo-commerce-button--text" onClick={() => setView('product')} disabled={busy}>{t.back}</button>
      </div> : <div className="demo-commerce-actions">
        {checkoutReturn === 'return' && status === 'CHECKOUT_STARTED' && <p className="demo-waiting" role="status" aria-live="polite">{t.waiting}</p>}
        {checkoutReturn === 'cancelled' && <p className="demo-cancelled" role="status">{t.cancelled}</p>}
        <p className="demo-real-action">{t.realAction}</p>
        <button className="demo-commerce-button demo-commerce-button--primary demo-commerce-button--stacked" onClick={() => { setClipboardStatus('idle'); setView('checkout'); }} disabled={busy || status === 'CHECKOUT_STARTED' || blocksDemoActions(status)}><strong>{checkoutReturn === 'cancelled' ? t.retry : t.buy}</strong><small>{t.buyHint}</small></button>
        <button className="demo-commerce-button demo-commerce-button--secondary demo-commerce-button--stacked" onClick={reserve} disabled={busy || status === 'CHECKOUT_STARTED' || blocksDemoActions(status)}><strong>{t.reserve}</strong><small>{t.reserveHint}</small></button>
      </div>}

      {error && <p className="demo-friendly-error" role="alert">{error}</p>}
    </article>
  </main>;
}
