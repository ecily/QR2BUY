import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

export const MERCHANT_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', INACTIVE: 'INACTIVE' });
export const LOCATION_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
export const DEVICE_STATUS = Object.freeze({ PROVISIONED: 'PROVISIONED', ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', RETIRED: 'RETIRED' });
export const PRODUCT_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', ARCHIVED: 'ARCHIVED' });
export const ASSIGNMENT_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', ENDED: 'ENDED' });
export const DISPLAY_ASSIGNMENT_STATUS = Object.freeze({ PENDING: 'PENDING', ACTIVE: 'ACTIVE', REPLACED: 'REPLACED', ENDED: 'ENDED' });
export const DEVICE_USAGE_TYPE = Object.freeze({ INTERNAL: 'INTERNAL', PILOT: 'PILOT', RENTAL: 'RENTAL', SOLD: 'SOLD' });
export const HARDWARE_VARIANT = Object.freeze({
  ESP32_ILI9341_CS5: 'ESP32_ILI9341_CS5',
  ESP32_ILI9341_NOCS: 'ESP32_ILI9341_NOCS'
});
export const INVENTORY_SOURCE = Object.freeze({ QR2BUY: 'QR2BUY', EXTERNAL: 'EXTERNAL' });
export const VERIFICATION_METHOD = Object.freeze({
  DEVICE_QR_AND_EAN: 'DEVICE_QR_AND_EAN',
  DEVICE_QR_AND_PRODUCT_CODE: 'DEVICE_QR_AND_PRODUCT_CODE'
});

const addressFields = {
  line1: { type: String, trim: true, default: null },
  line2: { type: String, trim: true, default: null },
  postalCode: { type: String, trim: true, default: null },
  city: { type: String, trim: true, default: null },
  region: { type: String, trim: true, default: null },
  country: { type: String, trim: true, uppercase: true, minlength: 2, maxlength: 2, default: null }
};

const MerchantSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, unique: true, trim: true, immutable: true },
  displayName: { type: String, required: true, trim: true },
  legalName: { type: String, trim: true, default: null },
  contactEmail: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true, default: null },
  address: { type: addressFields, default: () => ({}) },
  status: { type: String, enum: Object.values(MERCHANT_STATUS), default: MERCHANT_STATUS.ACTIVE, index: true }
}, { timestamps: true, collection: 'merchants' });

const LocationSchema = new mongoose.Schema({
  locationId: { type: String, required: true, unique: true, trim: true, immutable: true },
  merchantId: { type: String, required: true, trim: true, immutable: true, index: true },
  name: { type: String, required: true, trim: true },
  address: { type: addressFields, default: () => ({}) },
  timezone: { type: String, required: true, trim: true, default: 'Europe/Berlin' },
  status: { type: String, enum: Object.values(LOCATION_STATUS), default: LOCATION_STATUS.ACTIVE, index: true }
}, { timestamps: true, collection: 'merchant_locations' });
LocationSchema.index({ merchantId: 1, status: 1 });

const ManagedDeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, trim: true, immutable: true },
  displayName: { type: String, required: true, trim: true },
  hardwareUid: { type: String, trim: true, lowercase: true, default: null },
  hardwareVariant: { type: String, required: true, enum: Object.values(HARDWARE_VARIANT), immutable: true },
  firmwareVersion: { type: String, trim: true, default: null },
  firmwareVersionExpected: { type: String, trim: true, default: null },
  status: { type: String, enum: Object.values(DEVICE_STATUS), default: DEVICE_STATUS.PROVISIONED, index: true },
  lastSeenAt: { type: Date, default: null, index: true },
  activatedAt: { type: Date, default: null }
}, { timestamps: true, collection: 'managed_devices' });
ManagedDeviceSchema.index(
  { hardwareUid: 1 },
  { unique: true, partialFilterExpression: { hardwareUid: { $type: 'string' } } }
);

const DeviceMerchantAssignmentSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, trim: true, immutable: true },
  merchantId: { type: String, required: true, trim: true, immutable: true, index: true },
  locationId: { type: String, required: true, trim: true, immutable: true, index: true },
  validFrom: { type: Date, required: true, immutable: true },
  validUntil: { type: Date, default: null },
  status: { type: String, enum: Object.values(ASSIGNMENT_STATUS), required: true, index: true },
  usageType: { type: String, enum: Object.values(DEVICE_USAGE_TYPE), required: true }
}, { timestamps: true, collection: 'device_merchant_assignments' });
DeviceMerchantAssignmentSchema.index(
  { deviceId: 1 },
  { unique: true, partialFilterExpression: { status: ASSIGNMENT_STATUS.ACTIVE } }
);
DeviceMerchantAssignmentSchema.index({ merchantId: 1, locationId: 1, status: 1 });
DeviceMerchantAssignmentSchema.index({ deviceId: 1, validFrom: -1 });

const MerchantProductSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true, trim: true, immutable: true },
  merchantId: { type: String, required: true, trim: true, immutable: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: null },
  sku: { type: String, trim: true, default: null },
  ean: { type: String, trim: true, default: null },
  category: { type: String, trim: true, default: null },
  image: { type: String, trim: true, default: null },
  status: { type: String, enum: Object.values(PRODUCT_STATUS), default: PRODUCT_STATUS.ACTIVE, index: true }
}, { timestamps: true, collection: 'merchant_products' });
MerchantProductSchema.index(
  { merchantId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string' } } }
);
MerchantProductSchema.index(
  { merchantId: 1, ean: 1 },
  { unique: true, partialFilterExpression: { ean: { $type: 'string' } } }
);

const OfferSchema = new mongoose.Schema({
  publicOfferId: { type: String, default: () => randomBytes(16).toString('hex'), immutable: true, match: /^[a-f0-9]{32}$/ },
  offerId: { type: String, required: true, unique: true, trim: true, immutable: true },
  merchantId: { type: String, required: true, trim: true, immutable: true, index: true },
  productId: { type: String, required: true, trim: true, immutable: true, index: true },
  locationId: { type: String, required: true, trim: true, immutable: true, index: true },
  priceMinor: { type: Number, required: true, min: 0, validate: Number.isInteger },
  currency: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'EUR' },
  stockQuantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
  purchasable: { type: Boolean, required: true, default: true },
  reservable: { type: Boolean, required: true, default: true },
  reservationDuration: { type: Number, min: 1, default: null }, // minutes
  conditions: { type: String, trim: true, default: null },
  inventorySource: { type: String, enum: Object.values(INVENTORY_SOURCE), default: INVENTORY_SOURCE.QR2BUY },
  externalInventoryRef: { type: String, trim: true, default: null },
  active: { type: Boolean, required: true, default: true, index: true }
}, { timestamps: true, collection: 'merchant_offers' });
OfferSchema.index({ merchantId: 1, productId: 1, locationId: 1, active: 1 });
OfferSchema.index({ publicOfferId: 1 }, { unique: true, partialFilterExpression: { publicOfferId: { $type: 'string' } } });

// Kept separate so existing merchant device queries cannot expose verifiers.
const DeviceCredentialSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, immutable: true },
  verifier: { type: String, required: true, select: false, match: /^[a-f0-9]{64}$/ },
  credentialVersion: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  credentialCreatedAt: { type: Date, required: true },
  credentialRotatedAt: { type: Date, default: null },
  credentialStatus: { type: String, enum: ['ACTIVE', 'REVOKED'], required: true }
}, { collection: 'device_credentials', timestamps: true });
export const DeviceCredential = mongoose.models.DeviceCredential || mongoose.model('DeviceCredential', DeviceCredentialSchema);

const DisplayAssignmentSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, trim: true, immutable: true },
  merchantId: { type: String, required: true, trim: true, immutable: true, index: true },
  locationId: { type: String, required: true, trim: true, immutable: true, index: true },
  productId: { type: String, required: true, trim: true, immutable: true, index: true },
  offerId: { type: String, required: true, trim: true, immutable: true, index: true },
  status: { type: String, enum: Object.values(DISPLAY_ASSIGNMENT_STATUS), required: true, index: true },
  assignedAt: { type: Date, required: true, immutable: true },
  verifiedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  boundBy: { type: String, trim: true, default: null },
  verificationMethod: { type: String, enum: Object.values(VERIFICATION_METHOD), default: null }
}, { timestamps: true, collection: 'display_assignments' });
DisplayAssignmentSchema.index(
  { deviceId: 1 },
  { unique: true, partialFilterExpression: { status: DISPLAY_ASSIGNMENT_STATUS.ACTIVE } }
);
DisplayAssignmentSchema.index({ productId: 1, status: 1 });
DisplayAssignmentSchema.index({ merchantId: 1, locationId: 1, status: 1 });
DisplayAssignmentSchema.index({ deviceId: 1, assignedAt: -1 });

export const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', MerchantSchema);
export const Location = mongoose.models.MerchantLocation || mongoose.model('MerchantLocation', LocationSchema);
export const ManagedDevice = mongoose.models.ManagedDevice || mongoose.model('ManagedDevice', ManagedDeviceSchema);
export const DeviceMerchantAssignment = mongoose.models.DeviceMerchantAssignment || mongoose.model('DeviceMerchantAssignment', DeviceMerchantAssignmentSchema);
export const MerchantProduct = mongoose.models.MerchantProduct || mongoose.model('MerchantProduct', MerchantProductSchema);
export const Offer = mongoose.models.MerchantOffer || mongoose.model('MerchantOffer', OfferSchema);
export const DisplayAssignment = mongoose.models.DisplayAssignment || mongoose.model('DisplayAssignment', DisplayAssignmentSchema);
