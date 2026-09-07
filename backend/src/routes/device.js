import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { createDeviceService } from '../merchant/deviceService.js';
import { DeviceApiError, validDeviceId } from '../merchant/deviceCredentials.js';

export function createDeviceRouter(service = createDeviceService()) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const ipLimit = createRateLimiter({ windowMs: 60_000, max: 180 });
  const deviceLimit = createRateLimiter({ windowMs: 60_000, max: 40, key: req => req.get('x-device-id') });
  router.get('/config', ipLimit, async (req, res) => {
    try {
      if (Object.keys(req.query).length || !validDeviceId(req.get('x-device-id'))) throw new DeviceApiError(401, 'device_unauthorized');
      const version = req.get('x-device-credential-version');
      if (!/^[1-9][0-9]{0,8}$/.test(version || '')) throw new DeviceApiError(401, 'device_unauthorized');
      const config = await service.config({ deviceId: req.get('x-device-id'), secret: req.get('x-device-secret'), version: Number(version) }, req.get('x-firmware-version'));
      return deviceLimit(req, res, () => res.json(config));
    } catch (error) {
      // Do not forward DB/crypto exceptions to the generic error logger.
      return res.status(error instanceof DeviceApiError ? error.status : 503)
        .json({ ok: false, error: error instanceof DeviceApiError ? error.code : 'device_unavailable' });
    }
  });
  return router;
}
export function createPublicOfferRouter(service = createDeviceService()) {
  const router = Router();
  router.get('/:publicOfferId', createRateLimiter({ windowMs: 60_000, max: 60 }), async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { return res.json(await service.publicOffer(req.params.publicOfferId)); }
    catch (error) { return res.status(error instanceof DeviceApiError ? error.status : 503).json({ ok: false, error: 'offer_unavailable' }); }
  });
  return router;
}
export default createDeviceRouter();
