import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { reservationFixture } from '../testing/reservationFixture.js';
import { Offer, MerchantProduct } from '../src/merchant/models.js';
import { AvailabilitySubscription as Sub, createAvailabilityService } from '../src/merchant/availabilitySubscriptions.js';
import { notifyStateAllowed } from '../src/merchant/availabilityPolicy.js';
import { createAvailabilityMailTransport } from '../src/merchant/availabilityMail.js';

test('availability notification: isolated Mongo lifecycle, delivery and public security',async t=>{
  const f=await reservationFixture();t.after(()=>f.close());
  const server=f.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const url='http://127.0.0.1:'+server.address().port;
  const input={email:' Reader@Example.TEST ',name:'Reader',locale:'de',consent:true};
  const post=(path,body,origin='http://127.0.0.1:5178')=>fetch(url+'/api/notify/'+path,{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
  await t.test('valid, normalized, concurrent duplicates; no enumeration, READY blocked',async()=>{
    const o=await f.offer({stockQuantity:0});
    const before=f.messages.length;
    const responses=await Promise.all(Array.from({length:5},()=>post('offers/'+o.publicOfferId,input)));
    for(const r of responses){assert.equal(r.status,200);const data=await r.json();assert.equal(data.ok,true);assert(Object.keys(data).every(k=>['ok','confirmationPending'].includes(k)));}
    assert.equal(f.messages.length,before+1);
    assert.equal(await Sub.countDocuments({offerId:o.offerId}),1);
    const row=await Sub.findOne({offerId:o.offerId}).select('+emailNormalized');assert.equal(row.emailNormalized,'reader@example.test');
    const ready=await f.offer();assert.equal((await post('offers/'+ready.publicOfferId,input)).status,409);
    for(const invalid of [{...input,email:'bad'},{...input,consent:false},{...input,merchantId:'M1'}])assert.equal((await post('offers/'+o.publicOfferId,invalid)).status,400);
    assert.equal((await post('offers/'+'0'.repeat(32),input)).status,404);
    assert.equal((await post('offers/'+o.publicOfferId,input,'https://foreign.invalid')).status,403);
    await MerchantProduct.updateOne({productId:o.productId},{$set:{status:'ARCHIVED'}});
    assert.equal((await post('offers/'+o.publicOfferId,input)).status,404);
    assert.equal(notifyStateAllowed('SOLD'),false);
    assert.equal(createAvailabilityMailTransport({}).configured,false);
  });
  for(const state of ['stock','paused','cancel','expiry'])await t.test(state+' transition sends once with current content',async()=>{
    const o=await f.offer({stockQuantity:state==='stock'?0:1,active:state!=='paused'});
    let reservation;
    if(['cancel','expiry'].includes(state))reservation=(await f.service.create(o.publicOfferId,{buyerName:'Buyer',buyerEmail:'buyer@example.test',requestKey:randomUUID()})).reservation;
    await f.notify.subscribe(o.publicOfferId,{...input,locale:'en'});
    const count=f.messages.length;await f.notify.run();assert.equal(f.messages.length,count);
    if(state==='cancel') {
      const {MerchantReservation}=await import('../src/merchant/models.js');
      const r=await MerchantReservation.findOne({publicReservationId:reservation.publicReservationId});await f.service.action('M0',r.reservationId,'cancel');
    } else if(state==='expiry')await f.advance(31*60000);
    else await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1,active:true,priceMinor:2990}});
    await f.advance(31000);
    await Promise.all([f.notify.run(),f.notify.run()]);await f.notify.run();
    assert.equal(f.messages.length,count+1);
    const row=await Sub.findOne({offerId:o.offerId}).select('+unsubscribeHash');assert.equal(row.status,'NOTIFIED');assert(row.notifiedAt);
    const mail=f.messages.at(-1);assert.equal(mail.to,'reader@example.test');assert(mail.text.includes('Merchant 0'));assert(mail.text.includes('Location 0'));assert(mail.text.includes(o.publicOfferId));
    assert.equal(mail.subject,'Your product is available again');
    if(['stock','paused'].includes(state))assert(mail.text.includes('29.90'));
    const token=mail.text.match(/unsubscribe\/([a-f0-9]{64})/)[1];assert(!JSON.stringify(row).includes(token));
    assert(mail.html.includes(`href="http://127.0.0.1:5178/o/${o.publicOfferId}?lang=en"`));
    assert(mail.html.includes(`href="http://127.0.0.1:5178/notify/unsubscribe/${token}?lang=en"`));
    assert.equal((await post('unsubscribe',{token})).status,200);
    assert.equal((await Sub.findById(row._id)).status,'CANCELLED');
    assert.deepEqual(await (await post('unsubscribe',{token:'bad'})).json(),{ok:true});
  });
  await t.test('cancelled and expired requests send nothing; single opt-in can be renewed',async()=>{
    const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);
    await Sub.updateOne({offerId:o.offerId},{$set:{expiresAt:new Date(0)}});
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});const n=f.messages.length;
    await f.notify.run();assert.equal(f.messages.length,n);assert.equal((await Sub.findOne({offerId:o.offerId})).status,'EXPIRED');
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:0}});await f.notify.subscribe(o.publicOfferId,input);
    assert.equal(await Sub.countDocuments({offerId:o.offerId}),1);assert.equal((await Sub.findOne({offerId:o.offerId})).status,'ACTIVE');
  });
  await t.test('definite pre-send failure retries, ambiguous acceptance never retries',async()=>{
    for(const retrySafe of [true,false]) {
      const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);
      await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});
      let attempts=0;
      const transport={configured:true,async send(){attempts++;const e=Error('private transport details');e.retrySafe=retrySafe;throw e;}};
      const service=createAvailabilityService({transport,now:f.now,origin:()=>url});
      await service.run();const row=await Sub.findOne({offerId:o.offerId});assert.equal(row.delivery,retrySafe?'IDLE':'UNCERTAIN');
      const before=attempts;await service.run();assert.equal(attempts,before);
      if(retrySafe){
        transport.send=async()=>{attempts++;return {accepted:true};};
        await f.advance(300000);await service.run();
        assert.equal(attempts,before+1);assert.equal((await Sub.findById(row._id)).status,'NOTIFIED');
      }
      if(!retrySafe){await f.advance(3600001);await f.notify.subscribe(o.publicOfferId,input).catch(e=>assert.equal(e.code,'notify_unavailable'));await service.run();assert.equal((await Sub.findById(row._id)).delivery,'UNCERTAIN');}
      await Sub.updateOne({_id:row._id},{$set:{status:'CANCELLED'}});
    }
  });
  await t.test('feature disabled exposes no fake availability capability',async()=>{
    const o=await f.offer({stockQuantity:0});const service=createAvailabilityService({enabled:()=>false});
    await assert.rejects(service.subscribe(o.publicOfferId,input),e=>e.code==='notify_unavailable');
    await service.run();assert.equal(await Sub.countDocuments({offerId:o.offerId}),0);
  });
  for(const locale of ['de','en'])await t.test(locale+' service confirmation allows immediate unsubscribe',async()=>{
    const o=await f.offer({stockQuantity:0}),before=f.messages.length;
    assert.deepEqual(await f.notify.subscribe(o.publicOfferId,{...input,locale}),{ok:true});
    assert.equal(f.messages.length,before+1);
    const mail=f.messages.at(-1),row=await Sub.findOne({offerId:o.offerId}).select('+unsubscribeHash');
    assert.equal(row.status,'ACTIVE');assert(row.confirmationSentAt);assert.equal(row.attempts,0);
    assert.equal(mail.subject,locale==='en'?'Availability notification activated':'Verfügbarkeitsbenachrichtigung aktiviert');
    for(const value of ['Reservation product','Merchant 0','Location 0','90',locale==='en'?'not a reservation or purchase':'keine Reservierung und kein Kauf',
      locale==='en'?'If you did not request':'Falls du dies nicht selbst angefordert'])assert(mail.text.includes(value));
    const token=mail.text.match(/unsubscribe\/([a-f0-9]{64})/)[1];
    assert(!JSON.stringify(row).includes(token));assert(mail.html.includes(`/notify/unsubscribe/${token}?lang=${locale}`));
    await f.notify.unsubscribe(token);
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});await f.notify.run();
    assert.equal((await Sub.findById(row._id)).status,'CANCELLED');assert.equal(f.messages.length,before+1);
  });
  await t.test('first service-mail link remains valid after availability mail',async()=>{
    const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);
    const token=f.messages.at(-1).text.match(/unsubscribe\/([a-f0-9]{64})/)[1];
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});await f.notify.run();
    await f.notify.unsubscribe(token);assert.equal((await Sub.findOne({offerId:o.offerId})).status,'CANCELLED');
  });
  await t.test('confirmation claim blocks workers and duplicate opt-ins; metadata refresh preserves claim',async()=>{
    const o=await f.offer({stockQuantity:0});let release,started,sends=0;
    const waiting=new Promise(r=>{started=r;}),pending=new Promise(r=>{release=r;});
    const service=createAvailabilityService({now:f.now,origin:()=>url,transport:{configured:true,async send(){sends++;started();await pending;return {accepted:true};}}});
    const first=service.subscribe(o.publicOfferId,input);await waiting;
    const before=await Sub.findOne({offerId:o.offerId});assert.equal(before.status,'CONFIRMING');
    const duplicate=await service.subscribe(o.publicOfferId,{...input,locale:'en',name:'Updated Reader'});
    assert.deepEqual(duplicate,{ok:true,confirmationPending:true});
    const after=await Sub.findById(before._id).select('+name');
    assert.equal(after.locale,'en');assert.equal(after.name,'Updated Reader');
    assert.equal(after.generation,before.generation);assert.equal(+after.claimedAt,+before.claimedAt);assert.equal(after.delivery,'SENDING');
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});
    await Promise.all([service.run(),service.run()]);assert.equal(sends,1);
    release();await first;await service.run();assert.equal(sends,2);
    assert.equal((await Sub.findById(before._id)).status,'NOTIFIED');
  });
  await t.test('ACTIVE re-opt-in updates locale/name without a second confirmation or new generation',async()=>{
    const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);
    const before=await Sub.findOne({offerId:o.offerId}),count=f.messages.length;
    await f.notify.subscribe(o.publicOfferId,{...input,locale:'en',name:'New name'});
    let row=await Sub.findById(before._id).select('+name');
    assert.equal(row.locale,'en');assert.equal(row.name,'New name');assert.equal(row.generation,before.generation);
    assert.equal(+row.expiresAt,+before.expiresAt);assert.equal(f.messages.length,count);
    await f.notify.subscribe(o.publicOfferId,{email:input.email,locale:'de',consent:true});
    row=await Sub.findById(before._id).select('+name');assert.equal(row.name,'New name');
    await Sub.updateOne({_id:row._id},{$set:{status:'CANCELLED'}});
  });
  for(const phase of ['confirmation','availability'])for(const retrySafe of [true,false])await t.test(`${phase}: bounded retries and private operator logs (${retrySafe})`,async()=>{
    const o=await f.offer({stockQuantity:0});
    if(phase==='availability')await f.notify.subscribe(o.publicOfferId,input);
    let sends=0;const logs=[];
    const service=createAvailabilityService({now:f.now,origin:()=>url,operatorLog:record=>logs.push(record),transport:{configured:true,async send(){
      sends++;const e=Error('reader@example.test PRIVATE-TOKEN Reader');e.retrySafe=retrySafe;throw e;
    }}});
    if(phase==='confirmation')assert.deepEqual(await service.subscribe(o.publicOfferId,input),{ok:true,confirmationPending:true});
    else {await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});await service.run();}
    let row=await Sub.findOne({offerId:o.offerId});
    assert.equal(row.delivery,retrySafe?'IDLE':'UNCERTAIN');
    await service.run();assert.equal(sends,1);
    if(retrySafe)for(let attempt=2;attempt<=5;attempt++){
      assert(+row.nextAttemptAt-+f.now()<=3600000);
      await f.advance(3600001);await service.run();row=await Sub.findById(row._id);
      assert.equal(sends,attempt);assert.equal(row.attempts,attempt);
    }
    const expected=retrySafe?'FAILED':'UNCERTAIN';
    row=await Sub.findById(row._id);assert.equal(row.delivery,expected);assert.equal(row.nextAttemptAt,null);
    await f.advance(3600001);await service.run();assert.equal(sends,retrySafe?5:1);
    assert.equal(logs.length,1);assert.deepEqual(Object.keys(logs[0]).sort(),['event','subscriptionId','generation','status','delivery','attempts'].sort());
    assert.equal(logs[0].delivery,expected);assert.equal(logs[0].attempts,retrySafe?5:1);
    assert(!/reader|example|PRIVATE-TOKEN/i.test(JSON.stringify(logs)));
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:0}});
    const previous=row.generation;await f.notify.subscribe(o.publicOfferId,{...input,locale:'en',name:'New name'});
    row=await Sub.findById(row._id).select('+name');assert.equal(row.locale,'en');assert.equal(row.name,'New name');
    if(retrySafe){assert.notEqual(row.generation,previous);assert.equal(row.delivery,'IDLE');assert.equal(row.status,'ACTIVE');assert.equal(row.attempts,0);}
    else {assert.equal(row.generation,previous);assert.equal(row.delivery,'UNCERTAIN');}
    await Sub.updateOne({_id:row._id},{$set:{status:'CANCELLED'}});
  });
  await t.test('stale confirmation becomes UNCERTAIN once with safe logging; old completion cannot activate',async()=>{
    const o=await f.offer({stockQuantity:0});let release,started;const logs=[];
    const waiting=new Promise(r=>{started=r;}),pending=new Promise(r=>{release=r;});
    const service=createAvailabilityService({now:f.now,origin:()=>url,operatorLog:r=>logs.push(r),transport:{configured:true,async send(){started();await pending;return {accepted:true};}}});
    const first=service.subscribe(o.publicOfferId,input);await waiting;
    await f.advance(61000);await service.run();await service.run();
    release();assert.deepEqual(await first,{ok:true,confirmationPending:true});
    assert.equal(logs.length,1);assert.equal(logs[0].delivery,'UNCERTAIN');
    const row=await Sub.findOne({offerId:o.offerId});assert.equal(row.status,'CONFIRMING');assert.equal(row.delivery,'UNCERTAIN');
    await Sub.updateOne({_id:row._id},{$set:{status:'CANCELLED'}});
  });
  for(const phase of ['confirmation','availability'])await t.test(phase+': unsubscribe and new opt-in cannot be overwritten by old in-flight completion',async()=>{
    const o=await f.offer({stockQuantity:0});
    if(phase==='availability'){
      await f.notify.subscribe(o.publicOfferId,input);
      await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});
    }
    let release,started;
    const waiting=new Promise(r=>{started=r;});const pending=new Promise(r=>{release=r;});
    const transport={configured:true,async send(message){started(message);await pending;return {accepted:true};}};
    const service=createAvailabilityService({transport,now:f.now,origin:()=>url});
    const run=phase==='confirmation'?service.subscribe(o.publicOfferId,input):service.run(),message=await waiting;
    const old=await Sub.findOne({offerId:o.offerId});
    if(phase==='availability'){
      await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:0}});
      await f.notify.subscribe(o.publicOfferId,{...input,locale:'en',name:'Updated while sending'});
      const updated=await Sub.findById(old._id).select('+name');
      assert.equal(updated.generation,old.generation);assert.equal(updated.delivery,'SENDING');assert.equal(updated.name,'Updated while sending');
      assert.equal(updated.locale,'en');assert.equal(+updated.claimedAt,+old.claimedAt);
    }
    const token=message.text.match(/unsubscribe\/([a-f0-9]{64})/)[1];await service.unsubscribe(token);
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:0}});await f.notify.subscribe(o.publicOfferId,input);
    release();await run;
    const row=await Sub.findOne({offerId:o.offerId});assert.equal(row.status,'ACTIVE');assert.equal(row.delivery,'IDLE');
    assert.notEqual(row.generation,old.generation);
  });
  await t.test('public rate limit blocks excess attempts without exposing addresses',async()=>{
    let response;
    for(let i=0;i<101;i++){response=await post('offers/'+'0'.repeat(32),input);await response.text();if(response.status===429)break;}
    assert.equal(response.status,429);
  });
  await t.test('slow earlier delivery cannot prematurely age a later delivery claim',async()=>{
    for(let i=0;i<2;i++){
      const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,{...input,email:`slow${i}@example.test`});
      await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});
    }
    let count=0;
    const transport={configured:true,async send(message){
      const row=await Sub.findOne({emailNormalized:message.to});
      assert(+f.now()-+row.claimedAt < 1000);count++;
      await f.advance(70000);return {accepted:true};
    }};
    await createAvailabilityService({transport,now:f.now,origin:()=>url}).run();assert.equal(count,2);
  });
});
