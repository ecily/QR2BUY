import { Router } from 'express';
import { merchantDomainAuth } from './merchant.js';
import { createClaimAuthorizationService } from '../merchant/deviceClaims.js';
import { DeviceApiError } from '../merchant/deviceCredentials.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { readClaimAuthorizationOptions } from '../merchant/claimAuthorizationRead.js';

// Operator-only JSON API. Never mounted in the merchant session/role namespace.
export function createClaimAuthorizationRouter(service = createClaimAuthorizationService(), readOptions = readClaimAuthorizationOptions) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(createRateLimiter({ windowMs: 60_000, max: 15 }));
  router.use(merchantDomainAuth);
  router.use((req, res, next) => {
    if (Object.keys(req.query).length || req.get('x-qr2buy-admin-action') !== 'claim-authorization')
      return res.status(400).json({ ok: false, error: 'invalid_request' });
    // Basic credentials may be browser-cached. JSON + custom header + exact Origin prevent CSRF.
    if (req.get('origin') && req.get('origin') !== process.env.PUBLIC_BASE_URL)
      return res.status(403).json({ ok: false, error: 'origin_rejected' });
    if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({ ok: false, error: 'json_required' });
    next();
  });
  const handle = fn => async (req, res) => {
    try { res.json(await fn(process.env.ADMIN_USER, req.body)); }
    catch (error) { res.status(error instanceof DeviceApiError ? error.status : error.name === 'ZodError' ? 400 : 503)
      .json({ ok: false, error: error instanceof DeviceApiError ? error.code : 'authorization_unavailable' }); }
  };
  router.get('/options', handle(() => readOptions()));
  router.post('/', handle(service.issue));
  router.post('/revoke', handle(service.revoke));
  return router;
}
