import pino from 'pino';
import { MerchantOrder } from './orderModel.js';
import { createAvailabilityMailTransport } from './availabilityMail.js';

const logger = pino();
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export function purchaseConfirmationMessage(order) {
  const en = order.language === 'en';
  const price = new Intl.NumberFormat(order.language, { style:'currency', currency:order.currency });
  const amount = price.format(order.unitPriceMinor / 10 ** price.resolvedOptions().maximumFractionDigits);
  const subject = en ? 'qr2buy · Purchase confirmation (test mode)' : 'qr2buy · Kaufbestätigung (Testmodus)';
  const lines = [en ? 'Payment status: PAID (Stripe test mode)' : 'Zahlungsstatus: BEZAHLT (Stripe-Testmodus)',
    `${en ? 'Product' : 'Produkt'}: ${order.productName}`, `${en ? 'Price' : 'Preis'}: ${amount}`,
    `${en ? 'Merchant' : 'Händler'}: ${order.merchantName}`, `${en ? 'Location' : 'Standort'}: ${order.locationName}`,
    `${en ? 'Order number' : 'Bestellnummer'}: ${order.publicOrderId}`,
    en ? 'No real payment was charged. This is a test purchase confirmation, not an invoice.'
      : 'Es wurde kein echtes Geld abgebucht. Dies ist eine Testkaufbestätigung, keine Rechnung.'];
  // The order only snapshots a location name: no invented pickup times,
  // address, delivery promise or fulfillment claim.
  return { subject, text:['qr2buy', ...lines].join('\n'),
    html:'<!doctype html><html><body style="font-family:Arial,sans-serif;color:#183b32"><main style="max-width:620px;margin:auto;padding:24px">'
      + '<h1>qr2buy</h1><h2>' + escape(subject) + '</h2>' + lines.map(line => '<p>' + escape(line) + '</p>').join('') + '</main></body></html>' };
}

export function createPurchaseMailService({ transport, now = () => new Date(),
  operatorLog = record => logger.warn(record, 'purchase delivery requires review') } = {}) {
  // Reuse the configured Graph transport and its existing explicit mail switch.
  // Resolve lazily, after startup has loaded environment configuration.
  const mail = () => transport || createAvailabilityMailTransport();
  const log = (row, status) => operatorLog({ event:'purchase_delivery', orderId:row.orderId, mailStatus:status, attempts:row.mailAttempts });
  async function deliver(candidate, sender) {
    const at = now();
    const claimed = await MerchantOrder.findOneAndUpdate({ _id:candidate._id, status:'PAID', testMode:true,
      buyerEmail:{ $type:'string' }, mailStatus:'NOT_SENT', mailNextAttemptAt:{ $lte:at }, mailAttempts:{ $lt:5 } },
      { $set:{ mailStatus:'SENDING', mailClaimedAt:at }, $inc:{ mailAttempts:1 } }, { new:true }).select('+buyerEmail');
    if (!claimed) return;
    const claim = { _id:claimed._id, status:'PAID', mailStatus:'SENDING', mailClaimedAt:at, mailAttempts:claimed.mailAttempts };
    try {
      const result = await sender.send({ to:claimed.buyerEmail, ...purchaseConfirmationMessage(claimed) });
      if (!result.accepted) { const error = new Error('mail_unavailable'); error.retrySafe = true; throw error; }
      await MerchantOrder.updateOne(claim, { $set:{ mailStatus:'SENT', mailSentAt:now(), mailNextAttemptAt:null } });
    } catch (error) {
      // Graph sendMail is not idempotent: unknown acceptance (including a DB
      // failure after acceptance) must never cause another delivery attempt.
      const status = error.retrySafe === true ? (claimed.mailAttempts >= 5 ? 'FAILED' : 'NOT_SENT') : 'UNCERTAIN';
      const result = await MerchantOrder.updateOne(claim, { $set:{ mailStatus:status,
        mailNextAttemptAt:status === 'NOT_SENT' ? new Date(+now() + Math.min(3600000, 60000 * 2 ** claimed.mailAttempts)) : null } });
      if (result.modifiedCount && ['FAILED', 'UNCERTAIN'].includes(status)) log(claimed, status);
    }
  }
  return { async run() {
    const at = now();
    const stale = await MerchantOrder.find({ status:'PAID', mailStatus:'SENDING', mailClaimedAt:{ $lte:new Date(+at - 60000) } }).lean();
    for (const row of stale) {
      const result = await MerchantOrder.updateOne({ _id:row._id, mailStatus:'SENDING', mailClaimedAt:row.mailClaimedAt, mailAttempts:row.mailAttempts },
        { $set:{ mailStatus:'UNCERTAIN', mailNextAttemptAt:null } });
      if (result.modifiedCount) log(row, 'UNCERTAIN');
    }
    const sender = mail();
    if (sender.configured !== true) return;
    const candidates = await MerchantOrder.find({ status:'PAID', testMode:true, buyerEmail:{ $type:'string' },
      mailStatus:'NOT_SENT', mailNextAttemptAt:{ $lte:at }, mailAttempts:{ $lt:5 } }).sort({ mailNextAttemptAt:1 }).limit(100).lean();
    for (const candidate of candidates) await deliver(candidate, sender);
  } };
}

export function startPurchaseMailDelivery(onError = () => {}, intervalMs = 30000) {
  const service = createPurchaseMailService(); let busy = false;
  const run = async () => { if (busy) return; busy = true; try { await service.run(); } catch { onError(); } finally { busy = false; } };
  const timer = setInterval(run, intervalMs); timer.unref(); void run(); return () => clearInterval(timer);
}
