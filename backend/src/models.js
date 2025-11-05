// C:\QR\backend\src\models.js
import mongoose from 'mongoose';

/* ───────── Status-Enums ───────── */
export const STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
});

export const ORDER_STATUS = Object.freeze({
  RESERVED: 'RESERVED',  // bei Checkout-Start
  PAID: 'PAID',          // nach Webhook/Verify
  EXPIRED: 'EXPIRED',    // wenn Session abläuft/Timeout
  CANCELLED: 'CANCELLED' // optional: manuell/Abbruch
});

/* ───────── Product ───────── */
const ProductSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true, // erzeugt den benötigten Unique-Index
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // als Euro (Order.amount unten in Cent)
    currency: {
      type: String,
      default: 'EUR',
      set: (v) => String(v || 'EUR').toUpperCase(),
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.AVAILABLE,
      index: true,
    },
    // Link auf Device-Dokument (nicht die String deviceId des ESP32)
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },

    // Reservierungsfenster (aktiv, wenn in der Zukunft)
    reservedUntil: { type: Date, default: null, index: true },

    // Stripe-Metadaten (optional)
    stripe: {
      productId: { type: String, default: null },
      priceId: { type: String, default: null },
    },

    imageUrl: { type: String, default: null },

    // Platz für Zusatzangaben, z. B. reservedBy (DeviceId als String)
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
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
      index: true,
    },
    // Link auf Product-Dokument (nicht shortId)
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    lastSeenAt: { type: Date, default: null, index: true },
    deviceSecret: { type: String, default: null }, // MVP: plain; später Hash/Rotate
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
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

/* ───────── Order ─────────
   WICHTIG: `deviceId` hier als STRING (ESP32-ID),
   damit Webhook/Checkout-Metadaten ohne Lookup gespeichert werden können.
*/
const OrderSchema = new mongoose.Schema(
  {
    sessionId: { type: String, unique: true, index: true, required: true },

    paymentIntentId: { type: String, index: true, default: null },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },

    // String-Device-ID (z. B. "ESP32-DEMO-001") – passt zum Checkout-Metadata/Webhook
    deviceId: { type: String, default: null, index: true },

    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      required: true,
      index: true,
      default: ORDER_STATUS.RESERVED,
    },

    // Beträge in CENT (Stripe amount_total)
    amount: { type: Number, required: true, min: 0, default: 0 },

    currency: {
      type: String,
      default: 'EUR',
      set: (v) => String(v || 'EUR').toUpperCase(),
    },

    // Zusatzfelder für Diagnose/Nachverfolgung
    customerEmail: { type: String, default: '' },
    paymentStatus: { type: String, default: '' },

    // Reservierungsfenster (für RESERVED)
    reservedUntil: { type: Date, default: null, index: true },

    // Zeitpunkt der erfolgreichen Zahlung (optional)
    paidAt: { type: Date, default: null, index: true },

    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

OrderSchema.index({ productId: 1, createdAt: -1 });
OrderSchema.index({ deviceId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
// sessionId ist bereits unique+index oben

/* ───────── Exports ───────── */
export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Device = mongoose.models.Device || mongoose.model('Device', DeviceSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
