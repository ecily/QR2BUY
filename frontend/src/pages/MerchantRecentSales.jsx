import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { merchantRequest } from '../merchantApi.js';
import { purchaseText } from '../purchase.js';
import { money } from '../reservation.js';

export default function MerchantRecentSales({ language }) {
  const t = purchaseText[language], [items, setItems] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let timer;
    async function load() {
      try {
        const r = await merchantRequest('/api/merchant/sales', null, 'GET', null, controller.signal);
        setItems(r.items.filter(o => o.status === 'PAID')); setError('');
      } catch (e) { if (e.name !== 'AbortError') setError(t.salesError); }
      if (!controller.signal.aborted) timer = setTimeout(load, 15000);
    }
    load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [t]);
  return <section className="merchant-recent-sales" aria-labelledby="recent-sales-title">
    <div className="merchant-actions"><h2 id="recent-sales-title">{t.recentSales}</h2><Link to={'/merchant/orders?lang=' + language}>{t.viewOrders}</Link></div>
    {error && <p role="alert">{error}</p>}
    {!items ? <p>{t.loading}</p> : !items.length ? <p>{t.emptySales}</p> : <div className="merchant-sales-list">{items.map((o, i) => <article key={o.publicOrderId} className={i === 0 ? 'merchant-latest-sale' : ''}>
      {i === 0 && <span className="merchant-badge is-online">{t.latestSale}</span>}
      <h3>{o.productName}</h3><p><strong>{money(o, language)}</strong> · {t.paidSale}</p>
      <p>{o.locationName}</p><p>{t.paidAt}: <time dateTime={o.paidAt}>{new Date(o.paidAt).toLocaleString(language)}</time></p>
      <p>{t.number}: {o.publicOrderId}</p>
    </article>)}</div>}
  </section>;
}
