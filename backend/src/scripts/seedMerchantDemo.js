import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {
  ASSIGNMENT_STATUS,
  DEVICE_STATUS,
  DEVICE_USAGE_TYPE,
  DISPLAY_ASSIGNMENT_STATUS,
  DeviceMerchantAssignment,
  DisplayAssignment,
  HARDWARE_VARIANT,
  Location,
  ManagedDevice,
  Merchant,
  MerchantProduct,
  Offer
} from '../merchant/models.js';

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qr2buy';
const enabled = process.env.MERCHANT_DEMO_SEED_ENABLED === 'true';
const productionAllowed = process.env.MERCHANT_DEMO_SEED_ALLOW_PRODUCTION === 'true';

const merchantId = 'MRC-DEMO-001';
const locationId = 'LOC-DEMO-001';

const devices = [
  { deviceId: 'QR2B-000001', displayName: 'Schild 1', hardwareUid: '78:1c:3c:2c:82:50', hardwareVariant: HARDWARE_VARIANT.ESP32_ILI9341_CS5 },
  { deviceId: 'QR2B-000002', displayName: 'Schild 2', hardwareUid: 'ec:e3:34:b2:b5:f8', hardwareVariant: HARDWARE_VARIANT.ESP32_ILI9341_NOCS }
];

const products = [
  { productId: 'PRD-DEMO-BAG', name: 'Handgemachte Ledertasche', description: 'Demo-Stammdatensatz ohne EAN' },
  { productId: 'PRD-DEMO-BOOK', name: 'Roman „Stadtlichter“', description: 'Demo-Stammdatensatz ohne EAN' },
  { productId: 'PRD-DEMO-PRINT', name: 'Gerahmter Kunstdruck', description: 'Demo-Stammdatensatz ohne EAN' }
];

const offers = [
  { offerId: 'OFR-DEMO-BAG', productId: 'PRD-DEMO-BAG', priceMinor: 12900, stockQuantity: 3 },
  { offerId: 'OFR-DEMO-BOOK', productId: 'PRD-DEMO-BOOK', priceMinor: 2490, stockQuantity: 10 },
  { offerId: 'OFR-DEMO-PRINT', productId: 'PRD-DEMO-PRINT', priceMinor: 39000, stockQuantity: 2 }
];

async function assertStableIdentity(Model, filter, expected) {
  const existing = await Model.findOne(filter).lean();
  if (!existing) return;
  for (const [field, value] of Object.entries(expected)) {
    if (existing[field] !== value) throw new Error(`refusing identity mismatch for ${JSON.stringify(filter)} field ${field}`);
  }
}

async function ensureDeviceMerchantAssignment(deviceId) {
  const active = await DeviceMerchantAssignment.findOne({ deviceId, status: ASSIGNMENT_STATUS.ACTIVE });
  if (active) {
    if (active.merchantId !== merchantId || active.locationId !== locationId) {
      throw new Error(`refusing to replace active merchant assignment for ${deviceId}`);
    }
    return active;
  }
  return DeviceMerchantAssignment.create({
    deviceId, merchantId, locationId,
    validFrom: new Date(), validUntil: null,
    status: ASSIGNMENT_STATUS.ACTIVE,
    usageType: DEVICE_USAGE_TYPE.PILOT
  });
}

async function ensurePendingDisplayAssignment(deviceId, productId, offerId) {
  const existing = await DisplayAssignment.findOne({ deviceId, productId, offerId, status: DISPLAY_ASSIGNMENT_STATUS.PENDING });
  if (existing) return existing;
  const active = await DisplayAssignment.findOne({ deviceId, status: DISPLAY_ASSIGNMENT_STATUS.ACTIVE });
  if (active) {
    if (active.merchantId !== merchantId || active.locationId !== locationId || active.productId !== productId || active.offerId !== offerId) {
      throw new Error(`refusing to replace active display assignment for ${deviceId}`);
    }
    return active;
  }
  return DisplayAssignment.create({
    deviceId, merchantId, locationId, productId, offerId,
    status: DISPLAY_ASSIGNMENT_STATUS.PENDING,
    assignedAt: new Date(),
    boundBy: 'bootstrap:p0.3.1'
  });
}

async function main() {
  if (!enabled) throw new Error('set MERCHANT_DEMO_SEED_ENABLED=true to run this non-destructive seed');
  if (process.env.NODE_ENV === 'production' && !productionAllowed) {
    throw new Error('production seed refused; explicit MERCHANT_DEMO_SEED_ALLOW_PRODUCTION=true required');
  }

  console.log('[merchant-seed] connecting');
  await mongoose.connect(MONGO_URL);

  await assertStableIdentity(Merchant, { merchantId }, { merchantId });
  await Merchant.updateOne(
    { merchantId },
    {
      $set: { displayName: 'qr2buy Demo Store', contactEmail: 'merchant-demo@invalid.example', status: 'ACTIVE' },
      $setOnInsert: { merchantId }
    },
    { upsert: true, runValidators: true }
  );
  await assertStableIdentity(Location, { locationId }, { merchantId });
  await Location.updateOne(
    { locationId },
    {
      $set: { name: 'Hauptstandort', timezone: 'Europe/Berlin', status: 'ACTIVE' },
      $setOnInsert: { locationId, merchantId }
    },
    { upsert: true, runValidators: true }
  );

  for (const device of devices) {
    await assertStableIdentity(ManagedDevice, { deviceId: device.deviceId }, { hardwareUid: device.hardwareUid, hardwareVariant: device.hardwareVariant });
    await ManagedDevice.updateOne(
      { deviceId: device.deviceId },
      {
        $set: { displayName: device.displayName, status: DEVICE_STATUS.PROVISIONED },
        $setOnInsert: { deviceId: device.deviceId, hardwareUid: device.hardwareUid, hardwareVariant: device.hardwareVariant }
      },
      { upsert: true, runValidators: true }
    );
    await ensureDeviceMerchantAssignment(device.deviceId);
  }

  for (const product of products) {
    await assertStableIdentity(MerchantProduct, { productId: product.productId }, { merchantId });
    await MerchantProduct.updateOne(
      { productId: product.productId },
      { $set: { name: product.name, description: product.description, status: 'ACTIVE' }, $setOnInsert: { productId: product.productId, merchantId } },
      { upsert: true, runValidators: true }
    );
  }

  for (const offer of offers) {
    await assertStableIdentity(Offer, { offerId: offer.offerId }, { merchantId, productId: offer.productId, locationId });
    await Offer.updateOne(
      { offerId: offer.offerId },
      {
        $set: { priceMinor: offer.priceMinor, stockQuantity: offer.stockQuantity, currency: 'EUR', purchasable: true, reservable: true, active: true, inventorySource: 'QR2BUY' },
        $setOnInsert: { offerId: offer.offerId, merchantId, productId: offer.productId, locationId }
      },
      { upsert: true, runValidators: true }
    );
  }

  await ensurePendingDisplayAssignment('QR2B-000001', 'PRD-DEMO-BAG', 'OFR-DEMO-BAG');
  await ensurePendingDisplayAssignment('QR2B-000002', 'PRD-DEMO-BOOK', 'OFR-DEMO-BOOK');

  console.log('[merchant-seed] ready', { merchantId, locationId, devices: devices.map(({ deviceId }) => deviceId) });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('[merchant-seed] failed:', error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
