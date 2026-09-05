import test from 'node:test';
import assert from 'node:assert/strict';
import {
  constructDemoWebhookEvent,
  createDemoService,
  DemoError,
  hashDemoToken
} from '../src/demo/service.js';
import { buildDemoMail, createDemoMailTransport, createMemoryDemoMailTransport } from '../src/demo/mail.js';
import { DemoSession } from '../src/models.js';

function clone(value) {
  return structuredClone(value);
}

function fakeRepository() {
  const sessions = [];
  let nextId = 1;

  function byHash(tokenHash) {
    return sessions.find((session) => session.tokenHash === tokenHash) || null;
  }

  function state(session, key) {
    return session?.products.find((product) => product.productKey === key) || null;
  }

  return {
    sessions,
    async create(data) {
      const session = { _id: String(nextId++), ...clone(data) };
      sessions.push(session);
      return clone(session);
    },
    async findByTokenHash(tokenHash) {
      return clone(byHash(tokenHash));
    },
    async resetDue(tokenHash, now, checkoutTimeoutAt) {
      const session = byHash(tokenHash);
      if (!session) return null;
      for (const product of session.products) {
        const completionDue = product.resetAt && new Date(product.resetAt) <= now;
        const checkoutDue = product.status === 'CHECKOUT_STARTED' && product.checkoutStartedAt && new Date(product.checkoutStartedAt) <= checkoutTimeoutAt;
        if (completionDue || checkoutDue) {
          const soldAfterConfirmation = completionDue && product.status === 'PAID' && product.productKey === 'tree';
          Object.assign(product, {
            status: soldAfterConfirmation ? 'SOLD' : 'READY', checkoutOperationId: null, checkoutSessionId: null,
            checkoutStartedAt: null, resetAt: null, demoOrderNumber: null, paidAt: null,
            mailAttemptedForCheckoutId: null, mailStatus: 'NONE', changedAt: now,
            eventVersion: product.eventVersion + 1
          });
        }
      }
      return clone(session);
    },
    async recordScan(tokenHash, key, now, interactionExpiresAt) {
      const session = byHash(tokenHash);
      const product = state(session, key);
      if (!product || (product.interactionExpiresAt && new Date(product.interactionExpiresAt) > now)) return null;
      Object.assign(product, {
        lastScannedAt: now,
        interactionExpiresAt,
        eventVersion: product.eventVersion + 1
      });
      return clone(session);
    },
    async reserve(tokenHash, key, now, resetAt) {
      const session = byHash(tokenHash);
      const product = state(session, key);
      if (!product || !['READY', 'CANCELLED'].includes(product.status)) return null;
      Object.assign(product, { status: 'RESERVED', changedAt: now, resetAt, eventVersion: product.eventVersion + 1 });
      return clone(session);
    },
    async claimCheckout(tokenHash, key, operationId, now) {
      const session = byHash(tokenHash);
      const product = state(session, key);
      if (!product || !['READY', 'CANCELLED'].includes(product.status)) return null;
      Object.assign(product, {
        status: 'CHECKOUT_STARTED', checkoutOperationId: operationId,
        checkoutStartedAt: now, changedAt: now, resetAt: null,
        eventVersion: product.eventVersion + 1
      });
      return clone(session);
    },
    async attachCheckout(tokenHash, key, operationId, checkoutSessionId, now) {
      const session = byHash(tokenHash);
      const product = state(session, key);
      if (!product || product.checkoutOperationId !== operationId) return null;
      Object.assign(product, { checkoutSessionId, changedAt: now });
      return clone(session);
    },
    async rollbackCheckout(tokenHash, key, operationId, now) {
      const session = byHash(tokenHash);
      const product = state(session, key);
      if (!product || product.checkoutOperationId !== operationId) return null;
      Object.assign(product, {
        status: 'READY', checkoutOperationId: null, checkoutSessionId: null,
        checkoutStartedAt: null, changedAt: now, eventVersion: product.eventVersion + 1
      });
      return clone(session);
    },
    async cancel(tokenHash, key, now, resetAt) {
      const session = byHash(tokenHash);
      const product = state(session, key);
      if (!product || product.status !== 'CHECKOUT_STARTED') return null;
      Object.assign(product, { status: 'CANCELLED', changedAt: now, resetAt, eventVersion: product.eventVersion + 1 });
      return clone(session);
    },
    async markPaid({ sessionId, productKey, checkoutSessionId, eventId, now, resetAt, demoOrderNumber }) {
      const session = sessions.find((item) => item._id === sessionId);
      const product = state(session, productKey);
      if (!session || session.processedWebhookEvents.includes(eventId) || product?.checkoutSessionId !== checkoutSessionId || product.status !== 'CHECKOUT_STARTED') return null;
      session.processedWebhookEvents.push(eventId);
      Object.assign(product, {
        status: 'PAID', changedAt: now, resetAt, paidAt: now, demoOrderNumber,
        mailStatus: 'NONE', eventVersion: product.eventVersion + 1
      });
      return clone(session);
    },
    async claimMail(sessionId, productKey, checkoutSessionId, now) {
      const session = sessions.find((item) => item._id === sessionId);
      const product = state(session, productKey);
      if (!product || product.status !== 'PAID' || product.checkoutSessionId !== checkoutSessionId || product.mailAttemptedForCheckoutId === checkoutSessionId) return null;
      Object.assign(product, {
        mailAttemptedForCheckoutId: checkoutSessionId, mailStatus: 'SENDING', changedAt: now,
        eventVersion: product.eventVersion + 1
      });
      return clone(session);
    },
    async completeMail({ sessionId, productKey, checkoutSessionId, status, now }) {
      const session = sessions.find((item) => item._id === sessionId);
      const product = state(session, productKey);
      if (!product || product.checkoutSessionId !== checkoutSessionId || product.mailStatus !== 'SENDING') return null;
      Object.assign(product, { mailStatus: status, changedAt: now, eventVersion: product.eventVersion + 1 });
      return clone(session);
    }
  };
}

