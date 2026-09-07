import { Router } from 'express';
import { merchantDomainAuth } from './merchant.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { createBindingService } from '../merchant/binding.js';
import { DeviceApiError } from '../merchant/deviceCredentials.js';

// Permanent sticker entrypoint. Route /device to the backend in hosting ingress
// so an unknown physical ID has an actual HTTP 404, not a successful SPA shell.
export function createDeviceEntryRouter(service = createBindingService()) {
  const router = Router();
  router.use(createRateLimiter({ windowMs: 60_000, max: 60 }));
  router.get('/:deviceId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const device = await service.publicDevice(req.params.deviceId);
      if (device.available) return res.redirect(303, `/binding/${encodeURIComponent(device.deviceId)}`);
      return res.status(409).type('html').send('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width, initial-scale=1"><title>qr2buy</title><main><h1>Schild derzeit nicht verfügbar</h1><p>Display currently unavailable. Bitte den Operator kontaktieren.</p></main></html>');
    } catch (e) {
      return res.status(e instanceof DeviceApiError && e.status === 404 ? 404 : 503).type('html').send('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width, initial-scale=1"><title>qr2buy</title><main><h1>Schild nicht verfügbar</h1><p>Display not found or unavailable.</p></main></html>');
    }
  });
  return router;
}

export function createBindingRouter(service = createBindingService()) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(createRateLimiter({ windowMs: 60_000, max: 40 }));
  const handle = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { res.status(e instanceof DeviceApiError ? e.status : 503).json({ ok: false, error: e instanceof DeviceApiError ? e.code : 'binding_unavailable' }); }
  };
  router.get('/devices/:deviceId', handle(req => service.publicDevice(req.params.deviceId)));
  router.use('/operator', (req, res, next) => {
    // Scope comes only from server configuration, never URL/body or device lookup.
    if (!process.env.BINDING_OPERATOR_MERCHANT_ID) return res.status(503).json({ ok: false, error: 'operator_unavailable' });
    if (Object.keys(req.query).length) return res.status(400).json({ ok: false, error: 'invalid_request' });
    if (req.method !== 'GET') {
      const origin = req.get('origin');
      if (origin && origin !== process.env.PUBLIC_BASE_URL) return res.status(403).json({ ok: false, error: 'origin_rejected' });
      if (!req.is('application/json')) return res.status(415).json({ ok: false, error: 'json_required' });
    }
    return merchantDomainAuth(req, res, next);
  });
  const scope = () => process.env.BINDING_OPERATOR_MERCHANT_ID;
  router.get('/operator/devices/:deviceId', handle(req => service.context(scope(), req.params.deviceId)));
  router.post('/operator/devices/:deviceId/preview', handle(req => service.start(scope(), req.params.deviceId, req.body || {}, process.env.ADMIN_USER)));
  router.post('/operator/devices/:deviceId/confirm', handle(req => service.finish(scope(), req.params.deviceId, { previewId: req.body?.previewId, code: req.body?.code })));
  router.post('/operator/devices/:deviceId/cancel', handle(req => service.finish(scope(), req.params.deviceId, { previewId: req.body?.previewId, cancel: true })));
  return router;
}
export default createBindingRouter();
