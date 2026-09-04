import test from 'node:test';
import assert from 'node:assert/strict';
import {
  constructLegacyWebhookEvent,
  createLegacyStripeClient,
  LegacyWebhookError,
  processLegacyWebhookEvent
} from '../src/stripe/legacyWebhook.js';

function event({
  id = 'evt_test_legacy',
  type = 'checkout.session.completed',
  livemode = false,
  paymentStatus = 'paid',
  metadata = { system: 'qr2buy', productId: 'product-1', productShortId: 'demo', deviceId: 'device-1' }
} = {}) {
  return {
    id,
    type,
    livemode,
    data: {
      object: {
        id: 'cs_test_legacy',
        status: 'complete',
        payment_status: paymentStatus,
        amount_total: 1999,
        currency: 'eur',
        payment_intent: 'pi_test_legacy',
        customer_details: { email: 'must-not-be-stored@example.test' },
        metadata
      }
    }
  };
}

function models() {
  const calls = [];
  const Product = {
    async findOneAndUpdate(filter, update, options) {
      calls.push(['product', filter, update, options]);
      return { _id: 'product-1', deviceId: null, price: 19.99, currency: 'EUR' };
    }
  };
  const Device = {
    async findByIdAndUpdate(...args) { calls.push(['deviceById', ...args]); return null; },
    async findOneAndUpdate(filter, update, options) {
      calls.push(['device', filter, update, options]);
      return { _id: 'device-object-1', deviceId: 'device-1' };
    }
  };
  const Order = {
    async updateOne(filter, update, options) {
      calls.push(['order', filter, update, options]);
      return { acknowledged: true, upsertedCount: 1 };
    }
  };
  return { Product, Device, Order, calls, log: { info() {} } };
}

test('turns the former missing-key 500 cause into an explicit unavailable configuration error', () => {
  for (const key of [undefined, '', 'sk_live_forbidden']) {
    assert.throws(
      () => createLegacyStripeClient(key),
      (error) => error instanceof LegacyWebhookError && error.code === 'legacy_checkout_not_configured' && error.status === 503
    );
  }
  assert.ok(createLegacyStripeClient('sk_test_placeholder'));
});

test('requires a raw body, signing secret and valid Stripe signature', () => {
  const stripe = {
    webhooks: {
      constructEvent(rawBody, signature, secret) {
        if (!Buffer.isBuffer(rawBody) || signature !== 'valid' || secret !== 'whsec_placeholder') throw new Error('invalid');
        return event();
      }
    }
  };
  assert.equal(constructLegacyWebhookEvent({ stripe, rawBody: Buffer.from('{}'), signature: 'valid', secret: 'whsec_placeholder' }).id, 'evt_test_legacy');
  assert.throws(
    () => constructLegacyWebhookEvent({ stripe, rawBody: Buffer.from('{}'), signature: 'invalid', secret: 'whsec_placeholder' }),
    (error) => error instanceof LegacyWebhookError && error.code === 'invalid_webhook_signature' && error.status === 400
  );
});

test('acknowledges demo and unknown events without touching legacy commerce models', async () => {
  for (const candidate of [
    event({ metadata: { flow: 'qr2buy_demo', demoSessionId: 'demo-session', demoProductKey: 'bag' } }),
    event({ type: 'checkout.session.expired' })
  ]) {
    const dependencies = models();
    assert.deepEqual(await processLegacyWebhookEvent(candidate, dependencies), { ok: true, ignored: true });
    assert.equal(dependencies.calls.length, 0);
  }
});

test('fulfills a paid legacy checkout atomically and stores only a redacted session projection', async () => {
  const dependencies = models();
  assert.deepEqual(await processLegacyWebhookEvent(event(), dependencies), { ok: true, paid: true });
  assert.deepEqual(dependencies.calls.map(([kind]) => kind), ['product', 'device', 'order']);
  assert.deepEqual(dependencies.calls[0].slice(1), [
    { _id: 'product-1' },
    { $set: { status: 'SOLD' } },
    { new: true }
  ]);
  const orderUpdate = dependencies.calls[2][2].$setOnInsert;
  assert.equal(orderUpdate.amount, 19.99);
  assert.equal(orderUpdate.currency, 'EUR');
  assert.equal(orderUpdate.raw.id, 'cs_test_legacy');
  assert.equal(orderUpdate.raw.customer_details, undefined);
  assert.equal(JSON.stringify(orderUpdate.raw).includes('must-not-be-stored'), false);
  assert.deepEqual(dependencies.calls[2][1], { sessionId: 'cs_test_legacy' });
  assert.deepEqual(dependencies.calls[2][3], { upsert: true });
});

test('does not mark unpaid, malformed or live legacy events as sold', async () => {
  for (const candidate of [event({ paymentStatus: 'unpaid' }), event({ metadata: { system: 'qr2buy' } })]) {
    const dependencies = models();
    const result = await processLegacyWebhookEvent(candidate, dependencies);
    assert.equal(result.ignored, true);
    assert.equal(dependencies.calls.length, 0);
  }
  await assert.rejects(
    processLegacyWebhookEvent(event({ livemode: true }), models()),
    (error) => error instanceof LegacyWebhookError && error.code === 'invalid_webhook_event'
  );
});
