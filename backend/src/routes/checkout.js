// C:\QR\backend\src\routes\checkout.js
import { Router } from 'express';
import Stripe from 'stripe';
import { Product, Device, Order, STATUS, ORDER_STATUS } from '../models.js';

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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function minutesFromNow(mins) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

/**
 * Produkt/Device als SOLD markieren (idempotent) und Reservierungsmarker aufräumen.
 */
async function markSold({ productId, deviceIdFromMeta }) {
  const product = await Product.findById(productId);
  if (!product) return { ok: false, reason: 'product not found' };

  if (product.status !== STATUS.SOLD) {
    product.status = STATUS.SOLD;
    product.reservedUntil = undefined;
    try {
      // optional: Meta zurücksetzen
      if (product.meta && product.meta.reservedBy) delete product.meta.reservedBy;
    } catch {}
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
 * Order aus Stripe-Session idempotent anlegen/aktualisieren (sessionId als Schlüssel).
 */
async function upsertOrderFromSession(session, { productId, deviceIdFromMeta }) {
  const amount = Number(session?.amount_total ?? 0); // Cent
  const currency = String(session?.currency || 'EUR').toUpperCase();
  const customerEmail = session?.customer_details?.email || '';
  const paymentIntentId =
    session?.payment_intent?.id ||
    (typeof session?.payment_intent === 'string' ? session.payment_intent : '');
  const paymentStatus =
    session?.payment_status ||
    session?.status ||
    (session?.payment_intent?.status ? `pi:${session.payment_intent.status}` : 'unknown');

  const update = {
    productId,
    deviceId: deviceIdFromMeta || undefined, // String-DeviceId in Order
    amount,
    currency,
    status: ORDER_STATUS.PAID,
    customerEmail,
    paymentIntentId,
    paymentStatus,
    paidAt: new Date(),
    reservedUntil: null,
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

/**
 * Einheitliche Start-Logik mit Idempotenz + Reservierung.
 * Idempotenzschlüssel: (productId, deviceId, quantity)
 * Reservierung: Order.status=RESERVED + reservedUntil (ENV RESERVE_MINUTES, Default 7, clamp 2..20)
 */
async function startCheckout(req, { product, deviceId, quantity = 1 }) {
  const stripe = getStripe();
  const baseUrl = getBaseUrl(req);
  const now = new Date();
  const reserveMinutes = clamp(Number(process.env.RESERVE_MINUTES || 7) || 7, 2, 20);
  const reservedUntil = minutesFromNow(reserveMinutes);

  // Verfügbarkeit prüfen
  if (product.status === STATUS.SOLD) {
    return { status: 409, body: { ok: false, error: 'product not available (sold)' } };
  }

  // Abgelaufene Produkt-Reservierung bereinigen
  if (product.status === STATUS.RESERVED && product.reservedUntil && product.reservedUntil <= now) {
    try {
      product.status = STATUS.AVAILABLE;
      product.reservedUntil = null;
      if (product.meta && product.meta.reservedBy) delete product.meta.reservedBy;
      await product.save();
    } catch {}
  }

  // Aktive Reservierung (Order) prüfen
  const activeReservation = await Order.findOne({
    productId: product._id,
    status: ORDER_STATUS.RESERVED,
    reservedUntil: { $gt: now }
  }).lean();

  if (activeReservation) {
    const sameDevice = String(activeReservation.deviceId || '') === String(deviceId || '');
    if (!sameDevice) {
      return {
        status: 409,
        body: { ok: false, error: 'product reserved', reservedUntil: activeReservation.reservedUntil }
      };
    }
    // Gleiche DeviceId → vorhandene Session wiederverwenden (falls noch gültig)
    try {
      const session = await stripe.checkout.sessions.retrieve(activeReservation.sessionId);
      return {
        status: 200,
        body: { ok: true, reused: true, sessionId: session.id, url: session.url }
      };
    } catch {
      // Stripe-Session existiert nicht mehr → neue Session erstellen
    }
  }

  // Stripe Checkout Session (mit Idempotenz)
  const idemKey = ['qr2buy', String(product._id), String(deviceId || ''), String(quantity || 1), 'v1'].join(':');
  const session = await stripe.checkout.sessions.create(
    {
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
    },
    { idempotencyKey: idemKey }
  );

  // Order als RESERVED upserten
  await Order.findOneAndUpdate(
    { sessionId: session.id },
    {
      $setOnInsert: {
        sessionId: session.id,
        createdAt: now
      },
      $set: {
        productId: product._id,
        deviceId: deviceId || undefined, // String!
        status: ORDER_STATUS.RESERVED,
        reservedUntil,
        currency: String(product.currency || 'EUR').toUpperCase(),
        amount: Math.round(product.price * 100) * (Number(quantity) || 1), // in Cent
        updatedAt: now,
        raw: { id: session.id, mode: 'payment' }
      }
    },
    { new: true, upsert: true }
  );

  // Produkt markiert als RESERVED (nur UI/Diag; maßgeblich ist Order)
  try {
    product.reservedUntil = reservedUntil;
    if (STATUS && STATUS.RESERVED) product.status = STATUS.RESERVED;
    // optional: reservierendes Device in Meta
    product.meta = { ...(product.meta || {}), reservedBy: deviceId || null };
    await product.save();
  } catch {}

  // Optional: sofortige SSE-Version-Benachrichtigung (sanft, falls nicht konfiguriert)
  try {
    const sseBroadcast = req.app?.get?.('sseBroadcast');
    if (typeof sseBroadcast === 'function') {
      sseBroadcast('version', { updatedAt: new Date().toISOString(), version: Date.now() });
    }
  } catch {}

  return { status: 201, body: { ok: true, sessionId: session.id, url: session.url } };
}

/* ───────── Routes ───────── */

/**
 * Neuer, einheitlicher Start-Endpunkt (bevorzugt):
 * POST /api/checkout/start
 * Body: { productId?: string, shortId?: string, deviceId?: string, quantity?: number }
 */
router.post('/start', async (req, res, next) => {
  try {
    const { productId, shortId, deviceId, quantity = 1 } = req.body || {};

    let product = null;
    if (productId) {
      product = await Product.findById(String(productId));
    } else if (shortId) {
      product = await Product.findOne({ shortId: String(shortId).toLowerCase() });
    }
    if (!product) return res.status(404).json({ ok: false, error: 'product not found' });

    // Optional: Device existiert?
    if (deviceId) await Device.findOne({ deviceId: String(deviceId).trim() }).lean();

    const result = await startCheckout(req, { product, deviceId, quantity });
    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err?.message?.includes('STRIPE_SECRET_KEY')) {
      return res.status(500).json({ ok: false, error: 'Stripe not configured on server' });
    }
    next(err);
  }
});

/**
 * Legacy-kompatibel:
 * POST /api/checkout/:productId
 * Body: { deviceId?: "ESP32-...", quantity?: number }
 */
router.post('/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { deviceId, quantity = 1 } = req.body || {};

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ ok: false, error: 'product not found' });

    if (deviceId) await Device.findOne({ deviceId: String(deviceId).trim() }).lean();

    const result = await startCheckout(req, { product, deviceId, quantity });
    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err?.message?.includes('STRIPE_SECRET_KEY')) {
      return res.status(500).json({ ok: false, error: 'Stripe not configured on server' });
    }
    next(err);
  }
});

