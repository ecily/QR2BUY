import mongoose from 'mongoose';
import {
  ASSIGNMENT_STATUS,
  DISPLAY_ASSIGNMENT_STATUS,
  DeviceMerchantAssignment,
  DisplayAssignment,
  Location,
  ManagedDevice,
  Merchant,
  MerchantProduct,
  Offer,
  VERIFICATION_METHOD
} from './models.js';

export class MerchantDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MerchantDomainError';
    this.code = code;
  }
}

async function defaultTransactionRunner(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function findOne(Model, filter, session) {
  const query = Model.findOne(filter);
  return session && typeof query.session === 'function' ? query.session(session) : query;
}

async function createOne(Model, value, session) {
  if (!session) return Model.create(value);
  const created = await Model.create([value], { session });
  return created[0];
}

export function createMerchantDomainService({
  MerchantModel = Merchant,
  LocationModel = Location,
  DeviceModel = ManagedDevice,
  DeviceMerchantAssignmentModel = DeviceMerchantAssignment,
  ProductModel = MerchantProduct,
  OfferModel = Offer,
  DisplayAssignmentModel = DisplayAssignment,
  runTransaction = defaultTransactionRunner,
  now = () => new Date()
} = {}) {
  async function requireScope({ merchantId, locationId, deviceId, productId, offerId }, session) {
    const [merchant, location, device, product, offer] = await Promise.all([
      findOne(MerchantModel, { merchantId }, session),
      findOne(LocationModel, { locationId }, session),
      findOne(DeviceModel, { deviceId }, session),
      productId ? findOne(ProductModel, { productId }, session) : null,
      offerId ? findOne(OfferModel, { offerId }, session) : null
    ]);
    if (!merchant) throw new MerchantDomainError('MERCHANT_NOT_FOUND', 'merchant not found');
    if (!location || location.merchantId !== merchantId) throw new MerchantDomainError('LOCATION_SCOPE', 'location does not belong to merchant');
    if (!device) throw new MerchantDomainError('DEVICE_NOT_FOUND', 'device not found');
    if (productId && (!product || product.merchantId !== merchantId)) throw new MerchantDomainError('PRODUCT_SCOPE', 'product does not belong to merchant');
    if (offerId && (!offer || offer.merchantId !== merchantId || offer.productId !== productId || offer.locationId !== locationId)) {
      throw new MerchantDomainError('OFFER_SCOPE', 'offer does not match merchant, product and location');
    }
    return { merchant, location, device, product, offer };
  }

  async function assignDeviceToMerchant({ deviceId, merchantId, locationId, usageType }) {
    return runTransaction(async (session) => {
      await requireScope({ merchantId, locationId, deviceId }, session);
      // Serialize ownership changes against preview/confirmation transactions.
      await DeviceModel.updateOne({ deviceId }, { $inc: { bindingRevision: 1 } }, { session });
      const current = await findOne(DeviceMerchantAssignmentModel, { deviceId, status: ASSIGNMENT_STATUS.ACTIVE }, session);
      if (current && current.merchantId === merchantId && current.locationId === locationId && current.usageType === usageType) return current;
      const changedAt = now();
      await DisplayAssignmentModel.updateMany(
        { deviceId, status: DISPLAY_ASSIGNMENT_STATUS.ACTIVE },
        { $set: { status: DISPLAY_ASSIGNMENT_STATUS.ENDED, endedAt: changedAt } },
        { session }
      );
      await DeviceMerchantAssignmentModel.updateMany(
        { deviceId, status: ASSIGNMENT_STATUS.ACTIVE },
        { $set: { status: ASSIGNMENT_STATUS.ENDED, validUntil: changedAt } },
        { session }
      );
      return createOne(DeviceMerchantAssignmentModel, {
        deviceId, merchantId, locationId, usageType,
        status: ASSIGNMENT_STATUS.ACTIVE,
        validFrom: changedAt,
        validUntil: null
      }, session);
    });
  }

  async function createPendingDisplayAssignment({ deviceId, merchantId, locationId, productId, offerId, boundBy = null }) {
    return runTransaction(async (session) => {
      await requireScope({ merchantId, locationId, deviceId, productId, offerId }, session);
      const deviceAssignment = await findOne(DeviceMerchantAssignmentModel, { deviceId, status: ASSIGNMENT_STATUS.ACTIVE }, session);
      if (!deviceAssignment || deviceAssignment.merchantId !== merchantId || deviceAssignment.locationId !== locationId) {
        throw new MerchantDomainError('DEVICE_SCOPE', 'device is not actively assigned to merchant and location');
      }
      return createOne(DisplayAssignmentModel, {
        deviceId, merchantId, locationId, productId, offerId, boundBy,
        status: DISPLAY_ASSIGNMENT_STATUS.PENDING,
        assignedAt: now(),
        verifiedAt: null,
        endedAt: null,
        verificationMethod: null
      }, session);
    });
  }

  async function verifyDisplayAssignment({ assignmentId, merchantId, verificationMethod, boundBy = null }) {
    if (!Object.values(VERIFICATION_METHOD).includes(verificationMethod)) {
      throw new MerchantDomainError('VERIFICATION_METHOD', 'on-site verification method required');
    }
    return runTransaction(async (session) => {
      const pending = await findOne(DisplayAssignmentModel, { _id: assignmentId, merchantId, status: DISPLAY_ASSIGNMENT_STATUS.PENDING }, session);
      if (!pending) throw new MerchantDomainError('PENDING_NOT_FOUND', 'pending display assignment not found');
      await requireScope(pending, session);
      const deviceAssignment = await findOne(DeviceMerchantAssignmentModel, { deviceId: pending.deviceId, status: ASSIGNMENT_STATUS.ACTIVE }, session);
      if (!deviceAssignment || deviceAssignment.merchantId !== merchantId || deviceAssignment.locationId !== pending.locationId) {
        throw new MerchantDomainError('DEVICE_SCOPE', 'device merchant assignment changed before verification');
      }
      const changedAt = now();
      await DisplayAssignmentModel.updateMany(
        { deviceId: pending.deviceId, status: DISPLAY_ASSIGNMENT_STATUS.ACTIVE },
        { $set: { status: DISPLAY_ASSIGNMENT_STATUS.REPLACED, endedAt: changedAt } },
        { session }
      );
      return DisplayAssignmentModel.findOneAndUpdate(
        { _id: assignmentId, merchantId, status: DISPLAY_ASSIGNMENT_STATUS.PENDING },
        { $set: { status: DISPLAY_ASSIGNMENT_STATUS.ACTIVE, verifiedAt: changedAt, verificationMethod, boundBy: boundBy || pending.boundBy } },
        { new: true, session, runValidators: true }
      );
    });
  }

  return { assignDeviceToMerchant, createPendingDisplayAssignment, verifyDisplayAssignment, requireScope };
}

export const merchantDomainService = createMerchantDomainService();
