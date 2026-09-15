import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Merchant, Location, MerchantProduct, Offer, ManagedDevice, DeviceMerchantAssignment, DisplayAssignment } from './models.js';
import { bindingTransaction, bindingScope } from './binding.js';
import { deviceOnline } from './deviceService.js';
import { DeviceApiError } from './deviceCredentials.js';
import { emailSchema } from './accounts.js';

const text = max => z.string().trim().max(max);
const optionalText = max => text(max).transform(v => v || null).nullable().optional();
const name = text(120).min(1).refine(v => Buffer.byteLength(v) <= 256);
export const addressSchema = z.object({ line1: optionalText(150), line2: optionalText(150), postalCode: optionalText(20),
  city: optionalText(100), region: optionalText(100), country: z.union([z.literal(''), z.string().regex(/^[A-Z]{2}$/)]).transform(v => v || null).nullable().optional() }).strict();
export const profileSchema = z.object({ displayName: name, contactEmail: emailSchema, phone: optionalText(40), address: addressSchema.optional() }).strict();
export const locationSchema = z.object({ name, address: addressSchema.optional() }).strict();
export const productSchema = z.object({ name, description: optionalText(4000), sku: optionalText(80), category: optionalText(100),
  ean: z.union([z.literal(''), z.string().regex(/^(?:\d{8}|\d{12,14})$/)]).transform(v => v || null).nullable().optional(),
  image: z.union([z.literal(''), z.string().url().max(2000).refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; })]).transform(v => v || null).nullable().optional()
}).strict();
export const offerSchema = z.object({ productId: text(128).min(1), locationId: text(128).min(1), priceMinor: z.number().int().min(0).max(999999999),
  currency: z.enum(['EUR','USD','GBP','CHF','JPY','KWD','BHD']), stockQuantity: z.number().int().min(0).max(2147483647),
  purchasable: z.boolean(), reservable: z.boolean(), active: z.boolean(), reservationDuration: z.number().int().min(1).max(525600).nullable().optional(),
  conditions: optionalText(4000) }).strict();
const notFound = () => { throw new DeviceApiError(404, 'not_found'); };
export const clean = doc => { if (!doc) return doc; const { _id, __v, ...rest } = doc.toObject ? doc.toObject() : doc; return rest; };
const validAssignments = (merchantId, at) => ({ merchantId, status: 'ACTIVE', validFrom: { $lte: at }, $or: [{ validUntil: null }, { validUntil: { $gt: at } }] });

export async function listDevices(merchantId) {
  return bindingTransaction(async session => {
    const at = new Date();
    const assignments = await DeviceMerchantAssignment.find(validAssignments(merchantId, at)).session(session).lean();
    const locations = await Location.find({ merchantId, status: 'ACTIVE' }).session(session).lean();
    const current = assignments.filter(a => locations.some(l => l.locationId === a.locationId));
    const devices = await ManagedDevice.find({ deviceId: { $in: current.map(a => a.deviceId) } }).session(session).lean();
    const displays = await DisplayAssignment.find({ merchantId, deviceId: { $in: devices.map(d => d.deviceId) }, status: { $in: ['PENDING','ACTIVE'] } }).sort({ assignedAt: -1 }).session(session).lean();
    const products = await MerchantProduct.find({ merchantId }).session(session).lean();
    const offers = await Offer.find({ merchantId }).session(session).lean();
    return devices.map(d => {
      const owner = current.find(a => a.deviceId === d.deviceId);
      const candidates = displays.filter(a => a.deviceId === d.deviceId && a.locationId === owner.locationId);
      const active = candidates.find(a => a.status === 'ACTIVE' && a.verifiedAt && !a.endedAt);
      const product = active && products.find(p => p.productId === active.productId && p.status === 'ACTIVE');
      const offer = active && offers.find(o => o.offerId === active.offerId && o.productId === active.productId && o.locationId === owner.locationId);
      return { deviceId: d.deviceId, displayName: d.displayName, online: deviceOnline(d, at), lastSeenAt: d.lastSeenAt,
        firmwareVersion: d.firmwareVersion, location: { locationId: owner.locationId, name: locations.find(l => l.locationId === owner.locationId).name },
        assignmentStatus: active ? 'ACTIVE' : candidates.length ? 'PENDING' : 'NONE',
        product: product && offer ? { productId: product.productId, name: product.name } : null,
        offer: product && offer ? { priceMinor: offer.priceMinor, currency: offer.currency, stockQuantity: offer.stockQuantity, active: offer.active } : null };
    });
  });
}
export async function renameDevice(merchantId, deviceId, input) {
  const data = z.object({ displayName: name }).strict().parse(input);
  return bindingTransaction(async session => {
    await bindingScope(merchantId, deviceId, new Date(), session);
    await ManagedDevice.updateOne({ deviceId }, { $set: data }, { session, runValidators: true });
    return { deviceId, ...data };
  });
}
export async function saveOffer(merchantId, offerId, input) {
  const data = (offerId ? offerSchema.partial() : offerSchema).parse(input);
  return bindingTransaction(async session => {
    const existing = offerId && await Offer.findOne({ merchantId, offerId }).session(session);
    if (offerId && !existing) notFound();
    const final = { ...(existing?.toObject() || {}), ...data };
    if (existing && final.productId !== existing.productId) throw new DeviceApiError(400, 'product_identity_immutable');
    if (!await MerchantProduct.exists({ merchantId, productId: final.productId, status: 'ACTIVE' }).session(session)
      || !await Location.exists({ merchantId, locationId: final.locationId, status: 'ACTIVE' }).session(session)) notFound();
    if (existing?.inventorySource === 'EXTERNAL') throw new DeviceApiError(409, 'external_inventory_read_only');
    if (existing && final.locationId !== existing.locationId) {
      // Offer location is an immutable domain identity; create a separate offer at another location.
      throw new DeviceApiError(409, 'offer_location_immutable');
    }
    if (existing) {
      Object.assign(existing, data); await existing.save({ session }); return clean(existing);
    }
    const [offer] = await Offer.create([{ ...data, merchantId, offerId: randomUUID(), inventorySource: 'QR2BUY' }], { session });
    return clean(offer);
  });
}
export async function saveScoped(Model, merchantId, idField, id, schema, input) {
  const data = (id ? schema.partial() : schema).parse(input);
  if (!id) return clean(await Model.create({ ...data, merchantId, [idField]: randomUUID() }));
  const result = await Model.findOneAndUpdate({ merchantId, [idField]: id }, { $set: data }, { new: true, runValidators: true });
  if (!result) notFound(); return clean(result);
}
export { Merchant, Location, MerchantProduct, Offer, DisplayAssignment };
