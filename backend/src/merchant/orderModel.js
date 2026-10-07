import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  publicOrderId: { type: String, required: true, unique: true },
  merchantId: { type: String, required: true, index: true },
  locationId: { type: String, required: true },
  productId: { type: String, required: true },
  offerId: { type: String, required: true },
  publicOfferId: { type: String, required: true },
  productName: { type: String, required: true },
  merchantName: { type: String, required: true },
  locationName: { type: String, required: true },
  quantity: { type: Number, required: true, enum: [1] },
  unitPriceMinor: { type: Number, required: true },
  currency: { type: String, required: true },
  language: { type: String, enum: ['de', 'en'], required: true },
  returnOrigin: { type: String, required: true, select: false },
  requestKey: { type: String, required: true, select: false },
  requestHash: { type: String, required: true, select: false },
  status: { type: String, required: true, enum: ['CHECKOUT_STARTED', 'PAID', 'CANCELLED', 'EXPIRED'] },
  stripeSessionId: { type: String, default: null },
  checkoutUrl: { type: String, default: null, select: false },
  paymentIntentId: { type: String, default: null, select: false },
  paidEventId: { type: String, default: null, select: false },
  buyerEmail: { type: String, default: null, select: false },
  mailStatus: { type: String, enum: ['NOT_SENT', 'SENDING', 'SENT', 'FAILED', 'UNCERTAIN'], default: 'NOT_SENT' },
  mailAttempts: { type: Number, default: 0 },
  mailClaimedAt: { type: Date, default: null },
  mailNextAttemptAt: { type: Date, default: null },
  mailSentAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  paidAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  testMode: { type: Boolean, required: true, enum: [true] }
}, { timestamps: true, collection: 'merchant_orders' });
schema.index({ offerId: 1, requestKey: 1 }, { unique: true });
schema.index({ stripeSessionId: 1 }, { unique: true, partialFilterExpression: { stripeSessionId: { $type: 'string' } } });
schema.index({ offerId: 1, status: 1 });
schema.index({ status: 1, expiresAt: 1 });
schema.index({ merchantId: 1, createdAt: -1 });
schema.index({ merchantId: 1, status: 1, paidAt: -1 });
schema.index({ status: 1, mailStatus: 1, mailNextAttemptAt: 1 });
export const MerchantOrder = mongoose.models.MerchantOrder || mongoose.model('MerchantOrder', schema);
