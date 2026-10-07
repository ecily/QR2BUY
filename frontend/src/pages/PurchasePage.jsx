import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { purchaseRequest, purchaseText, stripeCheckoutUrl } from '../purchase.js';
import { money } from '../reservation.js';
import './MerchantOfferPage.css';

export default function PurchasePage() {
  const { publicOrderId } = useParams(), [params] = useSearchParams();
  const language = params.get('lang') === 'en' ? 'en' : 'de', t = purchaseText[language];
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const cancelReturn = params.get('cancel') === '1';
  useEffect(() => {
    const controller = new AbortController(); let timer;
    async function load() {
      try { const r = await purchaseRequest(publicOrderId, null, controller.signal); setResult({ id: publicOrderId, order: r.order, checkoutUrl: r.checkoutUrl }); setError(''); }
      catch (e) { if (e.name !== 'AbortError') { setResult({ id: publicOrderId, order: null }); setError(t.error); } }
      if (!controller.signal.aborted) timer = setTimeout(load, 3000);
    }
    load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [publicOrderId, t]);
  useEffect(() => {
    if (!cancelReturn) return;
    const controller = new AbortController();
    purchaseRequest(publicOrderId + '/cancel', {}, controller.signal).then(r => setResult({ id: publicOrderId, order: r.order }))
      .catch(e => { if (e.name !== 'AbortError') setError(t.error); });
    return () => controller.abort();
  }, [publicOrderId, cancelReturn, t]);
  const o = result?.id === publicOrderId ? result.order : null;
  async function cancel() {
    setBusy(true); setError('');
    try { const r = await purchaseRequest(publicOrderId + '/cancel', {}); setResult({ id: publicOrderId, order: r.order }); }
    catch { setError(t.error); } finally { setBusy(false); }
  }
  return <main lang={language} className="buyer-page"><p className="buyer-testmode">{t.test}</p>
    {result?.id !== publicOrderId ? <p role="status">{t.loading}</p> : !o ? <h1>{t.unavailable}</h1> : <article className="buyer-product">
      <p className="buyer-merchant">{o.merchantName}</p><p className="buyer-location">{o.locationName}</p><h1>{t[o.status]}</h1><h2>{o.productName}</h2>
      <p>{t.quantity}: 1 · {t.price}: {money(o, language)}</p><p>{t.number}: {o.publicOrderId}</p><p>{t.keep}</p>
      {o.status === 'CHECKOUT_STARTED' && <><p>{t.pending}</p>{stripeCheckoutUrl(result.checkoutUrl) && <p><a href={result.checkoutUrl} rel="noreferrer">{t.resume}</a></p>}<button disabled={busy} onClick={cancel}>{t.cancel}</button></>}
      <p><Link to={'/o/' + o.publicOfferId + '?lang=' + language}>{t.back}</Link></p>
    </article>}{error && <p role="alert">{error}</p>}<footer className="buyer-powered">powered by <a href="https://qr2buy.com">qr2buy.com</a></footer></main>;
}
