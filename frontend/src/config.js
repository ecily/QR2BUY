// C:\QR\frontend\src\config.js
// Zentrale API-Basis (Vite liest VITE_API_BASE zur Build-Zeit)
export const API_BASE =
  (import.meta.env.VITE_API_BASE?.replace(/\/$/, '')) || 'http://localhost:3001/api';
