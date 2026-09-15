import { Router } from 'express';
import { ZodError } from 'zod';
import { createReservationService } from '../merchant/reservations.js';
import { DeviceApiError } from '../merchant/deviceCredentials.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

export function createReservationRouter({ service = createReservationService(), origin = process.env.PUBLIC_BASE_URL,
  limit = 10 } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  router.use((req, res, next) => Object.keys(req.query).length ? res.status(400).json({ ok: false, error: 'invalid_input' }) : next());
  router.post('/offers/:id', createRateLimiter({ windowMs: 600000, max: limit }), async (req, res, next) => {
    try {
      if (!origin || req.get('origin') !== origin || !req.is('application/json')) return res.status(403).json({ ok: false, error: 'request_rejected' });
      res.status(201).json(await service.create(req.params.id, req.body));
    } catch (e) { next(e); }
  });
  router.get('/:id', createRateLimiter({ windowMs: 60000, max: 60 }), async (req, res, next) => {
    try { res.json(await service.publicStatus(req.params.id)); } catch (e) { next(e); }
  });
  router.use((e, _req, res, _next) => {
    res.status(e instanceof DeviceApiError ? e.status : e instanceof ZodError ? 400 : 503)
      .json({ ok: false, error: e instanceof DeviceApiError ? e.code : e instanceof ZodError ? 'invalid_input' : 'reservation_unavailable' });
  });
  return router;
}
