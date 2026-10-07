import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { reservationFixture } from '../testing/reservationFixture.js';
import { MerchantOrder } from '../src/merchant/orderModel.js';
import { Offer } from '../src/merchant/models.js';
import { createPurchaseMailService, purchaseConfirmationMessage } from '../src/merchant/purchaseMail.js';
import { createAvailabilityMailTransport } from '../src/merchant/availabilityMail.js';
import { createDemoMailTransport } from '../src/demo/mail.js';
import { createStripeWebhookRouter } from '../src/routes/stripeWebhook.js';

test('purchase mail outbox: verified payment, single delivery, safe failure and scoped sales', { timeout:180000 }, async t => {
  const f = await reservationFixture(undefined, { purchases:true });
  const sdk = new Stripe('sk_test_fixture_only'), secret = 'whsec_fixture_only';
  const app = express(); app.use(express.raw({ type:'application/json' }));
  app.use('/api/stripe', createStripeWebhookRouter({ stripeFactory:()=>sdk, merchantService:f.purchase, webhookSecret:()=>secret }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const hook = 'http://127.0.0.1:' + server.address().port + '/api/stripe/webhook';
  const row = id => MerchantOrder.findOne({ orderId:id }).select('+buyerEmail');
  async function create(language = 'de') {
    const offer = await f.offer({ stockQuantity:2 });
    const result = await f.purchase.create(offer.publicOfferId, { requestKey:randomUUID(), quantity:1, language, testMode:true });
    const order = await MerchantOrder.findOne({ publicOrderId:result.order.publicOrderId });
    return { offer, order };
  }
  async function signed(event, signature) {
    const payload = JSON.stringify(event);
    return fetch(hook, { method:'POST', headers:{ 'Content-Type':'application/json', 'stripe-signature':signature || sdk.webhooks.generateTestHeaderString({ payload, secret }) }, body:payload });
  }
  async function paid(language = 'de', email = 'verified-buyer@example.test') {
    const { order } = await create(language);
    f.gateway.sessions.get(order.stripeSessionId).customer_details = { email };
    const event = f.gateway.event(order.stripeSessionId);
    assert.equal((await signed(event)).status, 200);
    return { order, event };
  }
  try {
    await t.test('browser return, even with paid Stripe session, does not queue or send a mail', async () => {
      const { order } = await create(); f.gateway.event(order.stripeSessionId);
      assert.equal((await f.purchase.publicStatus(order.publicOrderId)).order.status, 'CHECKOUT_STARTED');
      await f.purchaseMail.run(); assert.equal(f.messages.length, 0);
      assert.equal((await row(order.orderId)).buyerEmail, null);
    });
    await t.test('forged webhook and unpaid completion never produce mail', async () => {
      const { order } = await create(), event = f.gateway.event(order.stripeSessionId);
      assert.equal((await signed(event, 'invalid')).status, 400);
      f.gateway.sessions.get(order.stripeSessionId).payment_status = 'unpaid'; event.data.object.payment_status = 'unpaid';
      assert.equal((await signed(event)).status, 200);
      await f.purchaseMail.run(); assert.equal(f.messages.length, 0);
      assert.equal((await row(order.orderId)).status, 'CHECKOUT_STARTED');
    });
    for (const language of ['de', 'en']) await t.test(language + ' verified Stripe email and snapshots: concurrent webhooks / workers send exactly once', async () => {
      const { offer, order } = await create(language);
      const email = language + '-server@example.test';
      f.gateway.sessions.get(order.stripeSessionId).customer_details = { email };
      f.gateway.sessions.get(order.stripeSessionId).customer_email = 'fallback@example.test';
      const event = f.gateway.event(order.stripeSessionId);
      // The signed payload is still not the authority for the recipient.
      event.data.object.customer_details.email = 'payload@example.test';
      const responses = await Promise.all([signed(event), signed(event), signed({ ...event, id:event.id + '_other' })]);
      assert.deepEqual(responses.map(r => r.status), [200, 200, 200]);
      await Promise.all([f.purchaseMail.run(), f.purchaseMail.run(), f.purchaseMail.run()]);
      const messages = f.messages.filter(m => m.text.includes(order.publicOrderId)); assert.equal(messages.length, 1);
      const m = messages[0]; assert.equal(m.to, email); assert.match(m.subject, /qr2buy/);
      for (const value of [order.productName, order.merchantName, order.locationName, order.publicOrderId]) assert.ok(m.text.includes(value));
      assert.match(m.text, language === 'de' ? /BEZAHLT/ : /PAID/);
      assert.match(m.text, language === 'de' ? /19,90/ : /19.90/);
      assert.match(m.text, language === 'de' ? /keine Rechnung/ : /not an invoice/);
      assert.doesNotMatch(m.text, /newsletter|marketing|delivery|Lieferung|Abholung|pickup/i);
      assert.equal((await row(order.orderId)).mailStatus, 'SENT'); assert.equal((await row(order.orderId)).mailAttempts, 1);
      assert.ok((await row(order.orderId)).mailSentAt); assert.equal((await Offer.findOne({ offerId:offer.offerId })).stockQuantity, 1);
      await signed(event); await f.purchaseMail.run(); assert.equal(f.messages.filter(m => m.text.includes(order.publicOrderId)).length, 1);
      for (const view of [(await f.purchase.publicStatus(order.publicOrderId)).order, ...(await f.purchase.list('M0')).items, ...(await f.purchase.recentSales('M0')).items]) {
        for (const key of ['buyerEmail', 'mailStatus', 'mailAttempts', 'mailSentAt', 'paidEventId']) assert.equal(view[key], undefined);
      }
      assert.equal((await MerchantOrder.findOne({ orderId:order.orderId }).lean()).buyerEmail, undefined);
    });
    await t.test('Stripe customer_email is the validated fallback; missing email does not undo payment', async () => {
      const { order } = await create(); const s = f.gateway.sessions.get(order.stripeSessionId);
      s.customer_details = null; s.customer_email = 'fallback@example.test';
      await signed(f.gateway.event(s.id)); await f.purchaseMail.run();
      assert.equal(f.messages.find(m => m.text.includes(order.publicOrderId)).to, 'fallback@example.test');
      const noEmail = await paid('de', 'bad\r\nBcc: stolen@example.test');
      await f.purchaseMail.run(); const o = await row(noEmail.order.orderId);
      assert.equal(o.status, 'PAID'); assert.equal(o.mailStatus, 'FAILED'); assert.equal(o.mailAttempts, 0);
      assert.equal(f.messages.filter(m => m.text.includes(o.publicOrderId)).length, 0);
    });
    await t.test('cancelled and expired orders never send confirmation', async () => {
      const a = await create(), b = await create(); await f.purchase.cancel(a.order.publicOrderId);
      const event = f.gateway.event(b.order.stripeSessionId, 'checkout.session.expired'); await signed(event);
      await f.purchaseMail.run();
      for (const { order } of [a, b]) assert.equal(f.messages.filter(m => m.text.includes(order.publicOrderId)).length, 0);
    });
    await t.test('safe rejection backs off; duplicate webhook does not reset attempts; one accepted send', async () => {
      const { order, event } = await paid(); let sends = 0;
      const service = createPurchaseMailService({ now:f.now, transport:{ configured:true, async send() {
        if (++sends === 1) { const e = new Error('secret recipient@example.test'); e.retrySafe = true; throw e; }
        return { accepted:true };
      } } });
      await service.run(); assert.equal((await row(order.orderId)).mailStatus, 'NOT_SENT');
      await signed(event); await service.run(); assert.equal(sends, 1);
      await f.advance(120001); await service.run(); await service.run();
      assert.equal(sends, 2); assert.equal((await row(order.orderId)).mailStatus, 'SENT');
    });
    await t.test('unknown send outcome never retries, even after new event ID; operator logs contain no PII or secrets', async () => {
      const { order, event } = await paid(); let sends = 0; const logs = [];
      const service = createPurchaseMailService({ now:f.now, operatorLog:r=>logs.push(r), transport:{ configured:true, async send() {
        sends++; throw Error('sk_test_private whsec_private buyer@example.test');
      } } });
      await service.run(); assert.equal((await row(order.orderId)).mailStatus, 'UNCERTAIN');
      await signed({ ...event, id:event.id + '_retry' }); await f.advance(3600001); await service.run();
      assert.equal(sends, 1); assert.equal(logs.length, 1);
      assert.deepEqual(Object.keys(logs[0]).sort(), ['attempts', 'event', 'mailStatus', 'orderId']);
      assert.doesNotMatch(JSON.stringify(logs), /@|sk_test_|whsec_|private/);
    });
    await t.test('five safe rejections end FAILED and never restart', async () => {
      const { order, event } = await paid(); let sends = 0; const logs = [];
      const service = createPurchaseMailService({ now:f.now, operatorLog:r=>logs.push(r), transport:{ configured:true, async send() {
        sends++; const e = new Error('rejected'); e.retrySafe = true; throw e;
      } } });
      for (let i = 0; i < 5; i++) { await service.run(); await f.advance(3600001); }
      await signed(event); await service.run(); assert.equal(sends, 5);
      assert.equal((await row(order.orderId)).mailStatus, 'FAILED'); assert.equal(logs.length, 1);
    });
    await t.test('orphaned claim becomes UNCERTAIN; no automatic resend after process restart', async () => {
      const { order } = await paid(); let sends = 0;
      await MerchantOrder.updateOne({ orderId:order.orderId }, { $set:{ mailStatus:'SENDING', mailAttempts:1, mailClaimedAt:new Date(+f.now() - 61000) } });
      const service = createPurchaseMailService({ now:f.now, operatorLog:()=>{}, transport:{ configured:true, async send() { sends++; return { accepted:true }; } } });
      await service.run(); await service.run(); assert.equal(sends, 0); assert.equal((await row(order.orderId)).mailStatus, 'UNCERTAIN');
    });
    await t.test('DB failure after transport acceptance is UNCERTAIN, never a second send', async () => {
      const { order } = await paid(); let sends = 0, fail = true; const update = MerchantOrder.updateOne;
      const service = createPurchaseMailService({ now:f.now, operatorLog:()=>{}, transport:{ configured:true, async send() { sends++; return { accepted:true }; } } });
      MerchantOrder.updateOne = function(filter, change, ...args) {
        if (change.$set?.mailStatus === 'SENT' && fail) { fail = false; throw Error('database unavailable'); }
        return update.call(this, filter, change, ...args);
      };
      try { await service.run(); await service.run(); } finally { MerchantOrder.updateOne = update; }
      assert.equal(sends, 1); assert.equal((await row(order.orderId)).mailStatus, 'UNCERTAIN');
    });
    await t.test('disabled transport preserves outbox, later configured worker resumes', async () => {
      const { order } = await paid(); let sends = 0;
      await createPurchaseMailService({ now:f.now, transport:{ configured:false } }).run();
      assert.equal((await row(order.orderId)).mailAttempts, 0);
      await createPurchaseMailService({ now:f.now, transport:{ configured:true, async send() { sends++; return { accepted:true }; } } }).run();
      assert.equal(sends, 1); assert.equal((await row(order.orderId)).mailStatus, 'SENT');
    });
    await t.test('historical PAID without an outbox is never backfilled by worker or webhook retry', async () => {
      const { order, event } = await paid();
      await MerchantOrder.updateOne({ orderId:order.orderId }, { $unset:{ buyerEmail:1, mailStatus:1, mailNextAttemptAt:1, mailAttempts:1 } });
      await signed(event); await f.purchaseMail.run(); assert.equal(f.messages.filter(m => m.text.includes(order.publicOrderId)).length, 0);
    });
    await t.test('sales are paid-only, scoped, newest paidAt first with limit five, independent of creation date', async () => {
      const sales = await f.purchase.recentSales('M0'); assert.equal(sales.items.length, 5);
      assert.ok(sales.items.every(o => o.status === 'PAID'));
      for (let i = 1; i < sales.items.length; i++) assert.ok(+new Date(sales.items[i-1].paidAt) >= +new Date(sales.items[i].paidAt));
      assert.deepEqual((await f.purchase.recentSales('M1')).items, []);
      const { order } = await create(); await MerchantOrder.updateOne({ orderId:order.orderId }, { $set:{ status:'PAID', paidAt:new Date(+f.now() + 100000), merchantId:'M1' } });
      assert.equal((await f.purchase.recentSales('M0')).items.some(o=>o.publicOrderId===order.publicOrderId), false);
      assert.equal((await f.purchase.recentSales('M1')).items[0].publicOrderId, order.publicOrderId);
    });
  } finally { await new Promise(r => server.close(r)); await f.close(); }
});

test('purchase confirmation escapes snapshots and handles zero/three decimal currencies', () => {
  const order = { language:'en', currency:'JPY', unitPriceMinor:2000, productName:'<script>alert(1)</script>', merchantName:'M & Co', locationName:'L', publicOrderId:'a'.repeat(32) };
  let m = purchaseConfirmationMessage(order); assert.match(m.text, /2,000/); assert.doesNotMatch(m.html, /<script>/); assert.match(m.html, /M &amp; Co/);
  m = purchaseConfirmationMessage({ ...order, currency:'KWD', unitPriceMinor:12345 }); assert.match(m.text, /12.345/);
});

test('confirmation uses existing Graph MIME transport and explicit enable gate', async () => {
  const env = { MAIL_PROVIDER:'microsoft', MICROSOFT_TENANT_ID:'fixture', MICROSOFT_CLIENT_ID:'fixture', MICROSOFT_CLIENT_SECRET:'fixture', MAIL_FROM:'sender@example.test' };
  assert.equal(createAvailabilityMailTransport(env).configured, false);
  assert.equal(createAvailabilityMailTransport({ ...env, NOTIFY_MAIL_ENABLED:'true' }).configured, true);
  const requests = [], transport = createDemoMailTransport({ ...env, DEMO_MAIL_TRANSPORT:'microsoft' }, 'qr2buy', { fetchImpl:async (url, request) => {
    requests.push({ url, request }); return url.includes('oauth2') ? { ok:true, json:async()=>({ access_token:'fixture' }) } : { status:202 };
  } });
  const message = purchaseConfirmationMessage({ language:'de', currency:'EUR', unitPriceMinor:2000, productName:'Produkt', merchantName:'Merchant', locationName:'Location', publicOrderId:'b'.repeat(32) });
  assert.equal((await transport.send({ to:'verified@example.test', ...message })).accepted, true);
  const mime = Buffer.from(requests[1].request.body, 'base64').toString();
  assert.match(mime, /From: qr2buy <sender@example.test>/); assert.match(mime, /To: verified@example.test/);
  assert.ok(mime.includes(Buffer.from(message.subject).toString('base64')));
});
