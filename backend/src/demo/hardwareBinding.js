import crypto from 'crypto';
import { DemoSession } from '../models.js';
import { getDemoProduct } from './catalog.js';
import { DemoHardwareBinding } from './hardwareBindingModel.js';

const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const TOKEN_ENVELOPE_VERSION = 'v1';

export class DemoHardwareError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'DemoHardwareError';
    this.code = code;
    this.status = status;
  }
}

function safeSecretEqual(expected, provided) {
  if (!expected || !provided) return false;
  const expectedHash = crypto.createHash('sha256').update(String(expected)).digest();
  const providedHash = crypto.createHash('sha256').update(String(provided)).digest();
  return crypto.timingSafeEqual(expectedHash, providedHash);
}

function encryptionKey(env) {
  const value = String(env.DEMO_HARDWARE_ENCRYPTION_KEY || '');
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new DemoHardwareError('hardware_encryption_not_configured', 503);
  }
  return Buffer.from(value, 'hex');
}

function deviceSecrets(env) {
  try {
    const parsed = JSON.parse(String(env.DEMO_HARDWARE_DEVICE_SECRETS || ''));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid map');
    return parsed;
  } catch {
    throw new DemoHardwareError('hardware_device_auth_not_configured', 503);
  }
}

function configuredDeviceSecret(env, deviceId) {
  const configured = deviceSecrets(env);
  if (!Object.hasOwn(configured, deviceId)) return '';
  const value = configured[deviceId];
  return typeof value === 'string' ? value : '';
}

function normalizeDeviceId(value) {
  const deviceId = String(value || '').trim();
  if (!DEVICE_ID_PATTERN.test(deviceId)) throw new DemoHardwareError('invalid_device_id', 400);
  return deviceId;
}

function normalizeLocale(value) {
  return value === 'en' ? 'en' : 'de';
}

function requireProduct(productKey) {
  const key = String(productKey || '').trim();
  if (!getDemoProduct(key)) throw new DemoHardwareError('product_not_found', 404);
  return key;
}

function requirePublicOrigin(values, requireHttps) {
  const candidates = Array.isArray(values) ? values : [values];
  for (const value of candidates) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      if (url.username || url.password) continue;
      if (requireHttps && url.protocol !== 'https:') continue;
      return url.origin;
    } catch {
      // Try the next configured/request-derived origin.
    }
  }
  throw new DemoHardwareError('invalid_public_base_url', 500);
}

function tokenAad(deviceId, tokenHash) {
  return Buffer.from(`${deviceId}:${tokenHash}`, 'utf8');
}

export function encryptDemoSessionToken(token, key, deviceId, tokenHash) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(tokenAad(deviceId, tokenHash));
  const ciphertext = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_ENVELOPE_VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptDemoSessionToken(envelope, key, deviceId, tokenHash) {
  try {
    const [version, ivValue, tagValue, ciphertextValue, extra] = String(envelope || '').split('.');
    if (version !== TOKEN_ENVELOPE_VERSION || !ivValue || !tagValue || !ciphertextValue || extra) {
      throw new Error('invalid envelope');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
    decipher.setAAD(tokenAad(deviceId, tokenHash));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    throw new DemoHardwareError('hardware_binding_decryption_failed', 503);
  }
}

function formatPrice(product, locale) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'de-DE', {
    style: 'currency',
    currency: product.currency
  }).format(product.price).replace(/\s/g, ' ');
}

function qrUrl(origin, productKey, token) {
  return `${origin}/demo/p/${encodeURIComponent(productKey)}#session=${encodeURIComponent(token)}`;
}

function projectConfig({ binding, token, productResult, origin }) {
  const product = productResult.product;
  const state = productResult.state;
  return {
    ok: true,
    bound: true,
    deviceId: binding.deviceId,
    productKey: product.key,
    text: product.name[binding.locale],
    priceText: formatPrice(product, binding.locale),
    status: state.status,
    qr: qrUrl(origin, product.key, token),
    eventVersion: state.eventVersion,
    resetAt: state.resetAt,
    expiresAt: new Date(binding.expiresAt).toISOString()
  };
}

