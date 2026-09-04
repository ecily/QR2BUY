import mongoose from 'mongoose';

const DemoHardwareBindingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, trim: true, index: true },
    demoSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DemoSession',
      required: true,
      index: true
    },
    tokenHash: { type: String, required: true, index: true },
    encryptedSessionToken: { type: String, required: true, select: false },
    productKey: { type: String, required: true },
    locale: { type: String, enum: ['de', 'en'], default: 'de' },
    boundAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

DemoHardwareBindingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DemoHardwareBinding =
  mongoose.models.DemoHardwareBinding ||
  mongoose.model('DemoHardwareBinding', DemoHardwareBindingSchema);
