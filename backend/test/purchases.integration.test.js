import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import Stripe from 'stripe';
import { reservationFixture } from '../testing/reservationFixture.js';
import { MerchantOrder } from '../src/merchant/orderModel.js';
import { Offer, ManagedDevice, DeviceMerchantAssignment, DisplayAssignment } from '../src/merchant/models.js';
import { reservedQuantity } from '../src/merchant/inventory.js';
import { saveOffer } from '../src/merchant/portal.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { createCredentialService } from '../src/merchant/deviceCredentials.js';
import { createStripeWebhookRouter } from '../src/routes/stripeWebhook.js';

const input = () => ({ requestKey: randomUUID(), quantity: 1, language: 'de', testMode: true });
test('P0.6 isolated Mongo, signed HTTP webhooks, inventory and device consistency', { timeout: 180000 }, async t => {
  const f = await reservationFixture(undefined, { purchases: true });
  const signatureSdk = new Stripe('sk_test_fixture_only'), secret = 'whsec_fixture_only';
  const webhookApp = express();
  webhookApp.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
  webhookApp.use('/api/stripe', createStripeWebhookRouter({ stripeFactory: () => signatureSdk, merchantService: f.purchase, webhookSecret: () => secret }));
  const server = f.app.listen(0, '127.0.0.1'), webhookServer = webhookApp.listen(0, '127.0.0.1');
  await Promise.all([server, webhookServer].map(s => new Promise(r => s.once('listening', r))));
  const base = 'http://127.0.0.1:' + server.address().port, hook = 'http://127.0.0.1:' + webhookServer.address().port + '/api/stripe/webhook';
  const origin = 'http://127.0.0.1:5178';
  const create = (o, data = input(), headers = {}) => fetch(base + '/api/purchases/offers/' + o.publicOfferId,
    { method: 'POST', headers: { 'Content-Type': 'application/json', origin, ...headers }, body: JSON.stringify(data) });
  async function signed(event, signature) {
    const payload = JSON.stringify(event);
    return fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature || signatureSdk.webhooks.generateTestHeaderString({ payload, secret }) }, body: payload });
  }
  async function paid(o) {
    const event = f.gateway.event(o.stripeSessionId); assert.equal((await signed(event)).status, 200); return event;
  }
  async function row(r) { return MerchantOrder.findOne({ publicOrderId: r.order.publicOrderId }); }
  try {
    await t.test('server snapshots price; test-only, quantity one, opaque public whitelist and request idempotency', async () => {
      const o = await f.offer(), data = input(), response = await create(o, data); assert.equal(response.status, 201);
      const r = await response.json(); assert.equal(r.order.status, 'CHECKOUT_STARTED'); assert.equal(r.order.quantity, 1); assert.equal(r.order.unitPriceMinor, 1990);
      assert.match(r.checkoutUrl, /^https:\/\/checkout\.stripe\.com\//);
      assert.equal((await (await create(o, data)).json()).order.publicOrderId, r.order.publicOrderId);
      assert.equal(await MerchantOrder.countDocuments({ offerId: o.offerId }), 1);
      for (const key of ['merchantId', 'offerId', 'productId', 'orderId', 'stripeSessionId', 'checkoutUrl', 'requestHash', 'requestKey', 'paymentIntentId', 'paidEventId']) assert.equal(r.order[key], undefined);
      assert.equal((await Offer.findOne({ offerId: o.offerId })).stockQuantity, 1);
      assert.equal(await reservedQuantity(o.offerId, f.now()), 1);
      assert.equal((await create(o, { ...data, language: 'en' })).status, 409);
    });
    for (const patch of [{ quantity: 2 }, { quantity: 0 }, { testMode: false }, { language: 'fr' }, { requestKey: 'bad' }, { unitPriceMinor: 1 }, { merchantId: 'M1' }])
      await t.test('reject client commerce override ' + JSON.stringify(patch), async () => { const o = await f.offer(); assert.equal((await create(o, { ...input(), ...patch })).status, 400); });
    for (const patch of [{ stockQuantity: 0 }, { purchasable: false }, { active: false }, { inventorySource: 'EXTERNAL' }, { priceMinor: 0 }])
      await t.test('reject unavailable checkout ' + JSON.stringify(patch), async () => { const o = await f.offer(patch); assert.equal((await create(o)).status, 409); });
    await t.test('POST origin and public GET query rejection, missing capability', async () => {
      const o = await f.offer(); assert.equal((await create(o, input(), { origin: 'https://foreign.example' })).status, 403);
      assert.equal((await fetch(base + '/api/purchases/' + 'a'.repeat(32) + '?paid=1')).status, 400);
      assert.equal((await fetch(base + '/api/purchases/' + 'a'.repeat(32))).status, 404);
    });
    await t.test('checkout versus checkout, duplicate request and reservation last-unit races', async () => {
      let o = await f.offer(); let rs = await Promise.all([create(o), create(o)]); assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
      o = await f.offer(); const data = input(); rs = await Promise.all([create(o, data), create(o, data)]); assert.deepEqual(rs.map(r => r.status), [201, 201]);
      assert.equal(await MerchantOrder.countDocuments({ offerId: o.offerId }), 1);
      o = await f.offer();
      const reservation = fetch(base + '/api/reservations/offers/' + o.publicOfferId, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerName: 'Fixture buyer', buyerEmail: 'fixture@example.test', requestKey: randomUUID(), quantity: 1 }) });
      rs = await Promise.all([create(o), reservation]); assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
      assert.equal(await reservedQuantity(o.offerId, f.now()), 1);
    });
    await t.test('forged signature, live event, price/metadata/quantity mismatch cannot pay', async () => {
      const o = await f.offer(), r = await (await create(o)).json(), order = await row(r);
      const event = f.gateway.event(order.stripeSessionId);
      assert.equal((await signed(event, 'invalid')).status, 400);
      assert.equal((await signed({ ...event, livemode: true })).status, 400);
      const forged = structuredClone(event); forged.data.object.amount_total = 1; assert.equal((await signed(forged)).status, 409);
      const session = f.gateway.sessions.get(order.stripeSessionId); session.quantity = 2; assert.equal((await signed(event)).status, 409); session.quantity = 1;
      assert.equal((await row(r)).status, 'CHECKOUT_STARTED'); assert.equal((await Offer.findOne({ offerId: o.offerId })).stockQuantity, 1);
      await paid(order);
    });
    await t.test('browser return and paid Stripe session do not set PAID; concurrent verified events reduce exactly once', async () => {
      const o = await f.offer({ stockQuantity: 2 }), r = await (await create(o)).json(), order = await row(r);
      const event = f.gateway.event(order.stripeSessionId);
      assert.equal((await (await fetch(base + '/api/purchases/' + r.order.publicOrderId)).json()).order.status, 'CHECKOUT_STARTED');
      await f.advance(31000); await f.purchase.reconcile(); assert.equal((await row(r)).status, 'CHECKOUT_STARTED');
      const responses = await Promise.all([signed(event), signed(event), signed({ ...event, id: event.id + '_duplicate' })]);
      assert.deepEqual(responses.map(r => r.status), [200, 200, 200]);
      assert.equal((await row(r)).status, 'PAID'); assert.equal((await Offer.findOne({ offerId: o.offerId })).stockQuantity, 1);
      assert.equal(await reservedQuantity(o.offerId, f.now()), 0); assert.equal((await f.device.publicOffer(o.publicOfferId)).availabilityState, 'PAID');
      await f.advance(31000); assert.equal((await f.device.publicOffer(o.publicOfferId)).availabilityState, 'READY');
    });
    await t.test('cancel must expire Stripe, releases once; paid/cancel race never releases paid inventory', async () => {
      const o = await f.offer(), r = await (await create(o)).json(), order = await row(r);
      const response = await fetch(base + '/api/purchases/' + r.order.publicOrderId + '/cancel', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 200); assert.equal((await row(r)).status, 'CANCELLED'); assert.equal(await reservedQuantity(o.offerId, f.now()), 0);
      assert.equal(f.gateway.sessions.get(order.stripeSessionId).status, 'expired');
      assert.equal((await signed(f.gateway.event(order.stripeSessionId, 'checkout.session.expired'))).status, 200);
      assert.equal((await Offer.findOne({ offerId: o.offerId })).stockQuantity, 1);
      const o2 = await f.offer(), r2 = await (await create(o2)).json(), order2 = await row(r2); const event = f.gateway.event(order2.stripeSessionId);
      const cancel = await fetch(base + '/api/purchases/' + r2.order.publicOrderId + '/cancel', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(cancel.status, 409); assert.equal(await reservedQuantity(o2.offerId, f.now()), 1);
      assert.equal((await signed(event)).status, 200); assert.equal((await row(r2)).status, 'PAID');
    });
    await t.test('wall-clock expiry alone retains hold; Stripe-confirmed expiry releases stock and notify', async () => {
      const o = await f.offer(), r = await (await create(o)).json();
      await f.advance(36 * 60000); assert.equal(await reservedQuantity(o.offerId, f.now()), 1);
      await f.purchase.reconcile(); assert.equal((await row(r)).status, 'EXPIRED'); assert.equal(await reservedQuantity(o.offerId, f.now()), 0);
      assert.equal((await f.device.publicOffer(o.publicOfferId)).availabilityState, 'READY');
    });
    await t.test('lost Stripe creation response recovered by same key and worker without duplicate session', async () => {
      const o = await f.offer(), data = input(); f.gateway.loseNextResponse();
      const first = await (await create(o, data)).json(); assert.equal(first.pending, true); assert.equal(await reservedQuantity(o.offerId, f.now()), 1);
      const second = await (await create(o, data)).json(); assert.equal(second.order.publicOrderId, first.order.publicOrderId); assert.ok(second.checkoutUrl);
      const order = await row(first); assert.equal([...f.gateway.sessions.values()].filter(s => s.metadata.orderId === order.orderId).length, 1);
    });
    await t.test('portal cannot reduce below checkout holds; restock clears actual SOLD provenance', async () => {
      const o = await f.offer(), r = await (await create(o)).json();
      await assert.rejects(saveOffer('M0', o.offerId, { stockQuantity: 0 }), e => e.code === 'stock_below_reservations');
      await paid(await row(r)); await f.advance(31000);
      assert.equal((await f.device.publicOffer(o.publicOfferId)).availabilityState, 'SOLD');
      await saveOffer('M0', o.offerId, { stockQuantity: 2 }); assert.equal((await f.device.publicOffer(o.publicOfferId)).availabilityState, 'READY');
      await saveOffer('M0', o.offerId, { stockQuantity: 0 }); assert.equal((await f.device.publicOffer(o.publicOfferId)).availabilityState, 'OUT_OF_STOCK');
    });
    await t.test('two physical device projections share offer state, separate offer stays unchanged', async () => {
      const o = await f.offer({ stockQuantity: 2 }), other = await f.offer({ stockQuantity: 4 });
      const pepper = 'a'.repeat(64), credentials = createCredentialService({ pepper: () => pepper });
      const device = createDeviceService({ pepper: () => pepper, publicOrigin: () => 'https://qr2buy.example.test', now: f.now, notifyEnabled: () => true });
      const auth = [];
      for (let i = 0; i < 3; i++) {
        const selected = i === 2 ? other : o, deviceId = 'QR2B-' + String(900001 + i);
        await ManagedDevice.create({ deviceId, displayName: 'Fixture ' + i, status: 'ACTIVE', hardwareVariant: 'ESP32_ILI9341_CS5' });
        await DeviceMerchantAssignment.create({ deviceId, merchantId: 'M0', locationId: 'L0', validFrom: new Date(+f.now() - 1000), status: 'ACTIVE', usageType: 'PILOT' });
        await DisplayAssignment.create({ deviceId, merchantId: 'M0', locationId: 'L0', productId: selected.productId, offerId: selected.offerId, status: 'ACTIVE', assignedAt: f.now(), verifiedAt: f.now() });
        const c = await credentials.rotate(deviceId); auth.push({ deviceId, secret: c.secret, version: c.version });
      }
      const configs = () => Promise.all(auth.map(a => device.config(a, '0.3.10')));
      const baseline = (await configs())[2]; const r = await (await create(o)).json();
      let states = await configs(); assert.deepEqual(states.map(s => s.display.status), ['CHECKOUT_STARTED', 'CHECKOUT_STARTED', 'READY']);
      assert.equal((await f.device.publicOffer(o.publicOfferId)).availabilityState, 'CHECKOUT_STARTED');
      await paid(await row(r)); states = await configs(); assert.deepEqual(states.map(s => s.display.status), ['PAID', 'PAID', 'READY']);
      assert.equal(states[0].display.qr, ''); await f.advance(31000); states = await configs(); assert.deepEqual(states.map(s => s.display.status), ['READY', 'READY', 'READY']);
      assert.deepEqual(states[2].display, baseline.display); assert.equal(states[0].offer.stockQuantity, 1);
    });
    await t.test('merchant orders require owner session and exclude other merchant orders / secrets', async () => {
      assert.equal((await fetch(base + '/api/merchant/orders')).status, 401);
      async function login(i) {
        let r = await fetch(base + '/api/merchant-auth/csrf'), cookie = r.headers.get('set-cookie').split(';')[0], csrf = (await r.json()).csrfToken;
        r = await fetch(base + '/api/merchant-auth/login', { method: 'POST', headers: { cookie, origin, 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ email: `merchant${i}@example.test`, password: f.password }) });
        assert.equal(r.status, 200); return r.headers.get('set-cookie').split(';')[0];
      }
      const own = await (await fetch(base + '/api/merchant/orders', { headers: { cookie: await login(0) } })).json(); assert.ok(own.items.length > 0);
      for (const o of own.items) for (const key of ['stripeSessionId', 'requestKey', 'paymentIntentId', 'paidEventId', 'checkoutUrl']) assert.equal(o[key], undefined);
      const foreign = await (await fetch(base + '/api/merchant/orders', { headers: { cookie: await login(1) } })).json(); assert.deepEqual(foreign.items, []);
    });
  } finally { await Promise.all([server, webhookServer].map(s => new Promise(r => s.close(r)))); await f.close(); }
});
