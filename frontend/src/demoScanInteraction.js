const SCAN_MARKER_KEY = 'qr2buy_demo_scan_interaction';
export const SCAN_MARKER_TTL_MS = 10_000;

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
    Number(existing.expiresAt) > currentTime
  ) return { reported: false };

  const marker = { token, productKey, expiresAt: currentTime + SCAN_MARKER_TTL_MS };
  storage.setItem(SCAN_MARKER_KEY, JSON.stringify(marker));
  try {
    const result = await report(token, productKey);
    return { reported: result?.interactionRecorded === true };
  } catch (error) {
    const stored = readMarker(storage);
    if (stored?.token === token && stored?.productKey === productKey && stored?.expiresAt === marker.expiresAt) {
      storage.removeItem(SCAN_MARKER_KEY);
    }
    throw error;
  }
}
