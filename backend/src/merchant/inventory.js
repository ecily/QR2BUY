import { MerchantReservation } from './models.js';

export function reservedQuantity(offerId, at = new Date(), session = null) {
  // P0.5 reserves exactly one unit. Expired holds never reduce availability,
  // even when the cleanup worker is delayed or the application was offline.
  return MerchantReservation.countDocuments({ offerId, status: 'RESERVED', expiresAt: { $gt: at } }).session(session);
}
export function expireReservations(at = new Date()) {
  return MerchantReservation.updateMany({ status: 'RESERVED', expiresAt: { $lte: at } }, { $set: { status: 'EXPIRED' } });
}
export function startReservationExpiry(onError = () => {}, intervalMs = 30000) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try { await expireReservations(); } catch { onError(); } finally { busy = false; }
  };
  const timer = setInterval(run, intervalMs); timer.unref(); void run();
  return () => clearInterval(timer);
}
