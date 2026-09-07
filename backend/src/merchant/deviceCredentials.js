import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DeviceCredential, ManagedDevice } from './models.js';

export class DeviceApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export const validDeviceId = value => typeof value === 'string' && /^QR2B-[0-9]{6}$/.test(value);
export function credentialVerifier(deviceId, version, secret, pepper = process.env.DEVICE_CREDENTIAL_PEPPER) {
  if (typeof pepper !== 'string' || !/^[a-f0-9]{64}$/i.test(pepper)) throw new DeviceApiError(503, 'device_auth_unavailable');
  return createHmac('sha256', Buffer.from(pepper, 'hex'))
    .update(`qr2buy-device-v1\0${deviceId}\0${version}\0${secret}`).digest('hex');
}
export function verifyCredential(device, credential, { deviceId, secret, version }, pepper) {
  if (!validDeviceId(deviceId) || typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)
      || !Number.isSafeInteger(version) || version < 1) throw new DeviceApiError(401, 'device_unauthorized');
  if (!device || device.deviceId !== deviceId || !['ACTIVE', 'PROVISIONED'].includes(device.status)
      || !credential || credential.deviceId !== deviceId || credential.credentialStatus !== 'ACTIVE'
      || credential.credentialVersion !== version) throw new DeviceApiError(401, 'device_unauthorized');
  const actual = credentialVerifier(deviceId, version, secret, pepper);
  const expected = credential?.verifier;
  const equal = typeof expected === 'string' && /^[a-f0-9]{64}$/.test(expected)
    && timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  if (!equal || !device || device.deviceId !== deviceId || !['ACTIVE', 'PROVISIONED'].includes(device.status)
      || credential.deviceId !== deviceId || credential.credentialStatus !== 'ACTIVE'
      || credential.credentialVersion !== version) throw new DeviceApiError(401, 'device_unauthorized');
}

// Operator service only. Returned plaintext goes directly to a protected local
// provisioning file, never to an HTTP response or a logger. CAS prevents lost rotations.
export function createCredentialService({ Credential = DeviceCredential, Device = ManagedDevice,
  pepper = () => process.env.DEVICE_CREDENTIAL_PEPPER, now = () => new Date() } = {}) {
  return {
    async rotate(deviceId) {
      if (!validDeviceId(deviceId) || !await Device.findOne({ deviceId })) throw new DeviceApiError(404, 'device_not_found');
      const previous = await Credential.findOne({ deviceId });
      const version = (previous?.credentialVersion || 0) + 1;
      const secret = randomBytes(32).toString('hex');
      const changedAt = now();
      const values = { deviceId, verifier: credentialVerifier(deviceId, version, secret, pepper()),
        credentialVersion: version, credentialCreatedAt: previous?.credentialCreatedAt || changedAt,
        credentialRotatedAt: previous ? changedAt : null, credentialStatus: 'ACTIVE' };
      if (previous) {
        const updated = await Credential.findOneAndUpdate({ deviceId, credentialVersion: previous.credentialVersion },
          { $set: values }, { new: true, runValidators: true });
        if (!updated) throw new DeviceApiError(409, 'credential_rotation_conflict');
      } else {
        try { await Credential.create(values); }
        catch (error) { if (error.code === 11000) throw new DeviceApiError(409, 'credential_rotation_conflict'); throw error; }
      }
      return { deviceId, secret, version };
    },
    async revoke(deviceId, version) {
      return Credential.updateOne({ deviceId, credentialVersion: version }, { $set: { credentialStatus: 'REVOKED' } });
    }
  };
}
