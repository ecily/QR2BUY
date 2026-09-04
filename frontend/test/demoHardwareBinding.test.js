import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  bindHardwareForSession,
  DEMO_HARDWARE_DEVICE_ID,
  DEMO_HARDWARE_STORAGE_KEY,
  DEMO_SESSION_STORAGE_KEY,
  HARDWARE_OPERATOR_COPY,
  readHardwareBinding,
  restoreOrCreateDemoSession,
  syncHardwareSelection
} from "../src/demoHardwareBinding.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values
  };
}

test("regular demo creation does not pair hardware automatically", async () => {
  let bindingCalls = 0;
  const storage = memoryStorage();
  const result = await restoreOrCreateDemoSession({
    storage,
    getSession: async () => { throw new Error("must not restore"); },
    createSession: async () => ({ token: "demo-token", products: [] })
  });
  const bind = async () => { bindingCalls += 1; };

  assert.equal(result.restored, false);
  assert.equal(storage.getItem(DEMO_SESSION_STORAGE_KEY), "demo-token");
  assert.equal(storage.getItem(DEMO_HARDWARE_STORAGE_KEY), null);
  assert.equal(bindingCalls, 0);
  assert.equal(typeof bind, "function");
});

test("successful explicit pairing binds demo-device and remembers only non-secret metadata", async () => {
  const storage = memoryStorage();
  const calls = [];
  const result = await bindHardwareForSession({
    bind: async (token, body) => { calls.push({ token, body }); return { ok: true, bound: true }; },
    storage,
    token: "demo-token",
    pairingSecret: "pairing-code-placeholder",
    productKey: "bag",
    locale: "de"
  });

  assert.deepEqual(calls, [{ token: "demo-token", body: { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "bag", locale: "de", pairingSecret: "pairing-code-placeholder" } }]);
  assert.deepEqual(result.marker, { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "bag", locale: "de" });
  assert.ok(!storage.getItem(DEMO_HARDWARE_STORAGE_KEY).includes("pairing-code-placeholder"));
});

test("wrong pairing code leaves no hardware marker", async () => {
  const storage = memoryStorage();
  await assert.rejects(() => bindHardwareForSession({
    bind: async () => { throw new Error("401 Unauthorized"); },
    storage,
    token: "demo-token",
    pairingSecret: "invalid-placeholder",
    productKey: "book",
    locale: "en"
  }), /401/);
  assert.equal(readHardwareBinding(storage), null);
});

test("a changed product or locale produces PATCH metadata", async () => {
  const storage = memoryStorage();
  const calls = [];
  const current = { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "book", locale: "de" };
  const result = await syncHardwareSelection({
    update: async (token, body) => { calls.push({ token, body }); return { ok: true }; },
    storage,
    token: "demo-token",
    current,
    productKey: "bag",
    locale: "en"
  });

  assert.equal(result.synced, true);
  assert.deepEqual(calls, [{ token: "demo-token", body: { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "bag", locale: "en" } }]);
  assert.deepEqual(readHardwareBinding(storage), calls[0].body);
});

test("an unchanged selection does not produce a PATCH", async () => {
  let calls = 0;
  const current = { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "bag", locale: "de" };
  const result = await syncHardwareSelection({
    update: async () => { calls += 1; },
    storage: memoryStorage(),
    token: "demo-token",
    current,
    productKey: "bag",
    locale: "de"
  });
  assert.equal(result.synced, false);
  assert.equal(calls, 0);
});

test("paired frontpage selection syncs bag to tree and back exactly once", async () => {
  const storage = memoryStorage();
  const patchCalls = [];
  const { marker: bagMarker } = await bindHardwareForSession({
    bind: async () => ({ ok: true, bound: true }),
    storage,
    token: "same-demo-session",
    pairingSecret: "pairing-code-placeholder",
    productKey: "bag",
    locale: "de"
  });
  const update = async (token, body) => {
    patchCalls.push({ token, body });
    return { ok: true, bound: true };
  };

  const tree = await syncHardwareSelection({
    update,
    storage,
    token: "same-demo-session",
    current: bagMarker,
    productKey: "tree",
    locale: "de"
  });
  const unchangedTree = await syncHardwareSelection({
    update,
    storage,
    token: "same-demo-session",
    current: tree.marker,
    productKey: "tree",
    locale: "de"
  });
  await syncHardwareSelection({
    update,
    storage,
    token: "same-demo-session",
    current: tree.marker,
    productKey: "bag",
    locale: "de"
  });

  assert.equal(unchangedTree.synced, false);
  assert.deepEqual(patchCalls, [
    {
      token: "same-demo-session",
      body: { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "tree", locale: "de" }
    },
    {
      token: "same-demo-session",
      body: { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "bag", locale: "de" }
    }
  ]);
});

