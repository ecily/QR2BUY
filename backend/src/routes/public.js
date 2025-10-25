// C:\ecily\ecily_landing\backend\src\routes\public.js
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
    status: p.status, // AVAILABLE | SOLD
    imageUrl: p.imageUrl || null,
    updatedAt: p.updatedAt
  };
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

    return res.json({ ok: true, product: sanitizeProduct(p) });
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
    return res.json({ ok: true, product: sanitizeProduct(p) });
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
    const p = await Product.findOne({ shortId }, { status: 1, updatedAt: 1, shortId: 1 });
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });

    return res.json({
      ok: true,
      shortId: p.shortId,
      status: p.status,
      sold: p.status === STATUS.SOLD,
      updatedAt: p.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

export default router;
