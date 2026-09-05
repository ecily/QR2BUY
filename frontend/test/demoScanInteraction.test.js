import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { reportDemoScanOnce } from '../src/demoScanInteraction.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test('reports a validated QR interaction once during the transient window', async () => {
  const storage = memoryStorage();
  const calls = [];
  const report = async (...args) => {
    calls.push(args);
    return {
      interactionRecorded: true,
      session: { products: [{ productKey: 'tree', interactionExpiresAt: new Date(121_000).toISOString() }] }
    };
  };
  const input = { storage, token: 'session-token', productKey: 'tree', report, now: () => 1_000 };
  assert.deepEqual(await reportDemoScanOnce(input), { reported: true });
  assert.deepEqual(await reportDemoScanOnce(input), { reported: false });
  assert.deepEqual(calls, [['session-token', 'tree']]);
});

test('allows another product or a later scan and clears a failed optimistic marker', async () => {
  const storage = memoryStorage();
  const calls = [];
  const report = async (token, productKey) => {
    calls.push([token, productKey]);
    return {
      interactionRecorded: true,
      session: { products: [{ productKey, interactionExpiresAt: new Date(121_000).toISOString() }] }
    };
  };
  await reportDemoScanOnce({ storage, token: 'session-a', productKey: 'bag', report, now: () => 1_000 });
  await reportDemoScanOnce({ storage, token: 'session-a', productKey: 'tree', report, now: () => 1_001 });
  await reportDemoScanOnce({ storage, token: 'session-a', productKey: 'tree', report, now: () => 121_001 });
  await assert.rejects(reportDemoScanOnce({
    storage,
    token: 'session-b',
    productKey: 'book',
    report: async () => { throw new Error('offline'); },
    now: () => 20_000
  }));
  await reportDemoScanOnce({ storage, token: 'session-b', productKey: 'book', report, now: () => 20_001 });
  assert.deepEqual(calls, [
    ['session-a', 'bag'],
    ['session-a', 'tree'],
    ['session-a', 'tree'],
    ['session-b', 'book']
  ]);
});

test('uses the backend interaction expiry instead of a frontend TTL', async () => {
  const source = await readFile(new URL('../src/demoScanInteraction.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /SCAN_MARKER_TTL_MS|10_000|120_000/);
  assert.match(source, /Date\.parse\(state\?\.interactionExpiresAt/);

  const storage = memoryStorage();
  let calls = 0;
  const expiry = new Date(121_000).toISOString();
  const report = async () => {
    calls += 1;
    return {
      interactionRecorded: calls === 1,
      session: { products: [{ productKey: 'bag', interactionExpiresAt: expiry }] }
    };
  };
  await reportDemoScanOnce({ storage, token: 'session-token', productKey: 'bag', report, now: () => 1_000 });
  await reportDemoScanOnce({ storage, token: 'session-token', productKey: 'bag', report, now: () => 120_999 });
  assert.equal(calls, 1);
  await reportDemoScanOnce({ storage, token: 'session-token', productKey: 'bag', report, now: () => 121_001 });
  assert.equal(calls, 2);
});

test('does not let an interrupted pending request suppress future real scans forever', async () => {
  const storage = memoryStorage();
  storage.setItem('qr2buy_demo_scan_interaction', JSON.stringify({
    token: 'session-token', productKey: 'bag', pending: true, startedAt: 1_000
  }));
  let calls = 0;
  const report = async () => {
    calls += 1;
    return {
      interactionRecorded: true,
      session: { products: [{ productKey: 'bag', interactionExpiresAt: new Date(151_001).toISOString() }] }
    };
  };
  await reportDemoScanOnce({ storage, token: 'session-token', productKey: 'bag', report, now: () => 30_999 });
  assert.equal(calls, 0);
  await reportDemoScanOnce({ storage, token: 'session-token', productKey: 'bag', report, now: () => 31_001 });
  assert.equal(calls, 1);
});

test('mobile page validates product data before reporting only fragment-based QR opens', async () => {
  const page = await readFile(new URL('../src/pages/DemoProductPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/api.js', import.meta.url), 'utf8');
  assert.match(api, /POST.*products\/\$\{encodeURIComponent\(productKey\)\}\/interaction/);
  assert.match(page, /if \(!fragmentToken \|\| data\?\.product\?\.key !== productKey\) return;/);
  assert.match(page, /reportDemoScanOnce\(\{[\s\S]*report: reportDemoProductInteraction/);
});

test('mobile first screen prioritizes identity, actions and concise trust copy in DE and EN', async () => {
  const page = await readFile(new URL('../src/pages/DemoProductPage.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8');
  const identity = page.indexOf('demo-mobile-identity');
  const actions = page.indexOf('demo-commerce-actions');
  const details = page.lastIndexOf('demo-mobile-details');
  assert.ok(identity > 0 && actions > identity && details > actions);
  for (const phrase of [
    'Jetzt kaufen', 'Reservieren', 'Keine App nötig', 'Sichere Zahlung über Stripe',
    'Das Verkaufsschild bestätigt deinen Vorgang live', 'Buy now', 'Reserve',
    'No app required', 'Secure payment through Stripe', 'The sales display confirms your action live'
  ]) assert.ok(page.includes(phrase), `missing mobile copy: ${phrase}`);
  assert.match(css, /\.demo-mobile-card\s*\{[^}]*width:\s*min\(100%, 560px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*\.demo-product-visual\s*\{\s*min-height:\s*104px/);
  assert.match(css, /\.demo-commerce-button--stacked\s*\{[^}]*min-height:\s*58px/);
});
