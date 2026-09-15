import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { reservationFixture } from '../testing/reservationFixture.js';
import { MerchantReservation, Offer, ManagedDevice, DeviceMerchantAssignment, DisplayAssignment, MerchantProduct } from '../src/merchant/models.js';
import { createCredentialService } from '../src/merchant/deviceCredentials.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { createReservationRouter } from '../src/routes/reservations.js';
import { saveOffer } from '../src/merchant/portal.js';
import { startReservationExpiry } from '../src/merchant/inventory.js';

const input=()=>({buyerName:'Buyer',buyerEmail:'buyer@example.test',quantity:1,requestKey:randomUUID()});
test('P0.5 isolated Mongo/HTTP reservation lifecycle, inventory, concurrency and security',{timeout:180000},async t=>{
 const f=await reservationFixture();const server=f.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port, origin='http://127.0.0.1:5178';
 const create=(o,data=input(),headers={})=>fetch(base+'/api/reservations/offers/'+o.publicOfferId,{method:'POST',headers:{'Content-Type':'application/json',origin,...headers},body:JSON.stringify(data)});
 async function login(i){
  let r=await fetch(base+'/api/merchant-auth/csrf');let cookie=r.headers.get('set-cookie').split(';')[0],csrf=(await r.json()).csrfToken;
  r=await fetch(base+'/api/merchant-auth/login',{method:'POST',headers:{cookie,origin,'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify({email:`merchant${i}@example.test`,password:f.password})});
  assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];csrf=(await r.json()).csrfToken;
  return {cookie,origin,'Content-Type':'application/json','x-csrf-token':csrf};
 }
 try{
 await t.test('valid email OR phone, server price, public whitelist, repeat request is idempotent',async()=>{
  for(const data of [input(),{buyerName:'Phone buyer',buyerPhone:'+43 123 456789',requestKey:randomUUID()}]){
   const o=await f.offer(), response=await create(o,data);assert.equal(response.status,201);
   const r=(await response.json()).reservation;assert.equal(r.status,'RESERVED');assert.equal(r.quantity,1);assert.equal(r.totalPriceMinor,1990);
   assert.ok(Math.abs(new Date(r.expiresAt)-new Date(r.confirmedAt)-1800000)<2);assert.match(r.publicReservationId,/^[a-f0-9]{32}$/);
   for(const key of ['buyerName','buyerEmail','buyerPhone','buyerNote','merchantId','locationId','productId','offerId','reservationId','requestKey','requestHash','_id'])assert.equal(r[key],undefined);
   assert.equal((await (await create(o,data)).json()).reservation.publicReservationId,r.publicReservationId);
   assert.equal(await MerchantReservation.countDocuments({offerId:o.offerId}),1);
   const status=await fetch(base+'/api/reservations/'+r.publicReservationId);assert.equal(status.status,200);assert.equal(status.headers.get('cache-control'),'no-store');
   assert.equal((await Offer.findOne({offerId:o.offerId})).stockQuantity,1);
  }
 });
 for(const patch of [{reservable:false},{active:false},{stockQuantity:0},{inventorySource:'EXTERNAL'}])await t.test('reject unavailable '+JSON.stringify(patch),async()=>{
  const o=await f.offer(patch);assert.equal((await create(o)).status,409);assert.equal(await MerchantReservation.countDocuments({offerId:o.offerId}),0);
 });
 for(const patch of [{buyerName:''},{buyerEmail:'',buyerPhone:''},{buyerEmail:'bad'},{buyerPhone:'x'},{buyerPhone:'123'},{quantity:2},{quantity:0},{merchantId:'M1'},{productId:'P999'},{unitPriceMinor:1},{stockQuantity:99},{requestKey:'bad'}])await t.test('validate '+JSON.stringify(patch),async()=>{
  const o=await f.offer();assert.equal((await create(o,{...input(),...patch})).status,400);
 });
 await t.test('two buyers race for stock 1; exactly one succeeds; same key concurrent retry succeeds once',async()=>{
  const o=await f.offer();const responses=await Promise.all([create(o),create(o)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);assert.equal(await MerchantReservation.countDocuments({offerId:o.offerId}),1);
  const second=await f.offer(),data=input();const again=await Promise.all([create(second,data),create(second,data)]);
  assert.deepEqual(again.map(r=>r.status),[201,201]);assert.equal(await MerchantReservation.countDocuments({offerId:second.offerId}),1);
  assert.equal((await create(second,{...data,buyerName:'Changed'})).status,409);
 });
 await t.test('merchant list/detail/cancel/collect, foreign scope, CSRF, closed status and stock guards',async()=>{
  const owner=await login(0),foreign=await login(1);
  for(const action of ['cancel','collect']){
   const o=await f.offer();const r=(await (await create(o)).json()).reservation;
   const doc=await MerchantReservation.findOne({publicReservationId:r.publicReservationId});const url=base+'/api/merchant/reservations/'+doc.reservationId;
   assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:foreign})).status,404);
   const detail=await (await fetch(url,{headers:owner})).json();assert.equal(detail.reservation.buyerEmail,'buyer@example.test');
   const list=await (await fetch(base+'/api/merchant/reservations',{headers:owner})).json();assert.ok(list.items.some(x=>x.reservationId===doc.reservationId));
   assert.equal((await (await fetch(base+'/api/merchant/reservations',{headers:foreign})).json()).items.length,0);
   for(const headers of [foreign,{...owner,'x-csrf-token':''},{...owner,origin:'https://foreign.test'}])assert.ok([403,404].includes((await fetch(url+'/'+action,{method:'POST',headers,body:'{}'})).status));
   await assert.rejects(saveOffer('M0',o.offerId,{stockQuantity:0}),e=>e.code==='stock_below_reservations');
   for(let n=0;n<2;n++)assert.equal((await fetch(url+'/'+action,{method:'POST',headers:owner,body:'{}'})).status,200);
   assert.equal((await Offer.findOne({offerId:o.offerId})).stockQuantity,action==='collect'?0:1);
   assert.equal((await f.service.publicStatus(r.publicReservationId)).reservation.status,action==='collect'?'COLLECTED':'CANCELLED');
   assert.equal((await fetch(url+'/'+(action==='collect'?'cancel':'collect'),{method:'POST',headers:owner,body:'{}'})).status,409);
  }
 });
 await t.test('device READY/RESERVED/expiry/cancel/COLLECTED SOLD/PAUSED and other device assignments stable',async()=>{
  const o=await f.offer({stockQuantity:2}),pepper='a'.repeat(64),now=f.now;
  const device=createDeviceService({now,pepper:()=>pepper,publicOrigin:()=> 'https://qr2buy.com'});
  const credentials=createCredentialService({pepper:()=>pepper});
  for(const id of ['QR2B-000001','QR2B-000002']){
   await ManagedDevice.create({deviceId:id,status:'ACTIVE',hardwareVariant:'ESP32_ILI9341_CS5',displayName:id});
   await DeviceMerchantAssignment.create({deviceId:id,merchantId:'M0',locationId:'L0',status:'ACTIVE',validFrom:new Date(0),usageType:'PILOT'});
   await DisplayAssignment.create({deviceId:id,merchantId:'M0',locationId:'L0',productId:o.productId,offerId:o.offerId,status:'ACTIVE',verifiedAt:now(),assignedAt:now(),verificationMethod:'DEVICE_QR_AND_PRODUCT_CODE'});
  }
  const auth=await credentials.rotate('QR2B-000001');const assignments=JSON.stringify(await DisplayAssignment.find().lean());
  const r1=(await f.service.create(o.publicOfferId,input())).reservation;
  assert.equal((await device.config(auth,'0.3.8')).display.status,'READY');
  const r2=(await f.service.create(o.publicOfferId,input())).reservation;
  let c=await device.config(auth,'0.3.8');assert.equal(c.display.status,'RESERVED');assert.equal(c.display.qr,'');assert.equal(c.offer.stockQuantity,0);
  assert.equal((await device.publicOffer(o.publicOfferId)).offer.temporarilyReserved,true);
  const d1=await MerchantReservation.findOne({publicReservationId:r1.publicReservationId});
  await f.service.action('M0',d1.reservationId,'cancel');assert.equal((await device.config(auth,'0.3.8')).display.status,'READY');
  await f.advance(31*60000);assert.equal((await f.service.publicStatus(r2.publicReservationId)).reservation.status,'EXPIRED');
  assert.equal((await device.config(auth,'0.3.8')).offer.stockQuantity,2);
  await Offer.updateOne({offerId:o.offerId},{$set:{stockQuantity:0}});assert.equal((await device.config(auth,'0.3.8')).display.status,'SOLD');
  await Offer.updateOne({offerId:o.offerId},{$set:{active:false}});assert.equal((await device.config(auth,'0.3.8')).display.status,'PAUSED');
  assert.equal(JSON.stringify(await DisplayAssignment.find().lean()),assignments);
 });
 await t.test('automatic worker marks expired without any buyer request; physical stock untouched',async()=>{
  const o=await f.offer();const r=(await f.service.create(o.publicOfferId,input())).reservation;
  await MerchantReservation.updateOne({publicReservationId:r.publicReservationId},{$set:{expiresAt:new Date(0)}});
  const stop=startReservationExpiry(()=>{},20);
  try {for(let n=0;n<30;n++){if((await MerchantReservation.findOne({publicReservationId:r.publicReservationId})).status==='EXPIRED')break;await new Promise(r=>setTimeout(r,20));}
   assert.equal((await MerchantReservation.findOne({publicReservationId:r.publicReservationId})).status,'EXPIRED');
   assert.equal((await Offer.findOne({offerId:o.offerId})).stockQuantity,1);
  }finally{stop();}
 });
 await t.test('expired hold is immediately excluded before cleanup, no extension from retry, default duration and price snapshot',async()=>{
  const o=await f.offer({reservationDuration:null}),data=input();
  const r=(await f.service.create(o.publicOfferId,data)).reservation;
  assert.equal(new Date(r.expiresAt)-new Date(r.confirmedAt),30*60000);
  await saveOffer('M0',o.offerId,{priceMinor:2590,reservationDuration:60});
  const replay=(await f.service.create(o.publicOfferId,data)).reservation;
  assert.equal(replay.totalPriceMinor,1990);assert.equal(+new Date(replay.expiresAt),+new Date(r.expiresAt));
  await MerchantReservation.updateOne({publicReservationId:r.publicReservationId},{$set:{expiresAt:new Date(0)}});
  assert.equal((await MerchantReservation.findOne({publicReservationId:r.publicReservationId})).status,'RESERVED');
  assert.equal((await f.service.publicStatus(r.publicReservationId)).reservation.status,'EXPIRED');
  assert.equal((await f.device.publicOffer(o.publicOfferId)).offer.stockQuantity,1);
  const second=await f.service.create(o.publicOfferId,input());assert.equal(second.reservation.totalPriceMinor,2590);
 });
 await t.test('collect/cancel race never releases and consumes the same unit twice',async()=>{
  const o=await f.offer(),r=(await f.service.create(o.publicOfferId,input())).reservation;
  const d=await MerchantReservation.findOne({publicReservationId:r.publicReservationId});
  const results=await Promise.allSettled(['collect','cancel'].map(action=>f.service.action('M0',d.reservationId,action)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const final=await MerchantReservation.findOne({reservationId:d.reservationId});
  assert.equal((await Offer.findOne({offerId:o.offerId})).stockQuantity,final.status==='COLLECTED'?0:1);
 });
 await t.test('public creation origin, unknown IDs, no public list, archived product and rate limit',async()=>{
  const o=await f.offer();assert.equal((await create(o,input(),{origin:'https://foreign.test'})).status,403);
  assert.equal((await fetch(base+'/api/reservations')).status,404);
  assert.equal((await fetch(base+'/api/reservations/'+randomUUID())).status,404);
  await MerchantProduct.updateOne({productId:o.productId},{$set:{status:'ARCHIVED'}});assert.equal((await create(o)).status,404);
  const app=express();app.use(express.json());app.use(createReservationRouter({service:f.service,origin,limit:1}));
  const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));
  try {for(const expected of [400,429]){const r=await fetch('http://127.0.0.1:'+s.address().port+'/offers/'+o.publicOfferId,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,expected);}}
  finally{s.close();}
 });
 }finally{server.close();await f.close();}
});