function harness({ tokens = ['A'.repeat(43), 'B'.repeat(43)], stripeFailure = false, email = null, mailFailure = false, requirePublicHttps = false } = {}) {
  const repository = fakeRepository();
  let clock = new Date('2026-09-01T12:00:00.000Z');
  let stripeNumber = 0;
  const stripeCalls = [];
  const broadcasts = [];
  const checkoutSessions = new Map();
  const mailTransport = createMemoryDemoMailTransport({ fail: mailFailure });
  const service = createDemoService({
    repository,
    now: () => new Date(clock),
    tokenFactory: () => tokens.shift(),
    schedule: () => {},
    broadcast: (tokenHash, snapshot) => broadcasts.push({ tokenHash, snapshot }),
    stripeClientFactory: () => ({
      checkout: {
        sessions: {
          async create(params) {
            stripeCalls.push(params);
            if (stripeFailure) throw new Error('Stripe unavailable');
            stripeNumber += 1;
            const checkout = {
              id: `cs_test_${stripeNumber}`, url: `https://checkout.stripe.test/${stripeNumber}`,
              livemode: false, payment_status: 'paid', metadata: params.metadata,
              customer_details: { email }
            };
            checkoutSessions.set(checkout.id, checkout);
            return checkout;
          },
          async retrieve(id) {
            const checkout = checkoutSessions.get(id);
            if (!checkout) throw new Error('missing checkout');
            return clone(checkout);
          }
        }
      }
    }),
    mailTransport,
    requirePublicHttps
  });
  return {
    repository, service, stripeCalls, broadcasts, mailTransport,
    setClock(value) { clock = new Date(value); }
  };
}

function paidEvent({ id = 'evt_paid', checkoutId = 'cs_test_1', sessionId = '1', productKey = 'bag' } = {}) {
  return {
    id, livemode: false, type: 'checkout.session.completed',
    data: { object: { id: checkoutId, payment_status: 'paid', metadata: { flow: 'qr2buy_demo', demoSessionId: sessionId, demoProductKey: productKey } } }
  };
}

test('creates an opaque session with READY product states and a future expiry', async () => {
  const { service } = harness();
  const created = await service.createSession();
  assert.equal(created.token.length, 43);
  assert.equal(created.session.products.length, 4);
  assert.ok(created.session.products.every((product) => product.status === 'READY'));
  assert.ok(new Date(created.session.expiresAt) > new Date('2026-09-01T12:00:00.000Z'));
});

test('marks the tree as a unique one-unit demo product', async () => {
  const { service } = harness();
  const created = await service.createSession();
  const tree = await service.getProduct(created.token, 'tree');
  assert.equal(tree.state.status, 'READY');
  assert.equal(tree.product.unique, true);
  assert.equal(tree.product.stock, 1);
});