/**
 * Legacy-kompatibel:
 * POST /api/checkout/by-short/:shortId
 * Body: { deviceId?: "ESP32-...", quantity?: number }
 */
router.post('/by-short/:shortId', async (req, res, next) => {
  try {
    const shortId = String(req.params.shortId || '').toLowerCase();
    const { deviceId, quantity = 1 } = req.body || {};

    const product = await Product.findOne({ shortId });
    if (!product) return res.status(404).json({ ok: false, error: 'product not found' });

    if (deviceId) await Device.findOne({ deviceId: String(deviceId).trim() }).lean();

    const result = await startCheckout(req, { product, deviceId, quantity });
    return res.status(result.status).json(result.body);
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

    // 1) Order idempotent updaten
    const order = await upsertOrderFromSession(session, { productId, deviceIdFromMeta });

    // 2) Produkt/Device SOLD (idempotent)
    const sold = await markSold({ productId, deviceIdFromMeta });
    if (!sold.ok) return res.status(404).json({ ok: false, error: sold.reason });

    // 3) Optional: sofortige SSE-Version-Benachrichtigung
    try {
      const sseBroadcast = req.app?.get?.('sseBroadcast');
      if (typeof sseBroadcast === 'function') {
        sseBroadcast('version', { updatedAt: new Date().toISOString(), version: Date.now() });
      }
    } catch {}

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
