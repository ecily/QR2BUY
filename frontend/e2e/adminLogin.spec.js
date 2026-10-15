import { test, expect } from '@playwright/test';
import http from 'node:http';
import process from 'node:process';
import { basicAuth } from '../../backend/src/middleware/basicAuth.js';

test('real Basic challenge replays include; actual admin clients omit implicit auth and still send explicit credentials', async ({ browser }) => {
  const previous = { user: process.env.ADMIN_USER, pass: process.env.ADMIN_PASS };
  process.env.ADMIN_USER = 'synthetic-browser'; process.env.ADMIN_PASS = 'synthetic-password';
  const auth = basicAuth(), requests = [];
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith('/api/')) { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Isolated admin auth</title>'); return; }
    requests.push(req.headers.authorization === 'Basic '+btoa('synthetic-browser:synthetic-password') ? 'browser' : 'form');
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    auth(req, res, () => res.json({ ok: true, products: [], devices: [] }));
  });
  server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const context = await browser.newContext({ httpCredentials: { username: 'synthetic-browser', password: 'synthetic-password' } });
  try {
    const page = await context.newPage(); await page.goto('http://127.0.0.1:'+server.address().port);
    const baseline = await page.evaluate(async () => (await fetch('/api/admin/products', { credentials: 'include', headers: { Authorization: 'Basic '+btoa('synthetic-form:synthetic-wrong') } })).status);
    expect(baseline).toBe(401); expect(requests).toEqual(['form','form']);
    for (const method of ['adminListProducts','adminClaimRequest']) {
      requests.length = 0;
      const denied = await page.evaluate(async name => {
        const api = await import('http://127.0.0.1:5178/src/api.js');
        api.setAdminAuth('synthetic-form','synthetic-wrong');
        try { await api[name](); return {unexpected:true}; } catch (error) { return {status:error.status,message:error.message}; }
      }, method);
      expect(denied.status).toBe(401); expect(requests).toEqual(['form']);
      requests.length = 0;
      const accepted = await page.evaluate(async name => {
        const api = await import('http://127.0.0.1:5178/src/api.js');
        api.setAdminAuth('synthetic-browser','synthetic-password');
        return (await api[name]()).ok;
      }, method);
      expect(accepted).toBe(true); expect(requests).toEqual(['browser']);
    }
  } finally {
    await context.close(); await new Promise(resolve => server.close(resolve));
    if (previous.user === undefined) delete process.env.ADMIN_USER; else process.env.ADMIN_USER = previous.user;
    if (previous.pass === undefined) delete process.env.ADMIN_PASS; else process.env.ADMIN_PASS = previous.pass;
  }
});

async function login(page, mode) {
  const requests = []; let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    requests.push(path);
    expect(req.headers()['authorization']).toBe('Basic '+btoa('synthetic-admin:synthetic-pass'));
    if (path.endsWith('/options')) {
      if (mode === 'hold') await held;
      if (mode === 'timeout') return;
      if (mode === 'network') { await route.abort(); return; }
      if (mode === 'denied') { await route.fulfill({ status:401, headers:{'WWW-Authenticate':'Basic realm="Synthetic"'}, json:{error:'unauthorized'} }); return; }
      await route.fulfill({json:{ok:true,devices:[],merchants:[],serverNow:new Date().toISOString()}});
    } else if (path === '/api/admin/products') await route.fulfill({json:{products:[]}});
    else if (path === '/api/admin/devices') await route.fulfill({json:{devices:[]}});
    else throw Error('Unexpected request or mutation');
  });
  await page.goto('/admin');
  await page.getByLabel('Adminbenutzer').fill('synthetic-admin');
  await page.getByLabel('Adminpasswort').fill('synthetic-pass');
  await page.getByRole('button',{name:'Login setzen'}).click();
  return {requests,release};
}

test('green state waits for server; one verification, no duplicate or blank-password login', async ({ page }) => {
  const {requests,release} = await login(page,'hold');
  await expect(page.getByText('Adminzugang wird geprüft …')).toBeVisible();
  await expect(page.getByText('✓ Backendzugang bestätigt')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Login setzen'})).toBeDisabled();
  expect(requests).toEqual(['/api/binding/admin/claim-authorizations/options']);
  release();
  await expect(page.getByText('✓ Backendzugang bestätigt')).toBeVisible();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests.filter(p=>p.endsWith('/options'))).toHaveLength(1);
  await expect(page.getByLabel('Adminpasswort')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Login setzen'})).toBeDisabled();
});

for (const mode of ['denied','timeout','network']) test(`login ${mode}: never authenticated, no parallel legacy reads or automatic retries`, async ({ page }) => {
  if (mode==='timeout') await page.clock.install();
  const {requests} = await login(page,mode);
  if (mode==='timeout') { await expect.poll(()=>requests.length).toBe(1); await page.clock.fastForward(11000); }
  const message = mode==='denied' ? /Adminzugang abgelehnt \(HTTP 401\)/ : mode==='timeout' ? /Zeitlimit überschritten/ : /Netzwerkzugriff gescheitert/;
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByText('✓ Backendzugang bestätigt')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Schild für Händler freigeben'})).toHaveCount(0);
  expect(requests).toEqual(['/api/binding/admin/claim-authorizations/options']);
});
