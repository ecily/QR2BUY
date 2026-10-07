import test from 'node:test';
import assert from 'node:assert/strict';
import { canBuy, stripeCheckoutUrl, purchaseText } from '../src/purchase.js';
test('purchase CTA requires actual backend capability and available offer', () => {
  const d = { checkoutAvailable: true, availabilityState: 'READY', offer: { active: true, purchasable: true, stockQuantity: 1 } };
  assert.equal(canBuy(d), true);
  for (const patch of [{ checkoutAvailable: false }, { checkoutAvailable: undefined }, ...['CHECKOUT_STARTED', 'PAID', 'SOLD', 'PAUSED', 'RESERVED', 'OUT_OF_STOCK'].map(availabilityState => ({ availabilityState }))]) assert.equal(canBuy({ ...d, ...patch }), false);
  for (const patch of [{ active: false }, { purchasable: false }, { stockQuantity: 0 }]) assert.equal(canBuy({ ...d, offer: { ...d.offer, ...patch } }), false);
});
test('checkout redirects allow only authentic HTTPS Stripe host', () => {
  assert.equal(stripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_fixture'), true);
  for (const v of ['http://checkout.stripe.com', 'https://checkout.stripe.com.evil.test', 'https://evil.test/checkout.stripe.com', 'javascript:alert(1)', 'https://user:pass@checkout.stripe.com', '/buy/test', null]) assert.equal(stripeCheckoutUrl(v), false);
});
test('DE/EN purchase copy explicitly labels test mode and four terminal/pending states', () => {
  for (const t of Object.values(purchaseText)) for (const key of ['buy', 'test', 'CHECKOUT_STARTED', 'PAID', 'CANCELLED', 'EXPIRED', 'orders']) assert.ok(t[key]);
});
