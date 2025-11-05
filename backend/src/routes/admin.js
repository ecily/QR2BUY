// C:\QR\backend\src\routes\admin.js
import { Router } from 'express';
import { Product, Device, STATUS } from '../models.js';

const router = Router();

/* ───────── Helpers ───────── */
function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function minutesFromNow(mins) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

function parseReservedUntil({ reservedUntil, reservedMinutes }) {
  if (reservedUntil) {
    const dt = new Date(reservedUntil);
    if (!isNaN(dt)) return dt;
  }
  const mins = clamp(Number(reservedMinutes || process.env.RESERVE_MINUTES || 7) || 7, 2, 20);
  return minutesFromNow(mins);
}

async function makeUniqueShortId(len = 6) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  // loop until unique
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let s = '';
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    const exists = await Product.findOne({ shortId: s });
    if (!exists) return s;
  }
}

function broadcaster(req) {
  const app = req?.app;
  const cands = [app?.locals?.broadcast, app?.locals?.sseBroadcast, app?.get?.('sseBroadcast')].filter(Boolean);
  const fn = cands.find((f) => typeof f === 'function');
  return (event, payload) => {
    if (!fn) return;
    try {
      fn(event, payload);
    } catch {
      /* ignore */
    }
  };
}

async function findProductByIdOrShort({ productId, productShortId }) {
  if (productId) return Product.findById(productId);
  if (productShortId) return Product.findOne({ shortId: String(productShortId).toLowerCase() });
  return null;
}

/* ───────── Products ───────── */
router.post('/products', async (req, res, next) => {
  try {
    const { name, price, currency = 'EUR', shortId } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ ok: false, error: 'name required' });

    const p = await Product.create({
      name: name.trim(),
      price: toNumber(price, 0),
      currency: String(currency || 'EUR').toUpperCase(),
      shortId: (shortId && String(shortId).trim().toLowerCase()) || (await makeUniqueShortId())
    });

    res.status(201).json({ ok: true, product: p });
  } catch (err) {
    next(err);
  }
});

router.get('/products', async (_req, res, next) => {
  try {
    const list = await Product.find().sort({ createdAt: -1 }).limit(500);
    res.json({ ok: true, products: list });
  } catch (err) {
    next(err);
  }
});

router.get('/products/by-short/:shortId', async (req, res, next) => {
  try {
    const shortId = String(req.params.shortId || '').toLowerCase();
    const p = await Product.findOne({ shortId });
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, product: p });
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, product: p });
  } catch (err) {
    next(err);
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const data = {};

    if (b.name != null) data.name = String(b.name).trim();
    if (b.price != null) data.price = toNumber(b.price);
    if (b.currency != null) data.currency = String(b.currency).toUpperCase();
    if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl == null ? null : String(b.imageUrl);

    // Status-Handling inkl. RESERVED
    if (b.status && [STATUS.AVAILABLE, STATUS.RESERVED, STATUS.SOLD].includes(b.status)) {
      data.status = b.status;

      if (b.status === STATUS.AVAILABLE || b.status === STATUS.SOLD) {
        data.reservedUntil = null; // aufräumen
      }

      if (b.status === STATUS.RESERVED) {
        data.reservedUntil = parseReservedUntil({
          reservedUntil: b.reservedUntil,
          reservedMinutes: b.reservedMinutes
        });
      }
    }

    const p = await Product.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });

    // Broadcast
    const push = broadcaster(req);
    push('product:update', {
      productId: String(p._id),
      shortId: p.shortId,
      status: p.status,
      reservedUntil: p.reservedUntil,
      updatedAt: new Date().toISOString()
    });

    res.json({ ok: true, product: p });
  } catch (err) {
    next(err);
  }
});

