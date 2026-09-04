import { Router } from 'express';
import { Product, Device, Order } from '../models.js';
import {
  constructLegacyWebhookEvent,
  createLegacyStripeClient,
  LegacyWebhookError,
  processLegacyWebhookEvent
} from '../stripe/legacyWebhook.js';

const router = Router();

router.post('/webhook', async (req, res) => {
  const log = req.log || console;
  try {
    const stripe = createLegacyStripeClient();
    const event = constructLegacyWebhookEvent({
      stripe,
      rawBody: req.body,
      signature: req.headers['stripe-signature'],
      secret: process.env.STRIPE_WEBHOOK_SECRET
    });
    const result = await processLegacyWebhookEvent(event, { Product, Device, Order, log });
    return res.json({ received: true, ...result });
  } catch (error) {
    if (error instanceof LegacyWebhookError) {
      log.warn?.({ code: error.code }, '[stripe] legacy webhook rejected');
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    log.error?.({ err: error?.message }, '[stripe] legacy webhook processing failed');
    return res.status(500).json({ ok: false, error: 'legacy_webhook_failed' });
  }
});

export default router;
