import { useEffect, useRef, useState } from 'react';
import { merchantRequest } from '../merchantApi.js';

const copy = {
  de: { title: 'Neues Schild zuordnen', device: 'Geräte-ID', location: 'Standort', choose: 'Standort auswählen', start: 'Besitzbestätigung anzeigen',
    help: 'Nur für noch nie zugeordnete Schilder. Zuerst den 32-stelligen Setupcode direkt vom Schild eingeben. Danach Händler und Standort am Schild prüfen und nur bei Übereinstimmung den sechsstelligen Code bestätigen. Es wird kein Produkt verbunden.',
    unsupported: 'Händler- und Standortname müssen am Schild exakt darstellbar sein: ASCII und ÄÖÜäöü, höchstens 64 UTF-8-Byte.', setupInvalid: 'Setupcode ungültig oder abgelaufen. Aktuellen Code direkt am Schild ablesen.', unavailable: 'Erstzuordnung derzeit nicht verfügbar.',
    setup: 'Setupcode auf dem Schild (32 Zeichen)', uncertain: 'Antwort unklar. Dieselbe Anfrage erneut prüfen.', check: 'Ergebnis erneut prüfen',
    code: 'Code auf dem Schild', confirm: 'Schild diesem Standort zuordnen', expired: 'Bestätigung abgelaufen. Neue Bestätigung anfordern.', restart: 'Neue Bestätigung vorbereiten',
    success: 'Schild zugeordnet. Noch kein Produkt verbunden.', remaining: 'Gültig für', seconds: 'Sekunden',
    error: 'Zuordnung nicht bestätigt. Eingaben prüfen oder nach Ablauf erneut versuchen.', update: 'Das Schild benötigt die freigegebene Erstzuordnungs-Firmware und einen aktuellen Onlinekontakt.',
    locked: 'Zu viele Fehlversuche. Nach zehn Minuten erneut versuchen.', progress: 'Für dieses Schild läuft bereits eine Bestätigung. Ablauf abwarten.' },
  en: { title: 'Assign a new display', device: 'Device ID', location: 'Location', choose: 'Choose a location', start: 'Show possession confirmation',
    help: 'Only for displays that have never been assigned. First enter the 32-character setup code from the physical display. Then check merchant and location on it and confirm its six-digit code only if both match. No product will be connected.',
    unsupported: 'Merchant and location names must render exactly: ASCII and ÄÖÜäöü, at most 64 UTF-8 bytes.', setupInvalid: 'Setup code invalid or expired. Read the current code from the physical display.', unavailable: 'Initial assignment is currently unavailable.',
    setup: 'Setup code on the display (32 characters)', uncertain: 'Response uncertain. Check the same request again.', check: 'Check result again',
    code: 'Code on the display', confirm: 'Assign display to this location', expired: 'Confirmation expired. Request a new confirmation.', restart: 'Prepare a new confirmation',
    success: 'Display assigned. No product connected yet.', remaining: 'Valid for', seconds: 'seconds',
    error: 'Assignment not confirmed. Check the inputs or try again after expiry.', update: 'The display needs the approved initial-assignment firmware and a recent online connection.',
    locked: 'Too many incorrect attempts. Try again after ten minutes.', progress: 'A confirmation is already pending for this display. Wait for it to expire.' }
};
export default function MerchantDeviceClaim({ language, merchantName, locations, csrfToken, onComplete }) {
  const t = copy[language];
  const [deviceId, setDeviceId] = useState(''), [locationId, setLocationId] = useState('');
  const [pending, setPending] = useState(null), [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  const [setupCode, setSetupCode] = useState(''), [startedAt, setStartedAt] = useState(null);
  const [message, setMessage] = useState(''), [done, setDone] = useState(false), [clock, setClock] = useState(Date.now);
  const request = useRef(null);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remaining = pending ? Math.max(0, Math.ceil((Date.parse(pending.expiresAt) - clock) / 1000)) : 0;
  function reset() { request.current = null; setPending(null); setStartedAt(null); setSetupCode(''); setCode(''); setMessage(''); }
  async function submit(event, check = false) {
    event?.preventDefault(); setBusy(true); setMessage('');
    controller.current = new AbortController();
    const timeout = setTimeout(() => controller.current.abort(), 20000);
    try {
      let result;
      if (!pending || check) {
        // Freeze the full request across lost responses, including scope and key.
        if (!request.current) { request.current = { deviceId, locationId, setupCode, requestKey: crypto.randomUUID().replaceAll('-', '') }; setStartedAt(Date.now()); }
        result = await merchantRequest('/api/merchant/device-claims', request.current, 'POST', csrfToken, controller.current.signal);
        setPending(result); setClock(Date.now());
      } else result = await merchantRequest('/api/merchant/device-claims/'+pending.claimId+'/confirm', { code }, 'POST', csrfToken, controller.current.signal);
      if (result.status === 'CONFIRMED') { setDone(true); setCode(''); await onComplete(); }
    } catch (error) {
      if ((!pending || check) && ((error.status >= 400 && error.status < 500) || error.message === 'claim_indexes_unavailable')) reset();
      setMessage(error.message === 'claim_indexes_unavailable' ? t.unavailable : !error.status || error.status >= 500 ? t.uncertain
        : error.message === 'invalid_setup_code' ? t.setupInvalid : error.message === 'claim_name_unsupported' ? t.unsupported : error.message === 'device_update_required' ? t.update : error.message === 'claim_locked' ? t.locked
        : error.message === 'claim_in_progress' ? t.progress : error.message === 'claim_expired' ? t.expired : t.error);
    } finally { clearTimeout(timeout); setBusy(false); }
  }
  return <article className="merchant-device-claim">
    <h2>{t.title}</h2>
    {done ? <p role="status">{t.success}</p> : <form onSubmit={submit}>
      <p>{t.help}</p><p><strong>{merchantName}</strong></p>
      <label className="merchant-field">{t.device}<input required pattern="QR2B-[0-9]{6}" maxLength={11} value={deviceId} disabled={busy || !!request.current} onChange={e => setDeviceId(e.target.value.trim().toUpperCase())}/></label>
      <div className="merchant-field"><label htmlFor="claim-location">{t.location}</label><select id="claim-location" required value={locationId} disabled={busy || !!request.current} onChange={e => setLocationId(e.target.value)}><option value="">{t.choose}</option>{locations.filter(l => l.status === 'ACTIVE').map(l => <option key={l.locationId} value={l.locationId}>{l.name}</option>)}</select></div>
      <label className="merchant-field">{t.setup}<input value={setupCode} onChange={e => setSetupCode(e.target.value.replace(/\s/g, '').toLowerCase())} pattern="[a-f0-9]{32}" maxLength={32} autoComplete="off" required disabled={busy || !!request.current}/></label>
      {pending && <><p role="status">{remaining ? `${t.remaining} ${remaining} ${t.seconds}` : t.expired}</p>
        <label className="merchant-field">{t.code}<input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} required disabled={busy || !remaining}/></label></>}
      <button disabled={busy || (pending ? !remaining || !/^\d{6}$/.test(code) : !/^QR2B-[0-9]{6}$/.test(deviceId) || !locationId || !/^[a-f0-9]{32}$/.test(setupCode))}>{pending ? t.confirm : t.start}</button>
      {!!request.current && <button type="button" disabled={busy} onClick={() => submit(null, true)}>{t.check}</button>}
      {((pending && !remaining) || (!pending && startedAt && clock - startedAt >= 140000)) && <button type="button" disabled={busy} onClick={reset}>{t.restart}</button>}
      {message && <p role="alert">{message}</p>}
    </form>}
  </article>;
}
