import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

// Read-only foundation. Merchant checkout/reservations are a later milestone.
export default function MerchantOfferPage() {
  const { publicOfferId } = useParams();
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
  return <main style={{ maxWidth: 540, margin: '40px auto', padding: 24, overflowWrap: 'anywhere' }}>
    <p>qr2buy</p>
    {!ready ? <p role="status">Angebot wird geladen …</p> : !data?.ok ? <h1>Angebot derzeit nicht verfügbar</h1> : <>
      <p>{data.merchant.displayName} · {data.location.name}</p>
      <h1>{data.product.name}</h1>
      <p>{data.product.description}</p>
      <strong>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: data.offer.currency }).format(
        data.offer.priceMinor / 10 ** new Intl.NumberFormat('de-DE', { style: 'currency', currency: data.offer.currency }).resolvedOptions().maximumFractionDigits
      )}</strong>
      <p>{data.offer.stockQuantity > 0 ? 'Verfügbar' : 'Nicht verfügbar'}</p>
      <p>Online-Kauf und Reservierung sind für dieses Angebot noch nicht freigeschaltet.</p>
    </>}
  </main>;
}
