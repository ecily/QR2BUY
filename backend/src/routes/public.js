// C:\QR\backend\src\routes\public.js
import { Router } from 'express';
import { Product, STATUS } from '../models.js';

const router = Router();

/* ───────── Helpers ───────── */
function sanitizeProduct(p) {
  if (!p) return null;
  return {
    id: String(p._id),
    shortId: p.shortId,
    name: p.name,
    price: p.price,
    currency: p.currency,
    status: p.status,                 // AVAILABLE | RESERVED | SOLD
    imageUrl: p.imageUrl || null,
    reservedUntil: p.reservedUntil || null,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null
  };
}

function makeETagForProduct(p) {
  const ts = p?.updatedAt instanceof Date ? p.updatedAt.getTime() : 0;
  const rs = p?.reservedUntil instanceof Date ? p.reservedUntil.getTime() : 0;
  const status = p?.status || '';
  // Weak ETag: ausreichend für Änderungs-Erkennung
  return `W/"prod-${String(p?._id)}-${ts}-${rs}-${status}"`;
}

function sendConditionalJSON(req, res, body, lastModified, etag) {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');

  // If-None-Match (ETag) hat Vorrang vor If-Modified-Since
  if (etag) {
    res.setHeader('ETag', etag);
    const inm = req.headers['if-none-match'];
    if (inm && inm === etag) {
      return res.status(304).end();
    }
  }

  if (lastModified instanceof Date && !isNaN(lastModified)) {
    res.setHeader('Last-Modified', lastModified.toUTCString());
    const ims = req.headers['if-modified-since'];
    if (ims) {
      const since = new Date(ims);
      if (!isNaN(since) && lastModified <= since) {
        return res.status(304).end();
      }
    }
  }

  return res.json(body);
}

/**
 * GET /api/public/products/by-short/:shortId
 * Öffentliche Produktabfrage für Käufer-Flow (/p/:shortId).
 */
router.get('/products/by-short/:shortId', async (req, res, next) => {
  try {
    const shortId = String(req.params.shortId || '').toLowerCase().trim();
    if (!shortId) return res.status(400).json({ ok: false, error: 'shortId required' });

    const p = await Product.findOne({ shortId });
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });

    const body = { ok: true, product: sanitizeProduct(p) };
    const etag = makeETagForProduct(p);
    const lastMod = p.updatedAt instanceof Date ? p.updatedAt : null;

    return sendConditionalJSON(req, res, body, lastMod, etag);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/public/products/:id
 * Öffentliche Abfrage per _id (optional).
 */
router.get('/products/:id', async (req, res, next) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });

    const body = { ok: true, product: sanitizeProduct(p) };
    const etag = makeETagForProduct(p);
    const lastMod = p.updatedAt instanceof Date ? p.updatedAt : null;

    return sendConditionalJSON(req, res, body, lastMod, etag);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/public/status/by-short/:shortId
 * Minimaler Status-Check (leichtgewichtig).
 */
router.get('/status/by-short/:shortId', async (req, res, next) => {
  try {
    const shortId = String(req.params.shortId || '').toLowerCase().trim();
    const p = await Product.findOne(
      { shortId },
      { status: 1, updatedAt: 1, shortId: 1, reservedUntil: 1 }
    );
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });

    const body = {
      ok: true,
      shortId: p.shortId,
      status: p.status,                      // AVAILABLE | RESERVED | SOLD
      sold: p.status === STATUS.SOLD,
      reservedUntil: p.reservedUntil || null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null
    };
    const etag = makeETagForProduct(p);
    const lastMod = p.updatedAt instanceof Date ? p.updatedAt : null;

    return sendConditionalJSON(req, res, body, lastMod, etag);
  } catch (err) {
    next(err);
  }
});

export default router;
