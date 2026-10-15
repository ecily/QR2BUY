import mongoose from 'mongoose';

export const CLAIM_INDEXES = Object.freeze({
  device_claims: [{ deviceId: 1 }, { claimId: 1 }],
  device_claim_attempts: [{ deviceId: 1, merchantId: 1 }],
  device_claim_authorizations: [{ deviceId: 1 }]
});
// Read-only, repeatable, no model initialization, createIndexes or DDL.
export async function verifyClaimIndexes(db = mongoose.connection.db) {
  if (!db) return { ok: false, missing: ['database_unavailable'] };
  const missing = [];
  // Audit writes must never implicitly create a production collection.
  if (!(await db.listCollections({ name: 'device_claim_audit' }, { nameOnly: true }).toArray()).length)
    missing.push('device_claim_audit:collection');
  else if ((await db.collection('device_claim_audit').listIndexes().toArray()).some(index => index.expireAfterSeconds !== undefined))
    missing.push('device_claim_audit:unexpected_ttl');
  for (const [collection, keys] of Object.entries(CLAIM_INDEXES)) {
    let indexes;
    try { indexes = await db.collection(collection).listIndexes().toArray(); }
    catch (error) { if (error.code !== 26) throw new Error('claim_index_check_unavailable'); indexes = []; }
    for (const key of keys) if (!indexes.some(index => index.unique === true && !index.sparse && !index.partialFilterExpression && index.expireAfterSeconds === undefined
        && (!index.collation || index.collation.locale === 'simple') && JSON.stringify(index.key) === JSON.stringify(key)))
      missing.push(collection + ':' + Object.keys(key).join('+'));
  }
  return { ok: missing.length === 0, missing };
}
