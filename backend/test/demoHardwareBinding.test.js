import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { publicDemoProduct, getDemoProduct } from '../src/demo/catalog.js';
import {
  createDemoHardwareBindingService,
  decryptDemoSessionToken,
  DemoHardwareError
} from '../src/demo/hardwareBinding.js';
import { DemoHardwareBinding } from '../src/demo/hardwareBindingModel.js';

const TOKEN_A = 'A'.repeat(43);
const TOKEN_B = 'B'.repeat(43);
const DEVICE_ID = 'demo-device';
const PAIRING_SECRET = 'test-only-pairing-secret';
const DEVICE_SECRET = 'test-only-device-secret';
const ENCRYPTION_KEY = '11'.repeat(32);
const NOW = new Date('2026-09-04T12:00:00.000Z');

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function clone(value) {
  return structuredClone(value);
}

function harness() {
  const states = new Map();
  const sessions = new Map([
    [tokenHash(TOKEN_A), { _id: 'session-a', tokenHash: tokenHash(TOKEN_A), expiresAt: new Date(NOW.getTime() + 7_200_000) }],
    [tokenHash(TOKEN_B), { _id: 'session-b', tokenHash: tokenHash(TOKEN_B), expiresAt: new Date(NOW.getTime() + 7_200_000) }]
  ]);
  const bindings = new Map();

  function stateKey(token, productKey) {
    return `${token}:${productKey}`;
  }

  function stateFor(token, productKey) {
    return states.get(stateKey(token, productKey)) || {
      productKey,
      status: 'READY',
      eventVersion: 0,
      interactionState: null,
      interactionExpiresAt: null,
      resetAt: null
    };
  }

  const demoService = {
    tokenHashFor(token) {
      if (![TOKEN_A, TOKEN_B].includes(token)) {
        throw Object.assign(new Error('invalid_session'), { code: 'invalid_session', status: 404 });
      }
      return tokenHash(token);
    },
    async getProduct(token, productKey) {
      this.tokenHashFor(token);
      const product = getDemoProduct(productKey);
      if (!product) throw Object.assign(new Error('product_not_found'), { code: 'product_not_found', status: 404 });
      return { ok: true, product: publicDemoProduct(product), state: clone(stateFor(token, productKey)) };
    }
  };

  const repository = {
    async findSessionByTokenHash(hash) {
      return clone(sessions.get(hash) || null);
    },
    async upsertForDevice(data) {
      const stored = clone(data);
      bindings.set(data.deviceId, stored);
      return clone(stored);
    },
    async updateForSession({ deviceId, demoSessionId, tokenHash: hash, now, changes }) {
      const binding = bindings.get(deviceId);
      if (
        !binding ||
        String(binding.demoSessionId) !== String(demoSessionId) ||
        binding.tokenHash !== hash ||
        new Date(binding.expiresAt) <= now
      ) return null;
      Object.assign(binding, clone(changes));
      return clone(binding);
    },
    async findActiveByDeviceId(deviceId, now) {
      const binding = bindings.get(deviceId);
      return binding && new Date(binding.expiresAt) > now ? clone(binding) : null;
    }
  };

  const env = {
    NODE_ENV: 'production',
    DEMO_PUBLIC_BASE_URL: 'https://qr2buy.com',
    DEMO_HARDWARE_PAIRING_SECRET: PAIRING_SECRET,
    DEMO_HARDWARE_ENCRYPTION_KEY: ENCRYPTION_KEY,
    DEMO_HARDWARE_DEVICE_SECRETS: JSON.stringify({ [DEVICE_ID]: DEVICE_SECRET })
  };
  const service = createDemoHardwareBindingService({ repository, demoService, env, now: () => new Date(NOW) });

  async function bind(token = TOKEN_A, productKey = 'bag') {
    return service.bind({
      token,
      deviceId: DEVICE_ID,
      productKey,
      locale: 'de',
      pairingSecret: PAIRING_SECRET,
      baseUrls: ['https://qr2buy.com']
    });
  }

  return { service, repository, demoService, bindings, sessions, states, bind };
}

test('creates an encrypted hardware binding and returns the expected READY projection', async () => {
  const { bind, bindings } = harness();
  const result = await bind();
  const stored = bindings.get(DEVICE_ID);

  assert.equal(result.ok, true);
  assert.equal(result.bound, true);
  assert.equal(result.deviceId, DEVICE_ID);
  assert.equal(result.productKey, 'bag');
  assert.equal(result.text, 'Handgemachte Ledertasche');
  assert.equal(result.priceText, '129,00 €');
  assert.equal(result.status, 'READY');
  assert.equal(result.eventVersion, 0);
  assert.equal(result.interactionState, null);
  assert.equal(stored.tokenHash, tokenHash(TOKEN_A));
  assert.ok(!stored.encryptedSessionToken.includes(TOKEN_A));
  assert.equal(result.tokenHash, undefined);
  assert.equal(result.encryptedSessionToken, undefined);
});

test('projects a fresh scan separately from the READY commerce status', async () => {
  const { service, states, bind } = harness();
  states.set(`${TOKEN_A}:bag`, {
    productKey: 'bag',
    status: 'READY',
    eventVersion: 1,
    interactionState: 'SCANNED',
    interactionExpiresAt: '2026-09-04T12:00:10.000Z',
    resetAt: null
  });
  await bind();
  const result = await service.getConfig({
    deviceId: DEVICE_ID,
    deviceSecret: DEVICE_SECRET,
    baseUrls: ['https://qr2buy.com']
  });
  assert.equal(result.status, 'READY');
  assert.equal(result.interactionState, 'SCANNED');
  assert.equal(result.interactionExpiresAt, '2026-09-04T12:00:10.000Z');
});

