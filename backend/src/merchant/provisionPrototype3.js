// Internal one-off operator helper. Not mounted in HTTP, startup, seed or CLI.
// The caller supplies an already protected/staged token and retains it unchanged
// across retries. No generated token, pepper, verifier or DB exception is returned.
import { timingSafeEqual } from 'node:crypto';
import { credentialVerifier } from './deviceCredentials.js';

export const P3_ID = 'QR2B-000003';
export const P3_MAC = 'f4:2d:c9:6b:c2:90';
export class P3ProvisioningError extends Error {
  constructor(code) { super(code); this.name = 'P3ProvisioningError'; this.code = code; }
}
const fail = code => { throw new P3ProvisioningError(code); };
const equal = (a, b) => typeof a === 'string' && typeof b === 'string'
  && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b)
  && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

export async function provisionPrototype3({ client, dbName, secret,
  pepper = process.env.DEVICE_CREDENTIAL_PEPPER, confirmDeviceId, observedMac,
  production = false, allowProduction = false, now = () => new Date(),
  // Injectable transaction runner for fault tests. Production uses the driver.
  runTransaction = (session, work) => session.withTransaction(work, {
    readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }
  }) } = {}) {
  if (confirmDeviceId !== P3_ID || observedMac !== P3_MAC) fail('p3_identity_confirmation_required');
  if (typeof dbName !== 'string' || !dbName || !client) fail('p3_target_required');
  // Fail closed outside a named local test database unless explicitly approved.
  if ((production || !/^qr2buy_test_[a-f0-9]+$/.test(dbName)) && allowProduction !== true)
    fail('p3_production_approval_required');
  if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret) || /^([a-f0-9])\1{63}$/.test(secret)) fail('p3_invalid_staged_token');
  if (typeof pepper !== 'string' || !/^[a-f0-9]{64}$/i.test(pepper)) fail('p3_pepper_unavailable');
  const verifier = credentialVerifier(P3_ID, 1, secret, pepper);
  const db = client.db(dbName);
  const devices = db.collection('managed_devices'), credentials = db.collection('device_credentials');
  // Do not create indexes, initialize models, upsert, rotate or update any record.
  try {
    for (const [collection, field, partial] of [[devices, 'deviceId', false], [devices, 'hardwareUid', true], [credentials, 'deviceId', false]]) {
      const indexes = await collection.listIndexes().toArray();
      if (!indexes.some(i => i.unique && !i.sparse && Object.keys(i.key).length === 1 && i.key[field] === 1
          && (partial ? JSON.stringify(i.partialFilterExpression) === JSON.stringify({ hardwareUid: { $type: 'string' } }) : !i.partialFilterExpression)))
        fail('p3_unique_index_required');
    }
  } catch (e) { if (e instanceof P3ProvisioningError) throw e; fail('p3_preflight_unavailable'); }

  async function inspect(session) {
    const options = { session };
    // Reject accidental reuse of the current Device 1/2 tokens without exporting
    // or modifying their credentials. Verifiers are bound to device ID/version.
    for (const deviceId of ['QR2B-000001', 'QR2B-000002']) {
      const other = await credentials.findOne({ deviceId }, options);
      if (other && Number.isSafeInteger(other.credentialVersion) && other.credentialVersion > 0
          && equal(other.verifier, credentialVerifier(deviceId, other.credentialVersion, secret, pepper)))
        fail('p3_reused_credential');
    }
    const matches = await devices.find({ $or: [{ deviceId: P3_ID },
      { hardwareUid: { $regex: '^f4:2d:c9:6b:c2:90$', $options: 'i' } }] }, options).toArray();
    const credential = await credentials.findOne({ deviceId: P3_ID }, options);
    for (const name of ['device_merchant_assignments', 'display_assignments', 'binding_previews']) {
      if (await db.collection(name).findOne({ deviceId: P3_ID }, options)) fail('p3_assignment_conflict');
    }
    if (!matches.length && !credential) return 'absent';
    if (matches.length !== 1) fail('p3_identity_conflict');
    const d = matches[0];
    if (d.deviceId !== P3_ID || d.hardwareUid !== P3_MAC || d.hardwareVariant !== 'ESP32_ILI9341_CS5'
        || d.status !== 'PROVISIONED' || d.displayName !== 'Schild 3' || d.bindingRevision !== 0)
      fail('p3_identity_conflict');
    if (!credential || credential.credentialVersion !== 1 || credential.credentialStatus !== 'ACTIVE'
        || !equal(credential.verifier, verifier)) fail('p3_credential_conflict');
    return 'matching';
  }
  const session = client.startSession();
  try {
    const result = await runTransaction(session, async () => {
      if (await inspect(session) === 'matching') return { status: 'ALREADY_PROVISIONED', deviceId: P3_ID };
      const at = now();
      await devices.insertOne({ deviceId: P3_ID, hardwareUid: P3_MAC, hardwareVariant: 'ESP32_ILI9341_CS5',
        displayName: 'Schild 3', status: 'PROVISIONED', bindingRevision: 0, firmwareVersion: null,
        firmwareVersionExpected: '0.3.11', lastSeenAt: null, activatedAt: null, createdAt: at, updatedAt: at }, { session });
      await credentials.insertOne({ deviceId: P3_ID, verifier, credentialVersion: 1,
        credentialStatus: 'ACTIVE', credentialCreatedAt: at, credentialRotatedAt: null,
        createdAt: at, updatedAt: at }, { session });
      return { status: 'PROVISIONED', deviceId: P3_ID };
    });
    return result;
  } catch (e) {
    if (e instanceof P3ProvisioningError) throw e;
    // Never guess after a lost commit acknowledgement or connectivity failure.
    // Driver retries commit appropriately; if still unresolved, retain the same
    // staged token and retry this helper later. Exact matching records -> no-op.
    if (e?.hasErrorLabel?.('UnknownTransactionCommitResult')) fail('p3_outcome_uncertain');
    if (e?.code === 11000) fail('p3_concurrent_identity_conflict');
    fail('p3_registration_unconfirmed');
  } finally {
    // Cleanup must not expose raw driver exceptions or override a known result.
    try { await session.endSession(); } catch { /* no sensitive diagnostics */ }
  }
}
