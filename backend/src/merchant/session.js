import session from 'express-session';
import MongoStore from 'connect-mongo';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { MerchantAccount } from './accounts.js';
import { Merchant } from './models.js';

export const SESSION_MS = 12 * 60 * 60 * 1000;
export function createMerchantSession({ secret = process.env.MERCHANT_SESSION_SECRET, mongoUrl,
  production = process.env.NODE_ENV === 'production', origin = process.env.MERCHANT_PUBLIC_ORIGIN || process.env.PUBLIC_BASE_URL, store } = {}) {
  let validOrigin = false;
  try { const u = new URL(origin); validOrigin = u.origin === origin && !u.username && !u.password
    && (u.protocol === 'https:' || (!production && u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))); } catch { /* disabled */ }
  if (!secret || Buffer.byteLength(secret) < 32 || !validOrigin || (!store && !mongoUrl)) {
    return { middleware: (_req, res) => res.status(503).json({ ok: false, error: 'merchant_unavailable' }) };
  }
  const sessionStore = store || MongoStore.create({ mongoUrl, collectionName: 'merchant_sessions', ttl: SESSION_MS / 1000 });
  // Error details can contain connection credentials. Middleware returns only a generic error.
  sessionStore.on('error', () => {});
  const name = production ? '__Host-qr2buy-merchant' : 'qr2buy-merchant';
  const options = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
  const middleware = session({ name, secret, store: sessionStore, resave: false, saveUninitialized: false,
    rolling: false, cookie: { ...options, maxAge: SESSION_MS } });
  return { middleware, store: sessionStore, name, cookieOptions: options, origin };
}
export function csrf(req, res, next) {
  const token = req.get('x-csrf-token') || '';
  const expected = req.session?.csrf || '';
  if (req.get('origin') !== req.merchantOrigin || !req.is('application/json') || !/^[a-f0-9]{64}$/.test(token) || !expected
      || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected)))
    return res.status(403).json({ ok: false, error: 'request_rejected' });
  next();
}
export const csrfToken = req => (req.session.csrf ||= randomBytes(32).toString('hex'));
export const saveSession = req => new Promise((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
export async function authenticateMerchant(req, res, next) {
  try {
    if (!req.session?.accountId || !req.session.authExpiresAt || Date.now() >= req.session.authExpiresAt)
      return res.status(401).json({ ok: false, error: 'login_required' });
    const account = await MerchantAccount.findOne({ accountId: req.session.accountId, status: 'ACTIVE', role: 'OWNER' }).lean();
    const merchant = account && await Merchant.findOne({ merchantId: account.merchantId, status: 'ACTIVE' }).lean();
    if (!merchant) return res.status(401).json({ ok: false, error: 'login_required' });
    req.merchantAuth = { account, merchant, merchantId: account.merchantId };
    next();
  } catch { res.status(503).json({ ok: false, error: 'merchant_unavailable' }); }
}
