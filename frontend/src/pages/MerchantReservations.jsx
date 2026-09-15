import { useEffect, useState } from 'react';
import { merchantRequest } from '../merchantApi.js';
import { reservationText } from '../reservation.js';
import { ReservationSummary } from './ReservationPage.jsx';

export default function MerchantReservations({ language, csrfToken }) {
  const t=reservationText[language], [items,setItems]=useState(null), [selected,setSelected]=useState(null), [pending,setPending]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let timer;
    async function load(){try {const r=await merchantRequest('/api/merchant/reservations',null,'GET',null,controller.signal);setItems(r.items);setError('');}
      catch(e){if(e.name!=='AbortError')setError(t.error);}
      if(!controller.signal.aborted)timer=setTimeout(load,15000);}
    load();return()=>{controller.abort();clearTimeout(timer);};
  },[t]);
  async function details(id){setError('');try{const r=await merchantRequest('/api/merchant/reservations/'+id);setSelected(r.reservation);setPending(null);}catch{setError(t.error);}}
  async function act(){setBusy(true);setError('');try{
    const r=await merchantRequest('/api/merchant/reservations/'+selected.reservationId+'/'+pending,{},'POST',csrfToken);
    setSelected(r.reservation);setItems(previous=>previous?.map(item=>item.reservationId===r.reservation.reservationId?r.reservation:item));
    setPending(null);const list=await merchantRequest('/api/merchant/reservations');setItems(list.items);
  }catch(e){setError(t[e.message]||t.error);}finally{setBusy(false);}}
  const current = selected && (items?.find(r=>r.reservationId===selected.reservationId) || selected);
  return <section className="reservation-ui">
    {error && <p role="alert">{error}</p>}
    {!selected && (!items?<p>{t.loading}</p>:!items.length?<p>{t.empty}</p>:<><p>{t.listLimit}</p>{items.map(r=><article key={r.reservationId}>
      <h2>{r.productName}</h2><p>{t.number}: {r.publicReservationId}</p><p>{r.buyerName} · {r.buyerEmail || r.buyerPhone}</p>
      <p>{t[r.status]} · {r.locationName}</p><p>{t.created}: {new Date(r.createdAt).toLocaleString(language)}</p>
      <p>{t.until}: {new Date(r.expiresAt).toLocaleString(language)}</p><button onClick={()=>details(r.reservationId)}>{t.details}</button>
    </article>)}</>)}
    {current && <article aria-label={t.details}><ReservationSummary r={current} language={language}/>
      <button disabled={busy} onClick={()=>{setSelected(null);setPending(null);}}>{t.back}</button>
      <p>{current.buyerName}</p><p>{current.buyerEmail}</p><p>{current.buyerPhone}</p><p>{current.buyerNote}</p>
      <p>{t.source}: {t[current.source]}</p>
      {current.status==='RESERVED' && <>{pending?<><p>{t.confirmAction}</p><button disabled={busy} onClick={act}>{pending==='collect'?t.confirmCollect:t.confirmCancel}</button><button disabled={busy} onClick={()=>setPending(null)}>{t.back}</button></>:<><button onClick={()=>setPending('collect')}>{t.collect}</button><button onClick={()=>setPending('cancel')}>{t.cancel}</button></>}</>}
    </article>}
  </section>;
}
