// C:\QR\frontend\src\lib\api.js
import { API_BASE } from '../config';

async function request(path, { method = 'GET', headers, body } = {}) {
  const base = API_BASE.replace(/\/$/, '');
  const join = path.startsWith('/') ? '' : '/';
  const url = `${base}${join}${path}`;

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit'
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  productByShort: (shortId) =>
    request(`/public/products/by-short/${encodeURIComponent(shortId)}`),
  checkoutByShort: (shortId) =>
    request(`/checkout/by-short/${encodeURIComponent(shortId)}`, { method: 'POST' }),
  verify: (session_id) =>
    request(`/checkout/verify?session_id=${encodeURIComponent(session_id)}`)
};
