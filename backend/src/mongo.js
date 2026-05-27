import mongoose from 'mongoose';

export async function connect() {
  // MONGO_URL has priority; MONGODB_URI is supported for Atlas-style env naming.
  const url = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qr2buy';
  mongoose.set('strictQuery', true);
  await mongoose.connect(url);
  console.log('[backend] Mongo connected');
}

const DisplayStateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'current' }, // single-doc store
    text: { type: String, default: 'Jetzt kaufen' },
    qr:   { type: String, default: 'https://example.com' },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const DisplayState = mongoose.model('DisplayState', DisplayStateSchema);
