import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { verifyClaimIndexes } from '../merchant/claimIndexes.js';

export async function main() {
  if (process.env.QR2BUY_CLAIM_INDEX_CHECK !== 'true') throw new Error('explicit_read_check_required');
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error('database_configuration_required');
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try { await client.connect(); return await verifyClaimIndexes(client.db()); }
  finally { await client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(result => { console.log(JSON.stringify(result)); process.exitCode = result.ok ? 0 : 1; })
    .catch(() => { console.error('claim_index_check_failed'); process.exitCode = 1; });
}
