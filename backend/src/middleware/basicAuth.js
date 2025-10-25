// C:\ecily\ecily_landing\backend\src\middleware\basicAuth.js
import crypto from 'crypto';

let warned = false;

function timingSafeEqualStr(a = '', b = '') {
  const aBuf = Buffer.from(String(a), 'utf8');
  const bBuf = Buffer.from(String(b), 'utf8');

  // Ensure equal length buffers to avoid length-leak timing differences
  const len = Math.max(aBuf.length, bBuf.length, 1);
  const aPadded = Buffer.concat([aBuf, Buffer.alloc(len - aBuf.length, 0)]);
  const bPadded = Buffer.concat([bBuf, Buffer.alloc(len - bBuf.length, 0)]);
  try {
    return crypto.timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
  } catch {
    // Fallback (shouldn't happen): constant-time-ish compare
    let diff = aPadded.length ^ bPadded.length;
    for (let i = 0; i < len; i++) diff |= aPadded[i] ^ bPadded[i];
    return diff === 0 && aBuf.length === bBuf.length;
  }
}

/**
 * Basic-Auth Middleware (ESM)
 * Uses ADMIN_USER / ADMIN_PASS from env.
 * In development (NODE_ENV !== 'production') falls back to admin/admin with a warning.
 */
export function basicAuth() {
  let user = process.env.ADMIN_USER || '';
  let pass = process.env.ADMIN_PASS || '';

  if ((!user || !pass) && process.env.NODE_ENV !== 'production') {
    user = 'admin';
    pass = 'admin';
    if (!warned) {
      console.warn('[auth] ADMIN_USER/ADMIN_PASS not set – using dev fallback admin/admin');
      warned = true;
    }
  }

  return function (req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');

    if (scheme !== 'Basic' || !encoded) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
      return res.status(401).json({ ok: false, error: 'auth required' });
    }

    let decoded = '';
    try {
      decoded = Buffer.from(encoded, 'base64').toString('utf8');
    } catch {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
      return res.status(401).json({ ok: false, error: 'invalid auth header' });
    }

    const idx = decoded.indexOf(':');
    const givenUser = decoded.slice(0, idx);
    const givenPass = decoded.slice(idx + 1);

    const ok = timingSafeEqualStr(givenUser, user) && timingSafeEqualStr(givenPass, pass);
    if (!ok) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin", charset="UTF-8"');
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    return next();
  };
}
