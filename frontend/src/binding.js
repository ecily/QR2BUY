export const bindingText = {
  de: { title: 'Schild verbinden', intro: 'Für Händler · direkt am Produkt', loading: 'Schild wird geladen …', unavailable: 'Dieses Schild ist derzeit nicht verfügbar.', missing: 'Schild nicht gefunden', login: 'Operator anmelden', user: 'Benutzername', password: 'Passwort', choose: 'Produkt verbinden', product: 'Produkt', method: 'Produkt erkennen', ean: 'EAN / Barcode', productCode: 'qr2buy-Produktcode', scan: 'Code scannen', scanHelp: 'Code scannen oder eingeben. Bei Produktcodes kannst du das Produkt auch auswählen.', preview: 'Vorschau auf Schild zeigen', question: 'Ist das das Produkt vor dir?', instruction: 'Prüfe das Produkt und den Preis auf dem echten Schild. Gib dann den sechsstelligen Code vom Schild ein.', code: 'Code auf dem Schild', yes: 'Ja, Schild aktivieren', cancel: 'Abbrechen', expired: 'Die Vorschau ist abgelaufen. Bitte neu starten.', active: 'Schild aktiviert', success: 'Das Schild zeigt jetzt das Produkt und den Käufer-QR. Online-Kauf ist noch nicht freigeschaltet.', cancelled: 'Vorschau beendet. Die bisherige Zuordnung bleibt erhalten.', error: 'Das hat nicht geklappt. Bitte Anmeldung, Produktcode und Schild prüfen.', wrong: 'Der Code stimmt nicht. Bitte direkt vom Schild ablesen.', update: 'Das Schild ist offline oder benötigt zuerst das Firmware-Update.', changed: 'Die Vorschau ist nicht mehr gültig. Bitte neu starten.', logout: 'Abmelden', scannerUnavailable: 'Kamera-Scan ist hier nicht verfügbar. Bitte den Code eingeben.', empty: 'Keine verbindbaren Produkte verfügbar. Bitte den Operator kontaktieren.' },
  en: { title: 'Connect a display', intro: 'For merchants · beside the product', loading: 'Loading display …', unavailable: 'This display is currently unavailable.', missing: 'Display not found', login: 'Operator sign in', user: 'Username', password: 'Password', choose: 'Connect product', product: 'Product', method: 'Identify product', ean: 'EAN / barcode', productCode: 'qr2buy product code', scan: 'Scan code', scanHelp: 'Scan or enter the code. For product codes you can also select the product.', preview: 'Show preview on display', question: 'Is this the product in front of you?', instruction: 'Check the product and price on the physical display. Then enter the six-digit code shown on it.', code: 'Code on the display', yes: 'Yes, activate display', cancel: 'Cancel', expired: 'The preview expired. Please start again.', active: 'Display activated', success: 'The display now shows the product and buyer QR. Online checkout is not yet available.', cancelled: 'Preview ended. The previous assignment is unchanged.', error: 'That did not work. Please check sign-in, product code and display.', wrong: 'The code does not match. Please read it from the display.', update: 'The display is offline or needs a firmware update first.', changed: 'This preview is no longer valid. Please start again.', logout: 'Sign out', scannerUnavailable: 'Camera scanning is unavailable here. Please enter the code.', empty: 'No products available to connect. Please contact the operator.' }
};
export function previewExpired(preview, now = Date.now()) {
  const expiry = preview && new Date(preview.expiresAt).getTime();
  return !preview || !Number.isFinite(expiry) || expiry <= now;
}
export function bindingError(error, text) {
  if (error === 'incorrect_display_code') return text.wrong;
  if (error === 'device_update_required') return text.update;
  if (['preview_expired', 'preview_changed', 'preview_finished', 'preview_not_found'].includes(error)) return text.changed;
  return text.error;
}
export function codeFromScan(raw, method) {
  const value = String(raw).trim();
  return (method === 'EAN' ? /^(?:\d{8}|\d{12,14})$/ : /^[a-f0-9]{32}$/).test(value) ? value : null;
}
export async function bindingRequest(deviceId, action, authorization, body, signal) {
  const path = `/api/binding/operator/devices/${encodeURIComponent(deviceId)}${action ? '/' + action : ''}`;
  const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', signal,
    headers: { Authorization: authorization, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'binding_unavailable');
  return result;
}
