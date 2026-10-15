import { ManagedDevice, DeviceCredential, DeviceMerchantAssignment, DisplayAssignment, BindingPreview, DeviceClaimAuthorization, Merchant } from './models.js';
import { claimCapable, CLAIM_TTL_MS } from './deviceClaims.js';

// Operator-only projection. Never return verifiers, nonces, setup proofs or credentials.
export async function readClaimAuthorizationOptions() {
  const [devices, credentials, assignments, displays, previews, grants, merchants] = await Promise.all([
    ManagedDevice.find({ status: 'PROVISIONED' }).select('deviceId displayName firmwareVersion lastSeenAt -_id').sort({ deviceId: 1 }).lean(),
    DeviceCredential.find({ credentialStatus: 'ACTIVE' }).select('deviceId -_id').lean(),
    DeviceMerchantAssignment.distinct('deviceId'), DisplayAssignment.distinct('deviceId'), BindingPreview.distinct('deviceId'),
    DeviceClaimAuthorization.find({}).select('deviceId merchantId authorizationId status expiresAt nextIssueAt -_id').lean(),
    Merchant.find({ status: 'ACTIVE' }).select('merchantId displayName legalName -_id').sort({ displayName: 1, merchantId: 1 }).lean()
  ]);
  const at = new Date(), blocked = new Set([...assignments, ...displays, ...previews]);
  const active = new Set(credentials.map(c => c.deviceId));
  return { ok: true, serverNow: at.toISOString(), merchants, devices: devices.filter(d => !blocked.has(d.deviceId)).map(d => ({
    ...d, canAuthorize: active.has(d.deviceId) && claimCapable(d.firmwareVersion)
      && !!d.lastSeenAt && d.lastSeenAt <= at && at - d.lastSeenAt <= CLAIM_TTL_MS,
    authorization: grants.find(g => g.deviceId === d.deviceId) || null
  })) };
}
