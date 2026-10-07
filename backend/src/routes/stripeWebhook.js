import { Router } from 'express';
import { Product, Device, Order } from '../models.js';
import { createPurchaseService } from '../merchant/purchases.js';
import { DeviceApiError } from '../merchant/deviceCredentials.js';
import {
  constructLegacyWebhookEvent,
  createLegacyStripeClient,
  LegacyWebhookError,
  processLegacyWebhookEvent
} from '../stripe/legacyWebhook.js';

export function createStripeWebhookRouter({ stripeFactory = createLegacyStripeClient, merchantService = createPurchaseService(),
  webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET } = {}) {
const router = Router();

router.post('/webhook', async (req, res) => {
  const log = req.log || console;
  try {
    const stripe = stripeFactory();
    const event = constructLegacyWebhookEvent({
      stripe,
      rawBody: req.body,
      signature: req.headers['stripe-signature'],
      secret: webhookSecret()
    });
    const result = event.data?.object?.metadata?.flow === 'qr2buy_merchant'
      ? await merchantService.webhook(event)
      : await processLegacyWebhookEvent(event, { Product, Device, Order, log });
    return res.json({ received: true, ...result });
  } catch (error) {
    if (error instanceof DeviceApiError) {
      log.warn?.({ code: error.code }, '[stripe] merchant webhook rejected');
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    if (error instanceof LegacyWebhookError) {
      log.warn?.({ code: error.code }, '[stripe] legacy webhook rejected');
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    log.error?.({ code: 'webhook_processing_failed' }, '[stripe] webhook processing failed');
    return res.status(500).json({ ok: false, error: 'legacy_webhook_failed' });
  }
});

return router;
}
export default createStripeWebhookRouter();
