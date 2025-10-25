// C:\ecily\ecily_landing\backend\src\routes\stripeWebhook.js
import { Router } from 'express';
import Stripe from 'stripe';
import { Product, Device, Order, STATUS } from '../models.js';

const router = Router();

/**
 * WICHTIG:
 * In src/index.js MUSS VOR dem JSON-Parser stehen:
 *   app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
 * Danach erst: app.use(express.json())
 */

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

async function markSoldAndLog({ session, log }) {
  const meta = session?.metadata || {};
  const productId = meta.productId || null;
  const deviceIdFromMeta = meta.deviceId || null;

  if (!productId) {
    log?.warn?.('[stripe] session missing productId');
    return;
  }

  const product = await Product.findById(productId);
  if (!product) {
    log?.warn?.('[stripe] product not found', { productId });
    return;
  }

  // Produkt auf SOLD setzen
  if (product.status !== STATUS.SOLD) {
    product.status = STATUS.SOLD;
    await product.save();
  }

  // Gerät (falls verlinkt/mitgegeben) auf SOLD setzen
  let device = null;
  if (product.deviceId) {
    device = await Device.findById(product.deviceId);
  } else if (deviceIdFromMeta) {
    device = await Device.findOne({ deviceId: deviceIdFromMeta });
  }
  if (device && device.status !== STATUS.SOLD) {
    device.status = STATUS.SOLD;
    await device.save();
  }

  // Order-Log (idempotent via session.id)
  const amount =
    Number.isFinite(+session?.amount_total) ? Math.round(+session.amount_total / 100) : product.price;
  const currency = String(session?.currency || product.currency || 'EUR').toUpperCase();

  try {
    await Order.updateOne(
      { sessionId: session.id },
      {
        $setOnInsert: {
          sessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          productId: product._id,
          deviceId: device ? device._id : null,
          status: session.status || 'completed',
          amount,
          currency,
          raw: session
        }
      },
      { upsert: true }
    );
  } catch (e) {
    log?.error?.('[stripe] order log upsert failed: ' + e.message);
  }

  log?.info?.('[stripe] marked SOLD', {
    productId: String(product._id),
    deviceId: device ? device.deviceId : null,
    sessionId: session.id
  });
}

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
      event = stripe.webhooks.constructEvent(req.body, signature, secret);
    } catch (err) {
      log.warn('[stripe] signature verification failed: ' + err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // Dev-Fallback ohne Secret (nicht in Production!)
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
        await markSoldAndLog({ session, log });
        break;
      }
      case 'checkout.session.expired': {
        // Optional: hier könnte man wieder auf AVAILABLE setzen.
        // Wir lassen es bewusst manuell/über Admin.
        break;
      }
      default:
        // andere Events ignorieren
        break;
    }

    return res.json({ received: true });
  } catch (e) {
    log.error('[stripe] webhook handler error: ' + e.message);
    return res.status(500).json({ ok: false });
  }
});

export default router;
