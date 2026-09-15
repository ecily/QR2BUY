import { test, expect } from '@playwright/test';
import { offerCopy } from '../src/pages/merchantOffer.js';

const offerId = 'b'.repeat(32);
const imageUrl = 'https://buyer-image.example.test/book.svg';
const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="640"><rect width="500" height="640" fill="#e8e4d9"/><rect x="115" y="55" width="270" height="510" rx="8" fill="#244a3f"/><text x="250" y="160" text-anchor="middle" font-family="serif" font-size="28" fill="#eee7ce">THE LORD</text><text x="250" y="200" text-anchor="middle" font-family="serif" font-size="28" fill="#eee7ce">OF THE RINGS</text><circle cx="250" cy="350" r="65" fill="none" stroke="#c8ad62" stroke-width="8"/></svg>';

for (const width of [320, 375, 390, 430]) for (const lang of ['de', 'en']) {
  test(`buyer experience ${lang} ${width}: image, disclosure, stock, pause, absent and broken images`, async ({ page }, testInfo) => {
    const t = offerCopy[lang], errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 850 });
    const description = 'A beautifully illustrated edition.\n\n' + 'Explore the world of Middle-earth and its stories. '.repeat(18);
    const data = { ok: true, publicOfferId: offerId,
      merchant: { displayName: 'ecily.com' }, location: { name: 'ecily – webentwicklung' },
      product: { name: 'Der Herr der Ringe', description, image: imageUrl, category: 'Books' },
      offer: { active: true, priceMinor: 1990, currency: 'EUR', stockQuantity: 2, purchasable: true, reservable: true },
      checkoutAvailable: false, reservationAvailable: false };
    let status = 200, broken = false;
    await page.route('https://buyer-image.example.test/**', route => broken
      ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ contentType: 'image/svg+xml', body: picture }));
    await page.route('**/api/**', route => {
      requests.push({ path: new URL(route.request().url()).pathname, method: route.request().method() });
      return route.fulfill({ status, json: status === 200 ? data : { ok: false } });
    });
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.goto(`/o/${offerId}?lang=${lang}`);
    await expect(page.getByRole('heading', { name: data.product.name })).toBeVisible();
    await expect(page.locator('.buyer-price')).toContainText(lang === 'de' ? '19,90' : '19.90');
    await expect(page.locator('.buyer-availability')).toHaveText(t.available);
    await expect(page.getByRole('img')).toBeVisible();
    await expect.poll(() => page.getByRole('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.buyer-description')).toContainText('A beautifully illustrated edition.');
    expect((await page.locator('.buyer-description').textContent()).length).toBeLessThanOrEqual(181);
    await expect(page.locator('.buyer-full-description')).toHaveCount(0);
    await noOverflow();
    if (width === 320 && lang === 'de') await page.screenshot({ path: testInfo.outputPath('buyer-320.png'), fullPage: true });
    const summary = page.locator('summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(summary).toHaveText(t.less);
    await expect(page.locator('.buyer-full-description')).toHaveText(description);
    await expect(page.locator('dl')).toContainText(t.merchant);
    await expect(page.locator('dl')).toContainText(t.location);
    await expect(page.locator('dl')).toContainText('Books');
    await expect(page.getByRole('img')).toHaveCount(2); await noOverflow();
    await summary.click(); await expect(summary).toHaveText(t.more);
    await expect(page.locator('.buyer-full-description')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    await expect(page.locator('.buyer-commerce')).toHaveText(t.checkout);
    for (const active of [true, false]) for (const stockQuantity of [0, 5]) {
      Object.assign(data.offer, { active, stockQuantity });
      await page.reload();
      await expect(page.locator('.buyer-availability')).toHaveText(!active ? t.paused : stockQuantity ? t.available : t.soldOut);
      await expect(page.getByRole('button')).toHaveCount(0); await noOverflow();
    }
    data.product.image = null; data.product.description = 'Short description.';
    data.product.name = 'VeryLongProductName'.repeat(12);
    data.offer.purchasable = false; data.offer.reservable = false;
    await page.reload();
    await expect(page.locator('.buyer-description')).toHaveText('Short description.');
    await expect(page.getByRole('img')).toHaveCount(0); await noOverflow();
    await summary.click(); await expect(page.locator('.buyer-full-description')).toHaveText('Short description.');
    await noOverflow();
    data.product.image = imageUrl; broken = true; data.product.description = null;
    await page.reload();
    await expect(page.getByRole('heading')).toHaveText(data.product.name);
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(page.locator('.buyer-description')).toHaveCount(0);
    await summary.click(); await expect(page.getByRole('img')).toHaveCount(0); await noOverflow();
    for (status of [404, 503]) {
      await page.reload(); await expect(page.getByRole('heading')).toHaveText(t.unavailable);
      await expect(page.locator('summary')).toHaveCount(0);
    }
    expect(requests.every(r => r.method === 'GET' && r.path === `/api/public/merchant-offers/${offerId}`)).toBe(true);
    expect(errors).toEqual([]);
  });
}
