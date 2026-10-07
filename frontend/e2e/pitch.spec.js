import { test, expect } from '@playwright/test';
import { purchaseText } from '../src/purchase.js';
import { reservationText } from '../src/reservation.js';
import { notifyText } from '../src/notify.js';
import { offerCopy } from '../src/pages/merchantOffer.js';

for (const width of [320, 375, 390, 430]) for (const lang of ['de', 'en']) {
  test(`pitch hierarchy and capability gates ${lang} ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    const id = 'c'.repeat(32), pt = purchaseText[lang], rt = reservationText[lang];
    const data = { ok: true, publicOfferId: id, merchant: { displayName: 'ecily.com' },
      location: { name: 'ecily - webentwicklung' }, product: { name: 'Der Herr der Ringe', description: 'A beautiful illustrated edition.' },
      offer: { active: true, priceMinor: 2990, currency: 'EUR', stockQuantity: 2, purchasable: true, reservable: true, reservationDuration: 30 },
      checkoutAvailable: true, reservationAvailable: true, notifyAvailable: false, availabilityState: 'READY' };
    await page.route('**/api/public/merchant-offers/**', route => route.fulfill({ json: data }));
    const position = selector => page.locator(selector).evaluate(el => el.getBoundingClientRect().top);
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`/o/${id}?lang=${lang}`);
    await expect(page.locator('.buyer-merchant')).toHaveText('ecily.com');
    await expect(page.locator('.buyer-brand')).toHaveCount(0);
    await expect(page.locator('.buyer-powered')).toHaveText('powered by qr2buy.com');
    await expect(page.locator('.buyer-convenience')).toHaveText(offerCopy[lang].noApp);
    await expect(page.getByRole('button', { name: pt.buy, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: rt.reserve, exact: true })).toBeVisible();
    await expect(page.locator('.buyer-testmode')).toHaveText(pt.test);
    for (const [before, after] of [['.buyer-merchant', 'h1'], ['h1', '.buyer-price'], ['.buyer-price', '.buyer-availability'],
      ['.buyer-availability', '.buyer-actions'], ['.buyer-actions', '.buyer-description'], ['.buyer-details', '.buyer-powered']]) {
      expect(await position(before)).toBeLessThan(await position(after));
    }
    await noOverflow();
    await page.screenshot({ path: testInfo.outputPath(`ready-${lang}-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: rt.reserve, exact: true }).click();
    await expect(page.locator('input[name=buyerName]')).toBeVisible(); await noOverflow();
    for (const state of ['SOLD', 'OUT_OF_STOCK', 'PAUSED', 'RESERVED', 'CHECKOUT_STARTED', 'PAID']) {
      Object.assign(data, { availabilityState: state, notifyAvailable: ['OUT_OF_STOCK', 'PAUSED', 'RESERVED'].includes(state) });
      Object.assign(data.offer, { active: state !== 'PAUSED', stockQuantity: 0, temporarilyReserved: state === 'RESERVED' });
      await page.reload();
      await expect(page.locator('.buyer-availability')).toHaveAttribute('data-state', state);
      await expect(page.getByRole('button', { name: pt.buy, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: rt.reserve, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: notifyText[lang].submit, exact: true })).toHaveCount(data.notifyAvailable ? 1 : 0);
      await noOverflow();
      if (width === 320) await page.screenshot({ path: testInfo.outputPath(`${state}-${lang}.png`), fullPage: true });
    }
    data.product.name = 'VeryLongProductName'.repeat(14); data.merchant.displayName = 'LongMerchantName'.repeat(12);
    await page.reload(); await expect(page.locator('h1')).toHaveText(data.product.name); await noOverflow();
  });
}
