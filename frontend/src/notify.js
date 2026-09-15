export const canNotify = data => data?.notifyAvailable === true
  && ['OUT_OF_STOCK','PAUSED','RESERVED'].includes(data.availabilityState);
export const notifyText = {
  de:{question:'Sollen wir dir eine E-Mail senden, wenn das Produkt wieder verfügbar ist?',email:'E-Mail',name:'Name (optional)',
    consent:'Meine E-Mail wird ausschließlich für diese Verfügbarkeitsbenachrichtigung genutzt, nicht für einen Newsletter.',
    submit:'Benachrichtigen',success:'Wir informieren dich, sobald das Produkt wieder verfügbar ist.',
    detail:'Keine Reservierung und kein Kauf. Die Anfrage gilt 90 Tage. Abmeldung ist über den Link in der E-Mail möglich.',
    error:'Das hat nicht geklappt. Bitte prüfe deine Angaben oder versuche es später erneut.',
    unsubscribe:'Verfügbarkeitsbenachrichtigung abbestellen',cancel:'Benachrichtigung abbestellen',cancelled:'Die Abmeldung wurde verarbeitet.',sold:'Verkauft'},
  en:{question:'Should we email you when this product becomes available again?',email:'Email',name:'Name (optional)',
    consent:'My email is used only for this availability notification, not for a newsletter.',
    submit:'Notify me',success:'We will notify you when the product becomes available again.',
    detail:'Not a reservation or purchase. Your request lasts 90 days. You can unsubscribe using the link in the email.',
    error:'Something went wrong. Check your details or try again later.',
    unsubscribe:'Unsubscribe from availability notifications',cancel:'Unsubscribe',cancelled:'Your unsubscribe request has been processed.',sold:'Sold'}
};
export async function notifyRequest(path,body) {
  const response=await fetch('/api/notify/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  if(!response.ok)throw Error('notify_failed');
  return response.json();
}
