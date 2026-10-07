import { useEffect, useState } from 'react';
import { merchantRequest } from '../merchantApi.js';
import { purchaseText } from '../purchase.js';
import { money } from '../reservation.js';

export default function MerchantOrders({ language }) {
  const t = purchaseText[language], [items, setItems] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let timer;
    async function load() {
      try { const r = await merchantRequest('/api/merchant/orders', null, 'GET', null, controller.signal); setItems(r.items); setError(''); }
      catch (e) { if (e.name !== 'AbortError') setError(t.error); }
      if (!controller.signal.aborted) timer = setTimeout(load, 15000);
    }
    load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [t]);
  return <section className="reservation-ui"><p>{t.test}</p>{error && <p role="alert">{error}</p>}
    {!items ? <p>{t.loading}</p> : !items.length ? <p>{t.empty}</p> : <><p>{t.limit}</p>{items.map(o => <article key={o.orderId}>
      <h2>{o.productName}</h2><p>{t[o.status]} · {money(o, language)} · {t.quantity}: 1</p><p>{o.locationName}</p>
      <p>{t.number}: {o.publicOrderId}</p><p>{t.created}: {new Date(o.createdAt).toLocaleString(language)}</p>
    </article>)}</>}
  </section>;
}
