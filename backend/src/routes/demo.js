import { Router } from 'express';
import { createDemoService, createStripeDemoClient, constructDemoWebhookEvent, DemoError } from '../demo/service.js';
import { createMongooseDemoRepository } from '../demo/repository.js';
import { broadcastDemoSnapshot, registerDemoSse } from '../demo/events.js';
import {
  createDemoHardwareBindingService,
  createMongooseDemoHardwareRepository,
  DemoHardwareError
} from '../demo/hardwareBinding.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = Router();
const repository = createMongooseDemoRepository();
const service = createDemoService({ repository, broadcast: broadcastDemoSnapshot });
const hardwareRepository = createMongooseDemoHardwareRepository();
const hardwareService = createDemoHardwareBindingService({
  repository: hardwareRepository,
  demoService: service
});

const createSessionLimit = createRateLimiter({ windowMs: 60_000, max: 20 });
const actionLimit = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  key: (req) => `${req.ip}:${req.params.token || 'new'}`
});
const hardwareBindingLimit = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  key: (req) => `${req.ip}:${req.body?.deviceId || 'unknown'}`
});
const hardwarePollingLimit = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  key: (req) => `${req.ip}:${req.query?.deviceId || 'unknown'}`
});

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function baseUrls(req) {
  const configured = process.env.DEMO_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL;
  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  return configured ? [configured, requestOrigin] : [requestOrigin];
}

function sendError(res, error) {
  if (error instanceof DemoError || error instanceof DemoHardwareError) {
    return res.status(error.status).json({ ok: false, error: error.code });
  }
  reqLog(res)?.error?.({ err: error?.message }, '[demo] request failed');
  return res.status(500).json({ ok: false, error: 'demo_unavailable' });
}

function reqLog(res) {
  return res.req?.log || console;
}

router.post('/sessions', createSessionLimit, async (_req, res) => {
  try {
    return res.status(201).json(await service.createSession());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/sessions/:token', actionLimit, async (req, res) => {
  try {
    return res.json(await service.getSnapshot(req.params.token));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/sessions/:token/hardware-binding', hardwareBindingLimit, async (req, res) => {
  try {
    return res.status(201).json(await hardwareService.bind({
      token: req.params.token,
      deviceId: req.body?.deviceId,
      productKey: req.body?.productKey,
      locale: req.body?.locale,
      pairingSecret: req.header('x-demo-pairing-secret'),
      baseUrls: baseUrls(req)
    }));
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/sessions/:token/hardware-binding', hardwareBindingLimit, async (req, res) => {
  try {
    return res.json(await hardwareService.update({
      token: req.params.token,
      deviceId: req.body?.deviceId,
      productKey: req.body?.productKey,
      locale: req.body?.locale,
      baseUrls: baseUrls(req)
    }));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/hardware/config', hardwarePollingLimit, async (req, res) => {
  try {
    return res.json(await hardwareService.getConfig({
      deviceId: req.query?.deviceId,
      deviceSecret: req.header('x-device-secret'),
      baseUrls: baseUrls(req)
    }));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/sessions/:token/products/:productKey', actionLimit, async (req, res) => {
  try {
    return res.json(await service.getProduct(req.params.token, req.params.productKey));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/sessions/:token/products/:productKey/reserve', actionLimit, async (req, res) => {
  try {
    return res.json(await service.reserve(req.params.token, req.params.productKey));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/sessions/:token/products/:productKey/checkout', actionLimit, async (req, res) => {
  try {
    return res.status(201).json(
      await service.startCheckout(req.params.token, req.params.productKey, baseUrls(req), req.body?.locale)
    );
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/sessions/:token/products/:productKey/cancel', actionLimit, async (req, res) => {
  try {
    return res.json(await service.cancelCheckout(req.params.token, req.params.productKey));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/sessions/:token/events', actionLimit, async (req, res) => {
  try {
    const snapshot = await service.getSnapshot(req.params.token);
    const tokenHash = service.tokenHashFor(req.params.token);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    registerDemoSse(tokenHash, res, snapshot);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/stripe/webhook', async (req, res) => {
  try {
    const stripe = createStripeDemoClient();
    const event = constructDemoWebhookEvent({
      stripe,
      rawBody: req.body,
      signature: req.headers['stripe-signature'],
      secret: process.env.STRIPE_DEMO_WEBHOOK_SECRET
    });
    const result = await service.processWebhookEvent(event);
    return res.json({ received: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
