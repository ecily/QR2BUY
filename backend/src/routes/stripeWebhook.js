// C:\QR\backend\src\routes\stripeWebhook.js
import { Router } from 'express';
import Stripe from 'stripe';
import { Product, Device, Order, STATUS, ORDER_STATUS } from '../models.js';

const router = Router();

/**
 * WICHTIG:
 * In eurer Server-Bootstrap-Datei (z. B. src/index.js) MUSS VOR dem JSON-Parser stehen:
 *
 *   app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
 *
 * Danach erst:
 *   app.use(express.json());
 *
 * Sonst schlägt die Signaturprüfung fehl.
 */

/* ───────── Helpers ───────── */

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

function tryBroadcast(req, event, data) {
  // Optionaler Broadcaster:
  const app = req?.app;
  const candidates = [
    app?.locals?.broadcast,      // (event, data)
    app?.locals?.sseBroadcast,   // (event, data)
    app?.get?.('sseBroadcast'),  // (event, data)
  ].filter(Boolean);
  const fn = candidates.find((x) => typeof x === 'function');
  if (fn) {
    try {
      fn(event, data);
    } catch (e) {
      (req?.log || console).warn?.('[sse] broadcast failed: ' + e.message);
    }
  }
}

const now = () => new Date();

/* ───────── Core Ops ───────── */

/**
 * Idempotent: markiert Produkt/Device als SOLD und aktualisiert Order auf PAID.
 * - Nutzt session.metadata (productId, deviceId)
 * - Räumt Reservierungsmarker (reservedUntil, meta.reservedBy) am Produkt auf
 */
async function finalizePaidFromSession(req, session) {
  const log = req.log || console;
  const meta = session?.metadata || {};
  const productId = meta.productId || null;
  const deviceIdMeta = meta.deviceId || '';

  if (!productId) {
    log.warn?.('[stripe] session missing productId');
    return { ok: false, status: 400, reason: 'missing productId' };
  }

  const product = await Product.findById(productId);
  if (!product) {
    log.warn?.('[stripe] product not found', { productId });
    return { ok: false, status: 404, reason: 'product not found' };
  }

  // Produkt SOLD (idempotent) + Reservierung aufräumen
  if (product.status !== STATUS.SOLD) {
    product.status = STATUS.SOLD;
  }
  if ('reservedUntil' in product) product.reservedUntil = undefined;
  try {
    if (product.meta && product.meta.reservedBy) delete product.meta.reservedBy;
  } catch {}
  await product.save();

  // Gerät SOLD (falls vorhanden)
  let device = null;
  if (product.deviceId) {
    device = await Device.findById(product.deviceId);
  } else if (deviceIdMeta) {
    device = await Device.findOne({ deviceId: String(deviceIdMeta) });
  }
  if (device && device.status !== STATUS.SOLD) {
    device.status = STATUS.SOLD;
    await device.save();
  }

  // Order idempotent upserten/aktualisieren
  const amountTotal = Number(session?.amount_total ?? 0); // Cent
  const currency = String(session?.currency || product.currency || 'EUR').toUpperCase();
  const customerEmail = session?.customer_details?.email || '';
  const paymentIntentId =
    session?.payment_intent?.id ||
    (typeof session?.payment_intent === 'string' ? session.payment_intent : '');

  const update = {
    productId: product._id,
    deviceId: deviceIdMeta || undefined, // String deviceId (wie im Checkout-Start)
    status: ORDER_STATUS.PAID,
    amount: amountTotal, // Cent
    currency,
    customerEmail,
    paymentIntentId,
    paymentStatus:
      session?.payment_status ||
      session?.status ||
      (session?.payment_intent?.status ? `pi:${session.payment_intent.status}` : 'unknown'),
    raw: {
      id: session.id,
      mode: session.mode,
      payment_status: session.payment_status,
      status: session.status,
    },
    paidAt: now(),
    reservedUntil: null,
    updatedAt: now(),
  };

  await Order.findOneAndUpdate(
    { sessionId: session.id },
    {
      $set: update,
      $setOnInsert: { sessionId: session.id, createdAt: now() },
    },
    { new: true, upsert: true }
  );

  // Broadcasts
  const ts = new Date().toISOString();
  tryBroadcast(req, 'product:update', {
    productId: String(product._id),
    shortId: product.shortId,
    status: product.status,
    updatedAt: ts,
  });
  if (device) {
    tryBroadcast(req, 'device:update', {
      deviceId: device.deviceId || String(device._id),
      status: device.status,
      updatedAt: ts,
    });
  }
  // "version" an alle (MockDisplay/App) für UI-Refresh
  tryBroadcast(req, 'version', { updatedAt: ts, version: Date.now() });

  log.info?.('[stripe] finalized PAID', {
    sessionId: session.id,
    productId: String(product._id),
    deviceId: device?.deviceId || deviceIdMeta || null,
  });

  return { ok: true };
}

