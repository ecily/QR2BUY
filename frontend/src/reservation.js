export const reservationText = {
  de: { reserve:'Reservieren', submit:'Jetzt reservieren', name:'Name', email:'E-Mail', phone:'Telefonnummer', note:'Notiz (optional)', contact:'Bitte E-Mail oder Telefonnummer angeben.',
    contactError:'Bitte einen Namen und eine gültige E-Mail oder Telefonnummer angeben.', back:'Zurück', error:'Reservierung derzeit nicht möglich. Bitte erneut versuchen.',
    out_of_stock:'Inzwischen ist keine Einheit mehr verfügbar.', reservation_closed:'Diese Reservierung ist bereits beendet.', request_conflict:'Die Anfrage wurde geändert. Bitte erneut versuchen.',
    confirmed:'Reservierung bestätigt', number:'Reservierungsnummer', until:'Reserviert bis', quantity:'Menge', price:'Preis', merchant:'Händler', location:'Standort',
    pickup:'Zeige diese Bestätigung bei der Abholung. Bewahre den Link auf; es wird keine E-Mail oder SMS versendet.',
    RESERVED:'Reserviert', EXPIRED:'Abgelaufen', CANCELLED:'Storniert', COLLECTED:'Abgeholt', loading:'Wird geladen …',
    unavailable:'Reservierung nicht verfügbar', purchase:'Online-Kauf ist noch nicht freigeschaltet.', held:'Vorübergehend reserviert',
    reservations:'Reservierungen', empty:'Noch keine Reservierungen.', details:'Details', collect:'Als abgeholt markieren', cancel:'Reservierung stornieren',
    confirmCollect:'Abholung bestätigen', confirmCancel:'Stornierung bestätigen', confirmAction:'Diese Aktion beendet die Reservierung.',
    created:'Erstellt', source:'Quelle', BUYER_OFFER:'Öffentliche Produktseite', listLimit:'Die neuesten 200 Reservierungen.',
    duration:'Ein Stück reservieren. Reservierungsdauer:', minutes:'Minuten', refreshError:'Status konnte nicht aktualisiert werden. Bitte erneut laden.' },
  en: { reserve:'Reserve', submit:'Reserve now', name:'Name', email:'Email', phone:'Phone number', note:'Note (optional)', contact:'Please provide an email address or phone number.',
    contactError:'Please enter a name and a valid email address or phone number.', back:'Back', error:'Reservation is currently unavailable. Please try again.',
    out_of_stock:'No units are available anymore.', reservation_closed:'This reservation has already ended.', request_conflict:'The request has changed. Please try again.',
    confirmed:'Reservation confirmed', number:'Reservation number', until:'Reserved until', quantity:'Quantity', price:'Price', merchant:'Merchant', location:'Location',
    pickup:'Show this confirmation at pickup. Keep the link; no email or SMS will be sent.',
    RESERVED:'Reserved', EXPIRED:'Expired', CANCELLED:'Cancelled', COLLECTED:'Collected', loading:'Loading …',
    unavailable:'Reservation unavailable', purchase:'Online checkout is not yet available.', held:'Temporarily reserved',
    reservations:'Reservations', empty:'No reservations yet.', details:'Details', collect:'Mark as collected', cancel:'Cancel reservation',
    confirmCollect:'Confirm pickup', confirmCancel:'Confirm cancellation', confirmAction:'This action ends the reservation.',
    created:'Created', source:'Source', BUYER_OFFER:'Public product page', listLimit:'The latest 200 reservations.',
    duration:'Reserve one unit. Reservation duration:', minutes:'minutes', refreshError:'Could not update the status. Please reload.' }
};
export const canReserve = data => data?.reservationAvailable === true && data.offer?.active === true
  && data.offer.reservable === true && data.offer.stockQuantity > 0;
export function validBuyer(data) {
  const email = (data.buyerEmail || '').trim(), phone = (data.buyerPhone || '').trim();
  return !!data.buyerName?.trim() && !!(email || phone)
    && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    && (!phone || (/^\+?[0-9 ()-]+$/.test(phone) && phone.replace(/\D/g,'').length >= 7 && phone.replace(/\D/g,'').length <= 15));
}
export const money = (r, lang) => {
  const format = new Intl.NumberFormat(lang, {style:'currency',currency:r.currency});
  return format.format(r.totalPriceMinor / 10 ** format.resolvedOptions().maximumFractionDigits);
};
export async function reservationRequest(path, body, signal) {
  const response = await fetch('/api/reservations/'+path, { method:body?'POST':'GET', cache:'no-store', signal,
    ...(body ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'error');
  return result;
}
