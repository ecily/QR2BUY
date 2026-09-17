import test from 'node:test';
import assert from 'node:assert/strict';
import {canNotify,notifyText} from '../src/notify.js';
test('notify requires server capability and eligible state; READY and SOLD never opt in',()=>{
  for(const state of ['OUT_OF_STOCK','PAUSED','RESERVED','READY','SOLD',undefined]) {
    assert.equal(canNotify({notifyAvailable:true,availabilityState:state}),['OUT_OF_STOCK','PAUSED','RESERVED'].includes(state));
    assert.equal(canNotify({notifyAvailable:false,availabilityState:state}),false);
  }
  assert.equal(canNotify(null),false);
});
test('DE/EN distinguish notification consent and success from a purchase or reservation',()=>{
  for(const t of Object.values(notifyText))for(const key of ['question','consent','detail','success','error','cancelled'])assert(t[key]);
  assert.equal(notifyText.de.submit,'Benachrichtigen');assert.equal(notifyText.en.submit,'Notify me');
  assert.match(notifyText.de.success,/Anfrage ist gespeichert.*Abmeldelink/);
  assert.match(notifyText.en.success,/request is saved.*unsubscribe link/);
  assert.match(notifyText.de.detail,/maximal 90 Tage/);assert.match(notifyText.en.detail,/at most 90 days/);
  assert.match(notifyText.de.pending,/noch nicht bestätigt/);assert.match(notifyText.en.pending,/not yet been confirmed/);
});
