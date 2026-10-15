import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DeviceApiError, validDeviceId } from './deviceCredentials.js';
import { bindingTransaction } from './binding.js';
import { createMerchantDomainService } from './service.js';
import { MerchantAccount } from './accounts.js';
import { ManagedDevice, DeviceCredential, DeviceMerchantAssignment, DisplayAssignment, BindingPreview, DeviceClaim, DeviceClaimAttempt, Merchant, Location } from './models.js';
import { verifyClaimIndexes } from './claimIndexes.js';

export const CLAIM_TTL_MS = 120_000;
export const claimCapable = version => version === '0.3.12';
const hex = z.string().regex(/^[a-f0-9]{32}$/);
export const claimStartSchema = z.object({ deviceId: z.string().refine(validDeviceId), locationId: z.string().min(1).max(128), requestKey: hex, setupCode: hex }).strict();
export const claimConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
const fail = (status, code) => { throw new DeviceApiError(status, code); };
export const claimNameSupported = name => typeof name === 'string' && name.length > 0 && name.trim() === name
  && Buffer.byteLength(name) <= 64 && /^[\x20-\x7e\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]+$/u.test(name);
export function claimSetup(deviceId, credentialVersion, at, pepper = process.env.DEVICE_CREDENTIAL_PEPPER) {
  if (!/^[a-f0-9]{64}$/i.test(pepper || '')) fail(503, 'claim_unavailable');
  const bucket = Math.floor(+at / CLAIM_TTL_MS);
  return { code: createHmac('sha256', Buffer.from(pepper, 'hex')).update(`qr2buy-claim-setup-v1\0${deviceId}\0${credentialVersion}\0${bucket}`).digest('hex').slice(0, 32),
    expiresAt: Math.floor((bucket + 1) * CLAIM_TTL_MS / 1000) };
}
export function claimCode(claim, pepper = process.env.DEVICE_CREDENTIAL_PEPPER) {
  if (!/^[a-f0-9]{64}$/i.test(pepper || '')) fail(503, 'claim_unavailable');
  const digest = createHmac('sha256', Buffer.from(pepper, 'hex')).update(
    `qr2buy-initial-claim-v1\0${claim.deviceId}\0${claim.claimId}\0${claim.nonce}\0${claim.accountId}\0${claim.merchantId}\0${claim.locationId}\0${claim.credentialVersion}`
  ).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}
const phone = c => ({ ok: true, claimId: c.claimId, deviceId: c.deviceId, locationId: c.locationId, expiresAt: c.expiresAt, status: c.status });
async function scope(merchantId, accountId, locationId, session) {
  const account = await MerchantAccount.exists({ accountId, merchantId, status: 'ACTIVE', role: 'OWNER' }).session(session);
  const merchant = await Merchant.findOne({ merchantId, status: 'ACTIVE' }).session(session).lean();
  const location = await Location.findOne({ locationId, merchantId, status: 'ACTIVE' }).session(session).lean();
  if (!account || !merchant || !location) fail(403, 'claim_forbidden');
  for (const name of [merchant.displayName, location.name])
    if (!claimNameSupported(name)) fail(409, 'claim_name_unsupported');
  return { merchant, location };
}
async function ready(deviceId, at, session) {
  const device = await ManagedDevice.findOne({ deviceId }).session(session).lean();
  if (!device || device.status !== 'PROVISIONED'
      || await DeviceMerchantAssignment.exists({ deviceId }).session(session)
      || await DisplayAssignment.exists({ deviceId }).session(session)
      || await BindingPreview.exists({ deviceId }).session(session)) fail(409, 'device_unavailable');
  if (!device.lastSeenAt || at - device.lastSeenAt > CLAIM_TTL_MS || device.lastSeenAt > at
      || !claimCapable(device.firmwareVersion)) fail(409, 'device_update_required');
  const credential = await DeviceCredential.findOne({ deviceId, credentialStatus: 'ACTIVE' }).session(session).lean();
  if (!credential) fail(409, 'device_unavailable');
  return credential;
}
async function lock(deviceId, session) {
  await ManagedDevice.updateOne({ deviceId }, { $inc: { bindingRevision: 1 } }, { session });
}
export function claimBlocked(budget, at) { return !!budget && budget.until > at && budget.attempts >= 5; }

