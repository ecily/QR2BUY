import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { notifyText, notifyRequest } from '../notify.js';
import './Notify.css';

export function NotifyForm({offerId,language}) {
  const t=notifyText[language], [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState(false);
  async function submit(event) {
    event.preventDefault();if(busy)return;
    const data=new FormData(event.currentTarget);setBusy(true);setError(false);
    try{await notifyRequest('offers/'+encodeURIComponent(offerId),{email:data.get('email'),name:data.get('name'),locale:language,consent:data.get('consent')==='on'});setDone(true);}
    catch{setError(true);}finally{setBusy(false);}
  }
  return <section className="notify-form" aria-label={t.submit}>
    {done?<p role="status">{t.success}</p>:<form onSubmit={submit}>
      <h2>{t.question}</h2>
      <label>{t.email}<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy}/></label>
      <label>{t.name}<input name="name" autoComplete="name" maxLength={120} disabled={busy}/></label>
      <label className="notify-consent"><input name="consent" type="checkbox" required disabled={busy}/><span>{t.consent}</span></label>
      {error&&<p role="alert">{t.error}</p>}
      <button type="submit" disabled={busy}>{t.submit}</button>
    </form>}
    <p className="buyer-muted">{t.detail}</p>
  </section>;
}
export default function NotifyUnsubscribe() {
  const {token}=useParams(),[params]=useSearchParams(),language=params.get('lang')==='en'?'en':'de',t=notifyText[language];
  const [done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  async function cancel(){setBusy(true);setError(false);try{await notifyRequest('unsubscribe',{token});setDone(true);}catch{setError(true);}finally{setBusy(false);}}
  return <main className="buyer-page" lang={language}><meta name="referrer" content="no-referrer"/><p className="buyer-brand">qr2buy</p><section className="buyer-product notify-form">
    <h1>{t.unsubscribe}</h1>{done?<p role="status">{t.cancelled}</p>:<button disabled={busy} onClick={cancel}>{t.cancel}</button>}
    {error&&<p role="alert">{t.error}</p>}
  </section></main>;
}