test('exposes fictional example stock without creating a real inventory', async () => {
  const { service } = harness();
  const created = await service.createSession();
  const byKey = new Map(created.products.map((product) => [product.key, product]));
  assert.equal(byKey.get('tree').stock, 1);
  assert.match(byKey.get('tree').alternatives.de, /Weitere Tannen/);
  assert.equal(byKey.get('print').stock, 1);
  assert.match(byKey.get('print').alternatives.de, /Weitere Stadtbilder/);
  assert.equal(byKey.get('bag').stock, 3);
  assert.match(byKey.get('bag').alternatives.de, /Weitere Taschenmodelle/);
  assert.equal(byKey.get('print').unique, false);
});

test('defines MongoDB TTL cleanup for demo sessions', () => {
  const ttlIndex = DemoSession.schema.indexes().find(([fields]) => fields.expiresAt === 1);
  assert.equal(ttlIndex?.[1]?.expireAfterSeconds, 0);
});

test('isolates two visitor sessions during reservation', async () => {
  const { service } = harness();
  const first = await service.createSession();
  const second = await service.createSession();
  await service.reserve(first.token, 'book');
  const firstStatus = await service.getProduct(first.token, 'book');
  const secondStatus = await service.getProduct(second.token, 'book');
  assert.equal(firstStatus.state.status, 'RESERVED');
  assert.equal(secondStatus.state.status, 'READY');
});

test('records one transient scan without changing the commerce status', async () => {
  const { service, broadcasts } = harness();
  const created = await service.createSession();
  const result = await service.recordScan(created.token, 'bag');
  const state = result.session.products.find((item) => item.productKey === 'bag');
  assert.equal(result.interactionRecorded, true);
  assert.equal(state.status, 'READY');
  assert.equal(state.interactionState, 'SCANNED');
  assert.equal(state.eventVersion, 1);
  assert.equal(new Date(state.interactionExpiresAt) - new Date(state.lastScannedAt), 10_000);
  assert.equal(broadcasts.length, 1);
});

test('deduplicates reload scans while the interaction is fresh', async () => {
  const { service, broadcasts } = harness();
  const created = await service.createSession();
  await service.recordScan(created.token, 'bag');
  const duplicate = await service.recordScan(created.token, 'bag');
  const state = duplicate.session.products.find((item) => item.productKey === 'bag');
  assert.equal(duplicate.interactionRecorded, false);
  assert.equal(state.eventVersion, 1);
  assert.equal(broadcasts.length, 1);
});

test('expires scan projection deterministically without changing commerce state', async () => {
  const { service, setClock } = harness();
  const created = await service.createSession();
  await service.recordScan(created.token, 'book');
  setClock('2026-09-01T12:00:11.000Z');
  const result = await service.getProduct(created.token, 'book');
  assert.equal(result.state.status, 'READY');
  assert.equal(result.state.interactionState, null);
});

test('rejects scan interaction for an invalid session or product', async () => {
  const { service } = harness();
  const created = await service.createSession();
  await assert.rejects(service.recordScan('invalid', 'bag'), (error) => error.code === 'invalid_session');
  await assert.rejects(service.recordScan(created.token, 'missing'), (error) => error.code === 'product_not_found');
});

test('keeps scan interactions isolated to one session and product', async () => {
  const { service } = harness();
  const first = await service.createSession();
  const second = await service.createSession();
  await service.recordScan(first.token, 'tree');
  assert.equal((await service.getProduct(first.token, 'tree')).state.interactionState, 'SCANNED');
  assert.equal((await service.getProduct(first.token, 'bag')).state.interactionState, null);
  assert.equal((await service.getProduct(second.token, 'tree')).state.interactionState, null);
});

test('commerce states override an otherwise fresh scan projection', async () => {
  const { service, repository } = harness();
  const created = await service.createSession();
  await service.recordScan(created.token, 'bag');
  const product = repository.sessions[0].products.find((item) => item.productKey === 'bag');
  for (const status of ['CHECKOUT_STARTED', 'RESERVED', 'PAID', 'SOLD']) {
    product.status = status;
    assert.equal((await service.getProduct(created.token, 'bag')).state.interactionState, null);
  }
});

