import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { provisionPrototype3, P3_ID, P3_MAC } from '../src/merchant/provisionPrototype3.js';
import { credentialVerifier, verifyCredential } from '../src/merchant/deviceCredentials.js';

test('P3 operator helper: owned loopback replica set only', { timeout: 180000 }, async t => {
  const repl = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' },
    replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' } });
  const client = new MongoClient(repl.getUri());
  await client.connect();
  const pepper = randomBytes(32).toString('hex');
  const collections = ['managed_devices', 'device_credentials', 'device_merchant_assignments',
    'display_assignments', 'binding_previews', 'merchant_products', 'merchant_offers'];
  async function scenario(name, work) {
    await t.test(name, async () => {
      const dbName = 'qr2buy_test_' + randomBytes(8).toString('hex');
      const db = client.db(dbName);
      try {
        for (const name of collections) await db.createCollection(name);
        await db.collection('managed_devices').createIndex({ deviceId: 1 }, { unique: true });
        await db.collection('managed_devices').createIndex({ hardwareUid: 1 },
          { unique: true, partialFilterExpression: { hardwareUid: { $type: 'string' } } });
        await db.collection('device_credentials').createIndex({ deviceId: 1 }, { unique: true });
        const originalSecrets = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
        for (let i = 1; i <= 2; i++) {
          const deviceId = 'QR2B-00000' + i;
          await db.collection('managed_devices').insertOne({ deviceId, status: 'ACTIVE', hardwareUid: 'test-mac-' + i });
          await db.collection('device_credentials').insertOne({ deviceId, credentialVersion: 1,
            credentialStatus: 'ACTIVE', verifier: credentialVerifier(deviceId, 1, originalSecrets[i - 1], pepper) });
          for (const name of collections.slice(2)) await db.collection(name).insertOne({ deviceId, sentinel: name });
        }
        const snapshot = async () => Promise.all(collections.map(n => db.collection(n)
          .find({ deviceId: { $in: ['QR2B-000001', 'QR2B-000002'] } }).sort({ _id: 1 }).toArray()));
        const before = await snapshot();
        const secret = randomBytes(32).toString('hex');
        const opts = { client, dbName, secret, pepper, confirmDeviceId: P3_ID, observedMac: P3_MAC };
        await work({ db, opts, originalSecrets });
        assert.deepEqual(await snapshot(), before);
      } finally { await db.dropDatabase(); }
    });
  }
  const expectCode = code => e => e.code === code && e.message === code && !e.cause;
  const transaction = (session, work) => session.withTransaction(work,
    { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  const uncertain = () => Object.assign(new Error('SENSITIVE_TEST_DETAIL'),
    { hasErrorLabel: label => label === 'UnknownTransactionCommitResult' });
  try {
    await scenario('positive neutral registration, auth and credential isolation', async ({ db, opts, originalSecrets }) => {
      const result = await provisionPrototype3(opts);
      assert.deepEqual(result, { status: 'PROVISIONED', deviceId: P3_ID });
      assert.ok(!JSON.stringify(result).includes(opts.secret));
      const device = await db.collection('managed_devices').findOne({ deviceId: P3_ID });
      const credential = await db.collection('device_credentials').findOne({ deviceId: P3_ID });
      assert.equal(device.hardwareUid, P3_MAC); assert.equal(device.status, 'PROVISIONED');
      assert.equal(device.lastSeenAt, null);
      verifyCredential(device, credential, { deviceId: P3_ID, version: 1, secret: opts.secret }, pepper);
      assert.ok(!JSON.stringify(credential).includes(opts.secret));
      for (let i = 1; i <= 2; i++) {
        assert.throws(() => verifyCredential(device, credential,
          { deviceId: P3_ID, version: 1, secret: originalSecrets[i - 1] }, pepper), e => e.status === 401);
        const d = await db.collection('managed_devices').findOne({ deviceId: 'QR2B-00000' + i });
        const c = await db.collection('device_credentials').findOne({ deviceId: d.deviceId });
        assert.throws(() => verifyCredential(d, c,
          { deviceId: d.deviceId, version: 1, secret: opts.secret }, pepper), e => e.status === 401);
      }
      for (const n of collections.slice(2)) assert.equal(await db.collection(n).countDocuments({ deviceId: P3_ID }), 0);
    });
    await scenario('exact replay is a no-op; different token never rotates', async ({ db, opts }) => {
      await provisionPrototype3(opts);
      const before = await Promise.all(collections.map(n => db.collection(n).find({}).toArray()));
      assert.equal((await provisionPrototype3(opts)).status, 'ALREADY_PROVISIONED');
      await assert.rejects(provisionPrototype3({ ...opts, secret: randomBytes(32).toString('hex') }), expectCode('p3_credential_conflict'));
      assert.deepEqual(await Promise.all(collections.map(n => db.collection(n).find({}).toArray())), before);
    });
    await scenario('existing Device 1/2 tokens cannot be reused for P3', async ({ db, opts, originalSecrets }) => {
      for (const secret of originalSecrets)
        await assert.rejects(provisionPrototype3({ ...opts, secret }), expectCode('p3_reused_credential'));
      assert.equal(await db.collection('managed_devices').countDocuments({ deviceId: P3_ID }), 0);
      assert.equal(await db.collection('device_credentials').countDocuments({ deviceId: P3_ID }), 0);
    });
    await scenario('ID conflict fails closed without credential', async ({ db, opts }) => {
      await db.collection('managed_devices').insertOne({ deviceId: P3_ID, hardwareUid: 'wrong' });
      await assert.rejects(provisionPrototype3(opts), expectCode('p3_identity_conflict'));
      assert.equal(await db.collection('device_credentials').countDocuments({ deviceId: P3_ID }), 0);
    });
    await scenario('MAC conflict on another ID is untouched', async ({ db, opts }) => {
      await db.collection('managed_devices').insertOne({ deviceId: 'QR2B-999999', hardwareUid: P3_MAC.toUpperCase() });
      const before = await db.collection('managed_devices').find({}).toArray();
      await assert.rejects(provisionPrototype3(opts), expectCode('p3_identity_conflict'));
      assert.deepEqual(await db.collection('managed_devices').find({}).toArray(), before);
    });
    await scenario('orphan credential or assignment cannot be adopted', async ({ db, opts }) => {
      await db.collection('device_credentials').insertOne({ deviceId: P3_ID });
      await assert.rejects(provisionPrototype3(opts), expectCode('p3_identity_conflict'));
      await db.collection('device_credentials').deleteOne({ deviceId: P3_ID });
      await db.collection('device_merchant_assignments').insertOne({ deviceId: P3_ID });
      await assert.rejects(provisionPrototype3(opts), expectCode('p3_assignment_conflict'));
    });
    await scenario('abort after both inserts rolls back and sanitizes error', async ({ db, opts }) => {
      await assert.rejects(provisionPrototype3({ ...opts, runTransaction: (s, work) => transaction(s, async () => {
        await work(); throw new Error('SENSITIVE_TEST_DETAIL');
      }) }), expectCode('p3_registration_unconfirmed'));
      assert.equal(await db.collection('managed_devices').countDocuments({ deviceId: P3_ID }), 0);
      assert.equal(await db.collection('device_credentials').countDocuments({ deviceId: P3_ID }), 0);
      assert.equal((await provisionPrototype3(opts)).status, 'PROVISIONED');
    });
    await scenario('second insert fails: first insert rolls back', async ({ db, opts }) => {
      // Reject only P3's credential write, after its device insertion.
      await db.command({ collMod: 'device_credentials', validator: { deviceId: { $ne: P3_ID } } });
      await assert.rejects(provisionPrototype3(opts), expectCode('p3_registration_unconfirmed'));
      assert.equal(await db.collection('managed_devices').countDocuments({ deviceId: P3_ID }), 0);
      assert.equal(await db.collection('device_credentials').countDocuments({ deviceId: P3_ID }), 0);
    });
    await scenario('lost commit acknowledgement retains token; replay reconciles committed state', async ({ db, opts }) => {
      await assert.rejects(provisionPrototype3({ ...opts, runTransaction: async (s, work) => {
        await transaction(s, work); throw uncertain();
      } }), expectCode('p3_outcome_uncertain'));
      assert.equal((await provisionPrototype3(opts)).status, 'ALREADY_PROVISIONED');
      assert.equal(await db.collection('managed_devices').countDocuments({ deviceId: P3_ID }), 1);
      assert.equal(await db.collection('device_credentials').countDocuments({ deviceId: P3_ID }), 1);
    });
    await scenario('uncertain result without commit: same token can register later', async ({ opts }) => {
      await assert.rejects(provisionPrototype3({ ...opts, runTransaction: async () => { throw uncertain(); } }), expectCode('p3_outcome_uncertain'));
      assert.equal((await provisionPrototype3(opts)).status, 'PROVISIONED');
    });
    await scenario('concurrent different tokens cannot replace winner', async ({ db, opts }) => {
      const results = await Promise.allSettled([provisionPrototype3(opts),
        provisionPrototype3({ ...opts, secret: randomBytes(32).toString('hex') })]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(await db.collection('managed_devices').countDocuments({ deviceId: P3_ID }), 1);
      assert.equal(await db.collection('device_credentials').countDocuments({ deviceId: P3_ID }), 1);
    });
    await scenario('approval, identity, pepper and index gates before writes', async ({ db, opts }) => {
      for (const [changes, code] of [[{ confirmDeviceId: 'QR2B-000001' }, 'p3_identity_confirmation_required'],
        [{ observedMac: 'wrong' }, 'p3_identity_confirmation_required'], [{ production: true }, 'p3_production_approval_required'],
        [{ pepper: '' }, 'p3_pepper_unavailable'], [{ secret: 'short' }, 'p3_invalid_staged_token']])
        await assert.rejects(provisionPrototype3({ ...opts, ...changes }), expectCode(code));
      await db.collection('managed_devices').dropIndex('hardwareUid_1');
      await assert.rejects(provisionPrototype3(opts), expectCode('p3_unique_index_required'));
      assert.equal(await db.collection('managed_devices').countDocuments({ deviceId: P3_ID }), 0);
    });
  } finally { await client.close(); await repl.stop({ doCleanup: true, force: true }); }
});
