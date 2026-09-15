import { availabilityState, notifyStateAllowed } from './availabilityPolicy.js';
import { notifyConfigured } from './availabilityMail.js';
import { createHash } from 'node:crypto';
import { DeviceApiError, verifyCredential } from './deviceCredentials.js';
import { createDeviceRepository } from './deviceRepository.js';
import { bindingCode } from './binding.js';

export const deviceOnline = (device, at = new Date()) => !!device.lastSeenAt
  && ['ACTIVE', 'PROVISIONED'].includes(device.status)
  && at.getTime() - new Date(device.lastSeenAt).getTime() <= 120_000;
const publicIdValid = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
function origin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin;
  } catch { /* fail closed */ }
  throw new DeviceApiError(503, 'device_origin_unavailable');
}
function usableOffer(offer, allowPaused = false) {
  return (offer?.active === true || (allowPaused && offer?.active === false)) && publicIdValid(offer.publicOfferId) && Number.isSafeInteger(offer.priceMinor)
    && offer.priceMinor >= 0 && offer.priceMinor <= 999999999 && Number.isSafeInteger(offer.stockQuantity) && offer.stockQuantity >= 0 && offer.stockQuantity <= 2147483647
    && ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'KWD', 'BHD'].includes(offer.currency)
    && typeof offer.purchasable === 'boolean' && typeof offer.reservable === 'boolean';
}
async function resolveOffer(read, offer, allowPaused = false) {
  if (!usableOffer(offer, allowPaused)) return null;
  const merchant = await read.merchant(offer.merchantId);
  const location = await read.location(offer.locationId);
  const product = await read.product(offer.productId);
  if (merchant?.status !== 'ACTIVE' || location?.status !== 'ACTIVE' || product?.status !== 'ACTIVE'
      || typeof product.name !== 'string' || !product.name || Buffer.byteLength(product.name) > 256
      || typeof product.productId !== 'string' || product.productId.length > 128
      || location.merchantId !== offer.merchantId || product.merchantId !== offer.merchantId) return null;
  return { merchant, location, product, offer };
}
export function createDeviceService({ repository = createDeviceRepository(), pepper = () => process.env.DEVICE_CREDENTIAL_PEPPER,
  publicOrigin = () => process.env.PUBLIC_BASE_URL, now = () => new Date(), notifyEnabled = notifyConfigured } = {}) {
  return {
    async config(auth, firmwareVersion) {
      if (firmwareVersion !== undefined && (typeof firmwareVersion !== 'string' || !/^[A-Za-z0-9._+-]{1,64}$/.test(firmwareVersion)))
        throw new DeviceApiError(400, 'invalid_firmware_version');
      const at = now();
      const result = await repository.snapshot(async read => {
        const device = await read.device(auth.deviceId);
        verifyCredential(device, await read.credential(auth.deviceId), auth, pepper());
        const unassigned = { ok: true, deviceId: device.deviceId, assigned: false };
        const assignment = await read.assignment(device.deviceId);
        if (!assignment || new Date(assignment.validFrom) > at || (assignment.validUntil && new Date(assignment.validUntil) <= at)) return { config: unassigned, device };
        const display = await read.display(device.deviceId);
        const preview = await read.preview?.(device.deviceId);
        // A physical binding challenge is independent of old and target sale states.
        if (preview && preview.expiresAt > at && preview.attempts < 5
            && String(preview.merchantAssignmentId) === String(assignment._id)
            && preview.merchantId === assignment.merchantId && preview.locationId === assignment.locationId) {
          const resolvedPreview = await resolveOffer(read, await read.offer(preview.offerId), true);
          if (resolvedPreview && resolvedPreview.merchant.merchantId === assignment.merchantId
              && resolvedPreview.location.locationId === assignment.locationId && resolvedPreview.product.productId === preview.productId
              && resolvedPreview.product.name === preview.productName && resolvedPreview.offer.priceMinor === preview.priceMinor
              && resolvedPreview.offer.currency === preview.currency) {
            return { device, config: { ...unassigned, bindingPreview: {
              previewId: preview.previewId, expiresAt: Math.floor(new Date(preview.expiresAt).getTime() / 1000),
              productName: preview.productName, priceMinor: preview.priceMinor, currency: preview.currency,
              code: bindingCode(preview, pepper())
            } } };
          }
        }
        if (!display || !display.verifiedAt || display.endedAt || display.merchantId !== assignment.merchantId || display.locationId !== assignment.locationId) return { config: unassigned, device };
        // PAUSED is a new wire status. Older firmware retains its safe unassigned fallback.
        const pausedCapable = ['0.3.6', '0.3.7', '0.3.8', '0.3.9', '0.3.10'].includes(firmwareVersion);
        const resolved = await resolveOffer(read, await read.offer(display.offerId), pausedCapable);
        if (!resolved || resolved.offer.merchantId !== assignment.merchantId || resolved.offer.locationId !== assignment.locationId || resolved.product.productId !== display.productId) return { config: unassigned, device };
        const { product, offer } = resolved;
        const held = await read.reserved?.(offer.offerId, at) || 0;
        const available = Math.max(0, offer.stockQuantity - held);
        const state = availabilityState(offer, held);
        const notify = notifyEnabled() && notifyStateAllowed(state);
        const projection = {
          ok: true, deviceId: device.deviceId, displayName: device.displayName,
          merchantId: assignment.merchantId, locationId: assignment.locationId,
          hardwareVariant: device.hardwareVariant, firmwareVersionExpected: device.firmwareVersionExpected || null, assigned: true,
          product: { productId: product.productId, name: product.name, image: product.image || null },
          offer: { offerId: offer.offerId, priceMinor: offer.priceMinor, currency: offer.currency, stockQuantity: available,
            purchasable: offer.purchasable, reservable: offer.reservable,
            reservationDuration: offer.reservationDuration ?? null, conditions: offer.conditions || null },
          display: { status: firmwareVersion === '0.3.10' ? state : state === 'OUT_OF_STOCK' ? 'SOLD' : state,
            qr: state === 'READY' || (firmwareVersion === '0.3.10' && notify) ? `${origin(publicOrigin())}/o/${offer.publicOfferId}` : '',
            ...(firmwareVersion === '0.3.10' ? { notifyAvailable: notify } : {}) }
        };
        // Opaque change fingerprint, not a chronological commerce event counter.
        projection.display.eventVersion = createHash('sha256').update(JSON.stringify(projection)).digest('hex').slice(0, 16);
        return { config: projection, device };
      });
      if (!result.device.lastSeenAt || at - new Date(result.device.lastSeenAt) >= 60_000
          || (firmwareVersion && firmwareVersion !== result.device.firmwareVersion))
        await repository.heartbeat(auth.deviceId, at, firmwareVersion);
      return result.config;
    },
    async publicOffer(publicOfferId) {
      if (!publicIdValid(publicOfferId)) throw new DeviceApiError(404, 'offer_not_found');
      return repository.snapshot(async read => {
        const resolved = await resolveOffer(read, await read.publicOffer(publicOfferId), true);
        if (!resolved) throw new DeviceApiError(404, 'offer_not_found');
        const { merchant, location, product, offer } = resolved;
        const held = await read.reserved?.(offer.offerId, now()) || 0;
        const available = Math.max(0, offer.stockQuantity - held);
        const state = availabilityState(offer, held);
        const notify = notifyEnabled() && notifyStateAllowed(state);
        return { ok: true, publicOfferId, merchant: { displayName: merchant.displayName }, location: { name: location.name },
          product: { name: product.name, description: product.description || null,
            image: publicImage(product.image), category: product.category || null },
          offer: { active: offer.active, priceMinor: offer.priceMinor, currency: offer.currency, stockQuantity: available,
            temporarilyReserved: offer.stockQuantity > 0 && available === 0,
            purchasable: offer.purchasable, reservable: offer.reservable,
            reservationDuration: offer.reservationDuration ?? null, conditions: offer.conditions || null },
          availabilityState: state, notifyAvailable: notify,
          checkoutAvailable: false, reservationAvailable: offer.inventorySource === 'QR2BUY' };
      });
    }
  };
}

// Legacy/imported image values must meet the same URL policy as portal input.
function publicImage(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
