import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shortDescription, productImage, offerAvailability, offerCopy } from '../src/pages/merchantOffer.js';
test('merchant offer has a separate route and cannot enter legacy or demo checkout', () => {
  const page=readFileSync(new URL('../src/pages/MerchantOfferPage.jsx',import.meta.url),'utf8');
  const routes=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.ok(routes.includes('/o/:publicOfferId'));assert.ok(routes.includes('/p/:shortId'));assert.ok(routes.includes('/demo/p/:productKey'));
  assert.ok(page.includes('/api/public/merchant-offers/'));assert.ok(page.includes('AbortController'));
  assert.ok(!page.includes('/api/checkout'));assert.ok(!page.includes('/api/demo'));assert.ok(page.includes('canReserve(data)'));
});

test('description previews preserve short text, paragraphs in source and Unicode boundaries', () => {
  assert.equal(shortDescription(null), '');
  assert.equal(shortDescription('  A short description.  '), 'A short description.');
  assert.equal(shortDescription('First paragraph.\n\nSecond paragraph.'), 'First paragraph. Second paragraph.');
  const long = 'A useful product description. '.repeat(20);
  assert.ok(shortDescription(long).length <= 181);
  assert.ok(shortDescription(long).endsWith('…'));
  assert.equal(shortDescription('😀'.repeat(181)), '😀'.repeat(180) + '…');
});

test('availability prioritizes pause over stock independently of commerce flags', () => {
  for (const purchasable of [true, false]) for (const reservable of [true, false]) {
    assert.equal(offerAvailability({active:true,stockQuantity:5,purchasable,reservable}), 'available');
    assert.equal(offerAvailability({active:true,stockQuantity:0,purchasable,reservable}), 'soldOut');
    for (const stockQuantity of [0,5]) assert.equal(offerAvailability({active:false,stockQuantity}), 'paused');
  }
  assert.deepEqual(Object.keys(offerCopy.de), Object.keys(offerCopy.en));
});

test('images allow HTTPS references without embedded credentials only', () => {
  assert.equal(productImage('https://example.test/book.jpg'), 'https://example.test/book.jpg');
  for (const value of [null, '', 'broken', 'data:image/png;base64,AA', 'javascript:alert(1)', 'http://example.test/a', 'https://user:pass@example.test/a']) {
    assert.equal(productImage(value), null);
  }
});
