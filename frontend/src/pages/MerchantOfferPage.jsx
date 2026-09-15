import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const copy = {
  de: { loading: 'Angebot wird geladen …', unavailable: 'Angebot derzeit nicht verfügbar', available: 'Verfügbar', soldOut: 'Momentan ausverkauft', soldOutDetail: 'Dieses Produkt ist derzeit nicht verfügbar.', checkout: 'Online-Kauf und Reservierung sind für dieses Angebot noch nicht freigeschaltet.' },
  en: { loading: 'Loading offer …', unavailable: 'Offer currently unavailable', available: 'Available', soldOut: 'Temporarily sold out', soldOutDetail: 'This product is currently unavailable.', checkout: 'Online checkout and reservations are not yet available for this offer.' },
};

// Read-only foundation. Merchant checkout/reservations are a later milestone.
export default function MerchantOfferPage() {
  const { publicOfferId } = useParams();
  const [params] = useSearchParams();
  const language = params.get('lang') === 'en' ? 'en' : params.get('lang') === 'de' ? 'de' : navigator.language.startsWith('de') ? 'de' : 'en';
  const t = copy[language];
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/merchant-offers/${encodeURIComponent(publicOfferId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => ({ id: publicOfferId, data: response.ok ? await response.json() : null }))
      .then(setResult).catch(error => { if (error.name !== 'AbortError') setResult({ id: publicOfferId, data: null }); });
    return () => controller.abort();
  }, [publicOfferId]);
  const ready = result?.id === publicOfferId;
  const data = ready ? result.data : null;
  return <main lang={language} style={{ maxWidth: 540, margin: '40px auto', padding: 24, overflowWrap: 'anywhere' }}>
    <p>qr2buy</p>
    {!ready ? <p role="status">{t.loading}</p> : !data?.ok ? <h1>{t.unavailable}</h1> : <>
      <p>{data.merchant.displayName} · {data.location.name}</p>
      <h1>{data.product.name}</h1>
      <p>{data.product.description}</p>
      <strong>{new Intl.NumberFormat(language, { style: 'currency', currency: data.offer.currency }).format(
        data.offer.priceMinor / 10 ** new Intl.NumberFormat(language, { style: 'currency', currency: data.offer.currency }).resolvedOptions().maximumFractionDigits
      )}</strong>
      <p>{data.offer.stockQuantity > 0 ? t.available : t.soldOut}</p>
      {data.offer.stockQuantity === 0 && <p>{t.soldOutDetail}</p>}
      <p>{t.checkout}</p>
    </>}
  </main>;
}
