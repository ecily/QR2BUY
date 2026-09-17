export const canNotify = data => data?.notifyAvailable === true
  && ['OUT_OF_STOCK','PAUSED','RESERVED'].includes(data.availabilityState);
export const notifyText = {
  de:{question:'Sollen wir dir eine E-Mail senden, wenn das Produkt wieder verfügbar ist?',email:'E-Mail',name:'Name (optional)',
    consent:'Meine E-Mail wird nur für die Service-Mail mit Abmeldelink und diese Verfügbarkeitsbenachrichtigung genutzt, nicht für einen Newsletter.',
    submit:'Benachrichtigen',success:'Deine Anfrage ist gespeichert. Wir haben dir eine E-Mail mit Abmeldelink geschickt.',
    pending:'Deine Anfrage ist gespeichert. Der Versand der E-Mail mit Abmeldelink ist noch nicht bestätigt.',
    detail:'Keine Reservierung und kein Kauf. Die Anfrage gilt maximal 90 Tage. Du kannst dich jederzeit über den Link in der Service-E-Mail abmelden.',
    error:'Das hat nicht geklappt. Bitte prüfe deine Angaben oder versuche es später erneut.',
    unsubscribe:'Verfügbarkeitsbenachrichtigung abbestellen',cancel:'Benachrichtigung abbestellen',cancelled:'Die Abmeldung wurde verarbeitet.',sold:'Verkauft'},
  en:{question:'Should we email you when this product becomes available again?',email:'Email',name:'Name (optional)',
    consent:'My email is used only for the service email with an unsubscribe link and this availability notification, not for a newsletter.',
    submit:'Notify me',success:'Your request is saved. We have sent you an email with an unsubscribe link.',
    pending:'Your request is saved. Sending the email with your unsubscribe link has not yet been confirmed.',
    detail:'Not a reservation or purchase. Your request lasts at most 90 days. You can unsubscribe at any time using the link in the service email.',
    error:'Something went wrong. Check your details or try again later.',
    unsubscribe:'Unsubscribe from availability notifications',cancel:'Unsubscribe',cancelled:'Your unsubscribe request has been processed.',sold:'Sold'}
};
export async function notifyRequest(path,body) {
  const response=await fetch('/api/notify/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  if(!response.ok)throw Error('notify_failed');
  return response.json();
}
