import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { offerCopy, shortDescription, offerAvailability, productImage } from './merchantOffer.js';
import './MerchantOfferPage.css';

function ProductImage({ src, name, expanded = false }) {
  const [failed, setFailed] = useState(false);
  return !src || failed ? null : <img className={expanded ? 'buyer-image buyer-image-large' : 'buyer-image'}
    src={src} alt={name} referrerPolicy="no-referrer" decoding="async" onError={() => setFailed(true)} />;
}

function ProductExperience({ data, language, t }) {
  const [expanded, setExpanded] = useState(false);
  const image = productImage(data.product.image);
  const description = data.product.description?.trim();
  const availability = offerAvailability(data.offer);
  const price = new Intl.NumberFormat(language, { style: 'currency', currency: data.offer.currency });
  return <article className="buyer-product">
    <header>
      <p className="buyer-merchant">{data.merchant.displayName}</p>
      <p className="buyer-location">{data.location.name}</p>
      <h1>{data.product.name}</h1>
      <p className="buyer-price"><strong>{price.format(data.offer.priceMinor / 10 ** price.resolvedOptions().maximumFractionDigits)}</strong></p>
      <p className={`buyer-availability buyer-availability-${availability}`}>{t[availability]}</p>
    </header>
    <ProductImage key={image} src={image} name={data.product.name} />
    {description && <p className="buyer-description">{shortDescription(description)}</p>}
    {availability === 'soldOut' && <p className="buyer-muted">{t.soldOutDetail}</p>}
    <details className="buyer-details" onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>{expanded ? t.less : t.more}</summary>
      {expanded && <div className="buyer-detail-content">
        {description && <p className="buyer-full-description">{description}</p>}
        <ProductImage key={image} src={image} name={data.product.name} expanded />
        <dl>
          <dt>{t.merchant}</dt><dd>{data.merchant.displayName}</dd>
          <dt>{t.location}</dt><dd>{data.location.name}</dd>
          {data.product.category && <><dt>{t.category}</dt><dd>{data.product.category}</dd></>}
        </dl>
      </div>}
    </details>
    {/* Offer flags alone never authorize commerce. Add actions here only with real backend flows. */}
    <aside className="buyer-commerce">{t.checkout}</aside>
  </article>;
}

// Read-only foundation. Merchant checkout/reservations are a later milestone.
export default function MerchantOfferPage() {
  const { publicOfferId } = useParams();
  const [params] = useSearchParams();
  const language = params.get('lang') === 'en' ? 'en' : params.get('lang') === 'de' ? 'de' : navigator.language.startsWith('de') ? 'de' : 'en';
  const t = offerCopy[language];
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
  return <main lang={language} className="buyer-page">
    <p className="buyer-brand">qr2buy</p>
    {!ready ? <p role="status">{t.loading}</p> : !data?.ok ? <h1>{t.unavailable}</h1>
      : <ProductExperience key={publicOfferId} data={data} language={language} t={t} />}
  </main>;
}
