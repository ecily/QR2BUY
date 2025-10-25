// C:\QR\backend\src\routes\checkout.js
import { Router } from 'express';
import Stripe from 'stripe';
import { Product, Device, STATUS } from '../models.js';

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

  // Hinweis: Broadcast (SSE/WS) erfolgt im bestehenden Code-Pfad global;
  // andernfalls greift das 20s-Polling der Firmware.
  return { ok: true, productId: String(product._id), deviceId: device?.deviceId || null };
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
 * Fallback ohne Webhook/CLI: prüft Stripe-Session und markiert SOLD.
 */
router.get('/verify', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId) return res.status(400).json({ ok: false, error: 'session_id required' });

    let stripe;
    try {
      stripe = getStripe();
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Stripe not configured on server' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    });

    const paid =
      session?.payment_status === 'paid' ||
      session?.status === 'complete' ||
      session?.payment_intent?.status === 'succeeded';

    if (!paid) {
      return res.status(409).json({ ok: false, error: 'payment not completed', status: session?.payment_status || session?.status });
    }

    const meta = session?.metadata || {};
    const productId = meta.productId;
    const deviceIdFromMeta = meta.deviceId || '';

    if (!productId) {
      return res.status(400).json({ ok: false, error: 'missing productId in session metadata' });
    }

    const result = await markSold({ productId, deviceIdFromMeta });
    if (!result.ok) return res.status(404).json({ ok: false, error: result.reason });

    return res.json({ ok: true, mode: 'verify', productId: result.productId, deviceId: result.deviceId });
  } catch (err) {
    console.error('[verify] error', err);
    return res.status(500).json({ ok: false, error: 'verify failed' });
  }
});

export default router;
