// C:\QR\frontend\src\config.js
// Zentrale API-Basis (Vite liest VITE_API_BASE zur Build-Zeit)
const raw = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001/api';
export const API_BASE = String(raw).replace(/\/$/, '');

// Hilfsfunktionen/Endpunkte
export const api = (path = '') => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

export const ENDPOINTS = {
  health: () => api('/health'),
  config: (deviceId) => api(`/config?deviceId=${encodeURIComponent(deviceId)}`),
  productByShort: (shortId) => api(`/public/products/by-short/${encodeURIComponent(shortId)}`),
  checkoutByShort: (shortId) => api(`/checkout/by-short/${encodeURIComponent(shortId)}`),
  verify: (sessionId) => api(`/checkout/verify?session_id=${encodeURIComponent(sessionId)}`),
  events: () => api('/events'),
};
