import { Router } from 'express';
import { ZodError } from 'zod';
import { createPurchaseService } from '../merchant/purchases.js';
import { DeviceApiError } from '../merchant/deviceCredentials.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

export function createPurchaseRouter({ service = createPurchaseService(), origin = process.env.PUBLIC_BASE_URL, limit = 10 } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  router.use((req, res, next) => Object.keys(req.query).length ? res.status(400).json({ ok: false, error: 'invalid_input' }) : next());
  router.use((req, res, next) => req.method === 'POST' && (!origin || req.get('origin') !== origin || !req.is('application/json'))
    ? res.status(403).json({ ok: false, error: 'request_rejected' }) : next());
  router.post('/offers/:id', createRateLimiter({ windowMs: 600000, max: limit }), async (req, res, next) => {
    try { res.status(201).json(await service.create(req.params.id, req.body)); } catch (e) { next(e); }
  });
  router.get('/:id', createRateLimiter({ windowMs: 60000, max: 60 }), async (req, res, next) => {
    try { res.json(await service.publicStatus(req.params.id)); } catch (e) { next(e); }
  });
  router.post('/:id/cancel', createRateLimiter({ windowMs: 60000, max: 10 }), async (req, res, next) => {
    try {
      if (Object.keys(req.body || {}).length) throw new DeviceApiError(400, 'invalid_input');
      res.json(await service.cancel(req.params.id));
    } catch (e) { next(e); }
  });
  router.use((e, _req, res, _next) => res.status(e instanceof DeviceApiError ? e.status : e instanceof ZodError ? 400 : 503)
    .json({ ok: false, error: e instanceof DeviceApiError ? e.code : e instanceof ZodError ? 'invalid_input' : 'checkout_unavailable' }));
  return router;
}
