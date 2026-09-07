import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { MerchantProduct } from '../merchant/models.js';

// Explicit operator migration; never runs at application startup or loads .env.
export async function prepareProductBindingIds(merchantId) {
  if (!merchantId) throw new Error('merchant scope required');
  const products = await MerchantProduct.find({ merchantId, productBindingId: { $exists: false } }).select('_id').lean();
  let changed = 0;
  for (const product of products) {
    // Raw collection update intentionally initializes an immutable field on legacy documents.
    const result = await MerchantProduct.collection.updateOne({ _id: product._id, merchantId, productBindingId: { $exists: false } }, { $set: { productBindingId: randomBytes(16).toString('hex') } });
    changed += result.modifiedCount;
  }
  return changed;
}
if (process.argv[1]?.endsWith('prepareProductBindingIds.js')) {
  if (process.env.BINDING_CODE_MIGRATION_ENABLED !== 'true' || !process.env.BINDING_OPERATOR_MERCHANT_ID
      || (process.env.NODE_ENV === 'production' && process.env.BINDING_CODE_MIGRATION_ALLOW_PRODUCTION !== 'true')) {
    console.error('Explicit scoped migration authorization required'); process.exitCode = 1;
  } else {
    try {
      await mongoose.connect(process.env.MONGO_URL || process.env.MONGODB_URI);
      console.log(`Product binding codes initialized: ${await prepareProductBindingIds(process.env.BINDING_OPERATOR_MERCHANT_ID)}`);
    } catch { console.error('Migration failed'); process.exitCode = 1; }
    finally { await mongoose.disconnect(); }
  }
}
