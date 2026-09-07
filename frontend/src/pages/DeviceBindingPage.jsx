import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { bindingText, bindingRequest, bindingError, previewExpired, codeFromScan } from '../binding.js';
import BrandLogo from '../components/BrandLogo.jsx';
import './DeviceBindingPage.css';

function Binding({ deviceId }) {
  const [language, setLanguage] = useState(navigator.language.startsWith('de') ? 'de' : 'en');
  const text = bindingText[language];
  const [publicState, setPublicState] = useState('loading');
  const [authorization, setAuthorization] = useState(''); // Memory only, never URL or browser storage.
  const [context, setContext] = useState(null);
  const [method, setMethod] = useState('PRODUCT_CODE');
  const [value, setValue] = useState('');
  const [preview, setPreview] = useState(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [scanning, setScanning] = useState(false);
  const video = useRef(null);
  const scanner = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/binding/devices/${encodeURIComponent(deviceId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async r => ({ status: r.status, body: await r.json() }))
      .then(({ status, body }) => setPublicState(status === 404 ? 'missing' : status === 200 && body.available ? 'ready' : 'unavailable'))
      .catch(e => { if (e.name !== 'AbortError') setPublicState('unavailable'); });
    return () => controller.abort();
  }, [deviceId]);
  useEffect(() => { const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => () => { scanner.current?.getTracks().forEach(t => t.stop()); }, []);
  const expired = previewExpired(preview, tick);
  async function perform(work) {
    setBusy(true); setMessage('');
    try { await work(); } catch (e) { setMessage(bindingError(e.message, text)); } finally { setBusy(false); }
  }
  async function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bytes = new TextEncoder().encode(`${form.get('username')}:${form.get('password')}`);
    const auth = 'Basic ' + btoa(String.fromCharCode(...bytes));
    await perform(async () => { const c = await bindingRequest(deviceId, '', auth); setAuthorization(auth); setContext(c); });
  }
  async function scan() {
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) { setMessage(text.scannerUnavailable); return; }
    setScanning(true); setMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      scanner.current = stream;
      if (!video.current) { stream.getTracks().forEach(t => t.stop()); return; }
      video.current.srcObject = stream; await video.current.play();
      const detector = new window.BarcodeDetector({ formats: method === 'EAN' ? ['ean_13', 'ean_8', 'upc_a', 'upc_e'] : ['qr_code'] });
      const until = Date.now() + 30000;
      while (scanner.current && Date.now() < until) {
        const results = await detector.detect(video.current);
        const found = results.map(r => codeFromScan(r.rawValue, method)).find(Boolean);
        if (found) { setValue(found); break; }
        await new Promise(r => setTimeout(r, 250));
      }
    } catch { setMessage(text.scannerUnavailable); }
    finally { scanner.current?.getTracks().forEach(t => t.stop()); scanner.current = null; setScanning(false); }
  }
  return <main className="device-binding" lang={language}>
    <header><a href="/" aria-label="qr2buy"><BrandLogo/></a><button className="secondary" onClick={() => setLanguage(language === 'de' ? 'en' : 'de')}>{language === 'de' ? 'English' : 'Deutsch'}</button></header>
    <p className="eyebrow">{text.intro}</p><h1>{text.title}</h1>
    {publicState !== 'ready' ? <p role="status">{text[publicState]}</p> : !context ? <form onSubmit={login}>
      <p className="device-id">{deviceId}</p>
      <label>{text.user}<input name="username" autoComplete="username" required maxLength={128}/></label>
      <label>{text.password}<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
      <button disabled={busy}>{text.login}</button>
    </form> : <>
      <h2>{context.device.displayName}</h2><p className="device-id">{deviceId}</p>
      {status === 'ACTIVE' ? <section role="status"><h2>{text.active}</h2><p>{text.success}</p></section> : preview && !expired ? <section>
        <h2>{text.question}</h2><h3>{preview.product.name}</h3>
        <p className="price">{new Intl.NumberFormat(language, { style: 'currency', currency: preview.offer.currency }).format(preview.offer.priceMinor / 10 ** new Intl.NumberFormat(language, { style: 'currency', currency: preview.offer.currency }).resolvedOptions().maximumFractionDigits)}</p>
        <p>{text.instruction}</p><p aria-live="off">{Math.max(0, Math.ceil((new Date(preview.expiresAt) - tick) / 1000))} s</p>
        <label>{text.code}<input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off" maxLength={6}/></label>
        <button disabled={busy || code.length !== 6} onClick={() => perform(async () => { const r = await bindingRequest(deviceId, 'confirm', authorization, { previewId: preview.previewId, code }); setStatus(r.status); setPreview(null); setCode(''); })}>{text.yes}</button>
        <button className="secondary" disabled={busy} onClick={() => perform(async () => { await bindingRequest(deviceId, 'cancel', authorization, { previewId: preview.previewId }); setPreview(null); setCode(''); setStatus('CANCELLED'); })}>{text.cancel}</button>
      </section> : <section>
        {preview && expired && <p role="status">{text.expired}</p>}{status === 'CANCELLED' && <p role="status">{text.cancelled}</p>}
        <h2>{text.choose}</h2><label>{text.method}<select value={method} onChange={e => { setMethod(e.target.value); setValue(''); }}><option value="PRODUCT_CODE">{text.productCode}</option><option value="EAN">{text.ean}</option></select></label>
        {method === 'PRODUCT_CODE' && <label>{text.product}<select value={value} onChange={e => setValue(e.target.value)}><option value="">—</option>{context.products.map(p => <option key={p.productBindingId} value={p.productBindingId}>{p.name}</option>)}</select></label>}
        {!context.products.length && <p>{text.empty}</p>}
        <label>{method === 'EAN' ? text.ean : text.productCode}<input value={value} onChange={e => setValue(e.target.value.trim())} maxLength={32} inputMode={method === 'EAN' ? 'numeric' : 'text'}/></label>
        <p>{text.scanHelp}</p><button className="secondary" disabled={scanning || busy} onClick={scan}>{text.scan}</button>
        <video ref={video} hidden={!scanning} playsInline muted aria-label={text.scan}/>
        {scanning && <button className="secondary" onClick={() => { scanner.current?.getTracks().forEach(t => t.stop()); scanner.current = null; setScanning(false); }}>{text.cancel}</button>}
        <button disabled={busy || !codeFromScan(value, method)} onClick={() => perform(async () => { const p = await bindingRequest(deviceId, 'preview', authorization, { method, value }); setPreview(p); setCode(''); setStatus(''); setTick(Date.now()); })}>{text.preview}</button>
      </section>}
      <button className="secondary" disabled={busy} onClick={() => { setAuthorization(''); setContext(null); setPreview(null); setCode(''); setStatus(''); }}>{text.logout}</button>
    </>}
    {message && <p role="alert">{message}</p>}
  </main>;
}
export default function DeviceBindingPage() { const { deviceId } = useParams(); return <Binding key={deviceId} deviceId={deviceId}/>; }
