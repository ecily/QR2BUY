// C:\ecily\ecily_landing\backend\src\routes\admin.js
import { Router } from 'express';
import { Product, Device, STATUS } from '../models.js';
import { basicAuth } from '../middleware/basicAuth.js';

const router = Router();

/* ───────── Helpers ───────── */
function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

async function makeUniqueShortId(len = 6) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  while (true) {
    let s = '';
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    const exists = await Product.findOne({ shortId: s });
    if (!exists) return s;
  }
}

/* Protect all admin routes */
router.use(basicAuth());

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
    const data = {};
    if (req.body.name != null) data.name = String(req.body.name).trim();
    if (req.body.price != null) data.price = toNumber(req.body.price);
    if (req.body.currency != null) data.currency = String(req.body.currency).toUpperCase();
    if (req.body.status && [STATUS.AVAILABLE, STATUS.SOLD].includes(req.body.status)) data.status = req.body.status;
    if (req.body.imageUrl != null) data.imageUrl = String(req.body.imageUrl);

    const p = await Product.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!p) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, product: p });
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
    const data = {};
    if (req.body.name != null) data.name = String(req.body.name).trim();
    if (req.body.status && [STATUS.AVAILABLE, STATUS.SOLD].includes(req.body.status)) data.status = req.body.status;
    if (req.body.deviceSecret != null) data.deviceSecret = String(req.body.deviceSecret);

    const d = await Device.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!d) return res.status(404).json({ ok: false, error: 'not found' });
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

    res.json({ ok: true, device, product });
  } catch (err) {
    next(err);
  }
});

/* ───────── Status Override ───────── */
router.post('/override/status', async (req, res, next) => {
  try {
    const { deviceId, productId, status } = req.body || {};
    if (!status || ![STATUS.AVAILABLE, STATUS.SOLD].includes(status)) {
      return res.status(400).json({ ok: false, error: 'valid status required' });
    }

    let device = null;
    if (deviceId) device = await Device.findOneAndUpdate({ deviceId }, { $set: { status } }, { new: true });

    let product = null;
    if (productId) product = await Product.findByIdAndUpdate(productId, { $set: { status } }, { new: true });

    res.json({ ok: true, device, product });
  } catch (err) {
    next(err);
  }
});

export default router;
