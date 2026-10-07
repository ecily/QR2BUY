import { NotifyForm } from './NotifyForm.jsx';
import { canNotify, notifyText } from '../notify.js';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { offerCopy, shortDescription, offerAvailability, productImage } from './merchantOffer.js';
import './MerchantOfferPage.css';
import { canReserve, reservationText } from '../reservation.js';
import { ReservationForm } from './ReservationPage.jsx';
import PurchaseButton from './PurchaseButton.jsx';
import { canBuy, purchaseText } from '../purchase.js';

function ProductImage({ src, name, expanded = false }) {
  const [failed, setFailed] = useState(false);
  return !src || failed ? null : <img className={expanded ? 'buyer-image buyer-image-large' : 'buyer-image'}
    src={src} alt={name} referrerPolicy="no-referrer" decoding="async" onError={() => setFailed(true)} />;
}

function ProductExperience({ data, language, t }) {
  const [expanded, setExpanded] = useState(false);
  const [reserving, setReserving] = useState(false);
  const rt = reservationText[language];
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
      <p className={`buyer-availability buyer-availability-${availability}`} data-state={data.availabilityState}>{purchaseText[language][data.availabilityState] || (data.availabilityState === 'SOLD' ? notifyText[language].sold : data.offer.active && data.offer.temporarilyReserved ? rt.held : t[availability])}</p>
    </header>
    {availability === 'soldOut' && !data.offer.temporarilyReserved && <p className="buyer-muted">{t.soldOutDetail}</p>}
    <p className="buyer-convenience">{t.noApp}</p>
    <div className="buyer-actions">
    {canBuy(data) && <PurchaseButton offerId={data.publicOfferId} language={language}/>}
    {canReserve(data) && !reserving && <button className="reserve-button buyer-reserve" onClick={()=>setReserving(true)}>{rt.reserve}</button>}
    {reserving && canReserve(data) && <ReservationForm offerId={data.publicOfferId} language={language} duration={data.offer.reservationDuration} onClose={()=>setReserving(false)}/>}
    {canNotify(data) && <NotifyForm offerId={data.publicOfferId} language={language}/>}
    </div>
    <ProductImage key={image} src={image} name={data.product.name} />
    {description && <p className="buyer-description">{shortDescription(description)}</p>}
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
    {/* Backend capability gates the test purchase; offer flags alone are insufficient. */}
    {!data.checkoutAvailable && !['CHECKOUT_STARTED', 'PAID', 'SOLD'].includes(data.availabilityState) && <aside className="buyer-commerce">{data.reservationAvailable ? rt.purchase : t.checkout}</aside>}
  </article>;
}

// Buyer and physical display read the same server-side offer projection.
export default function MerchantOfferPage() {
  const { publicOfferId } = useParams();
  const [params] = useSearchParams();
  const language = params.get('lang') === 'en' ? 'en' : params.get('lang') === 'de' ? 'de' : navigator.language.startsWith('de') ? 'de' : 'en';
  const t = offerCopy[language];
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const load = () => fetch(`/api/public/merchant-offers/${encodeURIComponent(publicOfferId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => ({ id: publicOfferId, data: response.ok ? await response.json() : null }))
      .then(setResult).catch(error => { if (error.name !== 'AbortError') setResult({ id: publicOfferId, data: null }); })
      .finally(()=>{if(!controller.signal.aborted)timer=setTimeout(load,15000);});
    load();
    return () => {controller.abort();clearTimeout(timer);};
  }, [publicOfferId]);
  const ready = result?.id === publicOfferId;
  const data = ready ? result.data : null;
  return <main lang={language} className="buyer-page">
    {!ready ? <p role="status">{t.loading}</p> : !data?.ok ? <h1>{t.unavailable}</h1>
      : <ProductExperience key={publicOfferId} data={data} language={language} t={t} />}
    <footer className="buyer-powered">powered by <a href="https://qr2buy.com">qr2buy.com</a></footer>
  </main>;
}