test('rejects an incorrect operator pairing secret', async () => {
  const { service } = harness();
  await assert.rejects(
    service.bind({
      token: TOKEN_A,
      deviceId: DEVICE_ID,
      productKey: 'bag',
      pairingSecret: 'wrong',
      baseUrls: ['https://qr2buy.com']
    }),
    (error) => error instanceof DemoHardwareError && error.code === 'invalid_pairing_secret' && error.status === 401
  );
});

test('rejects an incorrect device secret', async () => {
  const { service, bind } = harness();
  await bind();
  await assert.rejects(
    service.getConfig({ deviceId: DEVICE_ID, deviceSecret: 'wrong', baseUrls: ['https://qr2buy.com'] }),
    (error) => error instanceof DemoHardwareError && error.code === 'invalid_device_secret' && error.status === 401
  );
});

test('keeps session isolation and atomically rebinds the same device', async () => {
  const { service, bind, bindings } = harness();
  await bind(TOKEN_A, 'bag');
  await bind(TOKEN_B, 'tree');

  const current = bindings.get(DEVICE_ID);
  assert.equal(current.demoSessionId, 'session-b');
  assert.equal(current.tokenHash, tokenHash(TOKEN_B));

  await assert.rejects(
    service.update({
      token: TOKEN_A,
      deviceId: DEVICE_ID,
      productKey: 'book',
      baseUrls: ['https://qr2buy.com']
    }),
    (error) => error.code === 'hardware_binding_not_found' && error.status === 404
  );

  const config = await service.getConfig({
    deviceId: DEVICE_ID,
    deviceSecret: DEVICE_SECRET,
    baseUrls: ['https://qr2buy.com']
  });
  assert.equal(config.productKey, 'tree');
  assert.match(config.qr, new RegExp(`${TOKEN_B}$`));
});

test('updates productKey only for the currently bound session', async () => {
  const { service, bind } = harness();
  await bind();
  const result = await service.update({
    token: TOKEN_A,
    deviceId: DEVICE_ID,
    productKey: 'print',
    locale: 'en',
    baseUrls: ['https://qr2buy.com']
  });
  assert.equal(result.productKey, 'print');
  assert.equal(result.text, 'Framed art print');
  assert.equal(result.priceText, '€390.00');
});

for (const status of ['READY', 'RESERVED', 'PAID', 'SOLD']) {
  test(`projects ${status} directly from the bound DemoSession state`, async () => {
    const { service, states, bind } = harness();
    states.set(`${TOKEN_A}:bag`, {
      productKey: 'bag',
      status,
      eventVersion: 3,
      resetAt: status === 'READY' || status === 'SOLD' ? null : '2026-09-04T12:00:20.000Z'
    });
    await bind();
    const result = await service.getConfig({
      deviceId: DEVICE_ID,
      deviceSecret: DEVICE_SECRET,
      baseUrls: ['https://qr2buy.com']
    });
    assert.equal(result.status, status);
    assert.equal(result.eventVersion, 3);
  });
}

test('returns bound false when no binding exists', async () => {
  const { service } = harness();
  assert.deepEqual(
    await service.getConfig({ deviceId: DEVICE_ID, deviceSecret: DEVICE_SECRET, baseUrls: ['https://qr2buy.com'] }),
    { ok: true, bound: false }
  );
});

test('returns bound false for an expired binding even before TTL cleanup runs', async () => {
  const { service, bindings, bind } = harness();
  await bind();
  bindings.get(DEVICE_ID).expiresAt = new Date(NOW.getTime() - 1);
  assert.deepEqual(
    await service.getConfig({ deviceId: DEVICE_ID, deviceSecret: DEVICE_SECRET, baseUrls: ['https://qr2buy.com'] }),
    { ok: true, bound: false }
  );
});

test('hardware QR points to exactly the same DemoSession token and selected product', async () => {
  const { service, bind } = harness();
  const bound = await bind(TOKEN_A, 'bag');
  const config = await service.getConfig({
    deviceId: DEVICE_ID,
    deviceSecret: DEVICE_SECRET,
    baseUrls: ['https://qr2buy.com']
  });
  const expected = `https://qr2buy.com/demo/p/bag#session=${TOKEN_A}`;
  assert.equal(bound.qr, expected);
  assert.equal(config.qr, expected);
});

test('AES-GCM authentication rejects a modified encrypted session token', async () => {
  const { bindings, bind } = harness();
  await bind();
  const binding = bindings.get(DEVICE_ID);
  const parts = binding.encryptedSessionToken.split('.');
  parts[3] = `${parts[3].startsWith('A') ? 'B' : 'A'}${parts[3].slice(1)}`;
  assert.throws(
    () => decryptDemoSessionToken(
      parts.join('.'),
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      DEVICE_ID,
      binding.tokenHash
    ),
    (error) => error.code === 'hardware_binding_decryption_failed'
  );
});

test('defines TTL cleanup for DemoHardwareBinding.expiresAt', () => {
  const ttlIndex = DemoHardwareBinding.schema.indexes().find(([fields]) => fields.expiresAt === 1);
  assert.ok(ttlIndex);
  assert.equal(ttlIndex[1].expireAfterSeconds, 0);
});
