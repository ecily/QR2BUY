import mongoose from 'mongoose';
import { DeviceCredential, ManagedDevice, DeviceMerchantAssignment, DisplayAssignment, Merchant, Location, Offer, MerchantProduct, BindingPreview } from './models.js';

export function createDeviceRepository() {
  return {
    // One Mongo snapshot: reassignment cannot mix old and new merchant records.
    async snapshot(work) {
      const session = await mongoose.startSession();
      try {
        return await session.withTransaction(() => work({
          device: id => ManagedDevice.findOne({ deviceId: id }).session(session).lean(),
          credential: id => DeviceCredential.findOne({ deviceId: id }).select('+verifier').session(session).lean(),
          assignment: id => DeviceMerchantAssignment.findOne({ deviceId: id, status: 'ACTIVE' }).session(session).lean(),
          display: id => DisplayAssignment.findOne({ deviceId: id, status: 'ACTIVE' }).session(session).lean(),
          preview: id => BindingPreview.findOne({ deviceId: id, status: 'PREVIEW' }).select('+nonce').session(session).lean(),
          merchant: id => Merchant.findOne({ merchantId: id }).session(session).lean(),
          location: id => Location.findOne({ locationId: id }).session(session).lean(),
          offer: id => Offer.findOne({ offerId: id }).session(session).lean(),
          publicOffer: id => Offer.findOne({ publicOfferId: id }).session(session).lean(),
          product: id => MerchantProduct.findOne({ productId: id }).session(session).lean()
        }), { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
      } finally { await session.endSession(); }
    },
    async heartbeat(deviceId, at, firmwareVersion) {
      const changes = [{ lastSeenAt: null }, { lastSeenAt: { $lte: new Date(at.getTime() - 60_000) } }];
      if (firmwareVersion) changes.push({ firmwareVersion: { $ne: firmwareVersion } });
      return ManagedDevice.updateOne({ deviceId, status: { $in: ['ACTIVE', 'PROVISIONED'] }, $or: changes },
        { $set: { lastSeenAt: at, ...(firmwareVersion ? { firmwareVersion } : {}) } });
    }
  };
}
