// C:\QR\backend\src\scripts\seed.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product, Device, STATUS } from '../models.js';

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/qr2buy';
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || 'localhost';
const API_BASE_URL = process.env.API_BASE_URL || `http://${HOST}:${PORT}`;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';

function randShortId() {
  // 6-stellig, [a-z0-9]
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

async function ensureUniqueShortId() {
  for (let i = 0; i < 20; i++) {
    const s = randShortId();
    const existing = await Product.findOne({ shortId: s }).lean();
    if (!existing) return s;
  }
  throw new Error('could not generate unique shortId');
}

async function main() {
  console.log('[seed] connecting:', MONGO_URL);
  await mongoose.connect(MONGO_URL);
  console.log('[seed] connected');

  // 1) Produkt anlegen/ersetzen
  let shortId = await ensureUniqueShortId();
  const productPayload = {
    shortId,
    name: 'Demo Produkt',
    price: 19.99,
    currency: 'EUR',
    status: STATUS.AVAILABLE,
    imageUrl: null
  };

  // Falls bereits Demo existiert (gleicher Name), ersetze sie, aber behalte ggf. shortId
  const existingDemo = await Product.findOne({ name: 'Demo Produkt' });
  if (existingDemo) {
    shortId = existingDemo.shortId || shortId;
    existingDemo.set({ ...productPayload, shortId });
    await existingDemo.save();
    console.log('[seed] product updated:', existingDemo._id.toString(), 'shortId=', existingDemo.shortId);
  } else {
    const created = await Product.create(productPayload);
    shortId = created.shortId;
    console.log('[seed] product created:', created._id.toString(), 'shortId=', created.shortId);
  }

  const product = await Product.findOne({ shortId });

  // 2) Device anlegen/ersetzen
  const deviceId = 'ESP32-DEMO-001';
  let device = await Device.findOne({ deviceId });
  if (device) {
    device.set({
      name: 'Demo-Gerät',
      status: STATUS.AVAILABLE
    });
    await device.save();
    console.log('[seed] device updated:', device.deviceId);
  } else {
    device = await Device.create({
      deviceId,
      name: 'Demo-Gerät',
      status: STATUS.AVAILABLE
    });
    console.log('[seed] device created:', device.deviceId);
  }

  // 3) Link: Device ↔ Product  (1:1)
  product.deviceId = device._id;
  await product.save();

  device.productId = product._id;
  device.status = STATUS.AVAILABLE;
  await device.save();

  // 4) Ausgabe / Test-URLs
  const buyerUrl = `${PUBLIC_BASE_URL}/p/${shortId}`;
  const publicApiUrl = `${API_BASE_URL}/api/public/products/by-short/${shortId}`;
  const firmwareConfigUrl = `${API_BASE_URL}/api/config?deviceId=${encodeURIComponent(deviceId)}`;

  console.log('✅ Seed ready.');
  console.log('   Buyer URL:            ', buyerUrl);
  console.log('   Public API (product): ', publicApiUrl);
  console.log('   Firmware /config:     ', firmwareConfigUrl);

  await mongoose.disconnect();
  console.log('[seed] disconnected, done.');
}

main().catch(async (err) => {
  console.error('[seed] error:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
