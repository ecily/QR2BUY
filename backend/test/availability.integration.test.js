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
  await t.test('valid, normalized, concurrent duplicates; confirmation enables immediate unsubscribe',async()=>{
    const o=await f.offer({stockQuantity:0});
    const responses=await Promise.all(Array.from({length:5},()=>post('offers/'+o.publicOfferId,input)));
    for(const r of responses){assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});}
    assert.equal(await Sub.countDocuments({offerId:o.offerId}),1);
    const row=await Sub.findOne({offerId:o.offerId}).select('+emailNormalized +preDeliveryUnsubscribeHash');
    assert.equal(row.emailNormalized,'reader@example.test');assert.equal(row.delivery,'IDLE');
    assert.equal(f.messages.length,1);assert.equal(f.messages[0].subject,'Deine Verfügbarkeitsbenachrichtigung ist aktiv');
    const token=f.messages[0].text.match(/unsubscribe\/([a-f0-9]{64})/)[1];assert(!JSON.stringify(row).includes(token));
    assert.equal((await post('unsubscribe',{token})).status,200);assert.equal((await Sub.findById(row._id)).status,'CANCELLED');
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
    const row=await Sub.findOne({offerId:o.offerId}).select('+unsubscribeHash +preDeliveryUnsubscribeHash');assert.equal(row.status,'NOTIFIED');assert(row.notifiedAt);
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
    assert.equal(f.messages.length,n+1);
  });
  await t.test('active re-opt-in updates locale without resetting uncertain delivery',async()=>{
    const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);
    await Sub.updateOne({offerId:o.offerId},{$set:{delivery:'UNCERTAIN'}});const mails=f.messages.length;
    await f.notify.subscribe(o.publicOfferId,{...input,locale:'en',name:'Updated'});
    const row=await Sub.findOne({offerId:o.offerId}).select('+name');assert.equal(row.delivery,'UNCERTAIN');assert.equal(row.locale,'en');assert.equal(row.name,'Updated');
    assert.equal(f.messages.length,mails);
  });
  await t.test('confirmation failure leaves no active subscription',async()=>{
    const o=await f.offer({stockQuantity:0});
    const issues=[];const transport={configured:true,async send(){const e=Error('smtp unavailable');e.retrySafe=true;throw e;}};
    const service=createAvailabilityService({transport,now:f.now,origin:()=>url,onDeliveryIssue:i=>issues.push(i)});
    await assert.rejects(service.subscribe(o.publicOfferId,input),e=>e.status===503&&e.code==='notify_unavailable');
    const row=await Sub.findOne({offerId:o.offerId});assert.equal(row.status,'CANCELLED');assert.equal(row.delivery,'FAILED');
    assert.equal(issues.length,1);assert.equal(issues[0].stage,'CONFIRMATION');assert.equal(JSON.stringify(issues).includes('reader@example.test'),false);
  });
  await t.test('definite pre-send failure retries, ambiguous acceptance never retries',async()=>{
    for(const retrySafe of [true,false]) {
      const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);
      await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});
      let attempts=0;const issues=[];
      const transport={configured:true,async send(){attempts++;const e=Error('private transport details');e.retrySafe=retrySafe;throw e;}};
      const service=createAvailabilityService({transport,now:f.now,origin:()=>url,onDeliveryIssue:i=>issues.push(i)});
      await service.run();const row=await Sub.findOne({offerId:o.offerId});assert.equal(row.delivery,retrySafe?'IDLE':'UNCERTAIN');
      const before=attempts;await service.run();assert.equal(attempts,before);
      if(retrySafe){
        transport.send=async()=>{attempts++;return {accepted:true};};
        await f.advance(300000);await service.run();
        assert.equal(attempts,before+1);assert.equal((await Sub.findById(row._id)).status,'NOTIFIED');
      } else {
        await f.advance(3600001);await f.notify.subscribe(o.publicOfferId,input);await service.run();
        assert.equal((await Sub.findById(row._id)).delivery,'UNCERTAIN');assert.equal(issues.at(-1).delivery,'UNCERTAIN');
      }
      await Sub.updateOne({_id:row._id},{$set:{status:'CANCELLED'}});
    }
  });
  await t.test('safe delivery failures stop after five attempts and explicit re-opt-in can retry',async()=>{
    const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});
    let attempts=0;const issues=[];const transport={configured:true,async send(){attempts++;const e=Error('rejected');e.retrySafe=true;throw e;}};
    const service=createAvailabilityService({transport,now:f.now,origin:()=>url,onDeliveryIssue:i=>issues.push(i)});
    for(let i=0;i<5;i++){await service.run();if(i<4)await f.advance(3600001);}
    let row=await Sub.findOne({offerId:o.offerId});assert.equal(attempts,5);assert.equal(row.delivery,'FAILED');assert.equal(issues.at(-1).delivery,'FAILED');
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:0}});await f.notify.subscribe(o.publicOfferId,{...input,locale:'en'});
    row=await Sub.findOne({offerId:o.offerId});assert.equal(row.delivery,'IDLE');assert.equal(row.attempts,0);assert.equal(row.locale,'en');
  });
  await t.test('feature disabled exposes no fake availability capability',async()=>{
    const o=await f.offer({stockQuantity:0});const service=createAvailabilityService({enabled:()=>false});
    await assert.rejects(service.subscribe(o.publicOfferId,input),e=>e.code==='notify_unavailable');
    await service.run();assert.equal(await Sub.countDocuments({offerId:o.offerId}),0);
  });
  await t.test('unsubscribe and new opt-in cannot be overwritten by old in-flight completion',async()=>{
    const o=await f.offer({stockQuantity:0});await f.notify.subscribe(o.publicOfferId,input);
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:1}});
    let release,started;
    const waiting=new Promise(r=>{started=r;});const pending=new Promise(r=>{release=r;});
    const transport={configured:true,async send(message){started(message);await pending;return {accepted:true};}};
    const service=createAvailabilityService({transport,now:f.now,origin:()=>url});
    const run=service.run(),message=await waiting;
    const token=message.text.match(/unsubscribe\/([a-f0-9]{64})/)[1];await service.unsubscribe(token);
    await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:0}});await service.subscribe(o.publicOfferId,input);
    release();await run;
    const row=await Sub.findOne({offerId:o.offerId});assert.equal(row.status,'ACTIVE');assert.equal(row.delivery,'IDLE');
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
