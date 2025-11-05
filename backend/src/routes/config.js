// C:\QR\backend\src\routes\config.js
import { Router } from 'express';
import { createHash } from 'crypto';
import { Product, Device, STATUS } from '../models.js';

const router = Router();

function getBaseUrl(req) {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.BASE_URL_LOCAL ||
    `${req.protocol}://${req.get('host')}`
  );
}

function computeETag(obj) {
  const json = JSON.stringify(obj);
  const digest = createHash('sha1').update(json).digest('hex');
  return `W/"${digest}"`;
}

/**
 * GET /api/config?deviceId=ESP32-XXXX
 * Optional security: header "x-device-secret: <secret>"
 * Response:
 * {
 *   ok: true,
 *   deviceId: "ESP32-XXXX",
 *   status: "AVAILABLE" | "RESERVED" | "SOLD",
 *   text: "VERKAUFT!" | "<Produktname>|Jetzt kaufen",
 *   qr: "https://<host>/p/<shortId>" | null,
 *   version: 1730050000000,   // unix ms (based on last content update)
 *   updatedAt: "2025-10-24T09:30:00.000Z",
 *   reservedUntil: "2025-11-04T10:00:00.000Z" | null
 * }
 */
router.get('/config', async (req, res, next) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ ok: false, error: 'deviceId required' });
    }

    // Find or auto-provision device (does not link a product here)
    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = await Device.create({ deviceId, status: STATUS.AVAILABLE });
    }

    // Optional secret check
    const providedSecret = req.header('x-device-secret');
    if (device.deviceSecret && providedSecret && device.deviceSecret !== providedSecret) {
      return res.status(401).json({ ok: false, error: 'invalid device secret' });
    }

    // Load linked product if any
    let product = null;
    if (device.productId) {
      product = await Product.findById(device.productId);
    }

    // Determine status
    const status =
      (product && product.status) ||
      device.status ||
      STATUS.AVAILABLE;

    const baseUrl = getBaseUrl(req);
    const qr = product ? `${baseUrl}/p/${product.shortId}` : null;

    const text =
      status === STATUS.SOLD
        ? 'VERKAUFT!'
        : (product?.name || 'Jetzt kaufen');

    // Compute "content" updatedAt independent of device.lastSeenAt
    const productUpdated = product?.updatedAt ? product.updatedAt.getTime() : 0;
    const deviceUpdated = device.updatedAt ? device.updatedAt.getTime() : 0;
    const contentUpdated = Math.max(productUpdated, deviceUpdated);
    const updatedAt = new Date(contentUpdated || Date.now());
    const version = updatedAt.getTime();

    // Build payload used for ETag
    const payload = {
      ok: true,
      deviceId,
      status,
      text,
      qr,
      version,
      updatedAt: updatedAt.toISOString(),
      reservedUntil: product?.reservedUntil ? product.reservedUntil.toISOString() : null
    };

    // Set caching headers
    const etag = computeETag({
      // only fields that influence rendering on device
      deviceId,
      status,
      text,
      qr,
      version,
      reservedUntil: payload.reservedUntil
    });

    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', updatedAt.toUTCString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    // help proxies/CDNs and CORS
    res.setHeader('Vary', 'Origin, If-None-Match, If-Modified-Since');

    // Conditional GET handling
    const inm = req.headers['if-none-match'];
    const imsRaw = req.headers['if-modified-since'];
    const ims = imsRaw ? Date.parse(imsRaw) : 0;

    if ((inm && inm === etag) || (ims && ims >= updatedAt.getTime())) {
      // 304 Not Modified — include validators
      return res.status(304).end();
    }

    // Touch lastSeenAt WITHOUT bumping device.updatedAt (timestamps: false)
    try {
      await Device.updateOne(
        { _id: device._id },
        { $set: { lastSeenAt: new Date() } },
        { timestamps: false }
      );
    } catch {
      /* non-fatal */
    }

    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
