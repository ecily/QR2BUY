const SCAN_MARKER_KEY = 'qr2buy_demo_scan_interaction';
const PENDING_MARKER_TIMEOUT_MS = 30_000;

function readMarker(storage) {
  try {
    return JSON.parse(storage?.getItem(SCAN_MARKER_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function reportDemoScanOnce({ storage, token, productKey, report, now = Date.now }) {
  if (!storage || !token || !productKey || typeof report !== 'function') return { reported: false };
  const currentTime = now();
  const existing = readMarker(storage);
  if (
    existing?.token === token &&
    existing?.productKey === productKey &&
    (
      (existing?.pending === true && Number(existing.startedAt) + PENDING_MARKER_TIMEOUT_MS > currentTime) ||
      Number(existing.expiresAt) > currentTime
    )
  ) return { reported: false };

  const marker = { token, productKey, pending: true, startedAt: currentTime };
  storage.setItem(SCAN_MARKER_KEY, JSON.stringify(marker));
  try {
    const result = await report(token, productKey);
    const state = result?.session?.products?.find((item) => item.productKey === productKey);
    const expiresAt = Date.parse(state?.interactionExpiresAt || '');
    if (Number.isFinite(expiresAt) && expiresAt > currentTime) {
      storage.setItem(SCAN_MARKER_KEY, JSON.stringify({ token, productKey, expiresAt }));
    } else {
      storage.removeItem(SCAN_MARKER_KEY);
    }
    return { reported: result?.interactionRecorded === true };
  } catch (error) {
    const stored = readMarker(storage);
    if (stored?.token === token && stored?.productKey === productKey && stored?.startedAt === marker.startedAt) {
      storage.removeItem(SCAN_MARKER_KEY);
    }
    throw error;
  }
}
