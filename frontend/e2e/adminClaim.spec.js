import { test, expect } from '@playwright/test';

const root = '/api/binding/admin/claim-authorizations';
async function setup(page, { mode = 'ok', grant: initialGrant = null, rejectRead = false } = {}) {
  const writes = [], legacyWrites = []; let grant = initialGrant, lost = true;
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let json = { ok: true }, status = 200;
    if (path.startsWith(root)) {
      expect(req.headers()['authorization']).toBe('Basic '+btoa('synthetic-admin:synthetic-pass'));
      expect(req.headers()['x-qr2buy-admin-action']).toBe('claim-authorization');
      expect(new URL(req.url()).search).toBe('');
      if (req.method() === 'GET') {
        if (rejectRead) { status = 401; json = { error: 'unauthorized' }; }
        else json = { ok: true, serverNow: new Date().toISOString(), devices: [
          { deviceId: 'QR2B-000003', displayName: 'P3', canAuthorize: true, authorization: grant },
          { deviceId: 'QR2B-000004', displayName: 'Offline', canAuthorize: false, authorization: null }
        ], merchants: [{ merchantId: 'merchant-A', displayName: 'Merchant A' }, { merchantId: 'merchant-B', displayName: 'Merchant A' }] };
      } else {
        const body = req.postDataJSON(); writes.push({ path, body });
        expect(body.deviceId).toBe('QR2B-000003');
        if (path === root) {
          expect(body.merchantId).toBe('merchant-B'); expect(body.requestKey).toMatch(/^[a-f0-9]{32}$/);
          expect(Object.keys(body).sort()).toEqual(['deviceId','merchantId','requestKey']);
          if (mode === 'denied') { status = 429; json = { error: 'authorization_cooldown' }; }
          else {
            grant ||= { deviceId: body.deviceId, merchantId: body.merchantId, authorizationId: body.requestKey,
              status: 'AUTHORIZED', expiresAt: new Date(Date.now()+120000).toISOString(), nextIssueAt: new Date(Date.now()+600000).toISOString() };
            json = grant;
          }
        } else if (path === root+'/revoke') {
          expect(body.authorizationId).toBe(grant.authorizationId); grant = { ...grant, status: 'REVOKED' }; json = grant;
        } else throw Error('Unexpected admin mutation');
        if ((mode === 'lost' || (mode === 'lost-revoke' && path.endsWith('/revoke'))) && lost) { lost = false; await route.abort(); return; }
        if (mode === 'timeout' && lost) { lost = false; return; }
      }
    } else if (path === '/api/admin/products') {
      if (req.method() === 'POST') legacyWrites.push(req.postDataJSON());
      json = { products: [] };
    }
    else if (path === '/api/admin/devices') json = { devices: [] };
    else throw Error('Unexpected API request'); // No claim, product, credential or binding write allowed.
    await route.fulfill({ status, json });
  });
  await page.goto('/admin');
  await page.getByLabel('Adminbenutzer').fill('synthetic-admin');
  await page.getByLabel('Adminpasswort').fill('synthetic-pass');
  await page.getByRole('button', { name: 'Login setzen' }).click();
  const section = page.getByRole('region', { name: 'Schild für Händler freigeben' });
  return { section, writes, legacyWrites };
}
async function choose(section) {
  await section.getByLabel('Provisioniertes Schild').selectOption('QR2B-000003');
  await section.getByRole('combobox', { name: /Zielhändler/ }).selectOption('merchant-B');
  await section.getByRole('checkbox').check();
}