export function createDeviceClaimService({ now = () => new Date(), pepper = () => process.env.DEVICE_CREDENTIAL_PEPPER, transaction = bindingTransaction,
  checkIndexes = verifyClaimIndexes } = {}) {
  async function indexesReady() { if (!(await checkIndexes()).ok) fail(503, 'claim_indexes_unavailable'); }
  return {
    async start(merchantId, accountId, input) {
      const { deviceId, locationId, requestKey, setupCode } = claimStartSchema.parse(input);
      await indexesReady();
      return transaction(async session => {
        const at = now();
        const target = await scope(merchantId, accountId, locationId, session);
        await lock(deviceId, session);
        const previous = await DeviceClaim.findOne({ deviceId }).select('+nonce +requestKey').session(session).lean();
        if (previous?.requestKey === requestKey && previous.accountId === accountId
            && previous.merchantId === merchantId && previous.locationId === locationId && previous.status === 'CONFIRMED') {
          const current = await DeviceMerchantAssignment.exists({ _id: previous.assignmentId, deviceId, merchantId, locationId, status: 'ACTIVE' }).session(session);
          if (!current) fail(409, 'claim_finished');
          return phone(previous);
        }
        const credential = await ready(deviceId, at, session);
        const budget = await DeviceClaimAttempt.findOne({ deviceId, merchantId }).session(session).lean();
        if (claimBlocked(budget, at)) fail(429, 'claim_locked');
        if (previous?.requestKey === requestKey) {
          if (previous.accountId !== accountId || previous.merchantId !== merchantId || previous.locationId !== locationId) fail(409, 'claim_unavailable');
          if (previous.proofVersion !== 2 || previous.status !== 'PENDING' || previous.expiresAt <= at || previous.credentialVersion !== credential.credentialVersion
              || previous.merchantName !== target.merchant.displayName || previous.locationName !== target.location.name) fail(409, 'claim_expired');
          claimCode(previous, pepper());
          return phone(previous); // No extension, no new code on network retry.
        }
        if (!timingSafeEqual(Buffer.from(setupCode), Buffer.from(claimSetup(deviceId, credential.credentialVersion, at, pepper()).code))) fail(403, 'invalid_setup_code');
        const previousBudget = previous && await DeviceClaimAttempt.findOne({ deviceId, merchantId: previous.merchantId }).session(session).lean();
        if (previous?.proofVersion === 2 && previous.status === 'PENDING' && previous.expiresAt > at && !claimBlocked(previousBudget, at)) fail(409, 'claim_in_progress');
        const claim = { deviceId, merchantId, accountId, locationId, requestKey, proofVersion: 2,
          merchantName: target.merchant.displayName, locationName: target.location.name,
          claimId: randomBytes(16).toString('hex'), nonce: randomBytes(32).toString('hex'),
          credentialVersion: credential.credentialVersion, expiresAt: new Date(+at + CLAIM_TTL_MS), status: 'PENDING',
          confirmedAt: null, assignmentId: null,
          failedAttempts: 0, failedUntil: null }; // Legacy fields no longer impose a device-wide lock.
        claimCode(claim, pepper()); // Fail closed before storing the challenge.
        await DeviceClaim.findOneAndUpdate({ deviceId }, { $set: claim }, { upsert: true, session, runValidators: true });
        return phone(claim);
      });
    },
    async confirm(merchantId, accountId, claimId, input) {
      hex.parse(claimId);
      const { code } = claimConfirmSchema.parse(input);
      await indexesReady();
      const result = await transaction(async session => {
        const at = now();
        const claim = await DeviceClaim.findOne({ claimId, merchantId, accountId }).select('+nonce').session(session).lean();
        if (!claim) fail(404, 'claim_not_found');
        const target = await scope(merchantId, accountId, claim.locationId, session);
        await lock(claim.deviceId, session);
        if (claim.status === 'CONFIRMED') {
          const current = await DeviceMerchantAssignment.exists({ _id: claim.assignmentId, deviceId: claim.deviceId, merchantId, locationId: claim.locationId, status: 'ACTIVE' }).session(session);
          if (!current) fail(409, 'claim_finished');
          return phone(claim); // Lost response: return prior result, never reassign.
        }
        const budget = await DeviceClaimAttempt.findOne({ deviceId: claim.deviceId, merchantId }).session(session).lean();
        if (claimBlocked(budget, at)) fail(429, 'claim_locked');
        if (claim.proofVersion !== 2 || claim.expiresAt <= at) fail(409, 'claim_expired');
        const credential = await ready(claim.deviceId, at, session);
        if (claim.credentialVersion !== credential.credentialVersion || claim.merchantName !== target.merchant.displayName
            || claim.locationName !== target.location.name) fail(409, 'claim_expired');
        if (!timingSafeEqual(Buffer.from(code), Buffer.from(claimCode(claim, pepper())))) {
          const fresh = !budget || budget.until <= at;
          await DeviceClaimAttempt.findOneAndUpdate({ deviceId: claim.deviceId, merchantId }, { $set: {
            attempts: fresh ? 1 : budget.attempts + 1,
            until: fresh ? new Date(+at + 600_000) : budget.until
          } }, { session, upsert: true, runValidators: true });
          return { error: 'invalid_claim_code' }; // Commit attempt budget, then report failure.
        }
        const service = createMerchantDomainService({ runTransaction: work => work(session), now: () => at });
        const assignment = await service.assignDeviceToMerchant({ deviceId: claim.deviceId, merchantId, locationId: claim.locationId, usageType: 'INTERNAL' });
        await ManagedDevice.updateOne({ deviceId: claim.deviceId }, { $set: { status: 'ACTIVE', activatedAt: at } }, { session });
        await DeviceClaim.updateOne({ _id: claim._id }, { $set: { status: 'CONFIRMED', assignmentId: assignment._id, confirmedAt: at } }, { session });
        return phone({ ...claim, status: 'CONFIRMED' });
      });
      if (result.error) fail(400, result.error);
      return result;
    }
  };
}
