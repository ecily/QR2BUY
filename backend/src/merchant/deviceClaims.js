import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DeviceApiError, validDeviceId } from './deviceCredentials.js';
import { bindingTransaction } from './binding.js';
import { createMerchantDomainService } from './service.js';
import { MerchantAccount } from './accounts.js';
import { ManagedDevice, DeviceCredential, DeviceMerchantAssignment, DisplayAssignment, BindingPreview, DeviceClaim, DeviceClaimAttempt, DeviceClaimAuthorization, DeviceClaimAudit, Merchant, Location } from './models.js';
import { verifyClaimIndexes } from './claimIndexes.js';

export const CLAIM_TTL_MS = 120_000;
export const claimCapable = version => version === '0.3.13';
const hex = z.string().regex(/^[a-f0-9]{32}$/);
export const claimStartSchema = z.object({ deviceId: z.string().refine(validDeviceId), locationId: z.string().min(1).max(128), requestKey: hex, setupCode: z.string().regex(/^[0-9]{8}$/) }).strict();
export const claimConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
const fail = (status, code) => { throw new DeviceApiError(status, code); };
export const claimNameSupported = name => typeof name === 'string' && name.length > 0 && name.trim() === name
  && Buffer.byteLength(name) <= 64 && /^[\x20-\x7e\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]+$/u.test(name);
