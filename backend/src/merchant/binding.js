import mongoose from 'mongoose';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { DeviceApiError, validDeviceId } from './deviceCredentials.js';
import { ManagedDevice, Merchant, Location, DeviceMerchantAssignment, MerchantProduct, Offer, DisplayAssignment, BindingPreview } from './models.js';

export const PREVIEW_TTL_MS = 120_000;
const fail = (status, code) => { throw new DeviceApiError(status, code); };
export function bindingCode(preview, pepper = process.env.DEVICE_CREDENTIAL_PEPPER) {
  if (!/^[a-f0-9]{64}$/i.test(pepper || '')) fail(503, 'binding_unavailable');
  const h = createHmac('sha256', Buffer.from(pepper, 'hex')).update(`qr2buy-binding-v1\0${preview.deviceId}\0${preview.previewId}\0${preview.nonce}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}
export async function bindingTransaction(work) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); }
  finally { await session.endSession(); }
}
export async function bindingScope(merchantId, deviceId, at, session) {
  if (!merchantId || !validDeviceId(deviceId)) fail(404, 'device_not_found');
  const device = await ManagedDevice.findOne({ deviceId }).session(session).lean();
  const assignment = await DeviceMerchantAssignment.findOne({ deviceId, merchantId, status: 'ACTIVE', validFrom: { $lte: at }, $or: [{ validUntil: null }, { validUntil: { $gt: at } }] }).session(session).lean();
  if (!device || !assignment) fail(404, 'device_not_found');
  const merchant = await Merchant.findOne({ merchantId, status: 'ACTIVE' }).session(session).lean();
  const location = await Location.findOne({ locationId: assignment.locationId, merchantId, status: 'ACTIVE' }).session(session).lean();
  if (!merchant || !location || device.status !== 'ACTIVE') fail(409, 'device_unavailable');
  return { device, assignment, merchant, location };
}
async function lock(deviceId, session) {
  await ManagedDevice.updateOne({ deviceId }, { $inc: { bindingRevision: 1 } }, { session });
}
const phonePreview = p => ({ ok: true, previewId: p.previewId, expiresAt: p.expiresAt, product: { name: p.productName }, offer: { priceMinor: p.priceMinor, currency: p.currency }, status: p.status });

export function createBindingService({ now = () => new Date(), pepper = () => process.env.DEVICE_CREDENTIAL_PEPPER } = {}) {
  return {
    async publicDevice(deviceId) {
      if (!validDeviceId(deviceId)) fail(404, 'device_not_found');
      const d = await ManagedDevice.findOne({ deviceId }).lean();
      if (!d) fail(404, 'device_not_found');
      return { ok: true, deviceId, available: d.status === 'ACTIVE' };
    },
    async context(merchantId, deviceId) {
      return bindingTransaction(async session => {
        const { device, assignment } = await bindingScope(merchantId, deviceId, now(), session);
        const offers = await Offer.find({ merchantId, locationId: assignment.locationId, active: true }).session(session).lean();
        const products = await MerchantProduct.find({ merchantId, productId: { $in: offers.map(o => o.productId) }, status: 'ACTIVE' }).session(session).lean();
        return { ok: true, device: { deviceId, displayName: device.displayName }, products: products.filter(p => p.productBindingId).map(p => ({ name: p.name, productBindingId: p.productBindingId })) };
      });
    },
    async start(merchantId, deviceId, { method, value }, operator) {
      if (!['EAN', 'PRODUCT_CODE'].includes(method) || typeof value !== 'string'
          || !(method === 'EAN' ? /^(?:\d{8}|\d{12,14})$/ : /^[a-f0-9]{32}$/).test(value)) fail(400, 'invalid_product_code');
      return bindingTransaction(async session => {
        const at = now();
        const { device, assignment } = await bindingScope(merchantId, deviceId, at, session);
        if (!device.lastSeenAt || at - device.lastSeenAt > 120_000 || device.firmwareVersion !== '0.3.4') fail(409, 'device_update_required');
        await lock(deviceId, session);
        const matches = await MerchantProduct.find({ merchantId, status: 'ACTIVE', [method === 'EAN' ? 'ean' : 'productBindingId']: value }).session(session).lean();
        if (matches.length !== 1) fail(404, 'product_not_found');
        const product = matches[0];
        const offers = await Offer.find({ merchantId, locationId: assignment.locationId, productId: product.productId, active: true }).session(session).lean();
        if (offers.length !== 1) fail(409, 'offer_ambiguous');
        const offer = offers[0];
        if (Buffer.byteLength(product.name) > 256 || !Number.isSafeInteger(offer.priceMinor) || offer.priceMinor > 999999999 || offer.stockQuantity <= 0
            || !['EUR','USD','GBP','CHF','JPY','KWD','BHD'].includes(offer.currency)) fail(409, 'offer_unavailable');
        let pending = await DisplayAssignment.findOne({ deviceId, merchantId, locationId: assignment.locationId, productId: product.productId, offerId: offer.offerId, status: 'PENDING' }).session(session);
        if (!pending) [pending] = await DisplayAssignment.create([{ deviceId, merchantId, locationId: assignment.locationId, productId: product.productId, offerId: offer.offerId, status: 'PENDING', assignedAt: at, boundBy: operator }], { session });
        const p = { deviceId, merchantId, merchantAssignmentId: assignment._id, locationId: assignment.locationId, assignmentId: pending._id, productId: product.productId, offerId: offer.offerId,
          productName: product.name, priceMinor: offer.priceMinor, currency: offer.currency, verificationMethod: method === 'EAN' ? 'DEVICE_QR_AND_EAN' : 'DEVICE_QR_AND_PRODUCT_CODE',
          previewId: randomBytes(16).toString('hex'), nonce: randomBytes(32).toString('hex'), expiresAt: new Date(+at + PREVIEW_TTL_MS), status: 'PREVIEW', attempts: 0, confirmedAt: null, boundBy: operator };
        bindingCode(p, pepper()); // Fail closed before creating a preview if pepper is absent.
        await BindingPreview.findOneAndUpdate({ deviceId }, { $set: p }, { upsert: true, session, runValidators: true });
        return { ...phonePreview(p), device: { displayName: device.displayName } };
      });
    },
    async finish(merchantId, deviceId, { previewId, code, cancel = false }) {
      if (!/^[a-f0-9]{32}$/.test(previewId || '') || typeof cancel !== 'boolean') fail(400, 'invalid_preview');
      const result = await bindingTransaction(async session => {
        const at = now();
        const { device, assignment } = await bindingScope(merchantId, deviceId, at, session);
        await lock(deviceId, session);
        const p = await BindingPreview.findOne({ deviceId, merchantId, previewId }).select('+nonce').session(session).lean();
        if (!p || p.locationId !== assignment.locationId || String(p.merchantAssignmentId) !== String(assignment._id)) fail(404, 'preview_not_found');
        if (p.status === 'CONFIRMED' && !cancel) {
          const active = await DisplayAssignment.exists({ _id: p.assignmentId, deviceId, merchantId, status: 'ACTIVE' }).session(session);
          if (!active) fail(409, 'preview_finished');
          return { ok: true, status: 'ACTIVE' };
        }
        if (p.status === 'CANCELLED' && cancel) return { ok: true, status: 'CANCELLED' };
        if (p.status !== 'PREVIEW' || p.expiresAt <= at || p.attempts >= 5) fail(409, 'preview_expired');
        if (cancel) {
          await BindingPreview.updateOne({ deviceId, previewId }, { $set: { status: 'CANCELLED' } }, { session });
          return { ok: true, status: 'CANCELLED' };
        }
        if (typeof code !== 'string' || !/^\d{6}$/.test(code) || !timingSafeEqual(Buffer.from(code), Buffer.from(bindingCode(p, pepper())))) {
          await BindingPreview.updateOne({ deviceId, previewId }, { $inc: { attempts: 1 } }, { session });
          return { error: 'incorrect_display_code' }; // Commit attempt counter before returning 400.
        }
        if (!device.lastSeenAt || at - device.lastSeenAt > 120_000 || device.firmwareVersion !== '0.3.4') fail(409, 'device_update_required');
        const product = await MerchantProduct.findOne({ productId: p.productId, merchantId, status: 'ACTIVE' }).session(session).lean();
        const offer = await Offer.findOne({ offerId: p.offerId, productId: p.productId, merchantId, locationId: p.locationId, active: true }).session(session).lean();
        if (!product || !offer || product.name !== p.productName || offer.priceMinor !== p.priceMinor || offer.currency !== p.currency || offer.stockQuantity <= 0) fail(409, 'preview_changed');
        const pending = await DisplayAssignment.findOne({ _id: p.assignmentId, deviceId, merchantId, locationId: p.locationId, productId: p.productId, offerId: p.offerId, status: 'PENDING' }).session(session);
        if (!pending) fail(409, 'preview_changed');
        const previous = await DisplayAssignment.findOne({ deviceId, status: 'ACTIVE' }).session(session).lean();
        if (previous) {
          const previousOffer = await Offer.findOne({ offerId: previous.offerId }).session(session).lean();
          if (previousOffer && previousOffer.stockQuantity === 0) fail(409, 'commerce_in_progress');
        }
        await DisplayAssignment.updateMany({ deviceId, status: 'ACTIVE' }, { $set: { status: 'REPLACED', endedAt: at } }, { session });
        await DisplayAssignment.updateOne({ _id: pending._id, status: 'PENDING' }, { $set: { status: 'ACTIVE', verifiedAt: at, verificationMethod: p.verificationMethod, boundBy: p.boundBy } }, { session });
        await BindingPreview.updateOne({ deviceId, previewId }, { $set: { status: 'CONFIRMED', confirmedAt: at } }, { session });
        return { ok: true, status: 'ACTIVE' };
      });
      if (result.error) fail(400, result.error);
      return result;
    }
  };
}
