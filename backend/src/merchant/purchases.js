import mongoose from 'mongoose';
import Stripe from 'stripe';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { Merchant, Location, MerchantProduct, Offer } from './models.js';
import { MerchantOrder } from './orderModel.js';
import { reservedQuantity } from './inventory.js';
import { DeviceApiError } from './deviceCredentials.js';
import { validDemoEmail } from '../demo/mail.js';

const fail = (status, code) => { throw new DeviceApiError(status, code); };
const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
export const purchaseInput = z.object({ requestKey: z.string().uuid(), quantity: z.literal(1), language: z.enum(['de', 'en']), testMode: z.literal(true) }).strict();
export function checkoutConfigured() {
  try {
    const origin = new URL(process.env.PUBLIC_BASE_URL);
    return process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') === true && !!process.env.STRIPE_WEBHOOK_SECRET
      && origin.protocol === 'https:' && origin.href === origin.origin + '/';
  } catch { return false; }
}
function gateway() {
  if (!checkoutConfigured()) fail(503, 'checkout_unavailable');
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20', maxNetworkRetries: 2, timeout: 15000 });
}
export function orderView(o, merchant = false) {
  return { publicOrderId: o.publicOrderId, ...(merchant ? { orderId: o.orderId } : {}), publicOfferId: o.publicOfferId,
    productName: o.productName, merchantName: o.merchantName, locationName: o.locationName, quantity: 1,
    unitPriceMinor: o.unitPriceMinor, totalPriceMinor: o.unitPriceMinor, currency: o.currency,
    status: o.status, testMode: true, createdAt: o.createdAt, expiresAt: o.expiresAt, paidAt: o.paidAt, closedAt: o.closedAt };
}
async function transaction(work) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); }
  finally { await session.endSession(); }
}
function checkSession(o, s) {
  if (s?.livemode !== false || s.mode !== 'payment' || !s.id?.startsWith('cs_test_')
    || s.metadata?.flow !== 'qr2buy_merchant' || s.metadata?.orderId !== o.orderId
    || s.client_reference_id !== o.orderId || s.amount_total !== o.unitPriceMinor || s.currency !== o.currency.toLowerCase()
    || (o.stripeSessionId && o.stripeSessionId !== s.id)) fail(409, 'checkout_mismatch');
}
function safeUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'checkout.stripe.com' && !u.username && !u.password; }
  catch { return false; }
}
export function createPurchaseService({ stripe: injectedStripe, configured = checkoutConfigured,
  origin = () => process.env.PUBLIC_BASE_URL, now = () => new Date() } = {}) {
  const stripe = () => injectedStripe || gateway();
  const find = async id => {
    if (!validId(id)) fail(404, 'order_not_found');
    const o = await MerchantOrder.findOne({ publicOrderId: id }).select('+checkoutUrl +returnOrigin');
    if (!o) fail(404, 'order_not_found');
    return o;
  };
  async function attach(o, s) {
    checkSession(o, s);
    if (s.status === 'open' && !safeUrl(s.url)) fail(409, 'checkout_mismatch');
    await MerchantOrder.updateOne({ orderId: o.orderId, status: 'CHECKOUT_STARTED', stripeSessionId: null },
      { $set: { stripeSessionId: s.id, checkoutUrl: s.status === 'open' ? s.url : null } });
    o.stripeSessionId = s.id; o.checkoutUrl = s.status === 'open' ? s.url : null;
    return o;
  }
  async function sessionFor(o) {
    const api = stripe();
    if (o.stripeSessionId) { const s = await api.checkout.sessions.retrieve(o.stripeSessionId); checkSession(o, s); return s; }
    // Immutable parameters + a stable Stripe idempotency key recover a lost response.
    // No new creation once its minimum lifetime could no longer be guaranteed.
    if (+now() < +o.createdAt + 4 * 60000) {
      const params = { mode: 'payment', payment_method_types: ['card'], client_reference_id: o.orderId,
        metadata: { flow: 'qr2buy_merchant', orderId: o.orderId }, locale: o.language,
        line_items: [{ quantity: 1, price_data: { currency: o.currency.toLowerCase(), unit_amount: o.unitPriceMinor, product_data: { name: o.productName } } }],
        expires_at: Math.floor(+o.expiresAt / 1000),
        success_url: `${o.returnOrigin}/buy/${o.publicOrderId}?lang=${o.language}`,
        cancel_url: `${o.returnOrigin}/buy/${o.publicOrderId}?lang=${o.language}&cancel=1` };
      const s = await api.checkout.sessions.create(params, { idempotencyKey: 'merchant-order-' + o.orderId });
      await attach(o, s); return s;
    }
    // Resolve creation ambiguity by paginating Stripe, never by assuming a timeout
    // means no payment. Past expiresAt, no late request can create a payable session.
    let after;
    do {
      const page = await api.checkout.sessions.list({ limit: 100, created: { gte: Math.floor(+o.createdAt / 1000) - 60 }, ...(after ? { starting_after: after } : {}) });
      const s = page.data.find(s => s.metadata?.flow === 'qr2buy_merchant' && s.metadata.orderId === o.orderId);
      if (s) { await attach(o, s); return s; }
      after = page.has_more ? page.data.at(-1)?.id : null;
      if (page.has_more && !after) fail(503, 'checkout_unavailable');
    } while (after);
    return null;
  }
  async function finish(o, s, status, eventId = null) {
    if (s) checkSession(o, s);
    if (status === 'PAID' && (!eventId || s?.status !== 'complete' || s.payment_status !== 'paid')) fail(409, 'checkout_mismatch');
    if (status !== 'PAID' && s && (s.status !== 'expired' || s.payment_status !== 'unpaid')) fail(409, 'checkout_pending');
    return transaction(async session => {
      const offer = await Offer.findOneAndUpdate({ offerId: o.offerId, merchantId: o.merchantId }, { $inc: { reservationRevision: 1 } }, { session, new: true });
      const order = await MerchantOrder.findOne({ orderId: o.orderId }).session(session);
      if (!order || !offer) fail(409, 'checkout_mismatch');
      if (order.status === status || order.status === 'PAID' || (status !== 'PAID' && ['CANCELLED', 'EXPIRED'].includes(order.status))) return orderView(order);
      if (order.status !== 'CHECKOUT_STARTED') fail(409, 'order_closed');
      if (status === 'PAID') {
        if (offer.stockQuantity < 1) fail(409, 'inventory_mismatch');
        offer.stockQuantity -= 1; offer.depletedByPurchase = offer.stockQuantity === 0;
        order.paidAt = now(); order.paidEventId = eventId; order.paymentIntentId = s.payment_intent || null;
        // Only this verified PAID transition creates the mail outbox. Duplicate
        // events and historical PAID orders never reset a claim or trigger backfill.
        order.buyerEmail = validDemoEmail(s.customer_details?.email) || validDemoEmail(s.customer_email);
        order.mailStatus = order.buyerEmail ? 'NOT_SENT' : 'FAILED';
        order.mailNextAttemptAt = order.buyerEmail ? now() : null;
      } else order.closedAt = now();
      order.status = status; order.stripeSessionId = s?.id || order.stripeSessionId;
      if (offer.commerceOrderId === order.orderId) {
        offer.commerceState = status; offer.commerceUntil = status === 'PAID' ? new Date(+now() + 30000) : null;
      }
      await offer.save({ session }); await order.save({ session }); return orderView(order);
    });
  }
  const service = {
    async create(publicOfferId, input) {
      if (!configured()) fail(503, 'checkout_unavailable');
      if (!validId(publicOfferId)) fail(404, 'offer_not_found');
      const data = purchaseInput.parse(input), returnOrigin = origin();
      const requestHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      const o = await transaction(async session => {
        const offer = await Offer.findOneAndUpdate({ publicOfferId }, { $inc: { reservationRevision: 1 } }, { session, new: true });
        if (!offer) fail(404, 'offer_not_found');
        const previous = await MerchantOrder.findOne({ offerId: offer.offerId, requestKey: data.requestKey }).select('+requestHash +checkoutUrl +returnOrigin').session(session);
        if (previous) { if (previous.requestHash !== requestHash) fail(409, 'request_conflict'); return previous; }
        const merchant = await Merchant.findOne({ merchantId: offer.merchantId, status: 'ACTIVE' }).session(session);
        const location = await Location.findOne({ merchantId: offer.merchantId, locationId: offer.locationId, status: 'ACTIVE' }).session(session);
        const product = await MerchantProduct.findOne({ merchantId: offer.merchantId, productId: offer.productId, status: 'ACTIVE' }).session(session);
        if (!merchant || !location || !product) fail(404, 'offer_not_found');
        if (!offer.active || !offer.purchasable || offer.inventorySource !== 'QR2BUY' || !Number.isSafeInteger(offer.priceMinor)
          || offer.priceMinor < 1 || offer.priceMinor > 999999999 || !['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'KWD', 'BHD'].includes(offer.currency)) fail(409, 'checkout_unavailable');
        if (offer.commerceState === 'CHECKOUT_STARTED' || (offer.commerceState === 'PAID' && offer.commerceUntil > now())) fail(409, 'checkout_pending');
        if (offer.stockQuantity - await reservedQuantity(offer.offerId, now(), session) < 1) fail(409, 'out_of_stock');
        const [order] = await MerchantOrder.create([{ ...data, requestHash, returnOrigin,
          orderId: randomUUID(), publicOrderId: randomBytes(16).toString('hex'), merchantId: offer.merchantId,
          locationId: offer.locationId, productId: offer.productId, offerId: offer.offerId, publicOfferId,
          productName: product.name, merchantName: merchant.displayName, locationName: location.name,
          unitPriceMinor: offer.priceMinor, currency: offer.currency, status: 'CHECKOUT_STARTED',
          createdAt: now(), expiresAt: new Date(+now() + 35 * 60000) }], { session });
        offer.commerceOrderId = order.orderId; offer.commerceState = 'CHECKOUT_STARTED'; offer.commerceUntil = null;
        await offer.save({ session }); return order;
      });
      if (o.status !== 'CHECKOUT_STARTED') return { ok: true, order: orderView(o), checkoutUrl: null };
      try { const s = await sessionFor(o); return { ok: true, order: orderView(o), checkoutUrl: s?.status === 'open' ? s.url : null }; }
      catch (e) { if (e instanceof DeviceApiError) throw e; return { ok: true, order: orderView(o), checkoutUrl: null, pending: true }; }
    },
    async publicStatus(id) {
      const o = await find(id);
      return { ok: true, order: orderView(o), checkoutUrl: o.status === 'CHECKOUT_STARTED' && +o.expiresAt > +now() && safeUrl(o.checkoutUrl) ? o.checkoutUrl : null };
    },
    async cancel(id) {
      const o = await find(id);
      if (o.status !== 'CHECKOUT_STARTED') return { ok: true, order: orderView(o) };
      let s = await sessionFor(o);
      if (!s) { if (+now() <= +o.expiresAt + 120000) fail(409, 'checkout_pending'); return { ok: true, order: await finish(o, null, 'CANCELLED') }; }
      if (s.status === 'open') {
        try { s = await stripe().checkout.sessions.expire(s.id); }
        catch { s = await stripe().checkout.sessions.retrieve(s.id); }
      }
      return { ok: true, order: await finish(o, s, 'CANCELLED') };
    },
    async webhook(event) {
      if (!event?.id || event.livemode !== false) fail(400, 'invalid_webhook_event');
      const payload = event.data?.object;
      if (payload?.metadata?.flow !== 'qr2buy_merchant') return { ok: true, ignored: true };
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) return { ok: true, ignored: true };
      const o = await MerchantOrder.findOne({ orderId: payload.metadata.orderId });
      if (!o) fail(409, 'checkout_mismatch');
      checkSession(o, payload);
      const s = await stripe().checkout.sessions.retrieve(payload.id); checkSession(o, s);
      if (event.type === 'checkout.session.expired') return { ok: true, order: await finish(o, s, 'EXPIRED') };
      if (payload.payment_status !== 'paid' || s.payment_status !== 'paid') return { ok: true, ignored: true, waitingForPayment: true };
      const lines = await stripe().checkout.sessions.listLineItems(s.id, { limit: 2 });
      if (lines.has_more || lines.data.length !== 1 || lines.data[0].quantity !== 1 || lines.data[0].amount_total !== o.unitPriceMinor) fail(409, 'checkout_mismatch');
      return { ok: true, order: await finish(o, s, 'PAID', event.id) };
    },
    async list(merchantId) { return { ok: true, items: (await MerchantOrder.find({ merchantId }).sort({ createdAt: -1 }).limit(200).lean()).map(o => orderView(o, true)) }; },
    async recentSales(merchantId) { return { ok: true, items: (await MerchantOrder.find({ merchantId, status: 'PAID' }).sort({ paidAt: -1 }).limit(5).lean()).map(o => orderView(o, true)) }; },
    async reconcile() {
      if (!configured()) return;
      const orders = await MerchantOrder.find({ status: 'CHECKOUT_STARTED', createdAt: { $lte: new Date(+now() - 30000) } }).select('+returnOrigin').sort({ createdAt: 1 }).limit(100);
      for (const o of orders) {
        const s = await sessionFor(o);
        if (s?.status === 'expired' && s.payment_status === 'unpaid') await finish(o, s, 'EXPIRED');
        else if (!s && +now() > +o.expiresAt + 120000) await finish(o, null, 'EXPIRED');
        // Complete/paid stays held until a verified webhook, never a browser/worker PAID.
      }
    }
  };
  return service;
}
export function startPurchaseReconciliation(onError = () => {}, intervalMs = 30000) {
  const service = createPurchaseService(); let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await service.reconcile(); } catch { onError(); } finally { busy = false; } };
  const timer = setInterval(run, intervalMs); timer.unref(); void run(); return () => clearInterval(timer);
}
