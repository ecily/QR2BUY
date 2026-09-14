import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import { merchantRequest, safeReturn, minorFromInput, priceInput, merchantSummary } from '../merchantApi.js';
import { merchantText } from '../merchantText.js';
import './MerchantPortal.css';

const empty = { products: [], offers: [], devices: [], locations: [], merchant: {} };
const fields = ['line1','line2','postalCode','city','region','country'];
function Input({ name, label, value, type = 'text', required = false, ...props }) {
  return <label className="merchant-field">{label}<input name={name} type={type} defaultValue={value ?? ''} required={required} {...props}/></label>;
}
function Address({ text, value = {} }) {
  return <fieldset className="merchant-address"><legend>{text.address}</legend>{fields.map(f => <Input key={f} name={'address.'+f} label={text[f]} value={value?.[f]} maxLength={f === 'country' ? 2 : 150}/>)}</fieldset>;
}
function Portal() {
  const { pathname, search } = useLocation(), navigate = useNavigate();
  const [language, setLanguage] = useState(() => new URLSearchParams(search).get('lang') === 'en' ? 'en' : new URLSearchParams(search).get('lang') === 'de' ? 'de' : navigator.language.startsWith('de') ? 'de' : 'en');
  const t = merchantText[language];
  const [auth, setAuth] = useState(null), [data, setData] = useState(empty), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [edit, setEdit] = useState(null), [connect, setConnect] = useState(null);
  const register = pathname === '/merchant/register', login = pathname === '/merchant/login';
  const authPage = register || login;
  const section = pathname.split('/')[2] || 'overview';
  const returnTo = safeReturn(new URLSearchParams(search).get('returnTo'));
  const langQuery = '?lang='+language;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (authPage) {
          const r = await merchantRequest('/api/merchant-auth/csrf', null, 'GET', null, controller.signal); setAuth(r);
        } else {
          const me = await merchantRequest('/api/merchant-auth/me', null, 'GET', null, controller.signal); setAuth(me);
          const values = await Promise.all(['products','offers','devices','locations','me'].map(p => merchantRequest('/api/merchant/'+p, null, 'GET', null, controller.signal)));
          setData({ products: values[0].items, offers: values[1].items, devices: values[2].items, locations: values[3].items, merchant: values[4].merchant });
        }
        setReady(true);
      } catch (e) {
        if (e.name === 'AbortError') return;
        if (e.status === 401) navigate('/merchant/login?returnTo='+encodeURIComponent(pathname)+'&lang='+language, { replace: true });
        else { setMessage(e.message); setReady(true); }
      }
    }
    load(); return () => controller.abort();
  }, [authPage, pathname, navigate, language]);
  useEffect(() => { document.title = `qr2buy · ${t.title}`; }, [t.title]);
  const money = o => new Intl.NumberFormat(language, { style: 'currency', currency: o.currency }).format(Number(priceInput(o.priceMinor, o.currency)));
  async function reload() {
    const values = await Promise.all(['products','offers','devices','locations','me'].map(p => merchantRequest('/api/merchant/'+p)));
    setData({ products: values[0].items, offers: values[1].items, devices: values[2].items, locations: values[3].items, merchant: values[4].merchant });
  }
  async function perform(work) {
    setBusy(true); setMessage('');
    try { await work(); } catch (e) {
      if (e.status === 401 && !authPage) navigate('/merchant/login?returnTo='+encodeURIComponent(pathname)+'&lang='+language);
      else setMessage(e.status === 429 ? 'rate' : e.message);
    } finally { setBusy(false); }
  }
  async function submitAuth(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body = { email: form.get('email'), password: form.get('password') };
    if (register) Object.assign(body, { displayName: form.get('displayName'), locationName: form.get('locationName'), phone: form.get('phone') });
    await perform(async () => { await merchantRequest('/api/merchant-auth/'+(register ? 'register' : 'login'), body, 'POST', auth.csrfToken); navigate(returnTo+(returnTo.startsWith('/merchant') ? langQuery : ''), { replace: true }); });
  }
  async function save(event) {
    event.preventDefault(); const f = new FormData(event.currentTarget), body = {};
    const { type, item } = edit;
    let path, method = 'PATCH';
    if (type === 'product') {
      for (const key of ['name','description','sku','ean','category','image']) body[key] = f.get(key);
      path = '/products'+(item.productId ? '/'+item.productId : ''); method = item.productId ? 'PATCH' : 'POST';
    } else if (type === 'offer') {
      body.productId = item.productId; body.locationId = item.offerId ? item.locationId : f.get('locationId');
      body.currency = f.get('currency');
      try { body.priceMinor = minorFromInput(f.get('price'), body.currency); } catch { setMessage('invalid_input'); return; }
      body.stockQuantity = Number(f.get('stockQuantity'));
      for (const key of ['purchasable','reservable','active']) body[key] = f.get(key) === 'on';
      body.reservationDuration = f.get('reservationDuration') ? Number(f.get('reservationDuration')) : null; body.conditions = f.get('conditions');
      path = '/offers'+(item.offerId ? '/'+item.offerId : ''); method = item.offerId ? 'PATCH' : 'POST';
    } else if (type === 'device') { body.displayName = f.get('displayName'); path = '/devices/'+item.deviceId; }
    else {
      body.address = Object.fromEntries(fields.map(key => [key, key === 'country' ? String(f.get('address.'+key)).toUpperCase() : f.get('address.'+key)]));
      if (type === 'location') { body.name = f.get('name'); path = '/locations'+(item.locationId ? '/'+item.locationId : ''); method = item.locationId ? 'PATCH' : 'POST'; }
      else { for (const key of ['displayName','contactEmail','phone']) body[key] = f.get(key); path = '/me'; }
    }
    await perform(async () => { await merchantRequest('/api/merchant'+path, body, method, auth.csrfToken); await reload(); setEdit(null); setMessage('saved'); });
  }
  const startEdit = (type, item = {}) => { setMessage(''); setConnect(null); setEdit({ type, item }); };
  const summary = merchantSummary(data.products, data.offers, data.devices);
  return <div className="merchant-portal" lang={language}>
    <header className="merchant-top"><Link to="/" aria-label="qr2buy"><BrandLogo/></Link><button className="merchant-quiet" onClick={() => setLanguage(language === 'de' ? 'en' : 'de')}>{language === 'de' ? 'English' : 'Deutsch'}</button></header>
    {!authPage && auth?.account && <nav aria-label={t.title}>{[['overview',''],['devices','/devices'],['products','/products'],['locations','/locations'],['settings','/settings']].map(([key, p]) => <Link key={key} aria-current={section === key ? 'page' : undefined} to={'/merchant'+p+langQuery}>{t[key]}</Link>)}<button disabled={busy} onClick={() => perform(async () => { await merchantRequest('/api/merchant-auth/logout', {}, 'POST', auth.csrfToken); setAuth(null); setData(empty); navigate('/merchant/login'+langQuery); })}>{t.logout}</button></nav>}
    <main>
      {!ready ? <p role="status">{t.loading}</p> : authPage ? <section className="merchant-auth">
        <p className="merchant-eyebrow">qr2buy · {t.title}</p><h1>{register ? t.register : t.login}</h1><p>{register ? t.registerIntro : t.loginIntro}</p>
        {auth?.csrfToken && <form onSubmit={submitAuth}><fieldset disabled={busy}>
          <Input name="email" label={t.email} type="email" required autoComplete="email" maxLength={254}/>
          <Input name="password" label={t.password} type="password" required autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : 1} maxLength={128}/>
          {register && <><p className="merchant-help">{t.passwordHint}</p><Input name="displayName" label={t.business} required maxLength={120}/><Input name="locationName" label={t.locationName} required maxLength={120}/><Input name="phone" label={t.phone} type="tel" maxLength={40}/></>}
          <button type="submit">{register ? t.register : t.login}</button>
        </fieldset></form>}
        <Link to={(register ? '/merchant/login' : '/merchant/register')+'?lang='+language+'&returnTo='+encodeURIComponent(returnTo)}>{register ? t.existingAccount : t.newAccount}</Link>
      </section> : auth?.account && <>
        <p className="merchant-eyebrow">{data.merchant.displayName}</p><h1>{t[section] || t.overview}</h1>
        {section === 'overview' && <><p>{t.intro}</p><div className="merchant-stats">{[['products',t.products],['devices',t.devices],['online',t.onlineCount],['unassigned',t.unassignedCount],['activeOffers',t.activeOffers]].map(([key,label]) => <article key={key}><strong>{summary[key]}</strong><span>{label}</span></article>)}</div><div className="merchant-actions"><Link className="merchant-button" to={'/merchant/products'+langQuery}>{t.newProduct}</Link><Link to={'/merchant/devices'+langQuery}>{t.devices}</Link></div><p className="merchant-help">{t.checkout}</p></>}
        {section === 'products' && <><button onClick={() => startEdit('product')}>{t.newProduct}</button>{!data.products.length && <p>{t.emptyProducts}</p>}<div className="merchant-cards">{data.products.map(p => {
          const offers = data.offers.filter(o => o.productId === p.productId), active = offers.filter(o => o.active), count = data.devices.filter(d => d.product?.productId === p.productId).length;
          return <article key={p.productId}>{p.image && <img className="merchant-product-image" src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<h2>{p.name}</h2><p className="merchant-help">{t.boundOffers}: {active.length} · {t.stock}: {active.reduce((n,o) => n+o.stockQuantity,0)} · {t.displayCount}: {count}</p>
            <div className="merchant-actions"><button className="merchant-quiet" onClick={() => startEdit('product',p)}>{t.edit}</button><button onClick={() => startEdit('offer',{productId:p.productId,currency:'EUR',priceMinor:0,stockQuantity:0,purchasable:true,reservable:true,active:true})}>{t.newOffer}</button><button className="merchant-quiet" onClick={() => { setEdit(null); setConnect(p); }}>{t.showOnDisplay}</button></div>
            <h3>{t.offers}</h3>{!offers.length && <p>{t.emptyOffers}</p>}{offers.map(o => <div className="merchant-offer" key={o.offerId}><p><strong>{money(o)}</strong> · {data.locations.find(l => l.locationId === o.locationId)?.name}<br/>{t.stock}: {o.stockQuantity} · {o.active ? t.ACTIVE : t.INACTIVE}</p><button className="merchant-quiet" onClick={() => startEdit('offer',o)}>{t.edit}</button></div>)}
          </article>;
        })}</div></>}
        {section === 'devices' && <>{!data.devices.length && <p>{t.emptyDevices}</p>}<div className="merchant-cards">{data.devices.map(d => <article key={d.deviceId}><span className={'merchant-badge '+(d.online ? 'is-online' : '')}>{d.online ? t.online : t.offline}</span><h2>{d.displayName}</h2><p>{d.location.name}</p><h3>{d.product?.name || t.unassigned}</h3>{d.offer && <p>{money(d.offer)} · {t.stock}: {d.offer.stockQuantity}</p>}<p>{t[d.assignmentStatus]}</p><p className="merchant-help">{t.lastSeen}: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString(language) : t.none}<br/>{t.firmware}: {d.firmwareVersion || t.none}</p><div className="merchant-actions"><button className="merchant-quiet" onClick={() => startEdit('device',d)}>{t.rename}</button><Link className="merchant-button" to={'/binding/'+d.deviceId}>{t.connect}</Link></div><details><summary>{t.technical}</summary><p>{d.deviceId}</p></details></article>)}</div><p className="merchant-help">{t.bindHelp}</p></>}
        {section === 'locations' && <><button onClick={() => startEdit('location')}>{t.newLocation}</button><div className="merchant-cards">{data.locations.map(l => <article key={l.locationId}><h2>{l.name}</h2><p>{[l.address?.line1,l.address?.postalCode,l.address?.city,l.address?.country].filter(Boolean).join(', ')}</p><p>{t[l.status]}</p><button className="merchant-quiet" onClick={() => startEdit('location',l)}>{t.edit}</button></article>)}</div></>}
        {section === 'settings' && <article><h2>{data.merchant.displayName}</h2><p>{data.merchant.contactEmail}</p><p>{data.merchant.phone}</p><p>{Object.values(data.merchant.address || {}).filter(Boolean).join(', ')}</p><p>{t.status}: {t[data.merchant.status]}</p><button onClick={() => startEdit('profile',data.merchant)}>{t.edit}</button></article>}
        {connect && <section className="merchant-editor"><h2>{connect.name} · {t.selectDisplay}</h2><p>{t.bindHelp}</p>{data.devices.length ? data.devices.map(d => <p key={d.deviceId}><Link to={'/binding/'+d.deviceId+'?product='+connect.productBindingId}>{d.displayName} · {d.location.name}</Link></p>) : <p>{t.emptyDevices}</p>}<button className="merchant-quiet" onClick={() => setConnect(null)}>{t.cancel}</button></section>}
        {edit && <section className="merchant-editor" key={edit.type+(edit.item.productId || edit.item.locationId || edit.item.deviceId || '')+(edit.item.offerId || '')}>
          <h2>{edit.type === 'offer' ? t.offers : edit.type === 'product' ? t.product : edit.type === 'device' ? t.rename : edit.type === 'location' ? t.location : t.settings}</h2>
          <form onSubmit={save}><fieldset disabled={busy}>
            {edit.type === 'product' && <><Input name="name" label={t.name} value={edit.item.name} required maxLength={120}/>{['ean','sku','category','image'].map(key => <Input key={key} name={key} label={t[key]} value={edit.item[key]} type={key === 'image' ? 'url' : 'text'} maxLength={key === 'image' ? 2000 : key === 'ean' ? 14 : 80}/>)}<label>{t.description}<textarea name="description" defaultValue={edit.item.description || ''} maxLength={4000}/></label><p className="merchant-help">{t.imageHelp}</p></>}
            {edit.type === 'offer' && <><Input name="price" label={t.price} value={priceInput(edit.item.priceMinor,edit.item.currency)} required inputMode="decimal"/>
              <div className="merchant-field"><label htmlFor="merchant-offer-currency">{t.currency}</label><select id="merchant-offer-currency" name="currency" defaultValue={edit.item.currency}>{['EUR','USD','GBP','CHF','JPY','KWD','BHD'].map(c => <option key={c}>{c}</option>)}</select></div>
              <Input name="stockQuantity" label={t.stock} value={edit.item.stockQuantity} type="number" min={0} max={2147483647} step={1} required/>
              <div className="merchant-field"><label htmlFor="merchant-offer-location">{t.location}</label><select id="merchant-offer-location" name="locationId" defaultValue={edit.item.locationId || ''} required disabled={!!edit.item.offerId}><option value="">—</option>{data.locations.filter(l => l.status === 'ACTIVE').map(l => <option key={l.locationId} value={l.locationId}>{l.name}</option>)}</select></div>
              {['purchasable','reservable','active'].map(key => <label className="merchant-check" key={key}><input type="checkbox" name={key} defaultChecked={edit.item[key]}/>{t[key]}</label>)}
              <Input name="reservationDuration" label={t.duration} value={edit.item.reservationDuration} type="number" min={1} max={525600} step={1}/><label>{t.conditions}<textarea name="conditions" defaultValue={edit.item.conditions || ''} maxLength={4000}/></label><p className="merchant-help">{t.offerLocationHelp} {t.checkout}</p></>}
            {edit.type === 'device' && <Input name="displayName" label={t.name} value={edit.item.displayName} required maxLength={120}/>}
            {edit.type === 'location' && <><Input name="name" label={t.locationName} value={edit.item.name} required maxLength={120}/><Address text={t} value={edit.item.address}/></>}
            {edit.type === 'profile' && <><Input name="displayName" label={t.business} value={edit.item.displayName} required maxLength={120}/><Input name="contactEmail" label={t.contactEmail} value={edit.item.contactEmail} type="email" required maxLength={254}/><Input name="phone" label={t.phone} value={edit.item.phone} type="tel" maxLength={40}/><Address text={t} value={edit.item.address}/></>}
            <div className="merchant-actions"><button type="submit">{t.save}</button><button type="button" className="merchant-quiet" onClick={() => setEdit(null)}>{t.cancel}</button></div>
          </fieldset></form>
        </section>}
      </>}
      {message && <p className={message === 'saved' ? 'merchant-success' : 'merchant-error'} role={message === 'saved' ? 'status' : 'alert'}>{t[message] || t.error}</p>}
    </main>
    <footer>qr2buy · {t.title}</footer>
  </div>;
}
export default function MerchantPortal() { const { pathname } = useLocation(); return <Portal key={pathname}/>; }
