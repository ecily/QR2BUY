import { test, expect } from '@playwright/test';
import { purchaseText } from '../src/purchase.js';
const fixture = 'http://127.0.0.1:3001', origin = 'http://127.0.0.1:5178';
for (const width of [320, 375, 390, 430]) for (const lang of ['de', 'en']) test(`merchant test purchase ${lang} ${width}`, async ({ page, request }) => {
  const t = purchaseText[lang], o = await (await request.post(fixture + '/__test__/purchase/offer', { data: { stockQuantity: 2 } })).json();
  await page.setViewportSize({ width, height: 850 });
  let checkout;
  await page.route('https://checkout.stripe.com/**', async route => {
    checkout = route.request().url();
    await route.fulfill({ contentType: 'text/html', body: '<html><body>Isolated Stripe test checkout</body></html>' });
  });
  let order;
  await page.route('**/api/purchases/offers/**', async route => {
    const response = await route.fetch(); order = (await response.json()).order;
    await route.fulfill({ response });
  });
  await page.goto('/o/' + o.publicOfferId + '?lang=' + lang);
  await expect(page.getByRole('button', { name: t.buy, exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText(t.test);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: t.buy, exact: true }).click();
  await expect(page).toHaveURL(/https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_fixture_/);
  expect(checkout).toBeTruthy(); await expect.poll(() => order?.publicOrderId).toMatch(/^[a-f0-9]{32}$/);
  await page.goto(origin + '/buy/' + order.publicOrderId + '?lang=' + lang);
  await expect(page.getByRole('heading', { name: t.CHECKOUT_STARTED, exact: true })).toBeVisible();
  await request.post(fixture + '/__test__/purchase/' + order.publicOrderId + '/paid');
  await expect(page.getByRole('heading', { name: t.PAID, exact: true })).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/merchant/orders?lang=' + lang);
  await page.locator('input[type=email]').fill('merchant0@example.test');
  await page.locator('input[type=password]').fill('Reservation-test-only-123!');
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/merchant\/orders/);
  const item = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Reservation product ' + o.productId.slice(1), exact: true }) });
  await expect(item).toContainText(t.PAID); await expect(item).toContainText(order.publicOrderId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('cancel return releases hold via server; unavailable offers never expose buy CTA', async ({ page, request }) => {
  const t = purchaseText.en, o = await (await request.post(fixture + '/__test__/purchase/offer', { data: { stockQuantity: 1 } })).json();
  const r = await request.post(fixture + '/api/purchases/offers/' + o.publicOfferId, { headers: { origin }, data: { requestKey: crypto.randomUUID(), quantity: 1, language: 'en', testMode: true } });
  const order = (await r.json()).order;
  await page.goto('/buy/' + order.publicOrderId + '?lang=en&cancel=1');
  await expect(page.getByRole('heading', { name: t.CANCELLED, exact: true })).toBeVisible();
  await page.goto('/o/' + o.publicOfferId + '?lang=en'); await expect(page.getByRole('button', { name: t.buy, exact: true })).toBeVisible();
  for (const fields of [{ stockQuantity: 0 }, { active: false }, { purchasable: false }]) {
    const unavailable = await (await request.post(fixture + '/__test__/purchase/offer', { data: fields })).json();
    await page.goto('/o/' + unavailable.publicOfferId + '?lang=en'); await expect(page.locator('.buyer-product')).toBeVisible();
    await expect(page.getByRole('button', { name: t.buy, exact: true })).toHaveCount(0);
  }
});
