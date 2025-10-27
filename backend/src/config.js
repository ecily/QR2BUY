// C:\QR\frontend\src\config.js
// Zentrale API-Basis für alle Calls
const fromEnv = import.meta.env.VITE_API_BASE;
export const API_BASE = fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:3001/api';