test("PATCH failure is exposed without replacing the browser demo session", async () => {
  const storage = memoryStorage({
    [DEMO_HARDWARE_STORAGE_KEY]: JSON.stringify({ deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "book", locale: "de" })
  });
  await assert.rejects(() => syncHardwareSelection({
    update: async () => { throw new Error("404 Binding not found"); },
    storage,
    token: "demo-token",
    current: readHardwareBinding(storage),
    productKey: "bag",
    locale: "de"
  }), /404/);
  assert.equal(readHardwareBinding(storage).productKey, "book");

  const landing = await readFile(new URL("../src/pages/LandingPage.jsx", import.meta.url), "utf8");
  assert.match(landing, /setHardwareStatus\("error"\)/);
  assert.match(landing, /setHardwareError\(t\.hardwareSyncError\)/);
});

test("valid saved demo session is restored without creating a new one", async () => {
  const storage = memoryStorage({ [DEMO_SESSION_STORAGE_KEY]: "saved-demo-token" });
  let createCalls = 0;
  const result = await restoreOrCreateDemoSession({
    storage,
    getSession: async (token) => ({ ok: true, session: { id: token } }),
    createSession: async () => { createCalls += 1; return { token: "new-token" }; }
  });
  assert.equal(result.restored, true);
  assert.equal(result.live.token, "saved-demo-token");
  assert.equal(createCalls, 0);
});

test("expired saved demo session creates a fresh session and clears old binding", async () => {
  const storage = memoryStorage({
    [DEMO_SESSION_STORAGE_KEY]: "expired-token",
    [DEMO_HARDWARE_STORAGE_KEY]: JSON.stringify({ deviceId: DEMO_HARDWARE_DEVICE_ID, productKey: "bag", locale: "de" })
  });
  const result = await restoreOrCreateDemoSession({
    storage,
    getSession: async () => { throw new Error("404 Demo session not found"); },
    createSession: async () => ({ token: "fresh-token" })
  });
  assert.equal(result.restored, false);
  assert.equal(result.live.token, "fresh-token");
  assert.equal(storage.getItem(DEMO_SESSION_STORAGE_KEY), "fresh-token");
  assert.equal(readHardwareBinding(storage), null);
});

test("invalid saved demo token also creates a fresh isolated session", async () => {
  const storage = memoryStorage({ [DEMO_SESSION_STORAGE_KEY]: "invalid-token" });
  const result = await restoreOrCreateDemoSession({
    storage,
    getSession: async () => { throw new Error("400 Invalid demo token"); },
    createSession: async () => ({ token: "replacement-token" })
  });
  assert.equal(result.restored, false);
  assert.equal(result.live.token, "replacement-token");
});

test("temporary restore errors do not silently replace the session", async () => {
  const storage = memoryStorage({ [DEMO_SESSION_STORAGE_KEY]: "saved-demo-token" });
  let createCalls = 0;
  await assert.rejects(() => restoreOrCreateDemoSession({
    storage,
    getSession: async () => { throw new Error("503 Unavailable"); },
    createSession: async () => { createCalls += 1; return { token: "new-token" }; }
  }), /503/);
  assert.equal(createCalls, 0);
  assert.equal(storage.getItem(DEMO_SESSION_STORAGE_KEY), "saved-demo-token");
});

test("operator controls and errors are translated in German and English", () => {
  assert.equal(HARDWARE_OPERATOR_COPY.de.hardwarePair, "Hardware koppeln");
  assert.equal(HARDWARE_OPERATOR_COPY.en.hardwarePair, "Pair hardware");
  assert.match(HARDWARE_OPERATOR_COPY.de.hardwareSyncError, /Browser-Demo/);
  assert.match(HARDWARE_OPERATOR_COPY.en.hardwareSyncError, /browser demo/i);
});

test("API client sends pairing secret only as POST header and PATCH without it", async () => {
  const source = await readFile(new URL("../src/api.js", import.meta.url), "utf8");
  assert.match(source, /http\('POST',[\s\S]*'x-demo-pairing-secret': pairingSecret/);
  assert.match(source, /http\('PATCH',[\s\S]*json: \{ deviceId, productKey, locale \}/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /x-device-secret/);
});
