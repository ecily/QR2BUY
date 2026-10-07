import { MerchantReservation } from './models.js';
import { MerchantOrder } from './orderModel.js';

export async function reservedQuantity(offerId, at = new Date(), session = null) {
  // P0.5 reserves exactly one unit. Expired holds never reduce availability,
  // even when the cleanup worker is delayed or the application was offline.
  const reservations = await MerchantReservation.countDocuments({ offerId, status: 'RESERVED', expiresAt: { $gt: at } }).session(session);
  // A wall clock timeout cannot release a potentially paid Stripe session.
  const checkouts = await MerchantOrder.countDocuments({ offerId, status: 'CHECKOUT_STARTED' }).session(session);
  return reservations + checkouts;
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
