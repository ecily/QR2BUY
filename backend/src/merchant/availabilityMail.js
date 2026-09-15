import { createDemoMailTransport } from '../demo/mail.js';

export function createAvailabilityMailTransport(env = process.env) {
  // Explicit opt-in switch: importing or running local code cannot enable mail
  // merely because demo SMTP credentials happen to be present.
  const transport = createDemoMailTransport({ ...env,
    DEMO_MAIL_TRANSPORT: env.NOTIFY_MAIL_ENABLED === 'true' ? 'smtp' : 'disabled'
  }, 'qr2buy');
  return transport;
}
export const notifyConfigured = () => createAvailabilityMailTransport().configured === true;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function availabilityMessage({ offer, product, merchant, location }, locale, origin, token) {
  const en = locale === 'en';
  const subject = en ? 'Your product is available again' : 'Dein Produkt ist wieder verfügbar';
  const price = new Intl.NumberFormat(locale, {style:'currency',currency:offer.currency}).format(offer.priceMinor / 10 ** new Intl.NumberFormat(locale,{style:'currency',currency:offer.currency}).resolvedOptions().maximumFractionDigits);
  const url = `${origin}/o/${offer.publicOfferId}?lang=${locale}`;
  const unsubscribe = `${origin}/notify/unsubscribe/${token}?lang=${locale}`;
  const lines = [subject, product.name, merchant.displayName, location.name, price, url,
    en ? 'Availability may change. This is not a reservation.' : 'Die Verfügbarkeit kann sich ändern. Dies ist keine Reservierung.',
    en ? 'Only the availability notice you requested. No newsletter.' : 'Nur deine angefragte Verfügbarkeitsbenachrichtigung. Kein Newsletter.',
    (en ? 'Unsubscribe: ' : 'Abmelden: ') + unsubscribe];
  const paragraph = line => `<p>${escape(line)}</p>`;
  const html = lines.slice(0,5).map(paragraph).join('')
    + `<p><a href="${escape(url)}">${en?'View product':'Produkt ansehen'}</a></p>`
    + lines.slice(6,8).map(paragraph).join('')
    + `<p><a href="${escape(unsubscribe)}">${en?'Unsubscribe':'Abmelden'}</a></p>`;
  return {subject, text:lines.join('\n'), html};
}
