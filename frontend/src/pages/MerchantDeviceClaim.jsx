import { useEffect, useRef, useState } from 'react';
import { merchantRequest } from '../merchantApi.js';

const copy = {
  de: { title: 'Neues Schild zuordnen', device: 'Geräte-ID', location: 'Standort', choose: 'Standort auswählen', start: 'Besitzbestätigung anzeigen',
    help: 'Nur für noch nie zugeordnete Schilder. Händler und Standort direkt auf dem Schild prüfen. Nur wenn beide stimmen, den dort angezeigten Code eingeben. Es wird kein Produkt verbunden.',
    code: 'Code auf dem Schild', confirm: 'Schild diesem Standort zuordnen', expired: 'Bestätigung abgelaufen. Neue Bestätigung anfordern.', restart: 'Neue Bestätigung vorbereiten',
    success: 'Schild zugeordnet. Noch kein Produkt verbunden.', remaining: 'Gültig für', seconds: 'Sekunden',
    error: 'Zuordnung nicht bestätigt. Eingaben prüfen oder nach Ablauf erneut versuchen.', update: 'Das Schild benötigt die freigegebene Erstzuordnungs-Firmware und einen aktuellen Onlinekontakt.',
    locked: 'Zu viele Fehlversuche. Nach zehn Minuten erneut versuchen.', progress: 'Für dieses Schild läuft bereits eine Bestätigung. Ablauf abwarten.' },
  en: { title: 'Assign a new display', device: 'Device ID', location: 'Location', choose: 'Choose a location', start: 'Show possession confirmation',
    help: 'Only for displays that have never been assigned. Check merchant and location on the physical display. Only enter its code if both are correct. No product will be connected.',
    code: 'Code on the display', confirm: 'Assign display to this location', expired: 'Confirmation expired. Request a new confirmation.', restart: 'Prepare a new confirmation',
    success: 'Display assigned. No product connected yet.', remaining: 'Valid for', seconds: 'seconds',
    error: 'Assignment not confirmed. Check the inputs or try again after expiry.', update: 'The display needs the approved initial-assignment firmware and a recent online connection.',
    locked: 'Too many incorrect attempts. Try again after ten minutes.', progress: 'A confirmation is already pending for this display. Wait for it to expire.' }
};
export default function MerchantDeviceClaim({ language, merchantName, locations, csrfToken, onComplete }) {
  const t = copy[language];
  const [deviceId, setDeviceId] = useState(''), [locationId, setLocationId] = useState('');
  const [pending, setPending] = useState(null), [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [done, setDone] = useState(false), [clock, setClock] = useState(Date.now);
  const request = useRef(null);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remaining = pending ? Math.max(0, Math.ceil((Date.parse(pending.expiresAt) - clock) / 1000)) : 0;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      let result;
      if (!pending) {
        // Freeze the full request across lost responses, including scope and key.
        request.current ||= { deviceId, locationId, requestKey: crypto.randomUUID().replaceAll('-', '') };
        result = await merchantRequest('/api/merchant/device-claims', request.current, 'POST', csrfToken);
        setPending(result); setClock(Date.now());
      } else result = await merchantRequest('/api/merchant/device-claims/'+pending.claimId+'/confirm', { code }, 'POST', csrfToken);
      if (result.status === 'CONFIRMED') { setDone(true); setCode(''); await onComplete(); }
    } catch (error) {
      setMessage(error.message === 'device_update_required' ? t.update : error.message === 'claim_locked' ? t.locked
        : error.message === 'claim_in_progress' ? t.progress : error.message === 'claim_expired' ? t.expired : t.error);
    } finally { setBusy(false); }
  }
  return <article className="merchant-device-claim">
    <h2>{t.title}</h2>
    {done ? <p role="status">{t.success}</p> : <form onSubmit={submit}>
      <p>{t.help}</p><p><strong>{merchantName}</strong></p>
      <label className="merchant-field">{t.device}<input required pattern="QR2B-[0-9]{6}" maxLength={11} value={deviceId} disabled={busy || !!request.current} onChange={e => setDeviceId(e.target.value.trim().toUpperCase())}/></label>
      <div className="merchant-field"><label htmlFor="claim-location">{t.location}</label><select id="claim-location" required value={locationId} disabled={busy || !!request.current} onChange={e => setLocationId(e.target.value)}><option value="">{t.choose}</option>{locations.filter(l => l.status === 'ACTIVE').map(l => <option key={l.locationId} value={l.locationId}>{l.name}</option>)}</select></div>
      {pending && <><p role="status">{remaining ? `${t.remaining} ${remaining} ${t.seconds}` : t.expired}</p>
        <label className="merchant-field">{t.code}<input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} required disabled={busy || !remaining}/></label></>}
      <button disabled={busy || (pending ? !remaining || !/^\d{6}$/.test(code) : !/^QR2B-[0-9]{6}$/.test(deviceId) || !locationId)}>{pending ? t.confirm : t.start}</button>
      {pending && !remaining && <button type="button" disabled={busy} onClick={() => { request.current = null; setPending(null); setCode(''); setMessage(''); }}>{t.restart}</button>}
      {message && <p role="alert">{message}</p>}
    </form>}
  </article>;
}
