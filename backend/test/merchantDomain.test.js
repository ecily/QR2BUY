import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  ASSIGNMENT_STATUS,
  DEVICE_USAGE_TYPE,
  DISPLAY_ASSIGNMENT_STATUS,
  DeviceMerchantAssignment,
  DisplayAssignment,
  HARDWARE_VARIANT,
  Location,
  ManagedDevice,
  Merchant,
  MerchantProduct,
  Offer,
  VERIFICATION_METHOD
} from '../src/merchant/models.js';
import { createMerchantDomainService, MerchantDomainError } from '../src/merchant/service.js';
import { merchantDomainAuth } from '../src/routes/merchant.js';

function model(initial) {
  const documents = initial.map((entry, index) => ({ _id: entry._id || String(index + 1), ...entry }));
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => doc[key] === value);
  return {
    documents,
    findOne(filter) { return Promise.resolve(documents.find((doc) => matches(doc, filter)) || null); },
    async create(value) { const doc = { _id: String(documents.length + 1), ...value }; documents.push(doc); return doc; },
    async updateOne(filter, update) {
      const doc = documents.find(entry => matches(entry, filter));
      if (!doc) return { modifiedCount: 0 };
      for (const [key, value] of Object.entries(update.$inc || {})) doc[key] = (doc[key] || 0) + value;
      Object.assign(doc, update.$set || {});
      return { modifiedCount: 1 };
    },
    async updateMany(filter, update) {
      let modifiedCount = 0;
      for (const doc of documents.filter((entry) => matches(entry, filter))) { Object.assign(doc, update.$set); modifiedCount += 1; }
      return { modifiedCount };
    },
    async findOneAndUpdate(filter, update) {
      const doc = documents.find((entry) => matches(entry, filter));
      if (!doc) return null;
      Object.assign(doc, update.$set);
      return doc;
    }
  };
}

function fixture() {
  const models = {
    MerchantModel: model([{ merchantId: 'M1' }, { merchantId: 'M2' }]),
    LocationModel: model([{ locationId: 'L1', merchantId: 'M1' }, { locationId: 'L2', merchantId: 'M2' }]),
    DeviceModel: model([{ deviceId: 'D1' }, { deviceId: 'D2' }]),
    DeviceMerchantAssignmentModel: model([]),
    ProductModel: model([{ productId: 'P1', merchantId: 'M1' }, { productId: 'P2', merchantId: 'M2' }]),
    OfferModel: model([
      { offerId: 'O1', productId: 'P1', merchantId: 'M1', locationId: 'L1' },
      { offerId: 'O2', productId: 'P2', merchantId: 'M2', locationId: 'L2' }
    ]),
    DisplayAssignmentModel: model([]),
    runTransaction: (work) => work(null),
    now: (() => { let tick = 0; return () => new Date(1_700_000_000_000 + tick++ * 1000); })()
  };
  return { models, service: createMerchantDomainService(models) };
}

function partialUniqueIndex(Model, expectedFilter) {
  return Model.schema.indexes().some(([keys, options]) =>
    keys.deviceId === 1 && options.unique === true && options.partialFilterExpression?.status === expectedFilter
  );
}

test('permanent devices support both prototypes, immutable identity and display names', () => {
  const first = new ManagedDevice({ deviceId: 'QR2B-000001', displayName: 'Schild 1', hardwareUid: '78:1c:3c:2c:82:50', hardwareVariant: HARDWARE_VARIANT.ESP32_ILI9341_CS5 });
  const second = new ManagedDevice({ deviceId: 'QR2B-000002', displayName: 'Schild 2', hardwareUid: 'ec:e3:34:b2:b5:f8', hardwareVariant: HARDWARE_VARIANT.ESP32_ILI9341_NOCS });
  assert.equal(first.validateSync(), undefined);
  assert.equal(second.validateSync(), undefined);
  assert.equal(ManagedDevice.schema.path('deviceId').options.unique, true);
  assert.equal(ManagedDevice.schema.path('deviceId').options.immutable, true);
  assert.equal(ManagedDevice.schema.path('hardwareVariant').options.immutable, true);
  assert.equal(ManagedDevice.schema.path('deviceSecret'), undefined);
});

test('merchant, location and optional product identifiers validate without EAN', () => {
  assert.equal(new Merchant({ merchantId: 'M1', displayName: 'Demo-Händler', contactEmail: 'demo@invalid.example' }).validateSync(), undefined);
  assert.equal(new Location({ locationId: 'L1', merchantId: 'M1', name: 'Hauptstandort', timezone: 'Europe/Berlin' }).validateSync(), undefined);
  const product = new MerchantProduct({ productId: 'P1', merchantId: 'M1', name: 'Handgemachte Ledertasche' });
  assert.equal(product.validateSync(), undefined);
  assert.equal(product.ean, null);
  assert.equal(Merchant.schema.path('merchantId').options.unique, true);
});

