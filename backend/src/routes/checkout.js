// C:\QR\backend\src\routes\checkout.js
import { Router } from 'express';
import Stripe from 'stripe';
import { Product, Device, Order, STATUS } from '../models.js';

const router = Router();

/* ───────── Helpers ───────── */
function getBaseUrl(req) {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.BASE_URL_LOCAL ||
    `${req.protocol}://${req.get('host')}`
  );
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

/**
 * Markiert Produkt/Device als SOLD (idempotent).
 * Bevorzugt die Device-Zuordnung aus Session-Metadata; fällt sonst auf Produkt.deviceId zurück (falls vorhanden).
 */
async function markSold({ productId, deviceIdFromMeta }) {
  const product = await Product.findById(productId);
  if (!product) return { ok: false, reason: 'product not found' };

  if (product.status !== STATUS.SOLD) {
    product.status = STATUS.SOLD;
    await product.save();
  }

  // Device bevorzugt über Meta-DeviceId, sonst verlinktes Device am Produkt
  let device = null;
  if (deviceIdFromMeta) {
    device = await Device.findOne({ deviceId: String(deviceIdFromMeta) });
  }
  if (!device && product.deviceId) {
    device = await Device.findById(product.deviceId);
  }
  if (device && device.status !== STATUS.SOLD) {
    device.status = STATUS.SOLD;
    await device.save();
  }

  return { ok: true, product, device };
}

/**
 * Legt eine Order zur Stripe-Session an bzw. aktualisiert sie (idempotent via sessionId).
 */
async function upsertOrderFromSession(session, { productId, deviceIdFromMeta }) {
  const amount = Number(session?.amount_total ?? 0); // Stripe gibt Cent zurück
  const currency = String(session?.currency || 'EUR').toUpperCase();
  const customerEmail = session?.customer_details?.email || '';
  const paymentIntentId = session?.payment_intent?.id || (typeof session?.payment_intent === 'string' ? session.payment_intent : '');
  const paymentStatus =
    session?.payment_status ||
    session?.status ||
    (session?.payment_intent?.status ? `pi:${session.payment_intent.status}` : 'unknown');

  const update = {
    productId,
    deviceId: deviceIdFromMeta || undefined,
    amount,
    currency,
    status: 'PAID',
    customerEmail,
    paymentIntentId,
    paymentStatus,
    raw: {
      id: session.id,
      mode: session.mode,
      payment_status: session.payment_status,
      status: session.status
    },
    updatedAt: new Date()
  };

  const order = await Order.findOneAndUpdate(
    { sessionId: session.id },
    {
      $set: update,
      $setOnInsert: {
        sessionId: session.id,
        createdAt: new Date()
      }
    },
    { new: true, upsert: true }
  );

  return order;
}

async function createSessionForProduct(req, product, { deviceId, quantity = 1 }) {
  const stripe = getStripe();
  const baseUrl = getBaseUrl(req);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cancel`,
    line_items: [
      {
        quantity: Number.isFinite(+quantity) && +quantity > 0 ? +quantity : 1,
        price_data: {
          currency: (product.currency || 'EUR').toLowerCase(),
          unit_amount: Math.round(product.price * 100),
          product_data: { name: product.name }
        }
      }
    ],
    metadata: {
      productId: String(product._id),
      productShortId: product.shortId,
      deviceId: deviceId ? String(deviceId) : '',
      system: 'qr2buy'
    }
  });

  return { sessionId: session.id, url: session.url };
}

/* ───────── Routes ───────── */

/**
 * POST /api/checkout/:productId
 * Body: { deviceId?: "ESP32-...", quantity?: number }
 */
router.post('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { deviceId, quantity = 1 } = req.body || {};

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ ok: false, error: 'product not found' });
    if (product.status !== STATUS.AVAILABLE) {
      return res.status(409).json({ ok: false, error: 'product not available' });
    }

    if (deviceId) {
      await Device.findOne({ deviceId: String(deviceId).trim() }).lean();
    }

    const { sessionId, url } = await createSessionForProduct(req, product, { deviceId, quantity });
    return res.status(201).json({ ok: true, sessionId, url });
  } catch (err) {
    if (err?.message?.includes('STRIPE_SECRET_KEY')) {
      return res.status(500).json({ ok: false, error: 'Stripe not configured on server' });
    }
    next(err);
  }
});

/**
 * POST /api/checkout/by-short/:shortId
 * Body: { deviceId?: "ESP32-...", quantity?: number }
 */
router.post('/by-short/:shortId', async (req, res, next) => {
  try {
    const shortId = String(req.params.shortId || '').toLowerCase();
    const { deviceId, quantity = 1 } = req.body || {};

    const product = await Product.findOne({ shortId });
    if (!product) return res.status(404).json({ ok: false, error: 'product not found' });
    if (product.status !== STATUS.AVAILABLE) {
      return res.status(409).json({ ok: false, error: 'product not available' });
    }

    if (deviceId) {
      await Device.findOne({ deviceId: String(deviceId).trim() }).lean();
    }

    const { sessionId, url } = await createSessionForProduct(req, product, { deviceId, quantity });
    return res.status(201).json({ ok: true, sessionId, url });
  } catch (err) {
    if (err?.message?.includes('STRIPE_SECRET_KEY')) {
      return res.status(500).json({ ok: false, error: 'Stripe not configured on server' });
    }
    next(err);
  }
});

/**
 * GET /api/checkout/verify?session_id=cs_test_...
 * Fallback ohne Webhook/CLI: prüft Stripe-Session, legt/aktualisiert Order (idempotent) und markiert SOLD.
 * Response: { ok:true, order, product, device }
 */
router.get('/verify', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId) return res.status(400).json({ ok: false, error: 'session_id required' });

    let stripe;
    try {
      stripe = getStripe();
    } catch {
      return res.status(500).json({ ok: false, error: 'Stripe not configured on server' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'line_items']
    });

    const paid =
      session?.payment_status === 'paid' ||
      session?.status === 'complete' ||
      session?.payment_intent?.status === 'succeeded';

    if (!paid) {
      return res
        .status(409)
        .json({ ok: false, error: 'payment not completed', status: session?.payment_status || session?.status });
    }

    const meta = session?.metadata || {};
    const productId = meta.productId;
    const deviceIdFromMeta = meta.deviceId || '';

    if (!productId) {
      return res.status(400).json({ ok: false, error: 'missing productId in session metadata' });
    }

    // 1) Order idempotent anlegen/aktualisieren
    const order = await upsertOrderFromSession(session, { productId, deviceIdFromMeta });

    // 2) Produkt/Device SOLD (idempotent)
    const sold = await markSold({ productId, deviceIdFromMeta });
    if (!sold.ok) return res.status(404).json({ ok: false, error: sold.reason });

    return res.json({
      ok: true,
      mode: 'verify',
      order,
      product: sold.product,
      device: sold.device || null
    });
  } catch (err) {
    console.error('[verify] error', err);
    return res.status(500).json({ ok: false, error: 'verify failed' });
  }
});

export default router;
