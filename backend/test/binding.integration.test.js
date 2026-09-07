import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as m from '../src/merchant/models.js';
import { createBindingService, PREVIEW_TTL_MS } from '../src/merchant/binding.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { createCredentialService } from '../src/merchant/deviceCredentials.js';
import { createBindingRouter, createDeviceEntryRouter } from '../src/routes/binding.js';
import { prepareProductBindingIds } from '../src/scripts/prepareProductBindingIds.js';

test('binding: real isolated Mongo, HTTP, physical-code proof and transitions', { timeout: 180000 }, async t => {
  const repl = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, ip: '127.0.0.1' } });
  let server;
  const names = ['ADMIN_USER','ADMIN_PASS','BINDING_OPERATOR_MERCHANT_ID','PUBLIC_BASE_URL'];
  const envBefore = Object.fromEntries(names.map(n => [n, process.env[n]]));
  try {
    await mongoose.connect(repl.getUri('qr2buy_binding_test_' + randomBytes(8).toString('hex')));
    const models = [m.Merchant,m.Location,m.ManagedDevice,m.DeviceCredential,m.DeviceMerchantAssignment,m.MerchantProduct,m.Offer,m.DisplayAssignment,m.BindingPreview];
    await Promise.all(models.map(Model => Model.init()));
    let at = new Date();
    const now = () => at;
    const pepper = 'ab'.repeat(32); // Clear test-only pepper, no .env or production connection.
    const binding = createBindingService({ now, pepper: () => pepper });
    const device = createDeviceService({ now, pepper: () => pepper, publicOrigin: () => 'https://qr2buy.com' });
    const credentials = createCredentialService({ now, pepper: () => pepper });
    const ids = ['QR2B-000001','QR2B-000002','QR2B-000003'];
    for (const i of [0,1]) {
      await m.Merchant.create({ merchantId: 'M'+i, displayName: 'Test merchant '+i, contactEmail: 'test@example.invalid' });
      await m.Location.create({ locationId: 'L'+i, merchantId: 'M'+i, name: 'Test location' });
    }
    const auth=[];
    for (let i=0;i<3;i++) {
      await m.ManagedDevice.create({ deviceId: ids[i], displayName:'Schild '+(i+1), hardwareVariant:i===1?'ESP32_ILI9341_NOCS':'ESP32_ILI9341_CS5', status:'ACTIVE', firmwareVersion:'0.3.4', lastSeenAt:at });
      await m.DeviceMerchantAssignment.create({ deviceId:ids[i],merchantId:i===2?'M1':'M0',locationId:i===2?'L1':'L0',validFrom:at,status:'ACTIVE',usageType:'PILOT' });
      auth.push(await credentials.rotate(ids[i]));
    }
    const products=[],offers=[];
    for(let i=0;i<3;i++) {
      products.push(await m.MerchantProduct.create({ merchantId:i===2?'M1':'M0',productId:'P'+i,name:'Product '+i,ean:i===1?null:'123456789012'+i }));
      offers.push(await m.Offer.create({ merchantId:i===2?'M1':'M0',locationId:i===2?'L1':'L0',productId:'P'+i,offerId:'O'+i,priceMinor:12900+i,stockQuantity:3,currency:'EUR' }));
    }
    const prepared = await m.DisplayAssignment.create({ deviceId:ids[0],merchantId:'M0',locationId:'L0',productId:'P0',offerId:'O0',status:'PENDING',assignedAt:at });
    const start=(i=0,p=0,method='PRODUCT_CODE')=>binding.start('M0',ids[i],{method,value:method==='EAN'?products[p].ean:products[p].productBindingId},'test-operator');
    const shown=async(i=0)=>(await device.config(auth[i])).bindingPreview;
    const confirm=async(i,p)=>binding.finish('M0',ids[i],{previewId:p.previewId,code:(await shown(i)).code});
    const rejects=(promise,status)=>assert.rejects(promise,e=>e.status===status);
    await t.test('public device identity only, unknown 404, inactive safe state',async()=>{
      assert.deepEqual(await binding.publicDevice(ids[0]),{ok:true,deviceId:ids[0],available:true});
      await rejects(binding.publicDevice('QR2B-999999'),404);await rejects(binding.publicDevice('invalid'),404);
      await m.ManagedDevice.updateOne({deviceId:ids[2]},{$set:{status:'INACTIVE'}});
      assert.equal((await binding.publicDevice(ids[2])).available,false);
      await m.ManagedDevice.updateOne({deviceId:ids[2]},{$set:{status:'ACTIVE'}});
    });
    await t.test('merchant context has no MAC, verifier, internal product IDs; foreign device rejected',async()=>{
      const c=await binding.context('M0',ids[0]);assert.equal(c.products.length,2);assert.equal(c.device.displayName,'Schild 1');
      assert(!/hardwareUid|verifier|secret|_id|"productId"/.test(JSON.stringify(c)));
      await rejects(binding.context('M0',ids[2]),404);
    });
    await t.test('foreign EAN and product code never resolve, optional EAN works',async()=>{
      await rejects(start(0,2,'EAN'),404);await rejects(start(0,2),404);
      const p=await start(0,0,'EAN');assert.equal(p.product.name,'Product 0');
      assert.equal((await m.BindingPreview.findOne({deviceId:ids[0]})).verificationMethod,'DEVICE_QR_AND_EAN');
    });
    await t.test('reuse existing PENDING, secret code only on selected device, no buyer QR',async()=>{
      const p=await start();assert.equal(+new Date(p.expiresAt)-at,PREVIEW_TTL_MS);
      assert.equal(await m.DisplayAssignment.countDocuments({deviceId:ids[0]}),1);
      assert.equal(String((await m.BindingPreview.findOne({deviceId:ids[0]})).assignmentId),String(prepared._id));
      assert(!/"code"|nonce/.test(JSON.stringify(p)));
      const config=await device.config(auth[0]);assert.equal(config.assigned,false);assert.match(config.bindingPreview.code,/^\d{6}$/);assert.equal(config.display,undefined);
      assert.deepEqual(await device.config(auth[1]),{ok:true,deviceId:ids[1],assigned:false});
      assert.equal((await m.DisplayAssignment.findById(prepared._id)).status,'PENDING');
    });
    await t.test('cancel removes preview without activation, idempotent cancel',async()=>{
      const p=await start();const data={previewId:p.previewId,cancel:true};
      assert.equal((await binding.finish('M0',ids[0],data)).status,'CANCELLED');
      assert.equal((await binding.finish('M0',ids[0],data)).status,'CANCELLED');
      assert.equal(await shown(),undefined);assert.equal((await m.DisplayAssignment.findById(prepared._id)).status,'PENDING');
    });
    await t.test('TTL expires preview and rejects replay before any transition',async()=>{
      const p=await start(),code=(await shown()).code;at=new Date(+at+PREVIEW_TTL_MS);
      assert.equal(await shown(),undefined);await rejects(binding.finish('M0',ids[0],{previewId:p.previewId,code}),409);
      await m.ManagedDevice.updateMany({},{$set:{lastSeenAt:at}});
    });
    await t.test('incorrect physical code bounded to five attempts, no active assignment',async()=>{
      const p=await start();const correct=(await shown()).code;const wrong=correct==='000000'?'111111':'000000';
      for(let n=0;n<5;n++)await rejects(binding.finish('M0',ids[0],{previewId:p.previewId,code:wrong}),400);
      assert.equal((await m.BindingPreview.findOne({deviceId:ids[0]})).attempts,5);
      assert.equal(await shown(),undefined);await rejects(binding.finish('M0',ids[0],{previewId:p.previewId,code:correct}),409);
      assert.equal(await m.DisplayAssignment.countDocuments({status:'ACTIVE'}),0);
    });
    await t.test('old challenge replay and foreign confirmation rejected',async()=>{
      const old=await start(),code=(await shown()).code;await start();
      await rejects(binding.finish('M0',ids[0],{previewId:old.previewId,code}),404);
      await rejects(binding.finish('M1',ids[0],{previewId:old.previewId,code}),404);
    });
    await t.test('confirm physical code activates existing PENDING exactly once and releases buyer QR',async()=>{
      const p=await start(),code=(await shown()).code;
      const outcomes=await Promise.all([binding.finish('M0',ids[0],{previewId:p.previewId,code}),binding.finish('M0',ids[0],{previewId:p.previewId,code})]);
      assert(outcomes.every(o=>o.status==='ACTIVE'));assert.equal(await m.DisplayAssignment.countDocuments({deviceId:ids[0],status:'ACTIVE'}),1);
      const row=await m.DisplayAssignment.findById(prepared._id);assert(row.verifiedAt);assert.equal(row.boundBy,'test-operator');
      const config=await device.config(auth[0]);assert.equal(config.assigned,true);assert.equal(config.display.qr,'https://qr2buy.com/o/'+offers[0].publicOfferId);
    });
    await t.test('preview cancel preserves previous active offer; confirmation replaces it atomically',async()=>{
      let p=await start(0,1);await binding.finish('M0',ids[0],{previewId:p.previewId,cancel:true});
      assert.equal((await device.config(auth[0])).product.productId,'P0');
      p=await start(0,1);await confirm(0,p);
      assert.equal((await m.DisplayAssignment.findById(prepared._id)).status,'REPLACED');
      assert.equal(await m.DisplayAssignment.countDocuments({deviceId:ids[0],status:'ACTIVE'}),1);
      assert.equal((await device.config(auth[0])).product.productId,'P1');
    });
    await t.test('second device preview isolated, separate buyer QR after confirmation',async()=>{
      const before=await device.config(auth[0]);const p=await start(1,0);assert.deepEqual(await device.config(auth[0]),before);
      await confirm(1,p);const second=await device.config(auth[1]);assert(second.assigned);assert.notEqual(second.display.qr,before.display.qr);
    });
    await t.test('offer edits invalidate confirmation and preview',async()=>{
      const p=await start(1,0),code=(await shown(1)).code;await m.Offer.updateOne({offerId:'O0'},{$set:{priceMinor:20000}});
      assert.equal(await shown(1),undefined);await rejects(binding.finish('M0',ids[1],{previewId:p.previewId,code}),409);
      await m.Offer.updateOne({offerId:'O0'},{$set:{priceMinor:12900}});
    });
    await t.test('sold active offer takes priority and blocks activation',async()=>{
      const p=await start(0,0),code=(await shown()).code;
      await m.Offer.updateOne({offerId:'O1'},{$set:{stockQuantity:0}});
      const c=await device.config(auth[0]);assert.equal(c.bindingPreview,undefined);assert.equal(c.display.status,'SOLD');assert.equal(c.display.qr,'');
      await rejects(binding.finish('M0',ids[0],{previewId:p.previewId,code}),409);
      await m.Offer.updateOne({offerId:'O1'},{$set:{stockQuantity:3}});
    });
    await t.test('old firmware and offline devices cannot start previews',async()=>{
      await m.ManagedDevice.updateOne({deviceId:ids[0]},{$set:{firmwareVersion:'0.3.2'}});await rejects(start(),409);
      await m.ManagedDevice.updateOne({deviceId:ids[0]},{$set:{firmwareVersion:'0.3.4',lastSeenAt:new Date(+at-121000)}});await rejects(start(),409);
      await m.ManagedDevice.updateOne({deviceId:ids[0]},{$set:{lastSeenAt:at}});
    });
    await t.test('ownership history change invalidates a previous physical challenge',async()=>{
      const p=await start(),code=(await shown()).code;
      const old=await m.DeviceMerchantAssignment.findOne({deviceId:ids[0],status:'ACTIVE'});
      await m.DeviceMerchantAssignment.updateOne({_id:old._id},{$set:{status:'ENDED',validUntil:at}});
      await m.DeviceMerchantAssignment.create({deviceId:ids[0],merchantId:'M0',locationId:'L0',status:'ACTIVE',validFrom:at,usageType:'PILOT'});
      assert.equal(await shown(),undefined);await rejects(binding.finish('M0',ids[0],{previewId:p.previewId,code}),404);
    });
    await t.test('same EAN across merchants resolves only the authorized merchant product',async()=>{
      await m.MerchantProduct.updateOne({productId:'P2'},{$set:{ean:products[0].ean}});
      const p=await start(0,0,'EAN');assert.equal(p.product.name,'Product 0');
    });
    await t.test('scoped stable product-code migration is idempotent',async()=>{
      await m.MerchantProduct.collection.updateOne({productId:'P0'},{$unset:{productBindingId:''}});
      assert.equal(await prepareProductBindingIds('M1'),0);assert.equal(await prepareProductBindingIds('M0'),1);
      const id=(await m.MerchantProduct.findOne({productId:'P0'})).productBindingId;assert.match(id,/^[a-f0-9]{32}$/);
      assert.equal(await prepareProductBindingIds('M0'),0);assert.equal((await m.MerchantProduct.findOne({productId:'P0'})).productBindingId,id);
    });
    await t.test('HTTP operator auth, fixed server scope, CSRF and payload hygiene',async()=>{
      process.env.ADMIN_USER='test-operator';process.env.ADMIN_PASS='test-only-password';process.env.BINDING_OPERATOR_MERCHANT_ID='M0';process.env.PUBLIC_BASE_URL='https://qr2buy.com';
      const app=express();app.use(express.json());app.use('/api/binding',createBindingRouter(binding));app.use('/device',createDeviceEntryRouter(binding));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
      const origin='http://127.0.0.1:'+server.address().port;
      const url=origin+'/api/binding/operator/devices/'+ids[0];
      assert.equal((await fetch(url)).status,401);
      const headers={authorization:'Basic '+Buffer.from('test-operator:test-only-password').toString('base64'),'content-type':'application/json'};
      assert.equal((await fetch(url,{headers})).status,200);
      assert.equal((await fetch(origin+'/api/binding/operator/devices/'+ids[2],{headers})).status,404);
      assert.equal((await fetch(url+'/preview',{method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:'{}'})).status,403);
      const p=products[1];const res=await fetch(url+'/preview',{method:'POST',headers,body:JSON.stringify({method:'PRODUCT_CODE',value:p.productBindingId,merchantId:'M1'})});
      assert.equal(res.status,200);const body=await res.text();assert(!/nonce|"code"|verifier|hardwareUid/.test(body));
      const unknown=await fetch(origin+'/api/binding/devices/QR2B-999999');assert.equal(unknown.status,404);
      assert.equal((await fetch(origin+'/device/QR2B-999999')).status,404);
      const entry=await fetch(origin+'/device/QR2B-000001',{redirect:'manual'});assert.equal(entry.status,303);assert.equal(entry.headers.get('location'),'/binding/QR2B-000001');
    });
  } finally {
    if(server)await new Promise(r=>server.close(r));
    for(const name of names)if(envBefore[name]===undefined)delete process.env[name];else process.env[name]=envBefore[name];
    if(mongoose.connection.readyState)await mongoose.connection.dropDatabase();
    await mongoose.disconnect();await repl.stop();
  }
});