test('offer owns integer minor-unit price, numeric stock, sales controls and ERP-open inventory source', () => {
  const offer = new Offer({ offerId: 'O1', merchantId: 'M1', productId: 'P1', locationId: 'L1', priceMinor: 12900, currency: 'eur', stockQuantity: 3, purchasable: true, reservable: true });
  assert.equal(offer.validateSync(), undefined);
  assert.equal(offer.priceMinor, 12900);
  assert.equal(offer.currency, 'EUR');
  assert.equal(offer.inventorySource, 'QR2BUY');
  assert.ok(new Offer({ offerId: 'bad-price', merchantId: 'M1', productId: 'P1', locationId: 'L1', priceMinor: 2490.5, stockQuantity: 1 }).validateSync());
  assert.ok(new Offer({ offerId: 'bad-stock', merchantId: 'M1', productId: 'P1', locationId: 'L1', priceMinor: 100, stockQuantity: 1.5 }).validateSync());
  assert.equal(Offer.schema.path('externalInventoryRef').options.default, null);
  assert.equal(Offer.schema.path('offerId').options.unique, true);
  assert.equal(Offer.schema.path('price'), undefined);
  const secondLocationOffer = new Offer({ offerId: 'O2', merchantId: 'M1', productId: 'P1', locationId: 'L2', priceMinor: 13900, stockQuantity: 2 });
  assert.equal(secondLocationOffer.validateSync(), undefined, 'one product may have multiple location offers');
});

test('partial unique indexes enforce one active merchant and display assignment per device', () => {
  assert.equal(partialUniqueIndex(DeviceMerchantAssignment, ASSIGNMENT_STATUS.ACTIVE), true);
  assert.equal(partialUniqueIndex(DisplayAssignment, DISPLAY_ASSIGNMENT_STATUS.ACTIVE), true);
  const productIndex = DisplayAssignment.schema.indexes().find(([keys]) => keys.productId === 1 && keys.status === 1);
  assert.ok(productIndex, 'product may have several active device assignments');
});

