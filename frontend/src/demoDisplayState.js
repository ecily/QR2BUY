export function getHardwareDisplayMode(status) {
  if (status === "PAID") return "paid";
  if (status === "RESERVED") return "reserved";
  if (status === "SOLD") return "sold";
  return "product";
}

export function blocksDemoActions(status) {
  return status === "SOLD" || status === "RESERVED";
}
