export const offerCopy = {
  de: {
    loading: 'Angebot wird geladen …', unavailable: 'Angebot derzeit nicht verfügbar',
    available: 'Verfügbar', soldOut: 'Momentan ausverkauft', paused: 'Derzeit nicht verfügbar',
    soldOutDetail: 'Dieses Produkt ist derzeit nicht verfügbar.',
    checkout: 'Online-Kauf und Reservierung sind für dieses Angebot noch nicht freigeschaltet.',
    more: 'Mehr erfahren', less: 'Weniger anzeigen', merchant: 'Händler', location: 'Standort', category: 'Kategorie',
  },
  en: {
    loading: 'Loading offer …', unavailable: 'Offer currently unavailable',
    available: 'Available', soldOut: 'Temporarily sold out', paused: 'Currently unavailable',
    soldOutDetail: 'This product is currently unavailable.',
    checkout: 'Online checkout and reservations are not yet available for this offer.',
    more: 'Learn more', less: 'Show less', merchant: 'Merchant', location: 'Location', category: 'Category',
  },
};

export function shortDescription(value, limit = 180) {
  const text = (value || '').trim().replace(/\s+/gu, ' ');
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  const prefix = chars.slice(0, limit).join('');
  const space = prefix.lastIndexOf(' ');
  return (space > limit / 2 ? prefix.slice(0, space) : prefix) + '…';
}

export function offerAvailability(offer) {
  return offer.active === false ? 'paused' : offer.stockQuantity > 0 ? 'available' : 'soldOut';
}

export function productImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