test('merchant reassignment ends the old assignment and preserves history', async () => {
  const { models, service } = fixture();
  const first = await service.assignDeviceToMerchant({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', usageType: DEVICE_USAGE_TYPE.PILOT });
  const pending = await service.createPendingDisplayAssignment({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', productId: 'P1', offerId: 'O1' });
  const display = await service.verifyDisplayAssignment({ assignmentId: pending._id, merchantId: 'M1', verificationMethod: VERIFICATION_METHOD.DEVICE_QR_AND_PRODUCT_CODE });
  const second = await service.assignDeviceToMerchant({ deviceId: 'D1', merchantId: 'M2', locationId: 'L2', usageType: DEVICE_USAGE_TYPE.RENTAL });
  assert.equal(first.status, ASSIGNMENT_STATUS.ENDED);
  assert.ok(first.validUntil instanceof Date);
  assert.equal(second.status, ASSIGNMENT_STATUS.ACTIVE);
  assert.equal(models.DeviceMerchantAssignmentModel.documents.length, 2);
  assert.equal(display.status, DISPLAY_ASSIGNMENT_STATUS.ENDED);
  assert.ok(display.endedAt instanceof Date);
});

test('idempotent merchant assignment does not create duplicate active history', async () => {
  const { models, service } = fixture();
  await service.assignDeviceToMerchant({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', usageType: DEVICE_USAGE_TYPE.PILOT });
  await service.assignDeviceToMerchant({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', usageType: DEVICE_USAGE_TYPE.PILOT });
  assert.equal(models.DeviceMerchantAssignmentModel.documents.length, 1);
});

test('on-site display verification replaces active assignment and retains history', async () => {
  const { models, service } = fixture();
  await service.assignDeviceToMerchant({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', usageType: DEVICE_USAGE_TYPE.PILOT });
  const firstPending = await service.createPendingDisplayAssignment({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', productId: 'P1', offerId: 'O1' });
  const first = await service.verifyDisplayAssignment({ assignmentId: firstPending._id, merchantId: 'M1', verificationMethod: VERIFICATION_METHOD.DEVICE_QR_AND_PRODUCT_CODE });
  const secondPending = await service.createPendingDisplayAssignment({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', productId: 'P1', offerId: 'O1' });
  const second = await service.verifyDisplayAssignment({ assignmentId: secondPending._id, merchantId: 'M1', verificationMethod: VERIFICATION_METHOD.DEVICE_QR_AND_EAN });
  assert.equal(first.status, DISPLAY_ASSIGNMENT_STATUS.REPLACED);
  assert.ok(first.endedAt instanceof Date);
  assert.equal(second.status, DISPLAY_ASSIGNMENT_STATUS.ACTIVE);
  assert.ok(second.verifiedAt instanceof Date);
  assert.equal(models.DisplayAssignmentModel.documents.length, 2);
});

test('one product may be active on multiple devices', async () => {
  const { models, service } = fixture();
  for (const deviceId of ['D1', 'D2']) {
    await service.assignDeviceToMerchant({ deviceId, merchantId: 'M1', locationId: 'L1', usageType: DEVICE_USAGE_TYPE.PILOT });
    const pending = await service.createPendingDisplayAssignment({ deviceId, merchantId: 'M1', locationId: 'L1', productId: 'P1', offerId: 'O1' });
    await service.verifyDisplayAssignment({ assignmentId: pending._id, merchantId: 'M1', verificationMethod: VERIFICATION_METHOD.DEVICE_QR_AND_PRODUCT_CODE });
  }
  assert.equal(models.DisplayAssignmentModel.documents.filter((entry) => entry.productId === 'P1' && entry.status === DISPLAY_ASSIGNMENT_STATUS.ACTIVE).length, 2);
});

test('merchant isolation rejects foreign location, product, offer and device assignment', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.assignDeviceToMerchant({ deviceId: 'D1', merchantId: 'M1', locationId: 'L2', usageType: DEVICE_USAGE_TYPE.PILOT }), MerchantDomainError);
  await service.assignDeviceToMerchant({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', usageType: DEVICE_USAGE_TYPE.PILOT });
  await assert.rejects(() => service.createPendingDisplayAssignment({ deviceId: 'D1', merchantId: 'M1', locationId: 'L1', productId: 'P2', offerId: 'O2' }), MerchantDomainError);
  await assert.rejects(() => service.createPendingDisplayAssignment({ deviceId: 'D2', merchantId: 'M1', locationId: 'L1', productId: 'P1', offerId: 'O1' }), MerchantDomainError);
});

test('merchant-domain API authentication fails closed and accepts configured Basic auth', () => {
  const originalUser = process.env.ADMIN_USER;
  const originalPass = process.env.ADMIN_PASS;
  const response = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {}
  });
  try {
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASS;
    const unavailable = response();
    merchantDomainAuth({ headers: {} }, unavailable, () => assert.fail('must fail closed'));
    assert.equal(unavailable.statusCode, 503);

    process.env.ADMIN_USER = 'merchant-test-user';
    process.env.ADMIN_PASS = 'merchant-test-pass';
    const unauthorized = response();
    merchantDomainAuth({ headers: { authorization: 'Basic invalid' } }, unauthorized, () => assert.fail('must reject bad credentials'));
    assert.equal(unauthorized.statusCode, 401);

    let passed = false;
    const authorized = response();
    const credentials = Buffer.from('merchant-test-user:merchant-test-pass').toString('base64');
    merchantDomainAuth({ headers: { authorization: `Basic ${credentials}` } }, authorized, () => { passed = true; });
    assert.equal(passed, true);
  } finally {
    if (originalUser === undefined) delete process.env.ADMIN_USER; else process.env.ADMIN_USER = originalUser;
    if (originalPass === undefined) delete process.env.ADMIN_PASS; else process.env.ADMIN_PASS = originalPass;
  }
});

test('merchant demo seed is explicit, idempotent-oriented and never destructive', () => {
  const seed = readFileSync(new URL('../src/scripts/seedMerchantDemo.js', import.meta.url), 'utf8');
  for (const value of [
    'MERCHANT_DEMO_SEED_ENABLED',
    'MERCHANT_DEMO_SEED_ALLOW_PRODUCTION',
    'QR2B-000001',
    'QR2B-000002',
    'ESP32_ILI9341_CS5',
    'ESP32_ILI9341_NOCS',
    'DEVICE_USAGE_TYPE.PILOT',
    'DISPLAY_ASSIGNMENT_STATUS.PENDING',
    'priceMinor: 2490',
    'updateOne'
  ]) assert.ok(seed.includes(value), `seed must contain ${value}`);
  for (const forbidden of ['deleteMany', 'dropDatabase', 'deviceSecret', 'DEMO_HARDWARE_DEVICE_SECRETS']) {
    assert.equal(seed.includes(forbidden), false, `seed must not contain ${forbidden}`);
  }
});
