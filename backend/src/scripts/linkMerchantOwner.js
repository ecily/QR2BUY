import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { linkMerchantOwner, MerchantAccount } from '../merchant/accounts.js';

// No dotenv, command-line credentials, startup invocation or guessed merchant/email.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.MERCHANT_ACCOUNT_LINK_ENABLED !== 'true'
      || (process.env.NODE_ENV === 'production' && process.env.MERCHANT_ACCOUNT_LINK_ALLOW_PRODUCTION !== 'true')) throw new Error('authorization required');
    await mongoose.connect(process.env.MONGO_URL || process.env.MONGODB_URI, { autoIndex: false });
    await MerchantAccount.createIndexes();
    const result = await linkMerchantOwner({ merchantId: process.env.MERCHANT_ACCOUNT_LINK_MERCHANT_ID,
      email: process.env.MERCHANT_ACCOUNT_LINK_EMAIL, password: process.env.MERCHANT_ACCOUNT_LINK_PASSWORD });
    console.log(result.created ? 'Merchant owner linked' : 'Merchant owner already linked');
  } catch { console.error('Merchant account linking failed; check explicit configuration and scope'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
