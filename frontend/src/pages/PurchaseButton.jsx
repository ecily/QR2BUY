import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchaseRequest, purchaseText, stripeCheckoutUrl } from '../purchase.js';

export default function PurchaseButton({ offerId, language }) {
  const t = purchaseText[language], navigate = useNavigate();
  const key = useRef(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function buy() {
    if (busy) return;
    setBusy(true); setError(''); key.current ||= crypto.randomUUID();
    try {
      const r = await purchaseRequest('offers/' + offerId, { requestKey: key.current, quantity: 1, language, testMode: true });
      if (stripeCheckoutUrl(r.checkoutUrl)) window.location.assign(r.checkoutUrl);
      else if (/^[a-f0-9]{32}$/.test(r.order?.publicOrderId)) navigate('/buy/' + r.order.publicOrderId + '?lang=' + language);
      else throw Error('checkout_unavailable');
    } catch { setError(t.error); setBusy(false); }
  }
  return <section className="reservation-ui"><p>{t.test}</p><button className="reserve-button" disabled={busy} onClick={buy}>{busy ? t.loading : t.buy}</button>
    {error && <p role="alert">{error}</p>}</section>;
}