for (const width of [320, 1280]) test(`admin explicit issue/revoke ${width}: identity, no storage, no load mutation`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const { section, writes } = await setup(page);
  await expect(section.getByRole('button', { name: 'Freigabe bewusst bestätigen' })).toBeDisabled();
  await choose(section); expect(writes).toHaveLength(0);
  await expect(section).toContainText('merchant-B');
  await section.getByRole('button', { name: 'Freigabe bewusst bestätigen' }).click();
  await expect(section.getByRole('status')).toContainText('Sekunden');
  if (width === 320) await section.screenshot({path:'node_modules/.cache/admin-claim-mobile.png'});
  await expect(section.getByRole('button', { name: 'Freigabe bewusst bestätigen' })).toBeDisabled();
  expect(writes).toHaveLength(1);
  await section.getByRole('button', { name: 'Freigabe widerrufen' }).click();
  await expect(section.getByRole('status')).toHaveText('Freigabe widerrufen.');
  expect(writes).toHaveLength(2);
  expect(await page.evaluate(() => sessionStorage.getItem('adm_pass'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('adm_user'))).toBeNull();
  await expect(page.getByLabel('Adminpasswort')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Produkt anlegen' })).toBeVisible();
  await page.getByRole('button', { name: 'Admin abmelden' }).click();
  await expect(section).toHaveCount(0);
});

test('lost issue response freezes scope and retries identical key', async ({ page }) => {
  const { section, writes } = await setup(page, { mode: 'lost' }); await choose(section);
  await section.getByRole('button', { name: 'Freigabe bewusst bestätigen' }).click();
  await expect(section.getByRole('alert')).toContainText('Antwort unklar');
  await expect(section.getByRole('combobox', { name: /Zielhändler/ })).toBeDisabled();
  await section.getByRole('button', { name: 'Dieselbe Anfrage erneut prüfen' }).click();
  await expect(section.getByRole('status')).toContainText('Sekunden');
  expect(writes).toHaveLength(2); expect(writes[0]).toEqual(writes[1]);
});

test('lost issue response recovers with read-only refresh', async ({ page }) => {
  const { section, writes } = await setup(page, { mode: 'lost' }); await choose(section);
  await section.getByRole('button', { name: 'Freigabe bewusst bestätigen' }).click();
  await expect(section.getByRole('alert')).toContainText('Antwort unklar');
  await section.getByRole('button', { name: 'Freigabestatus aktualisieren' }).click();
  await expect(section.getByRole('status')).toContainText('Sekunden');
  await expect(section.getByRole('button', { name: 'Dieselbe Anfrage erneut prüfen' })).toHaveCount(0);
  expect(writes).toHaveLength(1);
});

test('existing grant, deadline and reload never automatically renew', async ({ page }) => {
  await page.clock.install();
  const grant = { deviceId: 'QR2B-000003', merchantId: 'merchant-B', authorizationId: 'a'.repeat(32), status: 'AUTHORIZED',
    expiresAt: new Date(Date.now()+120000).toISOString(), nextIssueAt: new Date(Date.now()+600000).toISOString() };
  const { section, writes } = await setup(page, { grant });
  await section.getByLabel('Provisioniertes Schild').selectOption('QR2B-000003');
  await expect(section.getByRole('button', { name: 'Freigabe widerrufen' })).toBeEnabled();
  await page.clock.fastForward(121000);
  await expect(section.getByRole('status')).toHaveText('Freigabe abgelaufen.');
  await expect(section.getByRole('button', { name: 'Freigabe widerrufen' })).toBeDisabled();
  await page.reload(); await expect(page.getByRole('region', { name: 'Schild für Händler freigeben' })).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test('lost revoke response recovers idempotently', async ({ page }) => {
  const { section, writes } = await setup(page, { mode: 'lost-revoke' }); await choose(section);
  await section.getByRole('button', { name: 'Freigabe bewusst bestätigen' }).click();
  await expect(section.getByRole('status')).toContainText('Sekunden');
  await section.getByRole('button', { name: 'Freigabe widerrufen' }).click();
  await expect(section.getByRole('alert')).toContainText('Antwort unklar');
  await section.getByRole('button', { name: 'Dieselbe Anfrage erneut prüfen' }).click();
  await expect(section.getByRole('status')).toHaveText('Freigabe widerrufen.');
  expect(writes).toHaveLength(3); expect(writes[1]).toEqual(writes[2]);
});

test('definitive rejection remains editable and offline device cannot issue', async ({ page }) => {
  const { section, writes } = await setup(page, { mode: 'denied' });
  await choose(section); await section.getByRole('button', { name: 'Freigabe bewusst bestätigen' }).click();
  await expect(section.getByRole('alert')).toContainText('zehn Minuten');
  await expect(section.getByRole('combobox', { name: /Zielhändler/ })).toBeEnabled();
  await section.getByLabel('Provisioniertes Schild').selectOption('QR2B-000004');
  await expect(section.getByRole('button', { name: 'Freigabe bewusst bestätigen' })).toBeDisabled();
  expect(writes).toHaveLength(1);
});

test('unauthorized read fails closed without issuing', async ({ page }) => {
  const { section, writes } = await setup(page, { rejectRead: true });
  await expect(section.getByRole('alert')).toContainText('Adminzugang abgelehnt');
  await expect(section.getByRole('button', { name: 'Freigabe bewusst bestätigen' })).toBeDisabled();
  expect(writes).toHaveLength(0);
});

test('request timeout recovers by reading committed status without another issue', async ({ page }) => {
  await page.clock.install();
  const { section, writes } = await setup(page, { mode: 'timeout' }); await choose(section);
  await section.getByRole('button', { name: 'Freigabe bewusst bestätigen' }).click();
  await expect.poll(() => writes.length).toBe(1);
  await page.clock.fastForward(11000);
  await expect(section.getByRole('alert')).toContainText('Antwort unklar');
  await section.getByRole('button', { name: 'Freigabestatus aktualisieren' }).click();
  await expect(section.getByRole('status')).toContainText('Sekunden');
  expect(writes).toHaveLength(1);
});

test('legacy product form still uses existing admin API and never issues authorization', async ({ page }) => {
  const { writes, legacyWrites } = await setup(page);
  const form = page.locator('section').filter({has:page.getByRole('heading',{name:'Produkt anlegen',exact:true})});
  await form.locator('input').nth(0).fill('Synthetic product');
  await form.locator('input').nth(1).fill('1.25');
  await form.getByRole('button',{name:'Anlegen',exact:true}).click();
  await expect.poll(() => legacyWrites.length).toBe(1);
  expect(legacyWrites[0]).toMatchObject({name:'Synthetic product',price:1.25,currency:'EUR'});
  expect(writes).toHaveLength(0);
});