export function createMongooseDemoHardwareRepository() {
  return {
    findSessionByTokenHash(tokenHash) {
      return DemoSession.findOne({ tokenHash });
    },

    async upsertForDevice(data) {
      try {
        return await DemoHardwareBinding.findOneAndUpdate(
          { deviceId: data.deviceId },
          { $set: data },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
      } catch (error) {
        if (error?.code !== 11000) throw error;
        return DemoHardwareBinding.findOneAndUpdate(
          { deviceId: data.deviceId },
          { $set: data },
          { new: true, runValidators: true }
        );
      }
    },

    updateForSession({ deviceId, demoSessionId, tokenHash, now, changes }) {
      return DemoHardwareBinding.findOneAndUpdate(
        { deviceId, demoSessionId, tokenHash, expiresAt: { $gt: now } },
        { $set: changes },
        { new: true, runValidators: true }
      ).select('+encryptedSessionToken');
    },

    findActiveByDeviceId(deviceId, now) {
      return DemoHardwareBinding.findOne({ deviceId, expiresAt: { $gt: now } })
        .select('+encryptedSessionToken');
    }
  };
}

export function createDemoHardwareBindingService({
  repository,
  demoService,
  env = process.env,
  now = () => new Date(),
  requireHttps = env.NODE_ENV === 'production'
}) {
  if (!repository || !demoService) throw new Error('hardware binding dependencies required');

  function assertPairingSecret(provided) {
    const expected = String(env.DEMO_HARDWARE_PAIRING_SECRET || '');
    if (!expected) throw new DemoHardwareError('hardware_pairing_not_configured', 503);
    if (!safeSecretEqual(expected, provided)) throw new DemoHardwareError('invalid_pairing_secret', 401);
  }

  function assertDeviceSecret(deviceId, provided) {
    const expected = configuredDeviceSecret(env, deviceId);
    if (!safeSecretEqual(expected, provided)) throw new DemoHardwareError('invalid_device_secret', 401);
  }

  function assertKnownDevice(deviceId) {
    if (!configuredDeviceSecret(env, deviceId)) throw new DemoHardwareError('invalid_device_id', 400);
  }

  function originFor(baseUrls) {
    return requirePublicOrigin(
      [env.DEMO_PUBLIC_BASE_URL, env.PUBLIC_BASE_URL, ...(Array.isArray(baseUrls) ? baseUrls : [baseUrls])],
      requireHttps
    );
  }

  async function sessionIdentity(token) {
    const tokenHash = demoService.tokenHashFor(token);
    const session = await repository.findSessionByTokenHash(tokenHash);
    if (!session || new Date(session.expiresAt) <= now()) {
      throw new DemoHardwareError('session_expired', 404);
    }
    return { tokenHash, session };
  }

  return {
    async bind({ token, deviceId: rawDeviceId, productKey: rawProductKey, locale, pairingSecret, baseUrls }) {
      assertPairingSecret(pairingSecret);
      const deviceId = normalizeDeviceId(rawDeviceId);
      assertKnownDevice(deviceId);
      const productKey = requireProduct(rawProductKey);
      const normalizedLocale = normalizeLocale(locale);
      const productResult = await demoService.getProduct(token, productKey);
      const { tokenHash, session } = await sessionIdentity(token);
      const boundAt = now();
      const binding = await repository.upsertForDevice({
        deviceId,
        demoSessionId: session._id,
        tokenHash,
        encryptedSessionToken: encryptDemoSessionToken(
          token,
          encryptionKey(env),
          deviceId,
          tokenHash
        ),
        productKey,
        locale: normalizedLocale,
        boundAt,
        expiresAt: new Date(session.expiresAt)
      });
      return projectConfig({ binding, token, productResult, origin: originFor(baseUrls) });
    },

    async update({ token, deviceId: rawDeviceId, productKey: rawProductKey, locale, baseUrls }) {
      const deviceId = normalizeDeviceId(rawDeviceId);
      const productKey = requireProduct(rawProductKey);
      const productResult = await demoService.getProduct(token, productKey);
      const { tokenHash, session } = await sessionIdentity(token);
      const changes = { productKey };
      if (locale !== undefined) changes.locale = normalizeLocale(locale);
      const binding = await repository.updateForSession({
        deviceId,
        demoSessionId: session._id,
        tokenHash,
        now: now(),
        changes
      });
      if (!binding) throw new DemoHardwareError('hardware_binding_not_found', 404);
      return projectConfig({ binding, token, productResult, origin: originFor(baseUrls) });
    },

    async getConfig({ deviceId: rawDeviceId, deviceSecret, baseUrls }) {
      const deviceId = normalizeDeviceId(rawDeviceId);
      assertDeviceSecret(deviceId, deviceSecret);
      const binding = await repository.findActiveByDeviceId(deviceId, now());
      if (!binding) return { ok: true, bound: false };

      const token = decryptDemoSessionToken(
        binding.encryptedSessionToken,
        encryptionKey(env),
        deviceId,
        binding.tokenHash
      );
      if (!safeSecretEqual(demoService.tokenHashFor(token), binding.tokenHash)) {
        throw new DemoHardwareError('hardware_binding_decryption_failed', 503);
      }

      try {
        const productResult = await demoService.getProduct(token, binding.productKey);
        return projectConfig({ binding, token, productResult, origin: originFor(baseUrls) });
      } catch (error) {
        if (error?.code === 'session_expired' || error?.code === 'invalid_session') {
          return { ok: true, bound: false };
        }
        throw error;
      }
    }
  };
}
