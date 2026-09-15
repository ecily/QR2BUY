import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { ZodError } from 'zod';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { MerchantAccount, registerMerchant, publicAccount, loginSchema, verifyPassword, hashPassword } from '../merchant/accounts.js';
import { createMerchantSession, authenticateMerchant, csrf, csrfToken, saveSession, SESSION_MS } from '../merchant/session.js';
import { createBindingService } from '../merchant/binding.js';
import { DeviceApiError } from '../merchant/deviceCredentials.js';
import { createReservationService } from '../merchant/reservations.js';
import { listOffers } from '../merchant/portal.js';
import { Merchant, Location, MerchantProduct, Offer, DisplayAssignment, clean, profileSchema, locationSchema, productSchema, saveScoped, saveOffer, listDevices, renameDevice } from '../merchant/portal.js';

let dummyHash;
const handle = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
async function establish(req, account) {
  await new Promise((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
  req.session.accountId = account.accountId;
  req.session.authExpiresAt = Date.now() + SESSION_MS;
  csrfToken(req);
  await saveSession(req);
  await MerchantAccount.updateOne({ accountId: account.accountId }, { $set: { lastLoginAt: new Date() } });
}
export function createMerchantPortal(options = {}) {
  const router = Router(), auth = Router(), portal = Router();
  const config = createMerchantSession(options);
  const binding = options.binding || createBindingService();
  const reservations = options.reservations || createReservationService();
  router.use(['/merchant-auth','/merchant'], (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    req.merchantOrigin = config.origin;
    config.middleware(req, res, next);
  });
  auth.get('/csrf', createRateLimiter({ windowMs: 60000, max: 30 }), handle(async (req, res) => { const token = csrfToken(req); await saveSession(req); res.json({ ok: true, csrfToken: token }); }));
  auth.post('/register', createRateLimiter({ windowMs: 3600000, max: 10 }), csrf, handle(async (req, res) => {
    let account;
    try { account = await registerMerchant(req.body); }
    catch (e) { if (e.code === 11000) return res.status(400).json({ ok: false, error: 'registration_failed' }); throw e; }
    await establish(req, account);
    res.status(201).json({ ok: true, account: publicAccount(account), csrfToken: csrfToken(req) });
  }));
  auth.post('/login', createRateLimiter({ windowMs: 900000, max: 20 }), csrf, handle(async (req, res) => {
    const data = loginSchema.safeParse(req.body);
    if (!data.success) return res.status(401).json({ ok: false, error: 'login_failed' });
    const account = await MerchantAccount.findOne({ email: data.data.email }).select('+passwordHash');
    dummyHash ||= hashPassword(randomBytes(32).toString('hex'));
    const valid = await verifyPassword(account?.passwordHash || await dummyHash, data.data.password);
    if (!valid || account?.status !== 'ACTIVE' || account.role !== 'OWNER'
      || !await Merchant.exists({ merchantId: account.merchantId, status: 'ACTIVE' }))
      return res.status(401).json({ ok: false, error: 'login_failed' });
    await establish(req, account);
    res.json({ ok: true, account: publicAccount(account), csrfToken: csrfToken(req) });
  }));
  auth.post('/logout', csrf, handle(async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(e => e ? reject(e) : resolve()));
    res.clearCookie(config.name, config.cookieOptions); res.json({ ok: true });
  }));
  auth.get('/me', authenticateMerchant, (req, res) => res.json({ ok: true, account: publicAccount(req.merchantAuth.account), csrfToken: csrfToken(req) }));
  portal.use(authenticateMerchant, createRateLimiter({ windowMs: 60000, max: 120 }));
  portal.use((req, res, next) => {
    if (Object.keys(req.query).length) return res.status(400).json({ ok: false, error: 'invalid_request' });
    return ['GET','HEAD'].includes(req.method) ? next() : csrf(req, res, next);
  });
  portal.get('/me', (req, res) => res.json({ ok: true, merchant: clean(req.merchantAuth.merchant) }));
  portal.get('/reservations', handle(async (req, res) => res.json(await reservations.list(req.merchantAuth.merchantId))));
  portal.get('/reservations/:id', handle(async (req, res) => res.json(await reservations.detail(req.merchantAuth.merchantId, req.params.id))));
  for (const action of ['cancel','collect']) portal.post('/reservations/:id/'+action, handle(async (req, res) => {
    if (Object.keys(req.body || {}).length) throw new DeviceApiError(400, 'invalid_input');
    res.json(await reservations.action(req.merchantAuth.merchantId, req.params.id, action));
  }));
  portal.patch('/me', handle(async (req, res) => {
    const data = profileSchema.partial().parse(req.body);
    const merchant = await Merchant.findOneAndUpdate({ merchantId: req.merchantAuth.merchantId }, { $set: data }, { new: true, runValidators: true });
    res.json({ ok: true, merchant: clean(merchant) });
  }));
  for (const [path, Model, id, schema] of [['locations', Location, 'locationId', locationSchema], ['products', MerchantProduct, 'productId', productSchema]]) {
    portal.get('/'+path, handle(async (req, res) => res.json({ ok: true, items: (await Model.find({ merchantId: req.merchantAuth.merchantId }).sort({ createdAt: -1 }).lean()).map(clean) })));
    portal.get('/'+path+'/:id', handle(async (req, res) => {
      const item = await Model.findOne({ merchantId: req.merchantAuth.merchantId, [id]: req.params.id }).lean();
      if (!item) throw new DeviceApiError(404, 'not_found'); res.json({ ok: true, item: clean(item) });
    }));
    portal.post('/'+path, handle(async (req, res) => res.status(201).json({ ok: true, item: await saveScoped(Model, req.merchantAuth.merchantId, id, null, schema, req.body) })));
    portal.patch('/'+path+'/:id', handle(async (req, res) => res.json({ ok: true, item: await saveScoped(Model, req.merchantAuth.merchantId, id, req.params.id, schema, req.body) })));
  }
  portal.get('/offers', handle(async (req, res) => res.json({ ok: true, items: await listOffers(req.merchantAuth.merchantId) })));
  portal.post('/offers', handle(async (req, res) => res.status(201).json({ ok: true, item: await saveOffer(req.merchantAuth.merchantId, null, req.body) })));
  portal.patch('/offers/:id', handle(async (req, res) => res.json({ ok: true, item: await saveOffer(req.merchantAuth.merchantId, req.params.id, req.body) })));
  portal.get('/devices', handle(async (req, res) => res.json({ ok: true, items: await listDevices(req.merchantAuth.merchantId) })));
  portal.get('/devices/:id', handle(async (req, res) => {
    const device = (await listDevices(req.merchantAuth.merchantId)).find(d => d.deviceId === req.params.id);
    if (!device) throw new DeviceApiError(404, 'not_found'); res.json({ ok: true, item: device });
  }));
  portal.patch('/devices/:id', handle(async (req, res) => res.json({ ok: true, item: await renameDevice(req.merchantAuth.merchantId, req.params.id, req.body) })));
  portal.get('/display-assignments', handle(async (req, res) => res.json({ ok: true, items: (await DisplayAssignment.find({ merchantId: req.merchantAuth.merchantId }).select('-boundBy').lean()).map(clean) })));
  portal.get('/binding/devices/:deviceId', handle(async (req, res) => res.json(await binding.context(req.merchantAuth.merchantId, req.params.deviceId))));
  portal.post('/binding/devices/:deviceId/preview', handle(async (req, res) => res.json(await binding.start(req.merchantAuth.merchantId, req.params.deviceId, req.body || {}, req.merchantAuth.account.accountId))));
  for (const action of ['confirm','cancel']) portal.post('/binding/devices/:deviceId/'+action, handle(async (req, res) => res.json(await binding.finish(req.merchantAuth.merchantId, req.params.deviceId, { previewId: req.body?.previewId, code: req.body?.code, cancel: action === 'cancel' }))));
  router.use('/merchant-auth', auth); router.use('/merchant', portal);
  router.use(['/merchant-auth','/merchant'], (_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));
  router.use((e, _req, res, _next) => {
    const status = e instanceof DeviceApiError ? e.status : e instanceof ZodError || e.name === 'ValidationError' ? 400 : e.code === 11000 ? 409 : 503;
    const error = e instanceof DeviceApiError ? e.code : status === 400 ? 'invalid_input' : status === 409 ? 'value_conflict' : 'merchant_unavailable';
    res.status(status).json({ ok: false, error });
  });
  return router;
}
