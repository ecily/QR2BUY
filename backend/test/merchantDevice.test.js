import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { createCredentialService, credentialVerifier, verifyCredential } from '../src/merchant/deviceCredentials.js';
import { createDeviceService, deviceOnline } from '../src/merchant/deviceService.js';
import { createDeviceRepository } from '../src/merchant/deviceRepository.js';
import { DeviceCredential, ManagedDevice, Offer } from '../src/merchant/models.js';
import { createDeviceRouter, createPublicOfferRouter } from '../src/routes/device.js';

const pepper = randomBytes(32).toString('hex');
const ids = ['QR2B-000001', 'QR2B-000002'];
function fixture() {
  let clock = new Date('2026-09-07T12:00:00Z');
  const secrets = ids.map(() => randomBytes(32).toString('hex'));
  const devices = ids.map((deviceId, i) => ({ deviceId, status: 'ACTIVE', displayName: `Schild ${i+1}`,
    hardwareVariant: i ? 'ESP32_ILI9341_NOCS' : 'ESP32_ILI9341_CS5', lastSeenAt: null, firmwareVersion: null }));
  const credentials = devices.map((d,i) => ({ deviceId:d.deviceId, verifier:credentialVerifier(d.deviceId,1,secrets[i],pepper), credentialVersion:1, credentialStatus:'ACTIVE', credentialCreatedAt:clock }));
  const merchants = [0,1].map(i => ({ merchantId:`M${i}`,status:'ACTIVE',displayName:`Merchant ${i}` }));
  const locations = [0,1].map(i => ({ locationId:`L${i}`,merchantId:`M${i}`,status:'ACTIVE',name:`Location ${i}` }));
  const products = [0,1].map(i => ({ productId:`P${i}`,merchantId:`M${i}`,status:'ACTIVE',name:`Product ${i}` }));
  const offers = [0,1].map(i => ({ offerId:`O${i}`,productId:`P${i}`,merchantId:`M${i}`,locationId:`L${i}`,active:true, publicOfferId:randomBytes(16).toString('hex'),priceMinor:12900+i,currency:'EUR',stockQuantity:2,purchasable:true,reservable:false }));
  const assignments = ids.map((deviceId,i) => ({ deviceId, merchantId:`M${i}`,locationId:`L${i}`,validFrom:clock,status:'ACTIVE' }));
  const displays = ids.map((deviceId,i) => ({ deviceId,merchantId:`M${i}`,locationId:`L${i}`,productId:`P${i}`,offerId:`O${i}`,verifiedAt:clock,status:'ACTIVE' }));
  const find = (arr,key) => async id => arr.find(d=>d[key]===id) || null;
  const read = { device:find(devices,'deviceId'),credential:find(credentials,'deviceId'),assignment:find(assignments,'deviceId'),
    display:find(displays,'deviceId'),merchant:find(merchants,'merchantId'),location:find(locations,'locationId'),
    product:find(products,'productId'),offer:find(offers,'offerId'),publicOffer:find(offers,'publicOfferId') };
  let writes = 0;
  const repository = { snapshot:work=>work(read), async heartbeat(id, at, firmwareVersion) {
    writes++; Object.assign(await read.device(id), {lastSeenAt:at,...(firmwareVersion?{firmwareVersion}:{})});
  } };
  const service = createDeviceService({ repository,pepper:()=>pepper,publicOrigin:()=> 'https://qr2buy.com',now:()=>clock });
  const auth = i=>({deviceId:ids[i],secret:secrets[i],version:1});
  return { service,read,devices,credentials,merchants,locations,products,offers,assignments,displays,secrets,auth,
    writes:()=>writes, tick:ms=>{clock=new Date(+clock+ms);} };
}
const unauthorized = error => error.status===401 && error.code==='device_unauthorized';
test('both identities authenticate independently and resolve scoped config and stable buyer QR',async()=>{
  const f=fixture(); assert.notEqual(f.secrets[0],f.secrets[1]);
  for(let i=0;i<2;i++) {
    const c=await f.service.config(f.auth(i),'0.3.2');
    assert.equal(c.deviceId,ids[i]); assert.equal(c.assigned,true); assert.equal(c.merchantId,`M${i}`);
    assert.equal(c.locationId,`L${i}`); assert.equal(c.product.productId,`P${i}`); assert.equal(c.product.name,`Product ${i}`);
    assert.equal(c.product.image,null); assert.deepEqual(c.offer,{offerId:`O${i}`,priceMinor:12900+i,currency:'EUR',stockQuantity:2,purchasable:true,reservable:false});
    assert.equal(c.display.qr,`https://qr2buy.com/o/${f.offers[i].publicOfferId}`);
    assert.match(c.display.eventVersion,/^[a-f0-9]{16}$/); assert.equal(c.display.status,'READY');
    assert.ok(!JSON.stringify(c).includes(f.secrets[i])); assert.ok(!JSON.stringify(c).includes('verifier'));
  }
});
test('wrong, unknown, cross-device, disabled, revoked and stale-version credentials fail closed',async()=>{
  const f=fixture();
  for(const auth of [{...f.auth(0),secret:f.secrets[1]},{...f.auth(0),deviceId:'QR2B-999999'},
    {...f.auth(0),version:2},{...f.auth(0),secret:'short'}]) await assert.rejects(f.service.config(auth),unauthorized);
  for(const status of ['INACTIVE','RETIRED']) { f.devices[0].status=status; await assert.rejects(f.service.config(f.auth(0)),unauthorized); }
  f.devices[0].status='ACTIVE'; f.credentials[0].credentialStatus='REVOKED'; await assert.rejects(f.service.config(f.auth(0)),unauthorized);
  assert.equal(f.writes(),0);
});
test('rotation generates strong distinct credentials, increments version and invalidates old token immediately',async()=>{
  const f=fixture();
  const Credential={findOne:async({deviceId})=>f.credentials.find(c=>c.deviceId===deviceId),
    findOneAndUpdate:async(filter,update)=>{const c=f.credentials.find(c=>c.deviceId===filter.deviceId&&c.credentialVersion===filter.credentialVersion); if(!c)return null;Object.assign(c,update.$set);return c;},
    create:async value=>f.credentials.push(value)};
  const service=createCredentialService({Credential,Device:{findOne:({deviceId})=>f.read.device(deviceId)},pepper:()=>pepper});
  const old=f.auth(0); const next=await service.rotate(ids[0]);
  assert.equal(next.version,2);assert.match(next.secret,/^[a-f0-9]{64}$/);assert.notEqual(next.secret,old.secret);
  assert.ok(f.credentials[0].credentialRotatedAt);assert.ok(!JSON.stringify(f.credentials).includes(next.secret));
  await assert.rejects(f.service.config(old),unauthorized);assert.equal((await f.service.config(next)).assigned,true);
  assert.equal((await f.service.config(f.auth(1))).deviceId,ids[1]);
  f.credentials.splice(1,1);const first=await service.rotate(ids[1]);assert.equal(first.version,1);assert.notEqual(first.secret,next.secret);
});
test('HMAC binds device and version, requires pepper, no plaintext schema or verifier in default queries',()=>{
  const f=fixture(); assert.throws(()=>credentialVerifier(ids[0],1,f.secrets[0],''),e=>e.status===503);
  assert.throws(()=>verifyCredential(null,null,f.auth(0),''),unauthorized);
  assert.throws(()=>verifyCredential(f.devices[0],null,f.auth(0),''),unauthorized);
  assert.notEqual(credentialVerifier(ids[0],1,f.secrets[0],pepper),credentialVerifier(ids[1],1,f.secrets[0],pepper));
  assert.throws(()=>verifyCredential(f.devices[0],f.credentials[0],f.auth(0),randomBytes(32).toString('hex')),unauthorized);
  assert.equal(DeviceCredential.schema.path('verifier').options.select,false);
  assert.equal(ManagedDevice.schema.path('secret'),undefined);assert.equal(DeviceCredential.schema.path('secret'),undefined);
  const offer=new Offer();assert.match(offer.publicOfferId,/^[a-f0-9]{32}$/);
});
test('missing or pending display, missing merchant assignment and expired assignments are ordinary unassigned configs',async()=>{
  for(const mutate of [f=>f.assignments.splice(0,1),f=>f.displays.splice(0,1),f=>{f.displays[0].verifiedAt=null;},
    f=>{f.assignments[0].validUntil=new Date('2020-01-01');},f=>{f.assignments[0].validFrom=new Date('2030-01-01');}]) {
    const f=fixture();mutate(f);assert.deepEqual(await f.service.config(f.auth(0)),{ok:true,deviceId:ids[0],assigned:false});
    assert.equal(f.writes(),1);
  }
});
test('every cross-merchant and inactive link fails closed without exposing data',async()=>{
  for(const mutate of [f=>{f.displays[0].merchantId='M1';},f=>{f.displays[0].locationId='L1';},f=>{f.offers[0].merchantId='M1';},
    f=>{f.locations[0].merchantId='M1';},f=>{f.products[0].merchantId='M1';},f=>{f.displays[0].productId='P1';},
    f=>{f.merchants[0].status='SUSPENDED';},f=>{f.locations[0].status='INACTIVE';},f=>{f.products[0].status='ARCHIVED';},f=>{f.offers[0].active=false;}]) {
    const f=fixture();mutate(f);assert.equal((await f.service.config(f.auth(0))).assigned,false);
  }
});
test('server-only reassignment and offer switch change QR with unchanged firmware credentials',async()=>{
  const f=fixture();const first=await f.service.config(f.auth(0));
  Object.assign(f.assignments[0],{merchantId:'M1',locationId:'L1'});
  assert.equal((await f.service.config(f.auth(0))).assigned,false);
  Object.assign(f.displays[0],{merchantId:'M1',locationId:'L1',productId:'P1',offerId:'O1'});
  const next=await f.service.config(f.auth(0));assert.equal(next.merchantId,'M1');
  assert.notEqual(first.display.qr,next.display.qr);assert.notEqual(first.display.eventVersion,next.display.eventVersion);
});
test('heartbeat is throttled across polling and firmware changes; online expires after 120 seconds',async()=>{
  const f=fixture();await f.service.config(f.auth(0),'0.3.2');assert.equal(f.writes(),1);
  for(let i=0;i<19;i++){f.tick(3000);await f.service.config(f.auth(0),'0.3.2');}
  assert.equal(f.writes(),1);f.tick(3000);await f.service.config(f.auth(0),'0.3.2');assert.equal(f.writes(),2);
  await f.service.config(f.auth(0),'0.3.3');assert.equal(f.writes(),3);assert.equal(f.devices[0].firmwareVersion,'0.3.3');
  await f.service.config(f.auth(0));assert.equal(f.writes(),3);
  assert.equal(deviceOnline(f.devices[0],f.devices[0].lastSeenAt),true);
  assert.equal(deviceOnline(f.devices[0],new Date(+f.devices[0].lastSeenAt+120001)),false);
  await assert.rejects(f.service.config(f.auth(0),'bad\nversion'),e=>e.status===400);
});
test('Mongo heartbeat filter throttles atomically even with concurrent readers',async()=>{
  const original=ManagedDevice.updateOne;let recorded;
  ManagedDevice.updateOne=async(...args)=>{recorded=args;};
  try {const at=new Date();await createDeviceRepository().heartbeat(ids[0],at,'0.3.2');
    assert.equal(recorded[0].deviceId,ids[0]);assert.equal(+recorded[0].$or[1].lastSeenAt.$lte,+at-60000);
    assert.deepEqual(recorded[0].$or[2],{firmwareVersion:{$ne:'0.3.2'}});
    assert.deepEqual(recorded[1].$set,{lastSeenAt:at,firmwareVersion:'0.3.2'});
  }finally{ManagedDevice.updateOne=original;}
});
test('buyer offer is read-only, hides internal identifiers, excludes inactive scopes, sold config removes QR',async()=>{
  const f=fixture();const result=await f.service.publicOffer(f.offers[0].publicOfferId);
  assert.equal(result.checkoutAvailable,false);assert.equal(result.product.name,'Product 0');assert.equal(result.merchant.displayName,'Merchant 0');
  for(const key of ['merchantId','deviceId','offerId','productId','verifier','secret','_id'])assert.ok(!JSON.stringify(result).includes(`"${key}"`));
  f.offers[0].stockQuantity=0;const c=await f.service.config(f.auth(0));assert.equal(c.display.status,'SOLD');assert.equal(c.display.qr,'');
  f.offers[0].active=false;await assert.rejects(f.service.publicOffer(f.offers[0].publicOfferId),e=>e.status===404);
  await assert.rejects(f.service.publicOffer('bad'),e=>e.status===404);
});
test('HTTP headers, no-store, errors, query rejection, auth isolation and per-device polling limit',async t=>{
  const f=fixture();const app=express();app.use('/api/device',createDeviceRouter(f.service));app.use('/api/public/merchant-offers',createPublicOfferRouter(f.service));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={'x-device-id':ids[0],'x-device-secret':f.secrets[0],'x-device-credential-version':'1','x-firmware-version':'0.3.2'};
  let r=await fetch(base+'/api/device/config',{headers});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal((await r.json()).deviceId,ids[0]);
  for(const h of [{},{...headers,'x-device-secret':f.secrets[1]},{...headers,'x-device-id':ids[1]}, {...headers,'x-device-credential-version':'2'}]) {
    r=await fetch(base+'/api/device/config',{headers:h});assert.equal(r.status,401);
  }
  r=await fetch(base+'/api/device/config?secret=not-used',{headers});assert.equal(r.status,401);
  for(let i=1;i<40;i++)assert.equal((await fetch(base+'/api/device/config',{headers})).status,200);
  assert.equal((await fetch(base+'/api/device/config',{headers})).status,429);
  assert.equal((await fetch(base+'/api/public/merchant-offers/'+f.offers[0].publicOfferId)).status,200);
});
