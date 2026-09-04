export const DEMO_SESSION_STORAGE_KEY = "qr2buy_demo_token";
export const DEMO_HARDWARE_STORAGE_KEY = "qr2buy_demo_hardware_binding";
export const DEMO_HARDWARE_DEVICE_ID = "demo-device";

export const HARDWARE_OPERATOR_COPY = {
  de: {
    hardwareOperatorLabel: "Operator-Werkzeug",
    hardwarePair: "Hardware koppeln",
    hardwarePairingPrompt: "Pairing-Code",
    hardwarePairingHint: "Verbindet nur diese Demo-Session mit dem physischen Prototyp.",
    hardwareConnect: "Koppeln",
    hardwareCancel: "Abbrechen",
    hardwareConnecting: "Hardware wird gekoppelt …",
    hardwareConnected: "Hardware verbunden",
    hardwarePairError: "Hardware konnte nicht gekoppelt werden. Pairing-Code und Backend-Konfiguration prüfen.",
    hardwareSyncError: "Hardwareverbindung getrennt. Die Browser-Demo läuft weiter.",
    hardwareRetryPairing: "Erneut koppeln"
  },
  en: {
    hardwareOperatorLabel: "Operator tool",
    hardwarePair: "Pair hardware",
    hardwarePairingPrompt: "Pairing code",
    hardwarePairingHint: "Connects only this demo session to the physical prototype.",
    hardwareConnect: "Pair",
    hardwareCancel: "Cancel",
    hardwareConnecting: "Pairing hardware …",
    hardwareConnected: "Hardware connected",
    hardwarePairError: "Hardware could not be paired. Check the pairing code and backend configuration.",
    hardwareSyncError: "Hardware connection lost. The browser demo keeps running.",
    hardwareRetryPairing: "Pair again"
  }
};

function storageGet(storage, key) {
  try {
    return storage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function storageSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // The demo remains usable when session storage is unavailable.
  }
}

function storageRemove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // The demo remains usable when session storage is unavailable.
  }
}

export function readHardwareBinding(storage) {
  try {
    const value = JSON.parse(storageGet(storage, DEMO_HARDWARE_STORAGE_KEY));
    if (value?.deviceId !== DEMO_HARDWARE_DEVICE_ID || typeof value.productKey !== "string" || !["de", "en"].includes(value.locale)) return null;
    return value;
  } catch {
    return null;
  }
}

export function rememberHardwareBinding(storage, binding) {
  const marker = {
    deviceId: DEMO_HARDWARE_DEVICE_ID,
    productKey: binding.productKey,
    locale: binding.locale
  };
  storageSet(storage, DEMO_HARDWARE_STORAGE_KEY, JSON.stringify(marker));
  return marker;
}

export function clearHardwareBinding(storage) {
  storageRemove(storage, DEMO_HARDWARE_STORAGE_KEY);
}

export async function createFreshDemoSession({ storage, createSession }) {
  clearHardwareBinding(storage);
  storageRemove(storage, DEMO_SESSION_STORAGE_KEY);
  const live = await createSession();
  storageSet(storage, DEMO_SESSION_STORAGE_KEY, live.token);
  return live;
}

export async function restoreOrCreateDemoSession({ storage, getSession, createSession }) {
  const savedToken = storageGet(storage, DEMO_SESSION_STORAGE_KEY);
  if (savedToken) {
    try {
      const snapshot = await getSession(savedToken);
      return { live: { ...snapshot, token: savedToken }, restored: true };
    } catch (error) {
      if (!/^(?:400|404)(?:\s|$)/.test(String(error?.message || ""))) throw error;
    }
  }

  return {
    live: await createFreshDemoSession({ storage, createSession }),
    restored: false
  };
}

export async function bindHardwareForSession({ bind, storage, token, pairingSecret, productKey, locale }) {
  const binding = { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey, locale };
  const response = await bind(token, { ...binding, pairingSecret });
  return { response, marker: rememberHardwareBinding(storage, binding) };
}

export function hardwareSyncRequired(current, next) {
  return Boolean(
    current
    && current.deviceId === DEMO_HARDWARE_DEVICE_ID
    && (current.productKey !== next.productKey || current.locale !== next.locale)
  );
}

export async function syncHardwareSelection({ update, storage, token, current, productKey, locale }) {
  const next = { deviceId: DEMO_HARDWARE_DEVICE_ID, productKey, locale };
  if (!hardwareSyncRequired(current, next)) return { synced: false, marker: current };
  const response = await update(token, next);
  return { synced: true, response, marker: rememberHardwareBinding(storage, next) };
}
