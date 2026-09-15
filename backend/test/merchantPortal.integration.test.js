import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomBytes } from 'node:crypto';
import * as m from '../src/merchant/models.js';
import { MerchantAccount, linkMerchantOwner, verifyPassword } from '../src/merchant/accounts.js';
import { createMerchantPortal } from '../src/routes/merchantPortal.js';
import { createMerchantSession } from '../src/merchant/session.js';
import { createBindingService, PREVIEW_TTL_MS } from '../src/merchant/binding.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { createCredentialService } from '../src/merchant/deviceCredentials.js';

test('merchant portal: real Mongo sessions, registration, CRUD, scope and physical binding', { timeout: 180000 }, async t => {
  const repl = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, ip: '127.0.0.1' } });
  let server, store, base, a, b;
  let bindingTime;
  let merchantA, merchantB, locationA, locationB, productA, productB, offerA, offerB, deviceAuth;
  const origin = 'http://127.0.0.1:5173', password = 'test-only-merchant-password-2026';
  const pepper = 'cd'.repeat(32);
  try {
    t.beforeEach(async () => {
    bindingTime = null;
    merchantA = merchantB = locationA = locationB = productA = productB = offerA = offerB = deviceAuth = undefined;
    const uri = repl.getUri('qr2buy_portal_test_'+randomBytes(8).toString('hex'));
    await mongoose.connect(uri);
    await Promise.all([...Object.values(m).filter(x => x?.modelName), MerchantAccount].map(async Model => { await Model.createCollection(); await Model.createIndexes(); }));
    store = MongoStore.create({ mongoUrl: uri, collectionName: 'merchant_sessions' });
    const binding = createBindingService({ now: () => bindingTime || new Date(), pepper: () => pepper });
    const app = express(); app.use(express.json());
    app.use('/api', createMerchantPortal({ secret: 'test-only-session-secret-'+ 'x'.repeat(32), origin, production: false, store, binding }));
    server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening',r));
    base = 'http://127.0.0.1:'+server.address().port;
    a = client(); b = client();
    });
    t.afterEach(async () => {
      if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); server = null; }
      if (store) { await store.close(); store = null; }
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    function client() {
      return { cookie: '', csrf: '', async call(path, method = 'GET', body, extra = {}) {
        const r = await fetch(base+'/api/'+path, { method, headers: { ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: origin, 'x-csrf-token': this.csrf } : {}), ...extra },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        const set = r.headers.getSetCookie(); if (set.length) this.cookie = set[0].split(';')[0];
        const data = await r.json(); if (data.csrfToken) this.csrf = data.csrfToken;
        return { status: r.status, data, set };
      }, async init() { assert.equal((await this.call('merchant-auth/csrf')).status,200); } };
    }
    const binding = createBindingService({ pepper: () => pepper });
    const devices = createDeviceService({ pepper: () => pepper, publicOrigin: () => 'https://qr2buy.com' });
    async function fixture(level, sharedDevices = false) {
      await a.init();
      if (level === 'csrf') return;
      assert.equal((await a.call('merchant-auth/register','POST',{email:'owner-a@example.invalid',password,displayName:'Shop A',locationName:'Window A'})).status,201);
      merchantA=(await MerchantAccount.findOne({email:'owner-a@example.invalid'})).merchantId;
      locationA=(await m.Location.findOne({merchantId:merchantA})).locationId;
      if (level === 'a') return;
      await b.init();
      assert.equal((await b.call('merchant-auth/register','POST',{email:'owner-b@example.invalid',password,displayName:'Shop B',locationName:'Window B'})).status,201);
      merchantB=(await MerchantAccount.findOne({email:'owner-b@example.invalid'})).merchantId;
      locationB=(await m.Location.findOne({merchantId:merchantB})).locationId;
      if (level === 'ab') return;
      productA=(await a.call('merchant/products','POST',{name:'Leather bag'})).data.item;
      productB=(await b.call('merchant/products','POST',{name:'Book B'})).data.item;
      if (level === 'products') return;
      const offer={priceMinor:12900,currency:'EUR',stockQuantity:3,purchasable:true,reservable:true,active:true};
      offerA=(await a.call('merchant/offers','POST',{...offer,productId:productA.productId,locationId:locationA})).data.item;
      offerB=(await b.call('merchant/offers','POST',{...offer,productId:productB.productId,locationId:locationB})).data.item;
      for (const [id,merchantId,locationId] of [['QR2B-000001',merchantA,locationA],['QR2B-000002',sharedDevices ? merchantA : merchantB,sharedDevices ? locationA : locationB]]) {
        await m.ManagedDevice.create({deviceId:id,displayName:id,hardwareUid:id,hardwareVariant:sharedDevices && id.endsWith('2') ? 'ESP32_ILI9341_NOCS' : 'ESP32_ILI9341_CS5',status:'ACTIVE',firmwareVersion:'0.3.4',lastSeenAt:new Date()});
        await m.DeviceMerchantAssignment.create({deviceId:id,merchantId,locationId,validFrom:new Date(),status:'ACTIVE',usageType:'PILOT'});
      }
      deviceAuth=await createCredentialService({pepper:()=>pepper}).rotate('QR2B-000001');
      if (level === 'devices') return;
      const preview=await binding.start(merchantA,'QR2B-000001',{method:'PRODUCT_CODE',value:productA.productBindingId},'test-only-fixture');
      const config=await devices.config(deviceAuth);
      await binding.finish(merchantA,'QR2B-000001',{previewId:preview.previewId,code:config.bindingPreview.code});
    }
    await t.test('fail closed without session configuration and no unauthenticated CRUD', async () => {
      let status; const config = createMerchantSession({ secret: '', origin });
      config.middleware({}, { status(v) { status=v;return this; }, json() {} }); assert.equal(status,503);
      assert.equal((await a.call('merchant/devices')).status,401);
      assert.equal((await a.call('merchant-auth/me')).status,401);
    });
    await t.test('CSRF session initialization, JSON/origin/token gates', async () => {
      const r = await a.call('merchant-auth/csrf');assert.equal(r.status,200);assert.match(r.set[0],/HttpOnly/);assert.match(r.set[0],/SameSite=Lax/);
      assert.equal((await a.call('merchant-auth/register','POST',{}, {'x-csrf-token':''})).status,403);
      assert.equal((await a.call('merchant-auth/register','POST',{}, {Origin:'https://foreign.invalid'})).status,403);
      assert.equal((await a.call('merchant-auth/register','POST',{}, {Origin:''})).status,403);
      await b.init();
      assert.equal((await a.call('merchant-auth/register','POST',{}, {'x-csrf-token':b.csrf})).status,403);
      assert.equal((await a.call('merchant-auth/register','POST',{}, {'Content-Type':'text/plain'})).status,403);
    });
    await t.test('atomic registration, normalized email, Argon2id hash, no secret projection, session fixation prevented', async () => {
      await fixture('csrf');
      const oldCookie=a.cookie;
      const r=await a.call('merchant-auth/register','POST',{email:'  Owner-A@Example.invalid ',password,displayName:'Shop A',locationName:'Window A'});
      assert.equal(r.status,201);assert.equal(r.data.account.email,'owner-a@example.invalid');assert.notEqual(a.cookie,oldCookie);
      assert(!JSON.stringify(r.data).includes(password));assert(!JSON.stringify(r.data).includes('passwordHash'));
      merchantA=(await MerchantAccount.findOne({email:'owner-a@example.invalid'}).select('+passwordHash'));
      const [,algorithm,version,parameters] = merchantA.passwordHash.split('$');
      assert.equal(algorithm,'argon2id'); assert.equal(version,'v=19');
      assert.deepEqual(Object.fromEntries(parameters.split(',').map(p => p.split('='))),{m:'65536',t:'3',p:'1'});
      assert.equal(await verifyPassword(merchantA.passwordHash,password),true);
      assert.equal(await verifyPassword(merchantA.passwordHash,'wrong-test-password'),false);
      assert(merchantA.lastLoginAt); merchantA=merchantA.merchantId;
      locationA=(await m.Location.findOne({merchantId:merchantA})).locationId;
      const replay=client();replay.cookie=oldCookie;assert.equal((await replay.call('merchant-auth/me')).status,401);
      assert.equal((await a.call('merchant-auth/me')).status,200);
      const sessions=await mongoose.connection.db.collection('merchant_sessions').find({}).toArray();assert(sessions.length);assert(!JSON.stringify(sessions).includes(password));
    });
    await t.test('duplicate email rolls back Merchant and Location; malformed registration writes nothing', async () => {
      await fixture('a');
      const before=[await m.Merchant.countDocuments(),await m.Location.countDocuments(),await MerchantAccount.countDocuments()];
      assert.equal((await a.call('merchant-auth/register','POST',{email:'OWNER-A@example.invalid',password,displayName:'Duplicate',locationName:'Duplicate'})).status,400);
      assert.equal((await a.call('merchant-auth/register','POST',{email:'bad',password:'short',displayName:'Bad',locationName:'Bad'})).status,400);
      assert.deepEqual([await m.Merchant.countDocuments(),await m.Location.countDocuments(),await MerchantAccount.countDocuments()],before);
    });
    await t.test('second merchant is separate; profile/location update whitelist and isolation', async () => {
      await fixture('a');
      await b.init();assert.equal((await b.call('merchant-auth/register','POST',{email:'owner-b@example.invalid',password,displayName:'Shop B',locationName:'Window B'})).status,201);
      merchantB=(await MerchantAccount.findOne({email:'owner-b@example.invalid'})).merchantId;locationB=(await m.Location.findOne({merchantId:merchantB})).locationId;
      assert.notEqual(merchantA,merchantB);
      assert.equal((await a.call('merchant/me','PATCH',{displayName:'Updated A',address:{city:'Berlin',country:'DE'}})).status,200);
      assert.equal((await a.call('merchant/me','PATCH',{merchantId:merchantB,status:'INACTIVE'})).status,400);
      assert.equal((await b.call('merchant/me')).data.merchant.displayName,'Shop B');
      const l=await a.call('merchant/locations','POST',{name:'Second A',address:{city:'Hamburg'}});assert.equal(l.status,201);
      assert.equal((await a.call('merchant/locations/'+l.data.item.locationId,'PATCH',{name:'Renamed'})).status,200);
      assert.equal((await a.call('merchant/locations/'+locationB,'PATCH',{name:'Foreign'})).status,404);
      assert.equal((await a.call('merchant/locations/'+locationA,'DELETE')).status,403);
      assert.equal((await a.call('merchant/locations/'+locationA,'DELETE',{})).status,404);
    });
    await t.test('products create/update optional EAN, duplicate EAN/SKU, foreign IDs and injection', async () => {
      await fixture('ab');
      let r=await a.call('merchant/products','POST',{name:'Leather bag',ean:'',sku:''});assert.equal(r.status,201);productA=r.data.item;assert.equal(productA.ean,null);
      r=await b.call('merchant/products','POST',{name:'Book B',ean:'1234567890123'});assert.equal(r.status,201);productB=r.data.item;
      assert.equal((await a.call('merchant/products/'+productA.productId,'PATCH',{ean:'1234567890123',description:'Updated'})).status,200);
      assert.equal((await a.call('merchant/products','POST',{name:'Duplicate',ean:'1234567890123'})).status,409);
      assert.equal((await a.call('merchant/products/'+productB.productId,'PATCH',{name:'Foreign'})).status,404);
      assert.equal((await a.call('merchant/products/'+productB.productId)).status,404);
      assert.equal((await a.call('merchant/products?merchantId='+merchantB)).status,400);
      assert.equal((await a.call('merchant/products','POST',{name:'Bad',merchantId:merchantB})).status,400);
      assert.equal((await a.call('merchant/products/'+productA.productId,'PATCH',{image:'data:image/png;base64,test'})).status,400);
      assert.equal((await a.call('merchant/products')).data.items.length,1);
    });
    await t.test('offers integer money, stock, flags, own product/location and immutable identity', async () => {
      await fixture('products');
      const baseOffer={priceMinor:12900,currency:'EUR',stockQuantity:3,purchasable:true,reservable:true,active:true};
      let r=await a.call('merchant/offers','POST',{...baseOffer,productId:productA.productId,locationId:locationA});assert.equal(r.status,201);offerA=r.data.item;
      r=await b.call('merchant/offers','POST',{...baseOffer,productId:productB.productId,locationId:locationB});assert.equal(r.status,201);offerB=r.data.item;
      for(const invalid of [{priceMinor:1.5},{stockQuantity:-1},{purchasable:'yes'},{inventorySource:'EXTERNAL'}])assert.equal((await a.call('merchant/offers/'+offerA.offerId,'PATCH',invalid)).status,400);
      assert.equal((await a.call('merchant/offers/'+offerB.offerId,'PATCH',{priceMinor:10})).status,404);
      assert.equal((await a.call('merchant/offers','POST',{...baseOffer,productId:productB.productId,locationId:locationA})).status,404);
      assert.equal((await a.call('merchant/offers','POST',{...baseOffer,productId:productA.productId,locationId:locationB})).status,404);
      assert.equal((await a.call('merchant/offers/'+offerA.offerId,'PATCH',{locationId:locationB})).status,404);
    });
    await t.test('only provisioned own devices; rename leaves technical identity and credentials untouched', async () => {
      await fixture('ab');
      for(const [id,merchantId,locationId] of [['QR2B-000001',merchantA,locationA],['QR2B-000002',merchantB,locationB]]) {
        await m.ManagedDevice.create({deviceId:id,displayName:id.endsWith('1')?'Schild 1':'Schild 2',hardwareUid:id.endsWith('1')?'aa:00:00:00:00:01':'aa:00:00:00:00:02',hardwareVariant:'ESP32_ILI9341_CS5',status:'ACTIVE',firmwareVersion:'0.3.4',lastSeenAt:new Date()});
        await m.DeviceMerchantAssignment.create({deviceId:id,merchantId,locationId,validFrom:new Date(),status:'ACTIVE',usageType:'PILOT'});
      }
      deviceAuth=await createCredentialService({pepper:()=>pepper}).rotate('QR2B-000001');
      const r=await a.call('merchant/devices');assert.equal(r.data.items.length,1);assert.equal(r.data.items[0].product,null);assert(!JSON.stringify(r.data).includes('hardwareUid'));
      assert.equal((await a.call('merchant/devices/QR2B-000001','PATCH',{displayName:'Window left'})).status,200);
      assert.equal((await a.call('merchant/devices/QR2B-000002','PATCH',{displayName:'Foreign'})).status,404);
      for(const key of ['deviceId','hardwareUid','hardwareVariant','credential'])assert.equal((await a.call('merchant/devices/QR2B-000001','PATCH',{[key]:'tamper'})).status,400);
      assert.equal((await m.ManagedDevice.findOne({deviceId:'QR2B-000001'})).hardwareUid,'aa:00:00:00:00:01');
      assert.equal((await devices.config(deviceAuth)).assigned,false);
      await m.ManagedDevice.updateOne({deviceId:'QR2B-000001'},{$set:{lastSeenAt:new Date(Date.now()-121000)}});
      assert.equal((await a.call('merchant/devices')).data.items[0].online,false);
      assert.equal((await a.call('merchant/devices/QR2B-000002')).status,404);
      assert.equal((await b.call('merchant/devices')).data.items[0].deviceId,'QR2B-000002');
    });
    await t.test('session binding uses existing challenge service; foreign device/product blocked; no Basic Auth', async () => {
      await fixture('devices');
      assert.equal((await a.call('merchant/binding/devices/QR2B-000001')).status,200);
      assert.equal((await a.call('merchant/binding/devices/QR2B-000002')).status,404);
      assert.equal((await a.call('merchant/binding/devices/QR2B-000001/preview','POST',{method:'PRODUCT_CODE',value:productB.productBindingId})).status,404);
      const r=await a.call('merchant/binding/devices/QR2B-000001/preview','POST',{method:'PRODUCT_CODE',value:productA.productBindingId});assert.equal(r.status,200);assert.equal(r.data.product.name,'Leather bag');assert(!r.data.code);
      const config=await devices.config(deviceAuth);assert.equal(config.assigned,false);assert(config.bindingPreview);assert(!config.display);
      assert.equal((await b.call('merchant/binding/devices/QR2B-000001/confirm','POST',{previewId:r.data.previewId,code:config.bindingPreview.code})).status,404);
      assert.equal((await a.call('merchant/binding/devices/QR2B-000001/confirm','POST',{previewId:r.data.previewId,code:config.bindingPreview.code})).status,200);
      assert.equal((await devices.config(deviceAuth)).assigned,true);
      assert.equal((await a.call('merchant/devices')).data.items[0].assignmentStatus,'ACTIVE');
      assert.equal((await b.call('merchant/devices')).data.items[0].product,null);
    });
    for (const oldState of ['READY','SOLD','PAUSED']) for (const targetState of ['READY','SOLD','PAUSED'])
    await t.test(`0.3.8 NOCS rebinds ${oldState} A to ${targetState} B, preserving the other device on A`, async () => {
      await fixture('active',true);
      const firstId = 'QR2B-000001', secondId = 'QR2B-000002';
      await m.ManagedDevice.updateMany({}, {$set:{firmwareVersion:'0.3.8',lastSeenAt:new Date()}});
      const previous = await m.DisplayAssignment.create({deviceId:secondId,merchantId:merchantA,locationId:locationA,productId:productA.productId,offerId:offerA.offerId,status:'ACTIVE',assignedAt:new Date(),verifiedAt:new Date(),verificationMethod:'DEVICE_QR_AND_PRODUCT_CODE'});
      const secondAuth = await createCredentialService({pepper:()=>pepper}).rotate(secondId);
      const target = (await a.call('merchant/products','POST',{name:'Der Herr der Ringe'})).data.item;
      const targetOffer = (await a.call('merchant/offers','POST',{productId:target.productId,locationId:locationA,priceMinor:1990,currency:'EUR',stockQuantity:2,purchasable:true,reservable:true,active:true})).data.item;
      await m.Offer.updateOne({offerId:offerA.offerId},{$set:{active:oldState!=='PAUSED',stockQuantity:oldState==='READY'?3:0,purchasable:false,reservable:false}});
      await m.Offer.updateOne({offerId:targetOffer.offerId},{$set:{active:targetState!=='PAUSED',stockQuantity:targetState==='READY'?2:0,purchasable:false,reservable:false}});
      const firstConfig = await devices.config(deviceAuth,'0.3.8');
      assert.equal(firstConfig.display.status,oldState);
      const firstDevice = await m.ManagedDevice.findOne({deviceId:firstId}).lean();
      const firstAssignments = await m.DisplayAssignment.find({deviceId:firstId}).lean();
      const productsBefore = await m.MerchantProduct.find({}).sort({_id:1}).lean();
      const offersBefore = await m.Offer.find({}).sort({_id:1}).lean();
      const ownershipBefore = await m.DeviceMerchantAssignment.find({}).sort({_id:1}).lean();
      const credentialsBefore = await m.DeviceCredential.find({}).select('+verifier').sort({_id:1}).lean();
      const path = 'merchant/binding/devices/'+secondId;
      const context = await a.call(path);
      assert.equal(context.status,200);
      assert(context.data.products.some(p=>p.productBindingId===target.productBindingId));
      const body = {method:'PRODUCT_CODE',value:target.productBindingId};
      assert.equal((await b.call(path+'/preview','POST',body)).status,404);
      assert.equal((await a.call(path+'/preview','POST',body,{'x-csrf-token':''})).status,403);
      const firstPreview = await a.call(path+'/preview','POST',body);
      assert.equal(firstPreview.status,200);
      assert.equal((await m.DisplayAssignment.findById(previous._id)).status,'ACTIVE');
      assert.equal((await a.call(path+'/cancel','POST',{previewId:firstPreview.data.previewId})).status,200);
      assert.equal((await devices.config(secondAuth,'0.3.8')).product.productId,productA.productId);
      const preview = await a.call(path+'/preview','POST',body);
      assert.equal(preview.status,200);
      const shown = await devices.config(secondAuth,'0.3.8');
      assert.equal(shown.bindingPreview.productName,target.name);
      assert.equal(shown.display,undefined); // Challenge screen has no buyer QR.
      const code = shown.bindingPreview.code;
      assert.equal((await b.call(path+'/confirm','POST',{previewId:preview.data.previewId,code})).status,404);
      assert.equal((await a.call(path+'/confirm','POST',{previewId:preview.data.previewId,code:code==='000000'?'111111':'000000'})).status,400);
      assert.equal((await m.DisplayAssignment.findById(previous._id)).status,'ACTIVE');
      const confirmed = await a.call(path+'/confirm','POST',{previewId:preview.data.previewId,code});
      assert.equal(confirmed.status,200); assert.equal(confirmed.data.status,'ACTIVE');
      assert.equal((await a.call(path+'/confirm','POST',{previewId:preview.data.previewId,code})).status,200);
      const old = await m.DisplayAssignment.findById(previous._id);
      assert.equal(old.status,'REPLACED'); assert(old.endedAt);
      const current = await m.DisplayAssignment.find({deviceId:secondId,status:'ACTIVE'}).lean();
      assert.equal(current.length,1); assert.equal(current[0].offerId,targetOffer.offerId); assert(current[0].verifiedAt);
      const secondConfig = await devices.config(secondAuth,'0.3.8');
      assert.equal(secondConfig.assigned,true); assert.equal(secondConfig.product.productId,target.productId);
      assert.equal(secondConfig.display.status,targetState);
      assert.equal(secondConfig.display.qr,targetState==='READY'?'https://qr2buy.com/o/'+targetOffer.publicOfferId:'');
      assert.deepEqual(await devices.config(deviceAuth,'0.3.8'),firstConfig);
      assert.deepEqual(await m.ManagedDevice.findOne({deviceId:firstId}).lean(),firstDevice);
      assert.deepEqual(await m.DisplayAssignment.find({deviceId:firstId}).lean(),firstAssignments);
      assert.deepEqual(await m.MerchantProduct.find({}).sort({_id:1}).lean(),productsBefore);
      assert.deepEqual(await m.Offer.find({}).sort({_id:1}).lean(),offersBefore);
      assert.deepEqual(await m.DeviceMerchantAssignment.find({}).sort({_id:1}).lean(),ownershipBefore);
      assert.deepEqual(await m.DeviceCredential.find({}).select('+verifier').sort({_id:1}).lean(),credentialsBefore);
    });
    await t.test('sale-state edits preserve a challenge, but expiry still blocks a paused zero-stock target', async () => {
      await fixture('active');
      const path = 'merchant/binding/devices/'+deviceAuth.deviceId;
      await m.ManagedDevice.updateOne({deviceId:deviceAuth.deviceId},{$set:{firmwareVersion:'0.3.8'}});
      const body = {method:'PRODUCT_CODE',value:productA.productBindingId};
      const p = await a.call(path+'/preview','POST',body);
      assert.equal(p.status,200);
      const challenge = (await devices.config(deviceAuth,'0.3.8')).bindingPreview;
      for (const state of [{stockQuantity:0},{active:false,stockQuantity:2},{purchasable:false,reservable:false}]) {
        await m.Offer.updateOne({offerId:offerA.offerId},{$set:state});
        assert.deepEqual((await devices.config(deviceAuth,'0.3.8')).bindingPreview,challenge);
      }
      assert.equal((await a.call(path+'/confirm','POST',{previewId:p.data.previewId,code:challenge.code})).status,200);
      assert.equal((await devices.config(deviceAuth,'0.3.8')).display.status,'PAUSED');
      await m.Offer.updateOne({offerId:offerA.offerId},{$set:{stockQuantity:0}});
      const before = await m.DisplayAssignment.find({status:'ACTIVE'}).lean();
      const expired = await a.call(path+'/preview','POST',body);
      assert.equal(expired.status,200);
      const code = (await devices.config(deviceAuth,'0.3.8')).bindingPreview.code;
      bindingTime = new Date(expired.data.expiresAt);
      const clocked = createDeviceService({now:()=>bindingTime,pepper:()=>pepper,publicOrigin:()=> 'https://qr2buy.com'});
      assert.equal((await clocked.config(deviceAuth,'0.3.8')).bindingPreview,undefined);
      const rejected = await a.call(path+'/confirm','POST',{previewId:expired.data.previewId,code});
      assert.equal(rejected.status,409); assert.equal(rejected.data.error,'preview_expired');
      assert.deepEqual(await m.DisplayAssignment.find({status:'ACTIVE'}).lean(),before);
    });
    await t.test('merchant session restarts expired preview without cleanup, replay or activation', async () => {
      await fixture('devices');
      const path = 'merchant/binding/devices/QR2B-000001';
      const body = { method: 'PRODUCT_CODE', value: productA.productBindingId };
      const first = await a.call(path+'/preview', 'POST', body);
      assert.equal(first.status, 200);
      const firstConfig = await devices.config(deviceAuth);
      const oldCode = firstConfig.bindingPreview.code;
      const previous = await m.BindingPreview.findOne({ deviceId: 'QR2B-000001' }).select('+nonce').lean();
      bindingTime = new Date(+new Date(first.data.expiresAt));
      const clockedDevices = createDeviceService({ now: () => bindingTime, pepper: () => pepper, publicOrigin: () => 'https://qr2buy.com' });
      assert.deepEqual(await clockedDevices.config(deviceAuth), { ok: true, deviceId: 'QR2B-000001', assigned: false });
      const expired = await a.call(path+'/confirm', 'POST', { previewId: first.data.previewId, code: oldCode });
      assert.equal(expired.status, 409); assert.equal(expired.data.error, 'preview_expired');
      // Reopen the binding page with the same real Mongo-backed merchant session.
      assert.equal((await a.call('merchant/devices')).data.items[0].assignmentStatus, 'PENDING');
      assert.equal((await a.call('merchant-auth/me')).status, 200);
      assert.equal((await a.call(path)).status, 200);
      const second = await a.call(path+'/preview', 'POST', body);
      assert.equal(second.status, 200);
      assert.notEqual(second.data.previewId, first.data.previewId);
      assert.equal(+new Date(second.data.expiresAt) - bindingTime, PREVIEW_TTL_MS);
      const current = await m.BindingPreview.findOne({ deviceId: 'QR2B-000001' }).select('+nonce').lean();
      assert.equal(String(current._id), String(previous._id));
      assert.notEqual(current.nonce, previous.nonce);
      const config = await clockedDevices.config(deviceAuth);
      assert.equal(config.assigned, false); assert.equal(config.display, undefined);
      assert.equal(config.bindingPreview.previewId, second.data.previewId);
      assert.match(config.bindingPreview.code, /^\d{6}$/);
      assert.equal((await a.call(path+'/confirm', 'POST', { previewId: first.data.previewId, code: oldCode })).status, 404);
      assert.equal((await b.call(path+'/preview', 'POST', body)).status, 404);
      assert.equal((await a.call(path+'/preview', 'POST', body, { 'x-csrf-token': '' })).status, 403);
      assert.equal((await a.call(path+'/preview', 'POST', body, { Origin: 'https://foreign.invalid' })).status, 403);
      assert.equal((await clockedDevices.config(deviceAuth)).bindingPreview.previewId, second.data.previewId);
      assert.equal(await m.DisplayAssignment.countDocuments({ status: 'ACTIVE' }), 0);
      const pending = await m.DisplayAssignment.find({ deviceId: 'QR2B-000001' }).lean();
      assert.equal(pending.length, 1); assert.equal(pending[0].status, 'PENDING'); assert.equal(pending[0].verifiedAt, null);
    });
    for (const fw of ['0.3.6', '0.3.7', '0.3.8']) await t.test('pause and resume preserve binding, portal and country with '+fw, async () => {
      await fixture('active');
      const before = await m.DisplayAssignment.find({deviceId:deviceAuth.deviceId}).lean();
      assert.equal((await a.call('merchant/me','PATCH',{address:{country:'AT'}})).status,200);
      assert.equal((await a.call('merchant/me')).data.merchant.address.country,'AT');
      assert.equal((await a.call('merchant/offers/'+offerA.offerId,'PATCH',{active:false})).status,200);
      const card=(await a.call('merchant/devices')).data.items[0];
      assert.equal(card.assignmentStatus,'ACTIVE'); assert.equal(card.product.productId,productA.productId);
      assert.equal(card.offer.active,false);
      const paused=await devices.config(deviceAuth,fw);
      assert.equal(paused.assigned,true); assert.equal(paused.display.status,'PAUSED'); assert.equal(paused.display.qr,'');
      assert.equal((await a.call('merchant/offers/'+offerA.offerId,'PATCH',{active:true})).status,200);
      assert.equal((await devices.config(deviceAuth,fw)).display.status,'READY');
      assert.deepEqual(await m.DisplayAssignment.find({deviceId:deviceAuth.deviceId}).lean(),before);
      // New firmware must retain support for the existing preview/confirmation flow.
      const retry=await binding.start(merchantA,deviceAuth.deviceId,{method:'PRODUCT_CODE',value:productA.productBindingId},'test-only');
      assert.equal(retry.status,'PREVIEW');
      const previewConfig = await devices.config(deviceAuth, fw);
      await binding.finish(merchantA, deviceAuth.deviceId, {previewId:retry.previewId,code:previewConfig.bindingPreview.code});
      assert.equal((await devices.config(deviceAuth, fw)).assigned, true);
    });
    await t.test('remote price/stock/terms project immediately to device and public offer, no checkout', async () => {
      await fixture('active');
      const updates={priceMinor:13900,stockQuantity:7,purchasable:false,reservable:true,reservationDuration:30,conditions:'Test conditions'};
      assert.equal((await a.call('merchant/offers/'+offerA.offerId,'PATCH',updates)).status,200);
      const c=await devices.config(deviceAuth);for(const [key,value] of Object.entries(updates))assert.equal(c.offer[key],value);
      const buyer=await devices.publicOffer(offerA.publicOfferId);assert.equal(buyer.offer.priceMinor,13900);assert.equal(buyer.offer.conditions,updates.conditions);assert.equal(buyer.checkoutAvailable,false);
      assert.match(c.display.qr,/\/o\/[a-f0-9]{32}$/);
    });
    await t.test('disabled/suspended accounts fail closed; logout invalidates; successful login rotates again', async () => {
      await fixture('a');
      await MerchantAccount.updateOne({merchantId:merchantA},{$set:{status:'DISABLED'}});assert.equal((await a.call('merchant-auth/me')).status,401);
      assert.equal((await a.call('merchant-auth/login','POST',{email:'owner-a@example.invalid',password})).status,401);
      await MerchantAccount.updateOne({merchantId:merchantA},{$set:{status:'ACTIVE'}});
      await m.Merchant.updateOne({merchantId:merchantA},{$set:{status:'SUSPENDED'}});assert.equal((await a.call('merchant/products')).status,401);await m.Merchant.updateOne({merchantId:merchantA},{$set:{status:'ACTIVE'}});
      assert.equal((await a.call('merchant-auth/login','POST',{email:'owner-a@example.invalid',password:'wrong-test-password'})).status,401);
      const previous=a.cookie;assert.equal((await a.call('merchant-auth/login','POST',{email:'OWNER-A@example.invalid',password})).status,200);assert.notEqual(a.cookie,previous);
      const replay=client();replay.cookie=previous;assert.equal((await replay.call('merchant-auth/me')).status,401);
      const activeCookie=a.cookie;assert.equal((await a.call('merchant-auth/logout','POST',{})).status,200);replay.cookie=activeCookie;assert.equal((await replay.call('merchant-auth/me')).status,401);
    });
    await t.test('explicit existing-merchant link is idempotent, creates no merchant/location/device duplicates', async () => {
      await fixture('ab');
      await m.Merchant.create({merchantId:'merchant-demo-001',displayName:'Existing pilot',contactEmail:'pilot@example.invalid'});
      await m.Location.create({merchantId:'merchant-demo-001',locationId:'location-demo-001',name:'Existing location'});
      const before=[await m.Merchant.countDocuments(),await m.Location.countDocuments(),await m.ManagedDevice.countDocuments()];
      assert.equal((await linkMerchantOwner({merchantId:'merchant-demo-001',email:'pilot-owner@example.invalid',password})).created,true);
      assert.equal((await linkMerchantOwner({merchantId:'merchant-demo-001',email:'pilot-owner@example.invalid',password})).created,false);
      await assert.rejects(linkMerchantOwner({merchantId:merchantB,email:'pilot-owner@example.invalid',password}));
      assert.deepEqual([await m.Merchant.countDocuments(),await m.Location.countDocuments(),await m.ManagedDevice.countDocuments()],before);
      const pilot=client();await pilot.init();assert.equal((await pilot.call('merchant-auth/login','POST',{email:'pilot-owner@example.invalid',password})).status,200);assert.equal((await pilot.call('merchant/me')).data.merchant.merchantId,'merchant-demo-001');
    });
    await t.test('login rate limit rejects repeated attempts and production cookie options are secure', async () => {
      const c=client();await c.init();let r;for(let i=0;i<22;i++)r=await c.call('merchant-auth/login','POST',{});assert.equal(r.status,429);
      const config=createMerchantSession({secret:'test-only-'+ 'y'.repeat(40),origin:'https://qr2buy.com',production:true,store});
      assert.equal(config.name,'__Host-qr2buy-merchant');assert.equal(config.cookieOptions.secure,true);assert.equal(config.cookieOptions.httpOnly,true);assert.equal(config.cookieOptions.path,'/');
    });
  } finally {
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    if(store)await store.close();await mongoose.disconnect();await repl.stop();
  }
});