/* DELETE Produkt (inkl. Aufräumen bei Devices) */
router.delete('/products/:id', async (req, res, next) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });

    // Geräte, die auf dieses Produkt zeigen, entlinken
    await Device.updateMany({ productId: p._id }, { $set: { productId: null } });

    // Falls Produkt selbst einen Device-Ref hält, auch dort aufräumen (idempotent)
    if (p.deviceId) {
      await Device.findByIdAndUpdate(p.deviceId, { $set: { productId: null } });
    }

    await p.deleteOne();

    // Broadcast (Produkt gelöscht → Statusinfo)
    const push = broadcaster(req);
    push('product:update', {
      productId: String(p._id),
      shortId: p.shortId,
      deleted: true,
      updatedAt: new Date().toISOString()
    });

    res.json({ ok: true, deleted: true });
  } catch (err) {
    next(err);
  }
});

/* ───────── Devices ───────── */
router.post('/devices', async (req, res, next) => {
  try {
    const { deviceId, name, deviceSecret } = req.body || {};
    if (!deviceId) return res.status(400).json({ ok: false, error: 'deviceId required' });

    const d = await Device.create({
      deviceId: String(deviceId).trim(),
      name: name ? String(name).trim() : null,
      deviceSecret: deviceSecret ? String(deviceSecret) : null
    });

    // Broadcast
    const push = broadcaster(req);
    push('device:update', {
      deviceId: d.deviceId,
      status: d.status,
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({ ok: true, device: d });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ ok: false, error: 'deviceId exists' });
    next(err);
  }
});

router.get('/devices', async (_req, res, next) => {
  try {
    const list = await Device.find().sort({ updatedAt: -1 }).limit(500);
    res.json({ ok: true, devices: list });
  } catch (err) {
    next(err);
  }
});

router.patch('/devices/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const data = {};
    if (b.name != null) data.name = String(b.name).trim();
    if (b.status && [STATUS.AVAILABLE, STATUS.RESERVED, STATUS.SOLD].includes(b.status)) data.status = b.status;
    if (b.deviceSecret != null) data.deviceSecret = String(b.deviceSecret);

    const d = await Device.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!d) return res.status(404).json({ ok: false, error: 'not found' });

    // Broadcast
    const push = broadcaster(req);
    push('device:update', {
      deviceId: d.deviceId,
      status: d.status,
      updatedAt: new Date().toISOString()
    });

    res.json({ ok: true, device: d });
  } catch (err) {
    next(err);
  }
});

/* ───────── Link / Unlink ───────── */
router.post('/link', async (req, res, next) => {
  try {
    const { deviceId, productId, productShortId } = req.body || {};
    if (!deviceId || (!productId && !productShortId)) {
      return res.status(400).json({ ok: false, error: 'deviceId and productId|productShortId required' });
    }

    const device = await Device.findOne({ deviceId: String(deviceId).trim() });
    if (!device) return res.status(404).json({ ok: false, error: 'device not found' });

    const product = productId
      ? await Product.findById(productId)
      : await Product.findOne({ shortId: String(productShortId).toLowerCase() });

    if (!product) return res.status(404).json({ ok: false, error: 'product not found' });

    device.productId = product._id;
    await device.save();

    product.deviceId = device._id;
    await product.save();

    // Broadcast
    const push = broadcaster(req);
    push('product:update', {
      productId: String(product._id),
      shortId: product.shortId,
      status: product.status,
      updatedAt: new Date().toISOString()
    });
    push('device:update', {
      deviceId: device.deviceId,
      status: device.status,
      updatedAt: new Date().toISOString()
    });

    res.json({ ok: true, device, product });
  } catch (err) {
    next(err);
  }
});

