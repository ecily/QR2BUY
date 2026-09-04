import Stripe from 'stripe';
import { STATUS } from '../models.js';

const LEGACY_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded'
]);

export class LegacyWebhookError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'LegacyWebhookError';
    this.code = code;
    this.status = status;
  }
}

export function createLegacyStripeClient(secretKey = process.env.STRIPE_SECRET_KEY) {
  if (!secretKey || !secretKey.startsWith('sk_test_')) {
    throw new LegacyWebhookError('legacy_checkout_not_configured', 503);
  }
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

export function constructLegacyWebhookEvent({ stripe, rawBody, signature, secret }) {
  if (!secret || !signature || !Buffer.isBuffer(rawBody)) {
    throw new LegacyWebhookError('invalid_webhook_signature', 400);
  }
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new LegacyWebhookError('invalid_webhook_signature', 400);
  }
}

function safeSessionRecord(session) {
  return {
    id: session.id,
    status: session.status || null,
    payment_status: session.payment_status || null,
    metadata: {
      system: session.metadata?.system || null,
      productId: session.metadata?.productId || null,
      productShortId: session.metadata?.productShortId || null,
      deviceId: session.metadata?.deviceId || null
    }
  };
}

export async function processLegacyWebhookEvent(event, { Product, Device, Order, log = console }) {
  if (!event?.id || event.livemode !== false) {
    throw new LegacyWebhookError('invalid_webhook_event', 400);
  }
  if (!LEGACY_EVENT_TYPES.has(event.type)) return { ok: true, ignored: true };

  const session = event.data?.object;
  if (session?.metadata?.system !== 'qr2buy') return { ok: true, ignored: true };
  if (!session.id || !session.metadata?.productId) return { ok: true, ignored: true };
  if (session.payment_status !== 'paid') {
    return { ok: true, ignored: true, waitingForPayment: true };
  }

  const product = await Product.findOneAndUpdate(
    { _id: session.metadata.productId },
    { $set: { status: STATUS.SOLD } },
    { new: true }
  );
  if (!product) return { ok: true, ignored: true };

  let device = null;
  if (product.deviceId) {
    device = await Device.findByIdAndUpdate(
      product.deviceId,
      { $set: { status: STATUS.SOLD } },
      { new: true }
    );
  } else if (session.metadata.deviceId) {
    device = await Device.findOneAndUpdate(
      { deviceId: session.metadata.deviceId },
      { $set: { status: STATUS.SOLD } },
      { new: true }
    );
  }

  const amount = Number.isFinite(Number(session.amount_total))
    ? Number(session.amount_total) / 100
    : product.price;
  const currency = String(session.currency || product.currency || 'EUR').toUpperCase();
  await Order.updateOne(
    { sessionId: session.id },
    {
      $setOnInsert: {
        sessionId: session.id,
        paymentIntentId: session.payment_intent || null,
        productId: product._id,
        deviceId: device?._id || null,
        status: session.status || 'complete',
        amount,
        currency,
        raw: safeSessionRecord(session)
      }
    },
    { upsert: true }
  );

  log.info?.({ productId: String(product._id), deviceId: device?.deviceId || null }, '[stripe] legacy checkout fulfilled');
  return { ok: true, paid: true };
}