test('creates demo checkout from the server catalog price and metadata', async () => {
  const { service, stripeCalls } = harness();
  const created = await service.createSession();
  const result = await service.startCheckout(created.token, 'book', 'https://qr2buy.com');
  assert.match(result.url, /^https:\/\/checkout\.stripe\.test/);
  assert.equal(stripeCalls[0].line_items[0].price_data.unit_amount, 2490);
  assert.equal(stripeCalls[0].line_items[0].price_data.currency, 'eur');
  assert.equal(stripeCalls[0].metadata.flow, 'qr2buy_demo');
  assert.equal(stripeCalls[0].metadata.demoProductKey, 'book');
  assert.equal(stripeCalls[0].metadata.demoTokenHash, hashDemoToken(created.token));
  assert.deepEqual(stripeCalls[0].payment_method_types, ['card']);
  assert.equal(stripeCalls[0].wallet_options.link.display, 'never');
  assert.match(stripeCalls[0].line_items[0].price_data.product_data.description, /^qr2buy Live-Demo/);
  assert.match(stripeCalls[0].custom_text.submit.message, /4242 4242 4242 4242/);
  assert.match(stripeCalls[0].success_url, /\?checkout=return$/);
  assert.doesNotMatch(stripeCalls[0].success_url, /\?session=/);
  assert.doesNotMatch(stripeCalls[0].success_url, /#session=/);
});

test('requires a public HTTPS origin for production demo checkout returns', async () => {
  const { service } = harness({ tokens: ['A'.repeat(43), 'B'.repeat(43), 'C'.repeat(43)], requirePublicHttps: true });
  for (const origin of ['http://qr2buy.com', 'https://localhost:5173', 'https://10.0.0.3']) {
    const created = await service.createSession();
    await assert.rejects(
      service.startCheckout(created.token, 'book', origin),
      (error) => error.code === 'invalid_public_base_url'
    );
  }
});

test('recovers from a malformed optional public URL with the validated request origin', async () => {
  const { service, stripeCalls } = harness({ requirePublicHttps: true });
  const created = await service.createSession();
  await service.startCheckout(created.token, 'book', ['not-a-url', 'https://qr2buy.com']);
  assert.match(stripeCalls[0].success_url, /^https:\/\/qr2buy\.com\/demo\/p\/book/);
});

test('accepts only a valid webhook signature', () => {
  const stripe = {
    webhooks: {
      constructEvent(rawBody, signature, secret) {
        if (signature !== 'valid' || secret !== 'whsec_test' || !Buffer.isBuffer(rawBody)) throw new Error('bad signature');
        return { id: 'evt_1' };
      }
    }
  };
  assert.equal(constructDemoWebhookEvent({ stripe, rawBody: Buffer.from('{}'), signature: 'valid', secret: 'whsec_test' }).id, 'evt_1');
  assert.throws(
    () => constructDemoWebhookEvent({ stripe, rawBody: Buffer.from('{}'), signature: 'invalid', secret: 'whsec_test' }),
    (error) => error instanceof DemoError && error.code === 'invalid_webhook_signature'
  );
});

test('marks PAID only from a paid webhook and handles redelivery idempotently', async () => {
  const { service } = harness();
  const created = await service.createSession();
  await service.startCheckout(created.token, 'bag', 'https://qr2buy.com');
  const sessionId = '1';
  const event = paidEvent({ sessionId });
  assert.equal((await service.processWebhookEvent(event)).paid, true);
  assert.equal((await service.processWebhookEvent(event)).duplicate, true);
  assert.equal((await service.getProduct(created.token, 'bag')).state.status, 'PAID');
});

test('acknowledges unknown webhook events without changing demo state', async () => {
  const { service } = harness();
  const created = await service.createSession();
  const result = await service.processWebhookEvent({
    id: 'evt_unknown', livemode: false, type: 'payment_intent.created', data: { object: {} }
  });
  assert.deepEqual(result, { ok: true, ignored: true });
  assert.equal((await service.getProduct(created.token, 'bag')).state.status, 'READY');
});

test('does not apply a webhook to the wrong demo session or product', async () => {
  const { service } = harness();
  const created = await service.createSession();
  await service.startCheckout(created.token, 'bag', 'https://qr2buy.com');
  await assert.rejects(
    service.processWebhookEvent(paidEvent({ sessionId: 'different-session', productKey: 'tree' })),
    (error) => error.code === 'invalid_webhook_event'
  );
  assert.equal((await service.getProduct(created.token, 'bag')).state.status, 'CHECKOUT_STARTED');
  assert.equal((await service.getProduct(created.token, 'tree')).state.status, 'READY');
});

test('ignores a delayed paid retry after the checkout claim has timed out', async () => {
  const { service, setClock } = harness();
  const created = await service.createSession();
  await service.startCheckout(created.token, 'bag', 'https://qr2buy.com');
  setClock('2026-09-01T12:16:00.000Z');
  assert.equal((await service.getProduct(created.token, 'bag')).state.status, 'READY');
  assert.equal((await service.processWebhookEvent(paidEvent({ id: 'evt_delayed' }))).duplicate, true);
  assert.equal((await service.getProduct(created.token, 'bag')).state.status, 'READY');
});

test('does not treat an unpaid checkout.session.completed event as PAID', async () => {
  const { service } = harness();
  const created = await service.createSession();
  await service.startCheckout(created.token, 'bag', 'https://qr2buy.com');
  const result = await service.processWebhookEvent({
    id: 'evt_unpaid', livemode: false, type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', payment_status: 'unpaid', metadata: { flow: 'qr2buy_demo', demoSessionId: '1', demoProductKey: 'bag' } } }
  });
  assert.equal(result.waitingForPayment, true);
  assert.equal((await service.getProduct(created.token, 'bag')).state.status, 'CHECKOUT_STARTED');
});

test('rejects Stripe live-mode events from the demo webhook', async () => {
  const { service } = harness();
  await assert.rejects(
    service.processWebhookEvent({ id: 'evt_live', livemode: true, type: 'checkout.session.completed', data: { object: {} } }),
    (error) => error.code === 'live_event_rejected'
  );
});

test('resets only the completed demo product after 20 seconds without changing a real product', async () => {
  const { service, setClock } = harness();
  const realProduct = { status: 'AVAILABLE' };
  const created = await service.createSession();
  await service.reserve(created.token, 'print');
  setClock('2026-09-01T12:00:21.000Z');
  assert.equal((await service.getProduct(created.token, 'print')).state.status, 'READY');
  assert.equal((await service.getProduct(created.token, 'book')).state.status, 'READY');
  assert.equal(realProduct.status, 'AVAILABLE');
});

test('moves only the paid one-unit tree from PAID to permanent SOLD', async () => {
  const { service, setClock } = harness();
  const created = await service.createSession();
  await service.startCheckout(created.token, 'tree', 'https://qr2buy.com');
  await service.processWebhookEvent(paidEvent({ productKey: 'tree' }));
  assert.equal((await service.getProduct(created.token, 'tree')).state.status, 'PAID');

  setClock('2026-09-01T12:00:21.000Z');
  assert.equal((await service.getProduct(created.token, 'tree')).state.status, 'SOLD');
  setClock('2026-09-01T13:00:00.000Z');
  assert.equal((await service.getProduct(created.token, 'tree')).state.status, 'SOLD');
  await assert.rejects(service.reserve(created.token, 'tree'), (error) => error.code === 'product_busy');
  await assert.rejects(service.startCheckout(created.token, 'tree', 'https://qr2buy.com'), (error) => error.code === 'product_busy');
});

test('keeps a reserved one-unit tree blocked while other sessions start fresh', async () => {
  const { service, setClock } = harness();
  const first = await service.createSession();
  await service.reserve(first.token, 'tree');
  setClock('2026-09-01T13:00:00.000Z');
  assert.equal((await service.getProduct(first.token, 'tree')).state.status, 'RESERVED');
  assert.equal((await service.getProduct(first.token, 'tree')).state.resetAt, null);
  await assert.rejects(service.startCheckout(first.token, 'tree', 'https://qr2buy.com'), (error) => error.code === 'product_busy');

  const second = await service.createSession();
  assert.equal((await service.getProduct(second.token, 'tree')).state.status, 'READY');
});

test('sends at most one demo message from a verified paid Checkout Session', async () => {
  const address = 'person@example.test';
  const { service, mailTransport, broadcasts } = harness({ email: address });
  const created = await service.createSession();
  await service.startCheckout(created.token, 'bag', 'https://qr2buy.com');
  const event = paidEvent();
  assert.equal((await service.processWebhookEvent(event)).mailStatus, 'ACCEPTED');
  assert.equal((await service.processWebhookEvent(event)).duplicate, true);
  assert.equal((await service.processWebhookEvent(paidEvent({ id: 'evt_paid_second' }))).duplicate, true);
  assert.equal(mailTransport.messages.length, 1);

  const state = (await service.getProduct(created.token, 'bag')).state;
  assert.equal(state.status, 'PAID');
  assert.equal(state.mailStatus, 'ACCEPTED');
  assert.match(state.maskedEmail, /^p\*\*\*@e\*\*\*/);
  assert.doesNotMatch(JSON.stringify(broadcasts), new RegExp(address.replace('.', '\\.')));
  assert.doesNotMatch(JSON.stringify(broadcasts), /maskedEmail/);
});

test('never sends mail for unpaid or live events', async () => {
  const unpaid = harness({ email: 'person@example.test' });
  const created = await unpaid.service.createSession();
  await unpaid.service.startCheckout(created.token, 'bag', 'https://qr2buy.com');
  await unpaid.service.processWebhookEvent({
    id: 'evt_unpaid_mail', livemode: false, type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', payment_status: 'unpaid', metadata: { flow: 'qr2buy_demo', demoSessionId: '1', demoProductKey: 'bag' } } }
  });
  assert.equal(unpaid.mailTransport.messages.length, 0);
  await assert.rejects(
    unpaid.service.processWebhookEvent({ id: 'evt_live_mail', livemode: true, type: 'checkout.session.completed', data: { object: {} } }),
    (error) => error.code === 'live_event_rejected'
  );
  assert.equal(unpaid.mailTransport.messages.length, 0);
});

test('keeps PAID when demo mail delivery fails', async () => {
  const { service } = harness({ email: 'person@example.test', mailFailure: true });
  const created = await service.createSession();
  await service.startCheckout(created.token, 'bag', 'https://qr2buy.com');
  assert.equal((await service.processWebhookEvent(paidEvent())).mailStatus, 'FAILED');
  const state = (await service.getProduct(created.token, 'bag')).state;
  assert.equal(state.status, 'PAID');
  assert.equal(state.mailStatus, 'FAILED');
  assert.equal(state.maskedEmail, null);
});

test('marks the message and HTML receipt unmistakably as demo artifacts', () => {
  const message = buildDemoMail({
    product: { name: { de: 'Testprodukt' }, price: 24.9, currency: 'EUR' },
    demoOrderNumber: 'DEMO-20260901-ABC12345',
    demoDate: new Date('2026-09-01T12:00:00.000Z')
  });
  assert.equal(message.subject, '[DEMO] Deine qr2buy-Bestätigung – keine Abbuchung');
  assert.match(message.text, /DEMO-BELEG · KEINE ECHTE RECHNUNG · NICHT STEUERLICH GÜLTIG/);
  assert.match(message.html, /Keine Abbuchung/);
  assert.doesNotMatch(message.html, /tracking|pixel/i);
});

test('keeps SMTP unavailable until every TLS transport setting is present', async () => {
  const transport = createDemoMailTransport({ DEMO_MAIL_TRANSPORT: 'smtp', DEMO_SMTP_HOST: 'smtp.example.invalid' });
  assert.deepEqual(await transport.send({ to: 'person@example.test' }), { accepted: false, status: 'UNAVAILABLE' });
});

test('handles checkout failure, cancellation, invalid session and duplicate actions safely', async () => {
  const failing = harness({ stripeFailure: true });
  const created = await failing.service.createSession();
  await assert.rejects(
    failing.service.startCheckout(created.token, 'book', 'https://qr2buy.com'),
    (error) => error.code === 'checkout_unavailable'
  );
  assert.equal((await failing.service.getProduct(created.token, 'book')).state.status, 'READY');

  const normal = harness();
  const session = await normal.service.createSession();
  await normal.service.startCheckout(session.token, 'tree', 'https://qr2buy.com');
  assert.equal((await normal.service.cancelCheckout(session.token, 'tree')).session.products.find((item) => item.productKey === 'tree').status, 'CANCELLED');
  await assert.rejects(normal.service.getSnapshot('not-a-token'), (error) => error.code === 'invalid_session');
  await normal.service.reserve(session.token, 'book');
  await assert.rejects(normal.service.reserve(session.token, 'book'), (error) => error.code === 'product_busy');
});
