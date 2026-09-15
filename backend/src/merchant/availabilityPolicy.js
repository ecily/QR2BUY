// Merchant physical zero stock is OUT_OF_STOCK; legacy wire SOLD is only
// retained for old displays. This does not reinterpret actual sale/demo SOLD.
export function availabilityState(offer, held = 0) {
  if (!offer.active) return 'PAUSED';
  if (offer.stockQuantity === 0) return 'OUT_OF_STOCK';
  return offer.stockQuantity - held > 0 ? 'READY' : 'RESERVED';
}
export const notifyStateAllowed = state => ['OUT_OF_STOCK', 'PAUSED', 'RESERVED'].includes(state);
