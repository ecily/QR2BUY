import mongoose from 'mongoose';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Merchant, Location } from './models.js';
import { bindingTransaction } from './binding.js';

const schema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true, immutable: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
  emailVerified: { type: Boolean, default: false },
  merchantId: { type: String, required: true, immutable: true, index: true },
  role: { type: String, enum: ['OWNER', 'ADMIN', 'STAFF'], default: 'OWNER' },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true, collection: 'merchant_accounts' });
schema.index({ merchantId: 1, role: 1 }, { unique: true, partialFilterExpression: { role: 'OWNER' } });
export const MerchantAccount = mongoose.models.MerchantAccount || mongoose.model('MerchantAccount', schema);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(128);
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const registrationSchema = z.object({ email: emailSchema, password: passwordSchema,
  displayName: z.string().trim().min(1).max(120), locationName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional() }).strict();
export const hashPassword = password => argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
export const verifyPassword = (hash, password) => argon2.verify(hash, password);
export const publicAccount = a => ({ accountId: a.accountId, email: a.email, role: a.role, emailVerified: a.emailVerified });

export async function registerMerchant(input) {
  const data = registrationSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  return bindingTransaction(async session => {
    const merchantId = randomUUID();
    await Merchant.create([{ merchantId, displayName: data.displayName, contactEmail: data.email, phone: data.phone || null }], { session });
    await Location.create([{ locationId: randomUUID(), merchantId, name: data.locationName }], { session });
    const [account] = await MerchantAccount.create([{ accountId: randomUUID(), email: data.email, passwordHash, merchantId, role: 'OWNER' }], { session });
    return account;
  });
}

// Operator-only bootstrap; never called by public registration or application startup.
export async function linkMerchantOwner({ merchantId, email, password }) {
  email = emailSchema.parse(email); passwordSchema.parse(password);
  if (typeof merchantId !== 'string' || !merchantId) throw new Error('merchant scope required');
  const passwordHash = await hashPassword(password);
  return bindingTransaction(async session => {
    const merchant = await Merchant.findOne({ merchantId, status: 'ACTIVE' }).session(session);
    if (!merchant) throw new Error('merchant unavailable');
    const existing = await MerchantAccount.findOne({ email }).session(session);
    if (existing) {
      if (existing.merchantId !== merchantId || existing.role !== 'OWNER' || existing.status !== 'ACTIVE') throw new Error('account scope conflict');
      return { created: false }; // Idempotent; does not reset an existing password.
    }
    await MerchantAccount.create([{ accountId: randomUUID(), email, passwordHash, merchantId, role: 'OWNER' }], { session });
    return { created: true };
  });
}
