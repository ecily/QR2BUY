import { useEffect, useRef, useState } from 'react';
import { adminClaimRequest } from '../api.js';

const messages = {
  authorization_cooldown: 'Erneute Freigabe erst zehn Minuten nach der letzten Erteilung möglich.',
  device_update_required: 'Schild benötigt Firmware 0.3.13 und einen aktuellen Onlinekontakt.',
  device_unavailable: 'Schild ist nicht mehr für die Erstzuordnung verfügbar. Liste aktualisieren.',
  claim_forbidden: 'Zielhändler oder Berechtigung ist nicht gültig.',
  authorization_conflict: 'Diese Anfrage gehört zu einer anderen Freigabe.',
  authorization_replay: 'Diese Freigabe wurde bereits verwendet. Status aktualisieren.',
  authorization_finished: 'Freigabe wurde bereits durch eine Zuordnung verbraucht.',
  authorization_not_found: 'Freigabe nicht gefunden. Status aktualisieren.',
  claim_expired: 'Freigabe abgelaufen. Eine neue Freigabe benötigt die reguläre Wartezeit.',
  claim_indexes_unavailable: 'Freigabe derzeit nicht verfügbar. Backendvoraussetzungen prüfen.'
};
export default function AdminClaimAuthorization({ initialOptions }) {
  const [options, setOptions] = useState({ devices: [], merchants: [] });
  const [deviceId, setDeviceId] = useState(''), [merchantId, setMerchantId] = useState('');
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(true);
  const [message, setMessage] = useState(''), [clock, setClock] = useState(Date.now);
  const [grant, setGrant] = useState(null), [uncertain, setUncertain] = useState(false);
  const operation = useRef(null), lock = useRef(true), offset = useRef(0);
  const device = options.devices.find(d => d.deviceId === deviceId);
  const merchant = options.merchants.find(m => m.merchantId === merchantId);
  const remaining = grant ? Math.min(120, Math.max(0, Math.floor((Date.parse(grant.expiresAt) - clock) / 1000))) : 0;
  const active = grant && ['AUTHORIZED', 'CLAIMED'].includes(grant.status) && remaining > 0;
  const cooldown = grant && Date.parse(grant.nextIssueAt) > clock;
  function report(error) {
    setMessage(error.status === 401 ? 'Adminzugang abgelehnt. Zugangsdaten erneut eingeben.'
      : error.status === 429 && error.message !== 'authorization_cooldown' ? 'Zu viele Anfragen. Nach einer Minute den Status aktualisieren.'
        : messages[error.message] || 'Freigabe derzeit nicht verfügbar. Status aktualisieren.');
  }
  async function refresh() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const started = Date.now(), data = await adminClaimRequest();
      // Conservative display clock: network latency never extends the displayed lifetime.
      offset.current = Date.parse(data.serverNow) - started;
      setClock(Date.now() + offset.current); setOptions(data); setConfirmed(false);
      const current = data.devices.find(d => d.deviceId === deviceId)?.authorization || null;
      setGrant(current);
      const op = operation.current;
      if (op && current?.authorizationId === (op.body.requestKey || op.body.authorizationId)
          && (op.path !== '/revoke' || current.status === 'REVOKED')) {
        operation.current = null; setUncertain(false);
      }
      setMessage(deviceId && !data.devices.some(d => d.deviceId === deviceId)
        ? 'Schild nicht mehr für die Erstzuordnung verfügbar. Händlerzuordnung im Portal prüfen.'
        : 'Status aktualisiert. Es wurde keine Freigabe erteilt.');
    } catch (error) { report(error); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => {
    let disposed = false;
    const started = Date.now();
    (initialOptions ? Promise.resolve(initialOptions) : adminClaimRequest()).then(data => {
      if (disposed) return;
      offset.current = Date.parse(data.serverNow) - started;
      setClock(Date.now() + offset.current); setOptions(data);
    }).catch(error => { if (!disposed) report(error); })
      .finally(() => { if (!disposed) { lock.current = false; setBusy(false); } });
    const timer = setInterval(() => setClock(Date.now() + offset.current), 1000);
    return () => { disposed = true; clearInterval(timer); };
  }, [initialOptions]);
  function selectDevice(value) {
    setDeviceId(value); setGrant(options.devices.find(d => d.deviceId === value)?.authorization || null);
    setConfirmed(false); setMessage('');
  }
  async function mutate(path = '') {
    if (lock.current) return;
    if (!operation.current) {
      if (path === '' && (!confirmed || !device?.canAuthorize || !merchant || active || cooldown)) return;
      if (path === '/revoke' && !active) return;
      operation.current = { path, body: path === '/revoke' ? { deviceId, authorizationId: grant.authorizationId }
        : { deviceId, merchantId, requestKey: crypto.randomUUID().replaceAll('-', '') } };
    }
    lock.current = true; setBusy(true); setMessage('');
    const op = operation.current;
    try {
      const result = await adminClaimRequest(op.path, op.body);
      const next = { ...grant, deviceId: op.body.deviceId, merchantId: op.body.merchantId || grant?.merchantId,
        ...result, nextIssueAt: op.path === '/revoke' ? grant?.nextIssueAt
          : new Date(Date.parse(result.expiresAt) + 480000).toISOString() };
      setGrant(next);
      setOptions(previous => ({ ...previous, devices: previous.devices.map(d => d.deviceId === next.deviceId ? { ...d, authorization: next } : d) }));
      setClock(Date.now() + offset.current); setConfirmed(false);
      operation.current = null; setUncertain(false);
      setMessage(next.status === 'CONSUMED' ? 'Freigabe bereits verbraucht. Händlerzuordnung im Portal prüfen.'
        : next.status === 'REVOKED' ? 'Freigabe widerrufen. Dieser Vorgang nimmt keine Händlerzuordnung vor.'
          : Date.parse(next.expiresAt) <= Date.now() + offset.current ? messages.claim_expired
            : 'Freigabestatus bestätigt. Den Besitznachweis im Händlerportal fortsetzen. Dieser Vorgang nimmt keine Zuordnung vor.');
    } catch (error) {
      if (error.status >= 400 && error.status < 500) { operation.current = null; setUncertain(false); report(error); }
      else { setUncertain(true); setMessage('Antwort unklar. Auswahl bleibt gesperrt. Dieselbe Anfrage erneut prüfen oder Status aktualisieren.'); }
    } finally { lock.current = false; setBusy(false); }
  }
  const frozen = busy || uncertain;
  const grantMerchant = options.merchants.find(m => m.merchantId === grant?.merchantId);
  return <section aria-labelledby="admin-claim-title" style={{ padding: 20, margin: '16px 0', border: '1px solid #d5ded8', borderRadius: 14, background: '#fff' }}>
    <h2 id="admin-claim-title">Schild für Händler freigeben</h2>
    <p>Nur Erstzuordnung: Händlerberechtigung unabhängig prüfen. Die Freigabe gilt höchstens 120 Sekunden für den gesamten Ablauf. Es wird kein Händler oder Produkt gebunden.</p>
    <button type="button" disabled={busy} onClick={refresh}>Freigabestatus aktualisieren</button>
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <label>Provisioniertes Schild<select style={{ display: 'block', width: '100%' }} value={deviceId} disabled={frozen} onChange={e => selectDevice(e.target.value)}>
        <option value="">Schild auswählen</option>{options.devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.deviceId} · {d.displayName}{d.canAuthorize ? '' : ' · nicht freigabebereit'}</option>)}
      </select></label>
      <label>Zielhändler<select style={{ display: 'block', width: '100%' }} value={merchantId} disabled={frozen} onChange={e => { setMerchantId(e.target.value); setConfirmed(false); }}>
        <option value="">Händler auswählen</option>{options.merchants.map(m => <option key={m.merchantId} value={m.merchantId}>{m.displayName}{m.legalName ? ' · ' + m.legalName : ''} · {m.merchantId}</option>)}
      </select></label>
      <p style={{ overflowWrap: 'anywhere' }}>Ausgewählt: <strong>{deviceId || 'kein Schild'}</strong> → <strong>{merchant?.displayName || 'kein Händler'}</strong> {merchant?.merchantId}</p>
      <label><input type="checkbox" checked={confirmed} disabled={frozen || !device?.canAuthorize || !merchant || active || !!cooldown} onChange={e => setConfirmed(e.target.checked)} /> Ich habe Schild und Zielhändler geprüft und bestätige diese Freigabe.</label>
      <button type="button" disabled={frozen || !confirmed || !device?.canAuthorize || !merchant || active || !!cooldown} onClick={() => mutate()}>Freigabe bewusst bestätigen</button>
      {device && !device.canAuthorize && <p>Aktueller Onlinekontakt, Firmware 0.3.13 und aktives Credential erforderlich. Liste nach Gerätestart aktualisieren.</p>}
      {grant && <div style={{ overflowWrap: 'anywhere' }}><p>Freigabe für {grantMerchant?.displayName || grant.merchantId} · {grant.merchantId}: {grant.status}</p>
        <p role="status">{active ? `Verbleibende Gültigkeit: ${remaining} Sekunden` : grant.status === 'REVOKED' ? 'Freigabe widerrufen.' : grant.status === 'CONSUMED' ? 'Freigabe verbraucht.' : 'Freigabe abgelaufen.'}</p>
        {cooldown && <p>Neue Freigabe frühestens {new Date(grant.nextIssueAt).toLocaleTimeString('de-DE')}.</p>}
        <button type="button" disabled={frozen || !active} onClick={() => mutate('/revoke')}>Freigabe widerrufen</button></div>}
      {uncertain && <button type="button" disabled={busy} onClick={() => mutate()}>Dieselbe Anfrage erneut prüfen</button>}
      {message && <p role="alert">{message}</p>}
    </div>
  </section>;
}
