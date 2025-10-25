// C:\ecily\ecily_landing\backend\src\models.js
import mongoose from 'mongoose';

export const STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  SOLD: 'SOLD'
});

/* ───────── Product ───────── */
const ProductSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,          // unique erzeugt den benötigten Index
      lowercase: true,
      trim: true
    },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      default: 'EUR',
      set: (v) => String(v || 'EUR').toUpperCase()
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.AVAILABLE,
      index: true
    },
    // Link auf Device-Dokument (nicht die string deviceId des ESP32)
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
    stripe: {
      productId: { type: String, default: null },
      priceId: { type: String, default: null }
    },
    imageUrl: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Zusatzindizes (ohne Doppelung von shortId)
ProductSchema.index({ status: 1, deviceId: 1 });

/* ───────── Device ───────── */
const DeviceSchema = new mongoose.Schema(
  {
    // Echte Geräte-ID vom ESP32 (z. B. "ESP32-XXXX"); eindeutig
    deviceId: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.AVAILABLE,
      index: true
    },
    // Link auf Product-Dokument (nicht shortId)
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    lastSeenAt: { type: Date, default: null, index: true },
    deviceSecret: { type: String, default: null }, // MVP: plain; später Hash/Rotate
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

DeviceSchema.index({ status: 1, productId: 1 });

DeviceSchema.statics.touchLastSeen = async function (deviceId) {
  return this.findOneAndUpdate(
    { deviceId: String(deviceId).trim() },
    { $set: { lastSeenAt: new Date() } },
    { new: true }
  );
};

/* ───────── Order (Log) ───────── */
const OrderSchema = new mongoose.Schema(
  {
    sessionId: { type: String, unique: true, index: true },
    paymentIntentId: { type: String, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: false, default: null, index: true },
    status: { type: String, required: true, index: true }, // e.g., 'checkout.session.completed'
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      default: 'EUR',
      set: (v) => String(v || 'EUR').toUpperCase()
    },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

OrderSchema.index({ productId: 1, createdAt: -1 });
OrderSchema.index({ deviceId: 1, createdAt: -1 });

/* ───────── Exports ───────── */
export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Device = mongoose.models.Device || mongoose.model('Device', DeviceSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
