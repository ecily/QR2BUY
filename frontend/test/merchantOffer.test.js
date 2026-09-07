import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('merchant offer has a separate read-only route and cannot enter legacy or demo checkout', () => {
  const page=readFileSync(new URL('../src/pages/MerchantOfferPage.jsx',import.meta.url),'utf8');
  const routes=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.ok(routes.includes('/o/:publicOfferId'));assert.ok(routes.includes('/p/:shortId'));assert.ok(routes.includes('/demo/p/:productKey'));
  assert.ok(page.includes('/api/public/merchant-offers/'));assert.ok(page.includes('AbortController'));
  assert.ok(!page.includes('/api/checkout'));assert.ok(!page.includes('/api/demo'));assert.ok(!page.includes('<button'));
});