/**
 * Rollback einer Reservierung, wenn die Session bei Stripe EXPIRED ist.
 * Setzt Produkt zurück auf AVAILABLE (falls nicht bereits SOLD) und markiert Order als EXPIRED.
 */
async function expireReservationFromSession(req, session) {
  const log = req.log || console;
  const meta = session?.metadata || {};
  const productId = meta.productId || null;

  if (!productId) return;

  const product = await Product.findById(productId);
  if (!product) return;

  // Nur zurücksetzen, wenn nicht bereits verkauft
  if (product.status !== STATUS.SOLD) {
    product.status = STATUS.AVAILABLE;
    if ('reservedUntil' in product) product.reservedUntil = undefined;
    try {
      if (product.meta && product.meta.reservedBy) delete product.meta.reservedBy;
    } catch {}
    await product.save();

    const ts = new Date().toISOString();
    tryBroadcast(req, 'product:update', {
      productId: String(product._id),
      shortId: product.shortId,
      status: product.status,
      updatedAt: ts,
    });
    tryBroadcast(req, 'version', { updatedAt: ts, version: Date.now() });
  }

  // Order auf EXPIRED setzen (idempotent)
  await Order.findOneAndUpdate(
    { sessionId: session.id },
    {
      $set: {
        status: ORDER_STATUS.EXPIRED,
        paymentStatus: 'expired',
        updatedAt: now(),
      },
      $setOnInsert: { sessionId: session.id, createdAt: now() },
    },
    { upsert: true }
  );

  log.info?.('[stripe] reservation expired', {
    sessionId: session.id,
    productId: String(product._id),
  });
}

/* ───────── Route ───────── */

router.post('/webhook', async (req, res) => {
  const log = req.log || console;

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    log.error('[stripe] not configured: ' + e.message);
    return res.status(500).json({ ok: false, error: 'Stripe not configured' });
  }

  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  // Verifiziere Signatur in Prod (und Dev, wenn Secret gesetzt)
  if (secret) {
    try {
      // req.body ist Buffer dank express.raw()
      event = stripe.webhooks.constructEvent(req.body, signature, secret);
    } catch (err) {
      log.warn('[stripe] signature verification failed: ' + err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // Dev-Fallback ohne Secret (niemals in Production!)
    if (process.env.NODE_ENV === 'production') {
      log.error('[stripe] STRIPE_WEBHOOK_SECRET missing in production');
      return res.status(500).json({ ok: false, error: 'Webhook secret missing' });
    }
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch (e) {
      return res.status(400).send('Invalid JSON body');
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        await finalizePaidFromSession(req, session);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        await expireReservationFromSession(req, session);
        break;
      }
      default:
        // ignorieren
        break;
    }

    // Stripe erwartet 2xx möglichst schnell; keine lange Arbeit hier.
    return res.json({ received: true });
  } catch (e) {
    log.error('[stripe] webhook handler error: ' + e.message);
    return res.status(500).json({ ok: false });
  }
});

export default router;
