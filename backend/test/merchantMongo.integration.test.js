import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import express from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ManagedDevice, DeviceCredential, Merchant, Location, MerchantProduct, Offer, DeviceMerchantAssignment, DisplayAssignment } from '../src/merchant/models.js';
import { createCredentialService } from '../src/merchant/deviceCredentials.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { createDeviceRepository } from '../src/merchant/deviceRepository.js';
import { createMerchantDomainService } from '../src/merchant/service.js';
import { createDeviceRouter, createPublicOfferRouter } from '../src/routes/device.js';

// Own local mongod replica set, never a URI from ENV/.env or an Atlas connection.
// Random credentials are test-only and neither printed nor written to disk.
test('real Mongo: merchant devices, rotation, isolation, heartbeat and public offers', { timeout: 180_000 }, async t => {
  const dbName = `qr2buy_test_${randomBytes(8).toString('hex')}`;
  const repl = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' } });
  const storagePaths = repl.servers.map(server => server.instanceInfo.dbPath);
  let server;
  try {
    const uri = repl.getUri(dbName);
    assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
    await mongoose.connect(uri, { monitorCommands: true });
    assert.equal(mongoose.connection.name, dbName);
    await Promise.all([ManagedDevice, DeviceCredential, Merchant, Location, MerchantProduct, Offer, DeviceMerchantAssignment, DisplayAssignment].map(Model => Model.init()));
    let at = new Date();
    const now = () => at;
    const pepper = randomBytes(32).toString('hex');
    const credentials = createCredentialService({ pepper: () => pepper, now });
    const service = createDeviceService({ pepper: () => pepper, publicOrigin: () => 'https://qr2buy.com', now });
    const domain = createMerchantDomainService({ now });
    const ids = ['QR2B-000001', 'QR2B-000002'];
    for (const i of [0, 1]) {
      await Merchant.create({ merchantId: `TEST-M${i}`, displayName: `Test merchant ${i}`, contactEmail: 'test@example.invalid' });
      await Location.create({ locationId: `TEST-L${i}`, merchantId: `TEST-M${i}`, name: `Test location ${i}` });
      await ManagedDevice.create({ deviceId: ids[i], displayName: `Schild ${i + 1}`, status: 'ACTIVE',
        hardwareVariant: i ? 'ESP32_ILI9341_NOCS' : 'ESP32_ILI9341_CS5' });
    }
    const offers = [];
    for (const i of [0, 1, 2]) {
      const merchant = i === 2 ? 1 : 0;
      await MerchantProduct.create({ productId: `TEST-P${i}`, merchantId: `TEST-M${merchant}`, name: `Test product ${i}` });
      offers.push(await Offer.create({ offerId: `TEST-O${i}`, productId: `TEST-P${i}`, merchantId: `TEST-M${merchant}`,
        locationId: `TEST-L${merchant}`, priceMinor: 12900 + i, currency: 'EUR', stockQuantity: 2, purchasable: true, reservable: false }));
    }
    const auth = [await credentials.rotate(ids[0]), await credentials.rotate(ids[1])];
    assert.ok(auth[0].secret !== auth[1].secret);
    const assign = async (i, offerIndex) => {
      const o = offers[offerIndex];
      await domain.assignDeviceToMerchant({ deviceId: ids[i], merchantId: o.merchantId, locationId: o.locationId, usageType: 'PILOT' });
      const pending = await domain.createPendingDisplayAssignment({ deviceId: ids[i], merchantId: o.merchantId,
        locationId: o.locationId, productId: o.productId, offerId: o.offerId });
      assert.equal((await service.config(auth[i])).assigned, false);
      await domain.verifyDisplayAssignment({ assignmentId: pending._id, merchantId: o.merchantId, verificationMethod: 'DEVICE_QR_AND_PRODUCT_CODE' });
    };
    const app = express();
    app.use('/api/device', createDeviceRouter(service));
    app.use('/api/public/merchant-offers', createPublicOfferRouter(service));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const getConfig = a => fetch(`${origin}/api/device/config`, { headers: {
      'x-device-id': a.deviceId, 'x-device-secret': a.secret, 'x-device-credential-version': String(a.version)
    } });
    const buyer = id => fetch(`${origin}/api/public/merchant-offers/${id}`);

    await t.test('two independent HTTP credentials, missing and active assignments, product/offer projection', async () => {
      for (let i = 0; i < 2; i++) {
        const empty = await getConfig(auth[i]);
        assert.equal(empty.status, 200);
        assert.deepEqual(await empty.json(), { ok: true, deviceId: ids[i], assigned: false });
        await assign(i, i);
        const response = await getConfig(auth[i]);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.deviceId, ids[i]); assert.equal(data.assigned, true);
        assert.equal(data.merchantId, 'TEST-M0'); assert.equal(data.locationId, 'TEST-L0');
        assert.deepEqual(data.product, { productId: `TEST-P${i}`, name: `Test product ${i}`, image: null });
        assert.deepEqual(data.offer, { offerId: `TEST-O${i}`, priceMinor: 12900 + i, currency: 'EUR', stockQuantity: 2, purchasable: true, reservable: false });
        assert.equal(data.display.qr, `https://qr2buy.com/o/${offers[i].publicOfferId}`);
        assert.equal((await DeviceMerchantAssignment.findOne({ deviceId: ids[i], status: 'ACTIVE' })).merchantId, 'TEST-M0');
        assert.equal((await DisplayAssignment.findOne({ deviceId: ids[i], status: 'ACTIVE' })).offerId, `TEST-O${i}`);
        assert.ok(!JSON.stringify(data).includes(auth[i].secret));
        assert.ok(!JSON.stringify(data).includes('verifier'));
      }
      assert.equal((await getConfig({ ...auth[0], deviceId: ids[1] })).status, 401);
      assert.equal((await getConfig({ ...auth[1], deviceId: ids[0] })).status, 401);
    });
    await t.test('credential rotation uses real persistence and rejects old token/version', async () => {
      assert.equal((await getConfig(auth[0])).status, 200);
      const old = auth[0];
      at = new Date(+at + 1000);
      auth[0] = await credentials.rotate(ids[0]);
      assert.equal(auth[0].version, old.version + 1);
      assert.equal((await getConfig(old)).status, 401);
      assert.equal((await getConfig({ ...old, version: auth[0].version })).status, 401);
      assert.equal((await getConfig(auth[0])).status, 200);
      assert.equal((await getConfig(auth[1])).status, 200);
      const persisted = await DeviceCredential.findOne({ deviceId: ids[0] }).lean();
      assert.equal(persisted.verifier, undefined);
      assert.equal(persisted.credentialVersion, 2);
      assert.equal(+persisted.credentialRotatedAt, +at);
      const raw = await DeviceCredential.collection.findOne({ deviceId: ids[0] });
      assert.match(raw.verifier, /^[a-f0-9]{64}$/);
      assert.ok(!JSON.stringify(raw).includes(auth[0].secret));
    });
    await t.test('heartbeats avoid Mongo writes during polling; version changes and concurrent updates are controlled', async () => {
      await service.config(auth[0], '0.3.2');
      let updates = 0;
      const observer = event => { if (event.commandName === 'update' && event.command.update === 'managed_devices') updates++; };
      const client = mongoose.connection.getClient(); client.on('commandStarted', observer);
      try {
        const first = await ManagedDevice.findOne({ deviceId: ids[0] }).lean();
        at = new Date(+at + 3000);
        for (let i = 0; i < 5; i++) await service.config(auth[0], '0.3.2');
        const same = await ManagedDevice.findOne({ deviceId: ids[0] }).lean();
        assert.equal(+same.lastSeenAt, +first.lastSeenAt); assert.equal(updates, 0);
        at = new Date(+at + 60000); await service.config(auth[0], '0.3.2');
        assert.equal(updates, 1);
        const changed = await ManagedDevice.findOne({ deviceId: ids[0] }).lean();
        assert.equal(+changed.lastSeenAt, +at);
        at = new Date(+at + 1000); await service.config(auth[0], '0.3.3');
        assert.equal(updates, 2);
        const version = await ManagedDevice.findOne({ deviceId: ids[0] }).lean();
        assert.equal(version.firmwareVersion, '0.3.3'); assert.equal(+version.lastSeenAt, +at);
        at = new Date(+at + 60000);
        const repository = createDeviceRepository();
        const results = await Promise.all([repository.heartbeat(ids[0], at, '0.3.3'), repository.heartbeat(ids[0], at, '0.3.3')]);
        assert.equal(results.reduce((sum, result) => sum + result.modifiedCount, 0), 1);
      } finally { client.off('commandStarted', observer); }
    });
    await t.test('buyer uses public IDs only; missing, unknown, inactive and foreign scopes are safe', async () => {
      const response = await buyer(offers[0].publicOfferId);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      const data = await response.json();
      assert.equal(data.product.name, 'Test product 0'); assert.equal(data.checkoutAvailable, false);
      assert.match(data.publicOfferId, /^[a-f0-9]{32}$/);
      const serialized = JSON.stringify(data);
      for (const field of ['_id', 'deviceId', 'merchantId', 'productId', 'offerId', 'verifier', 'secret', 'token']) assert.ok(!serialized.includes(`"${field}"`));
      assert.equal((await buyer('')).status, 404);
      assert.equal((await buyer('bad')).status, 404);
      assert.equal((await buyer(randomBytes(16).toString('hex'))).status, 404);
      assert.equal((await buyer(String(offers[0]._id))).status, 404);
      await Offer.updateOne({ offerId: offers[0].offerId }, { $set: { active: false } });
      assert.equal((await buyer(offers[0].publicOfferId)).status, 404);
      assert.equal((await service.config(auth[0])).assigned, false);
      await Offer.updateOne({ offerId: offers[0].offerId }, { $set: { active: true } });
      await Merchant.updateOne({ merchantId: 'TEST-M0' }, { $set: { status: 'SUSPENDED' } });
      assert.equal((await buyer(offers[0].publicOfferId)).status, 404);
      assert.equal((await service.config(auth[0])).assigned, false);
      await Merchant.updateOne({ merchantId: 'TEST-M0' }, { $set: { status: 'ACTIVE' } });
    });
    await t.test('merchant isolation and reassignment are enforced by real transactions without credential changes', async () => {
      await assert.rejects(domain.createPendingDisplayAssignment({ deviceId: ids[0], merchantId: 'TEST-M0', locationId: 'TEST-L0',
        productId: 'TEST-P2', offerId: 'TEST-O2' }), error => error.code === 'PRODUCT_SCOPE');
      const before = await service.config(auth[0]);
      await assign(0, 2);
      const after = await service.config(auth[0]);
      assert.equal(after.merchantId, 'TEST-M1'); assert.equal(after.locationId, 'TEST-L1');
      assert.equal(after.product.productId, 'TEST-P2'); assert.notEqual(after.display.qr, before.display.qr);
      assert.equal((await service.config(auth[1])).merchantId, 'TEST-M0');
      assert.equal(await DeviceMerchantAssignment.countDocuments({ deviceId: ids[0], status: 'ACTIVE' }), 1);
      assert.equal(await DisplayAssignment.countDocuments({ deviceId: ids[0], status: 'ACTIVE' }), 1);
      assert.ok(await DeviceMerchantAssignment.countDocuments({ deviceId: ids[0], status: 'ENDED' }) > 0);
      // Public ID identifies the offer, not the device: old active offer remains
      // a read-only page after the device moves; it cannot operate on that device.
      assert.equal((await buyer(offers[0].publicOfferId)).status, 200);
      await DisplayAssignment.updateOne({ deviceId: ids[0], status: 'ACTIVE' }, { $set: { status: 'ENDED', endedAt: at } });
      assert.equal((await service.config(auth[0])).assigned, false);
      assert.equal((await service.config(auth[1])).assigned, true);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    try {
      if (mongoose.connection.readyState === 1) {
        assert.equal(mongoose.connection.host, '127.0.0.1');
        assert.equal(mongoose.connection.name, dbName);
        assert.match(dbName, /^qr2buy_test_[a-f0-9]{16}$/);
        await mongoose.connection.dropDatabase();
        assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0);
      }
    } finally {
      await mongoose.disconnect();
      await repl.stop({ doCleanup: true, force: true });
      for (const path of storagePaths) assert.equal(existsSync(path), false);
    }
  }
  t.diagnostic('Owned loopback replica set stopped; isolated test database and storage directories removed.');
});
