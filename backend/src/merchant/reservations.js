import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { MerchantReservation, Merchant, Location, MerchantProduct, Offer } from './models.js';
import { reservedQuantity, expireReservations } from './inventory.js';
import { DeviceApiError } from './deviceCredentials.js';

const optional = schema => z.preprocess(v => typeof v === 'string' ? v.trim() : v,
  z.union([z.literal(''), schema]).transform(v => v || null).nullable().optional());
export const reservationInput = z.object({
  buyerName: z.string().trim().min(1).max(120),
  buyerEmail: optional(z.string().trim().email().max(254)),
  buyerPhone: optional(z.string().trim().max(40).regex(/^\+?[0-9 ()-]+$/).refine(v => { const n = v.replace(/\D/g, '').length; return n >= 7 && n <= 15; })),
  buyerNote: optional(z.string().trim().max(1000)),
  quantity: z.literal(1).default(1),
  requestKey: z.string().uuid()
}).strict().refine(v => v.buyerEmail || v.buyerPhone, { message: 'contact_required' });
const fail = (status, code) => { throw new DeviceApiError(status, code); };
const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
const effectiveStatus = (r, at) => r.status === 'RESERVED' && new Date(r.expiresAt) <= at ? 'EXPIRED' : r.status;
export function reservationView(r, at = new Date(), merchant = false) {
  const result = { publicReservationId: r.publicReservationId, productName: r.productName, merchantName: r.merchantName,
    locationName: r.locationName, quantity: r.quantity, unitPriceMinor: r.unitPriceMinor, totalPriceMinor: r.totalPriceMinor,
    currency: r.currency, status: effectiveStatus(r, at), createdAt: r.createdAt, expiresAt: r.expiresAt,
    confirmedAt: r.confirmedAt, cancelledAt: r.cancelledAt, collectedAt: r.collectedAt };
  if (merchant) Object.assign(result, { reservationId: r.reservationId, buyerName: r.buyerName, buyerEmail: r.buyerEmail,
    buyerPhone: r.buyerPhone, buyerNote: r.buyerNote, source: r.source });
  return result;
}
async function transaction(work) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); }
  finally { await session.endSession(); }
}
export function createReservationService({ now = () => new Date() } = {}) {
  return {
    async create(publicOfferId, input) {
      if (!validId(publicOfferId)) fail(404, 'offer_not_found');
      const data = reservationInput.parse(input);
      const requestHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      return transaction(async session => {
        // Every contender writes the same offer first. Mongo retries write conflicts
        // with a fresh snapshot before counting holds; two buyers cannot take the last unit.
        const offer = await Offer.findOneAndUpdate({ publicOfferId }, { $inc: { reservationRevision: 1 } }, { session, new: true });
        if (!offer) fail(404, 'offer_not_found');
        const previous = await MerchantReservation.findOne({ offerId: offer.offerId, requestKey: data.requestKey }).select('+requestHash').session(session);
        const at = now();
        if (previous) {
          if (previous.requestHash !== requestHash) fail(409, 'request_conflict');
          return { ok: true, reservation: reservationView(previous, at) };
        }
        const merchant = await Merchant.findOne({ merchantId: offer.merchantId, status: 'ACTIVE' }).session(session);
        const location = await Location.findOne({ merchantId: offer.merchantId, locationId: offer.locationId, status: 'ACTIVE' }).session(session);
        const product = await MerchantProduct.findOne({ merchantId: offer.merchantId, productId: offer.productId, status: 'ACTIVE' }).session(session);
        if (!merchant || !location || !product) fail(404, 'offer_not_found');
        if (!offer.active || !offer.reservable || offer.inventorySource !== 'QR2BUY') fail(409, 'reservation_unavailable');
        if (!Number.isSafeInteger(offer.priceMinor) || offer.priceMinor < 0 || offer.priceMinor > 999999999
          || !['EUR','USD','GBP','CHF','JPY','KWD','BHD'].includes(offer.currency)) fail(409, 'reservation_unavailable');
        if (offer.stockQuantity - await reservedQuantity(offer.offerId, at, session) < 1) fail(409, 'out_of_stock');
        const duration = offer.reservationDuration ?? 30;
        if (!Number.isInteger(duration) || duration < 1 || duration > 525600) fail(409, 'reservation_unavailable');
        const [reservation] = await MerchantReservation.create([{ ...data, requestHash,
          reservationId: randomUUID(), publicReservationId: randomBytes(16).toString('hex'),
          merchantId: offer.merchantId, locationId: offer.locationId, productId: offer.productId, offerId: offer.offerId,
          productName: product.name, merchantName: merchant.displayName, locationName: location.name,
          unitPriceMinor: offer.priceMinor, totalPriceMinor: offer.priceMinor, currency: offer.currency,
          status: 'RESERVED', confirmedAt: at, createdAt: at, expiresAt: new Date(+at + duration * 60000), source: 'BUYER_OFFER'
        }], { session });
        return { ok: true, reservation: reservationView(reservation, at) };
      });
    },
    async publicStatus(id) {
      if (!validId(id)) fail(404, 'reservation_not_found');
      const r = await MerchantReservation.findOne({ publicReservationId: id }).lean();
      if (!r) fail(404, 'reservation_not_found');
      return { ok: true, reservation: reservationView(r, now()) };
    },
    async list(merchantId) {
      await expireReservations(now());
      const items = await MerchantReservation.find({ merchantId }).sort({ createdAt: -1 }).limit(200).lean();
      return { ok: true, items: items.map(r => reservationView(r, now(), true)) };
    },
    async detail(merchantId, id) {
      const r = await MerchantReservation.findOne({ merchantId, reservationId: id }).lean();
      if (!r) fail(404, 'reservation_not_found');
      return { ok: true, reservation: reservationView(r, now(), true) };
    },
    async action(merchantId, id, action) {
      if (!['cancel','collect'].includes(action)) fail(400, 'invalid_input');
      return transaction(async session => {
        const r = await MerchantReservation.findOne({ merchantId, reservationId: id }).session(session);
        if (!r) fail(404, 'reservation_not_found');
        const offer = await Offer.findOneAndUpdate({ merchantId, offerId: r.offerId }, { $inc: { reservationRevision: 1 } }, { new: true, session });
        if (!offer) fail(409, 'reservation_unavailable');
        const at = now(), target = action === 'collect' ? 'COLLECTED' : 'CANCELLED';
        if (r.status === target) return { ok: true, reservation: reservationView(r, at, true) };
        if (effectiveStatus(r, at) !== 'RESERVED') fail(409, 'reservation_closed');
        if (action === 'collect') {
          if (offer.stockQuantity < 1) fail(409, 'out_of_stock');
          offer.stockQuantity -= 1; await offer.save({ session }); r.collectedAt = at;
        } else r.cancelledAt = at;
        r.status = target; await r.save({ session });
        return { ok: true, reservation: reservationView(r, at, true) };
      });
    }
  };
}