// Deterministic PRF with rejection sampling: no modulo bias and no stored plaintext code.
export function claimSetup(deviceId, credentialVersion, at, pepper = process.env.DEVICE_CREDENTIAL_PEPPER, authorization) {
  if (!/^[a-f0-9]{64}$/i.test(pepper || '')) fail(503, 'claim_unavailable');
  if (!authorization || authorization.deviceId !== deviceId || authorization.credentialVersion !== credentialVersion
      || authorization.status !== 'AUTHORIZED' || authorization.expiresAt <= at || authorization.attempts >= 5) return null;
  for (let counter = 0; ; counter++) {
    const digest = createHmac('sha256', Buffer.from(pepper, 'hex'))
      .update(JSON.stringify(['qr2buy-claim-setup-v3', deviceId, credentialVersion, authorization.authorizationId, authorization.merchantId, counter])).digest();
    for (let offset = 0; offset < 32; offset += 4) {
      const value = digest.readUInt32BE(offset);
      if (value < 4_200_000_000) return { protocol: 3, code: String(value % 100_000_000).padStart(8, '0'),
        expiresAt: Math.floor(+new Date(authorization.expiresAt) / 1000) };
    }
  }
}
export const authorizationLive = (grant, at) => !!grant && grant.expiresAt > at && ['AUTHORIZED', 'CLAIMED'].includes(grant.status);
async function audit(grant, event, actor, at, session) {
  await DeviceClaimAudit.create([{ deviceId: grant.deviceId, authorizationId: grant.authorizationId,
    merchantId: grant.merchantId, event, actor, at }], { session });
}
export function createClaimAuthorizationService({ now = () => new Date(), transaction = bindingTransaction, checkIndexes = verifyClaimIndexes } = {}) {
  return {
    async issue(actor, input) {
      const { deviceId, merchantId, requestKey } = z.object({ deviceId: z.string().refine(validDeviceId), merchantId: z.string().min(1).max(128), requestKey: hex }).strict().parse(input);
      if (!actor) fail(403, 'claim_forbidden');
      if (!(await checkIndexes()).ok) fail(503, 'claim_indexes_unavailable');
      return transaction(async session => {
        await lock(deviceId, session);
        const previous = await DeviceClaimAuthorization.findOne({ deviceId }).session(session).lean();
        if (previous?.authorizationId === requestKey) {
          if (previous.merchantId !== merchantId || previous.actor !== actor) fail(409, 'authorization_conflict');
          return { ok: true, authorizationId: requestKey, status: previous.status, expiresAt: previous.expiresAt };
        }
        if (await DeviceClaimAudit.exists({ deviceId, authorizationId: requestKey, event: 'AUTHORIZED' }).session(session)) fail(409, 'authorization_replay');
        if (previous?.nextIssueAt > now()) fail(429, 'authorization_cooldown');
        const credential = await ready(deviceId, now, session);
        if (!await Merchant.exists({ merchantId, status: 'ACTIVE' }).session(session)) fail(403, 'claim_forbidden');
        const at = now(); // Issue the lifetime only after asynchronous eligibility checks.
        const grant = { deviceId, merchantId, authorizationId: requestKey, actor, credentialVersion: credential.credentialVersion,
          expiresAt: new Date(+at + CLAIM_TTL_MS), nextIssueAt: new Date(+at + 600_000), status: 'AUTHORIZED', attempts: 0, claimId: null };
        await DeviceClaimAuthorization.findOneAndUpdate({ deviceId }, { $set: grant }, { upsert: true, session, runValidators: true });
        await audit(grant, 'AUTHORIZED', actor, at, session);
        deadlineOpen(grant, now);
        return { ok: true, authorizationId: requestKey, status: grant.status, expiresAt: grant.expiresAt };
      });
    },
    async revoke(actor, input) {
      const { deviceId, authorizationId } = z.object({ deviceId: z.string().refine(validDeviceId), authorizationId: hex }).strict().parse(input);
      if (!actor) fail(403, 'claim_forbidden');
      if (!(await checkIndexes()).ok) fail(503, 'claim_indexes_unavailable');
      return transaction(async session => {
        const at = now(); await lock(deviceId, session);
        const grant = await DeviceClaimAuthorization.findOne({ deviceId, authorizationId }).session(session).lean();
        if (!grant) fail(404, 'authorization_not_found');
        if (grant.status === 'CONSUMED') fail(409, 'authorization_finished');
        if (grant.status !== 'REVOKED') {
          await DeviceClaimAuthorization.updateOne({ deviceId, authorizationId }, { $set: { status: 'REVOKED' } }, { session });
          await audit(grant, 'REVOKED', actor, at, session);
        }
        return { ok: true, authorizationId, status: 'REVOKED' };
      });
    }
  };
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
async function ready(deviceId, now, session) {
  const device = await ManagedDevice.findOne({ deviceId }).session(session).lean();
  if (!device || device.status !== 'PROVISIONED'
      || await DeviceMerchantAssignment.exists({ deviceId }).session(session)
      || await DisplayAssignment.exists({ deviceId }).session(session)
      || await BindingPreview.exists({ deviceId }).session(session)) fail(409, 'device_unavailable');
  const credential = await DeviceCredential.findOne({ deviceId, credentialStatus: 'ACTIVE' }).session(session).lean();
  if (!credential) fail(409, 'device_unavailable');
  const at = now();
  if (!device.lastSeenAt || at - device.lastSeenAt > CLAIM_TTL_MS || device.lastSeenAt > at
      || !claimCapable(device.firmwareVersion)) fail(409, 'device_update_required');
  return credential;
}
async function lock(deviceId, session) {
  await ManagedDevice.updateOne({ deviceId }, { $inc: { bindingRevision: 1 } }, { session });
}
export function claimBlocked(budget, at) { return !!budget && budget.until > at && budget.attempts >= 5; }

function deadlineOpen(grant, now, claim = grant) {
  const at = now();
  if (!(grant.expiresAt > at) || !(claim.expiresAt > at)) fail(409, 'claim_expired');
  return at;
}
// Last write of the transaction: Mongo evaluates $$NOW when executing this statement,
// not when the HTTP request/callback began. A late write rolls back all staged effects.
async function timedGrantWrite(grant, status, update, session, now, claim = grant) {
  const at = deadlineOpen(grant, now, claim);
  const result = await DeviceClaimAuthorization.updateOne({ deviceId: grant.deviceId,
    authorizationId: grant.authorizationId, merchantId: grant.merchantId, status,
    expiresAt: { $gt: at },
    $expr: { $and: [{ $gt: ['$expiresAt', '$$NOW'] }, { $lt: ['$$NOW', { $literal: claim.expiresAt }] }] }
  }, update, { session });
  if (result.matchedCount !== 1) fail(409, 'claim_expired');
  deadlineOpen(grant, now, claim); // Also reject time spent awaiting the write response.
}

export function createDeviceClaimService({ now = () => new Date(), pepper = () => process.env.DEVICE_CREDENTIAL_PEPPER, transaction = bindingTransaction,
  checkIndexes = verifyClaimIndexes } = {}) {
  async function indexesReady() { if (!(await checkIndexes()).ok) fail(503, 'claim_indexes_unavailable'); }
  return {
    async start(merchantId, accountId, input) {
      const { deviceId, locationId, requestKey, setupCode } = claimStartSchema.parse(input);
      await indexesReady();
      const result = await transaction(async session => {
        const target = await scope(merchantId, accountId, locationId, session);
        await lock(deviceId, session);
        const previous = await DeviceClaim.findOne({ deviceId }).select('+nonce +requestKey').session(session).lean();
        if (previous?.requestKey === requestKey && previous.accountId === accountId
            && previous.merchantId === merchantId && previous.locationId === locationId && previous.status === 'CONFIRMED') {
          const current = await DeviceMerchantAssignment.exists({ _id: previous.assignmentId, deviceId, merchantId, locationId, status: 'ACTIVE' }).session(session);
          if (!current) fail(409, 'claim_finished');
          return phone(previous);
        }
        const credential = await ready(deviceId, now, session);
        const grant = await DeviceClaimAuthorization.findOne({ deviceId }).session(session).lean();
        const budget = await DeviceClaimAttempt.findOne({ deviceId, merchantId }).session(session).lean();
        const at = now();
        if (!authorizationLive(grant, at) || grant.merchantId !== merchantId || grant.credentialVersion !== credential.credentialVersion) fail(403, 'claim_not_authorized');
        if (claimBlocked(budget, at)) fail(429, 'claim_locked');
        if (previous?.requestKey === requestKey) {
          if (previous.accountId !== accountId || previous.merchantId !== merchantId || previous.locationId !== locationId) fail(409, 'claim_unavailable');
          if (previous.proofVersion !== 3 || previous.authorizationId !== grant.authorizationId || grant.claimId !== previous.claimId || previous.status !== 'PENDING' || previous.expiresAt <= at || previous.credentialVersion !== credential.credentialVersion
              || previous.merchantName !== target.merchant.displayName || previous.locationName !== target.location.name) fail(409, 'claim_expired');
          claimCode(previous, pepper());
          return phone(previous); // No extension, no new code on network retry.
        }
        if (grant.status !== 'AUTHORIZED') fail(409, 'authorization_used');
        if (grant.attempts >= 5) fail(429, 'claim_locked');
        const expected = claimSetup(deviceId, credential.credentialVersion, at, pepper(), grant);
        if (!expected || !timingSafeEqual(Buffer.from(setupCode), Buffer.from(expected.code))) {
          await audit(grant, 'SETUP_REJECTED', accountId, at, session);
          await timedGrantWrite(grant, 'AUTHORIZED', { $inc: { attempts: 1 } }, session, now);
          return { error: 'invalid_setup_code' };
        }
        const previousBudget = previous && await DeviceClaimAttempt.findOne({ deviceId, merchantId: previous.merchantId }).session(session).lean();
        deadlineOpen(grant, now);
        if (previous?.proofVersion === 3 && previous.status === 'PENDING' && previous.expiresAt > at && !claimBlocked(previousBudget, at)) fail(409, 'claim_in_progress');
        const claim = { deviceId, merchantId, accountId, locationId, requestKey, proofVersion: 3, authorizationId: grant.authorizationId,
          merchantName: target.merchant.displayName, locationName: target.location.name,
          claimId: randomBytes(16).toString('hex'), nonce: randomBytes(32).toString('hex'),
          credentialVersion: credential.credentialVersion, expiresAt: new Date(Math.min(+at + CLAIM_TTL_MS, +grant.expiresAt)), status: 'PENDING',
          confirmedAt: null, assignmentId: null,
          failedAttempts: 0, failedUntil: null }; // Legacy fields no longer impose a device-wide lock.
        claimCode(claim, pepper()); // Fail closed before storing the challenge.
        await DeviceClaim.findOneAndUpdate({ deviceId }, { $set: claim }, { upsert: true, session, runValidators: true });
        await audit(grant, 'CLAIMED', accountId, at, session);
        await timedGrantWrite(grant, 'AUTHORIZED', { $set: { status: 'CLAIMED', claimId: claim.claimId } }, session, now, claim);
        return phone(claim);
      });
      if (result.error) fail(403, result.error);
      return result;
    },
    async confirm(merchantId, accountId, claimId, input) {
      hex.parse(claimId);
      const { code } = claimConfirmSchema.parse(input);
      await indexesReady();
      const result = await transaction(async session => {
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
        const grant = await DeviceClaimAuthorization.findOne({ deviceId: claim.deviceId }).session(session).lean();
        const at = now();
        if (claimBlocked(budget, at)) fail(429, 'claim_locked');
        if (claim.proofVersion !== 3 || claim.expiresAt <= at || !authorizationLive(grant, at)
          || grant.status !== 'CLAIMED' || grant.authorizationId !== claim.authorizationId || grant.claimId !== claim.claimId
          || grant.merchantId !== merchantId) fail(409, 'claim_expired');
        const credential = await ready(claim.deviceId, now, session);
        deadlineOpen(grant, now, claim);
        if (claim.credentialVersion !== credential.credentialVersion || claim.merchantName !== target.merchant.displayName
            || claim.locationName !== target.location.name) fail(409, 'claim_expired');
        if (!timingSafeEqual(Buffer.from(code), Buffer.from(claimCode(claim, pepper())))) {
          const fresh = !budget || budget.until <= at;
          await DeviceClaimAttempt.findOneAndUpdate({ deviceId: claim.deviceId, merchantId }, { $set: {
            attempts: fresh ? 1 : budget.attempts + 1,
            until: fresh ? new Date(+at + 600_000) : budget.until
          } }, { session, upsert: true, runValidators: true });
          await timedGrantWrite(grant, 'CLAIMED', { $set: { status: 'CLAIMED' } }, session, now, claim);
          return { error: 'invalid_claim_code' }; // Commit attempt budget, then report failure.
        }
        const service = createMerchantDomainService({ runTransaction: work => work(session), now });
        const assignment = await service.assignDeviceToMerchant({ deviceId: claim.deviceId, merchantId, locationId: claim.locationId, usageType: 'INTERNAL' });
        await ManagedDevice.updateOne({ deviceId: claim.deviceId }, { $set: { status: 'ACTIVE', activatedAt: at } }, { session });
        await audit(grant, 'CONSUMED', accountId, at, session);
        await DeviceClaim.updateOne({ _id: claim._id }, { $set: { status: 'CONFIRMED', assignmentId: assignment._id, confirmedAt: at } }, { session });
        await timedGrantWrite(grant, 'CLAIMED', { $set: { status: 'CONSUMED' } }, session, now, claim);
        return phone({ ...claim, status: 'CONFIRMED' });
      });
      if (result.error) fail(400, result.error);
      return result;
    }
  };
}