router.post('/unlink', async (req, res, next) => {
  try {
    const { deviceId, productId, productShortId } = req.body || {};
    if (!deviceId && !productId && !productShortId) {
      return res.status(400).json({ ok: false, error: 'deviceId or productId|productShortId required' });
    }

    let product = null;
    if (productId) product = await Product.findById(productId);
    else if (productShortId) product = await Product.findOne({ shortId: String(productShortId).toLowerCase() });

    let device = null;
    if (deviceId) device = await Device.findOne({ deviceId: String(deviceId).trim() });
    if (!device && product && product.deviceId) device = await Device.findById(product.deviceId);
    if (!product && device && device.productId) product = await Product.findById(device.productId);

    if (device) {
      device.productId = null;
      await device.save();
    }
    if (product) {
      product.deviceId = null;
      await product.save();
    }

    // Broadcast
    const push = broadcaster(req);
    if (product) {
      push('product:update', {
        productId: String(product._id),
        shortId: product.shortId,
        status: product.status,
        updatedAt: new Date().toISOString()
      });
    }
    if (device) {
      push('device:update', {
        deviceId: device.deviceId,
        status: device.status,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({ ok: true, device, product });
  } catch (err) {
    next(err);
  }
});

/* ───────── Status Override (erweitert) ───────── */
router.post('/override/status', async (req, res, next) => {
  try {
    const { deviceId, productId, status, reservedUntil, reservedMinutes } = req.body || {};
    if (!status || ![STATUS.AVAILABLE, STATUS.RESERVED, STATUS.SOLD].includes(status)) {
      return res.status(400).json({ ok: false, error: 'valid status required' });
    }

    const push = broadcaster(req);

    let device = null;
    if (deviceId) {
      device = await Device.findOneAndUpdate(
        { deviceId },
        { $set: { status } },
        { new: true }
      );
      if (device) {
        push('device:update', {
          deviceId: device.deviceId,
          status: device.status,
          updatedAt: new Date().toISOString()
        });
      }
    }

    let product = null;
    if (productId) {
      const updates = { status };
      if (status === STATUS.AVAILABLE || status === STATUS.SOLD) {
        updates.reservedUntil = null;
      }
      if (status === STATUS.RESERVED) {
        updates.reservedUntil = parseReservedUntil({ reservedUntil, reservedMinutes });
      }
      product = await Product.findByIdAndUpdate(productId, { $set: updates }, { new: true });
      if (product) {
        push('product:update', {
          productId: String(product._id),
          shortId: product.shortId,
          status: product.status,
          reservedUntil: product.reservedUntil,
          updatedAt: new Date().toISOString()
        });
      }
    }

    res.json({ ok: true, device, product });
  } catch (err) {
    next(err);
  }
});

/* ───────── Demo Reset: SOLD/RESERVED → AVAILABLE (inkl. Cleanup) ─────────
   Body erlaubt eine der Varianten:
   - { productId }
   - { productShortId }
   - { deviceId }  // ermittelt verlinktes Produkt automatisch
*/
router.post('/demo/reset', async (req, res, next) => {
  try {
    const { deviceId, productId, productShortId } = req.body || {};
    if (!deviceId && !productId && !productShortId) {
      return res.status(400).json({ ok: false, error: 'deviceId or productId|productShortId required' });
    }

    const push = broadcaster(req);
    let product = await findProductByIdOrShort({ productId, productShortId });

    let device = null;
    if (deviceId) {
      device = await Device.findOne({ deviceId: String(deviceId).trim() });
      if (!product && device?.productId) {
        product = await Product.findById(device.productId);
      }
    } else if (!device && product?.deviceId) {
      device = await Device.findById(product.deviceId);
    }

    if (!product && !device) {
      return res.status(404).json({ ok: false, error: 'target not found' });
    }

    // Produkt resetten
    if (product) {
      const set = { status: STATUS.AVAILABLE, reservedUntil: null };
      product = await Product.findByIdAndUpdate(product._id, { $set: set }, { new: true });
      push('product:update', {
        productId: String(product._id),
        shortId: product.shortId,
        status: product.status,
        reservedUntil: product.reservedUntil,
        updatedAt: new Date().toISOString()
      });
    }

    // Device resetten (falls vorhanden)
    if (device) {
      device = await Device.findByIdAndUpdate(device._id, { $set: { status: STATUS.AVAILABLE } }, { new: true });
      push('device:update', {
        deviceId: device.deviceId,
        status: device.status,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({ ok: true, product: product || null, device: device || null });
  } catch (err) {
    next(err);
  }
});

export default router;
