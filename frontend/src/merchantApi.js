export async function merchantRequest(path, body, method = body ? 'POST' : 'GET', csrfToken, signal) {
  if (!/^\/api\/merchant(?:-auth)?\//.test(path)) throw new Error('invalid_request');
  const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal,
    headers: body ? { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken || '' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'merchant_unavailable'); error.status = response.status; throw error; }
  return result;
}
export function safeReturn(value) {
  return typeof value === 'string' && /^\/(?:merchant(?:\/[^?#]*)?|binding\/QR2B-\d{6})$/.test(value) && !value.startsWith('//')
    && !['/merchant/login','/merchant/register'].includes(value) ? value : '/merchant';
}
export function minorFromInput(value, currency) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  const raw = String(value).trim().replace(',', '.');
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${Math.max(1,digits)}})?$`).test(raw) || (digits === 0 && raw.includes('.'))) throw new Error('invalid_input');
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(amount) || amount > 999999999) throw new Error('invalid_input'); return amount;
}
export function priceInput(minor, currency) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return (minor / 10 ** digits).toFixed(digits);
}
export function merchantSummary(products, offers, devices) {
  return { products: products.length, devices: devices.length, online: devices.filter(d => d.online).length,
    unassigned: devices.filter(d => !d.product).length, activeOffers: offers.filter(o => o.active).length };
}
