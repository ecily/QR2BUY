export const DEMO_SAFETY_STORAGE_KEY = "qr2buy.demoSafetyAcknowledged";

export function hasDemoSafetyConfirmation(storage) {
  return storage?.getItem(DEMO_SAFETY_STORAGE_KEY) === "true";
}

export function confirmDemoSafety(storage) {
  storage?.setItem(DEMO_SAFETY_STORAGE_KEY, "true");
  return true;
}
