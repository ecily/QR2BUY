// C:\ecily\ecily_landing\frontend\src\api.js
import ky from 'ky';

let adminAuthHeader = null;

/** Optional: set Basic-Auth for /api/admin routes. */
export function setAdminAuth(user, pass) {
  adminAuthHeader = 'Basic ' + btoa(`${String(user)}:${String(pass)}`);
}

/** Base API client */
const api = ky.create({
  prefixUrl: '/api',
  timeout: 10000,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
});

/** Unified HTTP helper with optional query + admin auth */
async function http(method, path, { json, searchParams, headers } = {}) {
  try {
    const res = await api(path, {
      method,
      json,
      searchParams,
      headers: {
        ...(adminAuthHeader ? { Authorization: adminAuthHeader } : {}),
        ...headers
      }
    }).json();
    return res;
  } catch (err) {
    if (err?.response) {
      // Try to extract server error message
      try {
        const data = await err.response.json();
        throw new Error(`${err.response.status} ${data?.error || data?.message || err.message}`);
      } catch {
        throw new Error(`${err.response.status} ${err.message}`);
      }
    }
    throw err;
  }
}

/* ───────── Health ───────── */
export const getHealth = () => http('GET', 'health');

/* ───────── Public / Buyer Flow ───────── */
export function getPublicProductByShort(shortId) {
  return http('GET', `public/products/by-short/${encodeURIComponent(String(shortId).toLowerCase())}`);
}

export function getPublicStatusByShort(shortId) {
  return http('GET', `public/status/by-short/${encodeURIComponent(String(shortId).toLowerCase())}`);
}

export function createCheckoutByShort(shortId, { deviceId, quantity = 1 } = {}) {
  return http('POST', `checkout/by-short/${encodeURIComponent(String(shortId).toLowerCase())}`, {
    json: { deviceId, quantity }
  });
}

/** Convenience: Create session and redirect to Stripe Checkout */
export async function startCheckoutRedirectByShort(shortId, { deviceId, quantity = 1 } = {}) {
  const { ok, url } = await createCheckoutByShort(shortId, { deviceId, quantity });
  if (ok && url) {
    window.location.href = url;
    return true;
  }
  throw new Error('Failed to create checkout session');
}

/* ───────── Admin (Basic-Auth required; use setAdminAuth) ───────── */
export const adminListProducts = () => http('GET', 'admin/products');

export function adminCreateProduct({ name, price, currency = 'EUR', shortId } = {}) {
  return http('POST', 'admin/products', { json: { name, price, currency, shortId } });
}

export const adminListDevices = () => http('GET', 'admin/devices');

export function adminCreateDevice({ deviceId, name, deviceSecret } = {}) {
  return http('POST', 'admin/devices', { json: { deviceId, name, deviceSecret } });
}

export function adminLink({ deviceId, productId, productShortId } = {}) {
  return http('POST', 'admin/link', { json: { deviceId, productId, productShortId } });
}

export function adminUnlink({ deviceId, productId, productShortId } = {}) {
  return http('POST', 'admin/unlink', { json: { deviceId, productId, productShortId } });
}

export function adminOverrideStatus({ deviceId, productId, status } = {}) {
  return http('POST', 'admin/override/status', { json: { deviceId, productId, status } });
}
