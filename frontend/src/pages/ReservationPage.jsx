import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { reservationText, validBuyer, reservationRequest, money } from '../reservation.js';
import './Reservation.css';

export function ReservationForm({ offerId, language, duration, onClose }) {
  const t = reservationText[language], navigate = useNavigate(), attempt = useRef(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!validBuyer(data)) { setError(t.contactError); return; }
    const fingerprint = JSON.stringify(data);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key:crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const result = await reservationRequest('offers/'+offerId, {...data,quantity:1,requestKey:attempt.current.key});
      navigate('/r/'+result.reservation.publicReservationId+'?lang='+language);
    } catch(e) { setError(t[e.message] || t.error); }
    finally { setBusy(false); }
  }
  return <section className="reservation-ui"><h2>{t.reserve}</h2><p>{t.duration} {duration ?? 30} {t.minutes}</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      <label>{t.name}<input name="buyerName" required maxLength={120} autoComplete="name"/></label>
      <p id="reservation-contact">{t.contact}</p>
      <label>{t.email}<input name="buyerEmail" type="email" maxLength={254} autoComplete="email" aria-describedby="reservation-contact"/></label>
      <label>{t.phone}<input name="buyerPhone" type="tel" maxLength={40} autoComplete="tel" aria-describedby="reservation-contact"/></label>
      <label>{t.note}<textarea name="buyerNote" maxLength={1000}/></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">{busy?t.loading:t.submit}</button><button type="button" onClick={onClose}>{t.back}</button>
    </fieldset></form></section>;
}

export function ReservationSummary({ r, language }) {
  const t = reservationText[language];
  return <><p className="reservation-status">{t[r.status]}</p><h2>{r.productName}</h2>
    <dl><dt>{t.price}</dt><dd>{money(r,language)}</dd><dt>{t.quantity}</dt><dd>{r.quantity}</dd>
      <dt>{t.merchant}</dt><dd>{r.merchantName}</dd><dt>{t.location}</dt><dd>{r.locationName}</dd>
      <dt>{t.until}</dt><dd>{new Date(r.expiresAt).toLocaleString(language)}</dd>
      <dt>{t.number}</dt><dd className="reservation-number">{r.publicReservationId}</dd></dl></>;
}
export default function ReservationPage() {
  const { publicReservationId } = useParams(), [params] = useSearchParams();
  const language = params.get('lang') === 'en' ? 'en' : params.get('lang') === 'de' ? 'de' : navigator.language.startsWith('de') ? 'de' : 'en';
  const t = reservationText[language], [result,setResult] = useState(null), [error,setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let timer;
    async function load() {
      try { const data = await reservationRequest(publicReservationId,null,controller.signal); setResult({id:publicReservationId,r:data.reservation}); setError(false); }
      catch(e) { if(e.name!=='AbortError') setError(true); }
      if(!controller.signal.aborted) timer=setTimeout(load,15000);
    }
    load(); return()=>{controller.abort();clearTimeout(timer);};
  },[publicReservationId]);
  const r=result?.id===publicReservationId?result.r:null;
  return <main className="buyer-page reservation-ui" lang={language}><p className="buyer-brand">qr2buy</p>
    <h1>{r?(r.status==='RESERVED'?t.confirmed:t[r.status]):error?t.unavailable:t.loading}</h1>
    {r && <><ReservationSummary r={r} language={language}/>{r.status==='RESERVED' && <p>{t.pickup}</p>}</>}
    {error && r && <p role="alert">{t.refreshError}</p>}
  </main>;
}
