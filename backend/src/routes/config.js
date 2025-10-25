// C:\ecily\ecily_landing\backend\src\routes\config.js
import { Router } from 'express';
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

/**
 * GET /api/config?deviceId=ESP32-XXXX
 * Optional security: header "x-device-secret: <secret>"
 * Response:
 * {
 *   ok: true,
 *   deviceId: "ESP32-XXXX",
 *   status: "AVAILABLE" | "SOLD",
 *   text: "VERKAUFT!" | "<Produktname>|Jetzt kaufen",
 *   qr: "https://<host>/p/<shortId>" | null,
 *   version: 1730050000000,   // unix ms
 *   updatedAt: "2025-10-24T09:30:00.000Z"
 * }
 */
router.get('/config', async (req, res, next) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ ok: false, error: 'deviceId required' });
    }

    // Find or auto-provision device
    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = await Device.create({ deviceId, status: STATUS.AVAILABLE });
    }

    // Optional secret check
    const providedSecret = req.header('x-device-secret');
    if (device.deviceSecret && providedSecret && device.deviceSecret !== providedSecret) {
      return res.status(401).json({ ok: false, error: 'invalid device secret' });
    }

    // Touch lastSeenAt
    device.lastSeenAt = new Date();
    await device.save();

    // Load linked product if any
    let product = null;
    if (device.productId) {
      product = await Product.findById(device.productId);
    }

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

    const updatedAt = new Date(
      Math.max(
        product?.updatedAt ? product.updatedAt.getTime() : 0,
        device.updatedAt ? device.updatedAt.getTime() : 0
      )
    );
    const version = updatedAt.getTime() || Date.now();

    return res.json({
      ok: true,
      deviceId,
      status,
      text,
      qr,
      version,
      updatedAt: updatedAt.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;
