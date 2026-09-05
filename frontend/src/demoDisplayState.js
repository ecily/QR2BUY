export function getHardwareDisplayMode(status, interactionState = null) {
  if (status === "PAID") return "paid";
  if (status === "RESERVED") return "reserved";
  if (status === "SOLD") return "sold";
  if (status === "READY" && interactionState === "SCANNED") return "scan";
  return "product";
}

export function blocksDemoActions(status) {
  return status === "SOLD" || status === "RESERVED";
}
