export const purchaseText = {
  de: { buy: 'Kaufen (Testmodus)', test: 'Stripe-Testmodus: keine echte Zahlung, kein echter Kauf.',
    CHECKOUT_STARTED: 'Zahlung wird erwartet', PAID: 'Testzahlung bestätigt', CANCELLED: 'Kauf abgebrochen', EXPIRED: 'Checkout abgelaufen',
    error: 'Checkout ist gerade nicht möglich. Bitte erneut versuchen.', pending: 'Der Checkout wird vorbereitet. Bitte Status prüfen.',
    cancel: 'Checkout abbrechen', resume: 'Stripe-Testcheckout öffnen', back: 'Zur Produktseite', loading: 'Status wird geladen …', unavailable: 'Bestellung nicht verfügbar',
    keep: 'Bewahre diesen Link auf. Der Status wird vom Server bestätigt.', orders: 'Bestellungen', empty: 'Noch keine Bestellungen.',
    quantity: 'Menge', price: 'Preis', number: 'Bestellnummer', created: 'Erstellt', limit: 'Die neuesten 200 Bestellungen.',
    recentSales: 'Neueste Verkäufe', latestSale: 'Neuester Verkauf', paidSale: 'BEZAHLT (Testmodus)', paidAt: 'Bezahlt am',
    viewOrders: 'Alle Bestellungen ansehen', emptySales: 'Noch keine bezahlten Verkäufe.', salesError: 'Verkäufe können gerade nicht aktualisiert werden.' },
  en: { buy: 'Buy (test mode)', test: 'Stripe test mode: no real payment or purchase.',
    CHECKOUT_STARTED: 'Awaiting payment', PAID: 'Test payment confirmed', CANCELLED: 'Purchase cancelled', EXPIRED: 'Checkout expired',
    error: 'Checkout is currently unavailable. Please try again.', pending: 'Checkout is being prepared. Please check its status.',
    cancel: 'Cancel checkout', resume: 'Open Stripe test checkout', back: 'Back to product', loading: 'Loading status …', unavailable: 'Order unavailable',
    keep: 'Keep this link. The server confirms the status.', orders: 'Orders', empty: 'No orders yet.',
    quantity: 'Quantity', price: 'Price', number: 'Order number', created: 'Created', limit: 'The latest 200 orders.',
    recentSales: 'Recent sales', latestSale: 'Latest sale', paidSale: 'PAID (test mode)', paidAt: 'Paid at',
    viewOrders: 'View all orders', emptySales: 'No paid sales yet.', salesError: 'Sales cannot be refreshed right now.' }
};
export const canBuy = data => data?.checkoutAvailable === true && data.offer?.active === true
  && data.offer.purchasable === true && data.offer.stockQuantity > 0 && data.availabilityState === 'READY';
export function stripeCheckoutUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'checkout.stripe.com' && !u.username && !u.password; }
  catch { return false; }
}
export async function purchaseRequest(path, body, signal) {
  const response = await fetch('/api/purchases/' + path, { method: body ? 'POST' : 'GET', cache: 'no-store', signal,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'error');
  return result;
}
