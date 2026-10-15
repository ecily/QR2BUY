import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import MongoStore from 'connect-mongo';
import { randomBytes } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as m from '../src/merchant/models.js';
import { MerchantAccount, hashPassword } from '../src/merchant/accounts.js';
import { createMerchantPortal } from '../src/routes/merchantPortal.js';
import { createDeviceClaimService, CLAIM_TTL_MS, claimSetup, claimNameSupported } from '../src/merchant/deviceClaims.js';
import { bindingTransaction } from '../src/merchant/binding.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { createCredentialService } from '../src/merchant/deviceCredentials.js';
import { verifyClaimIndexes } from '../src/merchant/claimIndexes.js';
import { main as verifyIndexCommand } from '../src/scripts/verifyDeviceClaimIndexes.js';

test('initial device claims: isolated replica set, authenticated portal and physical proof', { timeout: 180000 }, async t => {
  const repl = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, ip: '127.0.0.1' } });
  let server, store;
  try {
    const uri = repl.getUri('qr2buy_claim_test_'+randomBytes(8).toString('hex'));
    await mongoose.connect(uri);
    await Promise.all([...Object.values(m).filter(x => x?.modelName), MerchantAccount].map(Model => Model.init()));
    for(const Model of [m.DeviceClaim,m.DeviceClaimAttempt]) {await Model.createCollection();await Model.createIndexes();}
    let at = new Date(Date.now()-3600000); const now = () => at, pepper = () => 'ef'.repeat(32);
    const claims = createDeviceClaimService({ now, pepper }), devices = createDeviceService({ now, pepper });
    const credentials = createCredentialService({ now, pepper });
    const reject = (promise, code) => assert.rejects(promise, e => e.code === code);
    for (const id of ['A','B']) {
      await m.Merchant.create({ merchantId: id, displayName: 'Merchant '+id, contactEmail: id+'@example.invalid' });
      await m.Location.create({ merchantId: id, locationId: 'L'+id, name: 'Location '+id });
      await MerchantAccount.create({ merchantId: id, accountId: id, email: id+'@example.invalid', passwordHash: 'test-only-unused' });
    }
    const auth = {};
    for (let i=1;i<=3;i++) {
      const id = 'QR2B-00000'+i;
      await m.ManagedDevice.create({ deviceId: id, displayName: id, hardwareUid: 'test-mac-'+i,
        hardwareVariant: 'ESP32_ILI9341_CS5', status: i===3 ? 'PROVISIONED' : 'ACTIVE', firmwareVersion: '0.3.12', lastSeenAt: at });
      auth[i] = await credentials.rotate(id);
      if (i<3) await m.DeviceMerchantAssignment.create({ deviceId: id, merchantId: 'A', locationId: 'LA', status: 'ACTIVE', usageType: 'PILOT', validFrom: at });
    }
    const id='QR2B-000003', snapshot = async () => JSON.stringify(await Promise.all([
      m.ManagedDevice.find({deviceId:{$ne:id}}).sort({deviceId:1}).lean(), m.DeviceCredential.find({deviceId:{$ne:id}}).select('+verifier').sort({deviceId:1}).lean(),
      m.DeviceMerchantAssignment.find({deviceId:{$ne:id}}).sort({deviceId:1}).lean()
    ]));
    const before = await snapshot();
    const setup = (deviceId=id,version=auth[3].version) => claimSetup(deviceId,version,at,pepper()).code;
    const start = (key='1', merchant='A') => claims.start(merchant,merchant,{deviceId:id,locationId:'L'+merchant,setupCode:setup(),requestKey:key.repeat(32)});
    const shown = async (version='0.3.12') => (await devices.config(auth[3],version)).claimPreview;
    const finish = (p,code,merchant='A') => claims.confirm(merchant,merchant,p.claimId,{code});
    await t.test('foreign location, role, assigned devices, old firmware and missing pepper fail closed',async()=>{
      await reject(claims.start('A','A',{deviceId:id,locationId:'LB',setupCode:setup(),requestKey:'a'.repeat(32)}),'claim_forbidden');
      await reject(claims.start('A','B',{deviceId:id,locationId:'LA',setupCode:setup(),requestKey:'a'.repeat(32)}),'claim_forbidden');
      await MerchantAccount.updateOne({accountId:'A'},{$set:{role:'STAFF'}});await reject(start(),'claim_forbidden');
      await MerchantAccount.updateOne({accountId:'A'},{$set:{role:'OWNER'}});
      await m.Location.updateOne({locationId:'LA'},{$set:{status:'INACTIVE'}});await reject(start(),'claim_forbidden');
      await m.Location.updateOne({locationId:'LA'},{$set:{status:'ACTIVE'}});
      await m.ManagedDevice.updateOne({deviceId:id},{$set:{lastSeenAt:new Date(+at-120001)}});await reject(start(),'device_update_required');
      await m.ManagedDevice.updateOne({deviceId:id},{$set:{lastSeenAt:at}});
      for(const i of [1,2]) await reject(claims.start('B','B',{deviceId:'QR2B-00000'+i,locationId:'LB',setupCode:setup(),requestKey:'a'.repeat(32)}),'device_unavailable');
      await m.ManagedDevice.updateOne({deviceId:id},{$set:{firmwareVersion:'0.3.11'}});
      await reject(start(),'device_update_required');
      await m.ManagedDevice.updateOne({deviceId:id},{$set:{firmwareVersion:'0.3.12'}});
      await reject(createDeviceClaimService({now,pepper:()=>''}).start('A','A',{deviceId:id,locationId:'LA',setupCode:setup(),requestKey:'a'.repeat(32)}),'claim_unavailable');
      assert.equal(await m.DeviceClaim.countDocuments(),0);
    });
    await t.test('parallel merchants: exactly one challenge; code only on authenticated correct device; retry stable',async()=>{
      const results = await Promise.allSettled([start(),start('2','B')]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      const pending = await m.DeviceClaim.findOne({deviceId:id});
      const owner = pending.merchantId;
      // Keep all later tests deterministic regardless of race winner.
      if(owner==='B') {await m.DeviceClaim.deleteOne({deviceId:id});await start('3');} // Reset only the isolated race fixture.
      const p = await m.DeviceClaim.findOne({deviceId:id}).select('+requestKey');
      const retry = await claims.start('A','A',{deviceId:id,locationId:'LA',setupCode:setup(),requestKey:p.requestKey});
      assert.equal(retry.claimId,p.claimId); assert.equal(+new Date(retry.expiresAt),+p.expiresAt);
      assert(!/"code"|nonce|verifier|secret|requestKey/.test(JSON.stringify(retry)));
      const challenge = await shown();assert.match(challenge.code,/^\d{6}$/);assert.equal(challenge.merchantName,'Merchant A');assert.equal(challenge.locationName,'Location A');
      assert.equal(await shown('0.3.11'),undefined);
      assert.equal((await devices.config(auth[1],'0.3.12')).claimPreview,undefined);
      await reject(devices.config({...auth[3],secret:auth[1].secret},'0.3.12'),'device_unauthorized');
      await reject(finish(p,challenge.code,'B'),'claim_not_found');
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:id}),0);
    });
    await t.test('wrong codes persist across expiry/restart; budget is isolated per device and merchant',async()=>{
      let p=await m.DeviceClaim.findOne({deviceId:id});
      let wrong=(await shown()).code==='000000'?'000001':'000000';
      for(let i=0;i<4;i++)await reject(finish(p,wrong),'invalid_claim_code');
      at=new Date(+at+CLAIM_TTL_MS);await m.ManagedDevice.updateOne({deviceId:id},{$set:{lastSeenAt:at}});
      await reject(finish(p,wrong),'claim_expired');assert.equal(await shown(),undefined);
      p=await start('4');wrong=(await shown()).code==='000000'?'000001':'000000';
      await reject(finish(p,wrong),'invalid_claim_code');
      await reject(finish(p,'123456'),'claim_locked');await reject(start('5'),'claim_locked');
      assert.equal(await shown(),undefined);
      assert.equal((await start('5','B')).status,'PENDING');
      at=new Date(+at+600_001);await m.ManagedDevice.updateOne({deviceId:id},{$set:{lastSeenAt:at}});
    });
    await t.test('expired proof replay, changed scope and credential revocation cannot assign',async()=>{
      const p=await start('6'), code=(await shown()).code;
      await m.Merchant.updateOne({merchantId:'A'},{$set:{displayName:'Changed name'}});
      await reject(finish(p,code),'claim_expired');assert.equal(await shown(),undefined);
      await m.Merchant.updateOne({merchantId:'A'},{$set:{displayName:'Merchant A'}});
      await credentials.revoke(id,auth[3].version);
      await reject(finish(p,code),'device_unavailable');
      await m.DeviceCredential.updateOne({deviceId:id},{$set:{credentialStatus:'ACTIVE'}});
      at=new Date(+at+CLAIM_TTL_MS);await m.ManagedDevice.updateOne({deviceId:id},{$set:{lastSeenAt:at}});
      await reject(finish(p,code),'claim_expired');
    });
    await t.test('HTTP session, CSRF, strict scope, concurrent confirmation, lost response retry and no product binding',async()=>{
      const password='test-only-claim-login-password';
      await MerchantAccount.updateOne({accountId:'A'},{$set:{passwordHash:await hashPassword(password)}});
      store=MongoStore.create({mongoUrl:uri,collectionName:'test_claim_sessions'});
      await store.collectionP;
      const origin='http://127.0.0.1:5173', app=express();app.use(express.json());
      app.use('/api',createMerchantPortal({secret:'test-only-session-secret-'+ 'x'.repeat(32),origin,production:false,store,claims}));
      server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
      const base='http://127.0.0.1:'+server.address().port;
      let cookie='',csrf='';
      async function call(path,body,headers={}) {
        const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:origin,'x-csrf-token':csrf}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
        if(r.headers.getSetCookie().length)cookie=r.headers.getSetCookie()[0].split(';')[0];
        const data=await r.json();if(data.csrfToken)csrf=data.csrfToken;return{status:r.status,data};
      }
      assert.equal((await call('merchant/device-claims',{})).status,401);
      await call('merchant-auth/csrf');assert.equal((await call('merchant-auth/login',{email:'A@example.invalid',password})).status,200);
      const input={deviceId:id,locationId:'LA',setupCode:setup(),requestKey:'7'.repeat(32)};
      assert.equal((await call('merchant/device-claims',input,{'x-csrf-token':''})).status,403);
      assert.equal((await call('merchant/device-claims',{...input,merchantId:'B'})).status,400);
      assert.equal((await call('merchant/device-claims',{...input,locationId:'LB'})).status,403);
      const p=(await call('merchant/device-claims',input)).data, code=(await shown()).code;
      const rollback=createDeviceClaimService({now,pepper,transaction:work=>bindingTransaction(async session=>{await work(session);throw new Error('test-only-rollback');})});
      await assert.rejects(rollback.confirm('A','A',p.claimId,{code}),/test-only-rollback/);
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:id}),0);
      assert.equal((await m.ManagedDevice.findOne({deviceId:id})).status,'PROVISIONED');
      assert.equal((await m.DeviceClaim.findOne({deviceId:id})).status,'PENDING');
      const path='merchant/device-claims/'+p.claimId+'/confirm';
      assert.equal((await call(path,{code},{Origin:'https://foreign.invalid'})).status,403);
      const confirmations=await Promise.all([call(path,{code}),call(path,{code})]);
      assert(confirmations.every(r=>r.status===200&&r.data.status==='CONFIRMED'));
      assert.equal((await call(path,{code})).status,200);
      assert.equal((await call('merchant/device-claims',input)).data.claimId,p.claimId);
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:id}),1);
      const assignment=await m.DeviceMerchantAssignment.findOne({deviceId:id});
      assert.equal(assignment.merchantId,'A');assert.equal(assignment.locationId,'LA');
      const device=await m.ManagedDevice.findOne({deviceId:id});assert.equal(device.status,'ACTIVE');assert.equal(device.hardwareUid,'test-mac-3');
      assert.equal(await m.DisplayAssignment.countDocuments({deviceId:id}),0);assert.equal(await m.BindingPreview.countDocuments({deviceId:id}),0);
      assert.deepEqual(await devices.config(auth[3],'0.3.12'),{ok:true,deviceId:id,assigned:false});
      assert.equal((await call('merchant/devices')).data.items.length,3);
      await reject(start('8','B'),'device_unavailable');
      // Credential values and permanent identity survive; no active product/offer writes.
      const verifier=await m.DeviceCredential.findOne({deviceId:id}).select('+verifier');
      assert.equal(verifier.credentialVersion,auth[3].version);assert.equal(verifier.credentialStatus,'ACTIVE');
      assert.equal(await m.MerchantProduct.countDocuments(),0);assert.equal(await m.Offer.countDocuments(),0);
      assert.ok(await snapshot()===before,'Device 1/2 identity, credentials and assignments remain unchanged');
    });
    await t.test('historical ownership is never reclaimed; rotation and confirmation share the device lock',async()=>{
      for(const n of [4,5]){
        const deviceId='QR2B-00000'+n;
        await m.ManagedDevice.create({deviceId,displayName:deviceId,hardwareVariant:'ESP32_ILI9341_CS5',status:'PROVISIONED',firmwareVersion:'0.3.12',lastSeenAt:at});
        const original=await credentials.rotate(deviceId);
        if(n===4){
          await m.DeviceMerchantAssignment.create({deviceId,merchantId:'B',locationId:'LB',status:'ENDED',usageType:'PILOT',validFrom:at,validUntil:at});
          await reject(claims.start('A','A',{deviceId,locationId:'LA',setupCode:setup(),requestKey:'9'.repeat(32)}),'device_unavailable');
          continue;
        }
        const p=await claims.start('A','A',{deviceId,locationId:'LA',setupCode:setup(deviceId,original.version),requestKey:'b'.repeat(32)});
        const code=(await devices.config(original,'0.3.12')).claimPreview.code;
        const [rotation,confirmation]=await Promise.allSettled([credentials.rotate(deviceId),claims.confirm('A','A',p.claimId,{code})]);
        assert.equal(rotation.status,'fulfilled');assert.equal(rotation.value.version,2);
        if(confirmation.status==='rejected'){
          assert.equal(confirmation.reason.code,'claim_expired');
          assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId}),0);
          assert.equal((await devices.config(rotation.value,'0.3.12')).claimPreview,undefined);
        }else assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId}),1);
        await reject(devices.config(original,'0.3.12'),'device_unauthorized');
      }
    });
    await t.test('multiple attack cycles: unknown physical setup cannot mutate state; B cannot lock A',async()=>{
      const deviceId='QR2B-000006';
      await m.ManagedDevice.create({deviceId,displayName:'Attack test',hardwareVariant:'ESP32_ILI9341_CS5',status:'PROVISIONED',firmwareVersion:'0.3.12',lastSeenAt:at});
      const own=await credentials.rotate(deviceId);
      const request=async merchant=>({deviceId,locationId:'L'+merchant,requestKey:randomBytes(16).toString('hex'),setupCode:(await devices.config(own,'0.3.12')).claimSetup.code});
      for(let cycle=0;cycle<3;cycle++){
        at=new Date(+at+601000);await m.ManagedDevice.updateOne({deviceId},{$set:{lastSeenAt:at}});
        const oldCount=await m.DeviceClaim.countDocuments();
        for(let attempt=0;attempt<8;attempt++) await reject(claims.start('B','B',{deviceId,locationId:'LB',requestKey:randomBytes(16).toString('hex'),setupCode:'0'.repeat(32)}),'invalid_setup_code');
        assert.equal(await m.DeviceClaim.countDocuments(),oldCount);
        // Even an attacker who once observed a real setup code cannot lock another merchant's budget.
        const inputB=await request('B'), b=await claims.start('B','B',inputB);
        const shownB=(await devices.config(own,'0.3.12')).claimPreview.code;
        const wrong=shownB==='000000'?'000001':'000000';
        await Promise.all(Array.from({length:5},()=>reject(claims.confirm('B','B',b.claimId,{code:wrong}),'invalid_claim_code')));
        const blocked=await devices.config(own,'0.3.12');assert(blocked.claimSetup);assert(!blocked.claimPreview);
        await reject(createDeviceClaimService({now,pepper}).start('B','B',await request('B')),'claim_locked');
        const inputA=await request('A'), a=await claims.start('A','A',inputA);assert.equal(a.status,'PENDING');
        await reject(claims.confirm('B','B',b.claimId,{code:shownB}),'claim_not_found');
        assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId}),0);
        // New setup epoch invalidates a captured token; same active request remains idempotent.
        assert.equal((await claims.start('A','A',inputA)).claimId,a.claimId);
        at=new Date(+at+121000);await m.ManagedDevice.updateOne({deviceId},{$set:{lastSeenAt:at}});
        await reject(claims.start('A','A',{...inputA,requestKey:randomBytes(16).toString('hex')}),'invalid_setup_code');
      }
      const p=await claims.start('A','A',await request('A'));
      const proof=(await devices.config(own,'0.3.12')).claimPreview;
      await m.DeviceClaim.updateOne({claimId:p.claimId},{$set:{proofVersion:1}});
      await reject(claims.confirm('A','A',p.claimId,{code:proof.code}),'claim_expired');
      assert.equal((await devices.config(own,'0.3.12')).claimPreview,undefined);
      await m.DeviceClaim.updateOne({claimId:p.claimId},{$set:{proofVersion:2}});
      await claims.confirm('A','A',p.claimId,{code:proof.code});
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId,merchantId:'A',status:'ACTIVE'}),1);
    });
    await t.test('display names are exact, supported and bounded; unsupported names create no challenge',async()=>{
      for(const text of ['ecily.com','A & B / "Shop"', 'ÄÖÜ äöü', 'x'.repeat(64)]) assert(claimNameSupported(text));
      for(const text of ['', ' ', ' A', 'A ', 'x'.repeat(65),'é','ß','ẞ','商店','🙂','a\u0308','a\nB','a\u202eB','a\u200bB', 'ä'.repeat(33)]) assert(!claimNameSupported(text));
      await m.Merchant.updateOne({merchantId:'A'},{$set:{displayName:'Café'}});
      const count=await m.DeviceClaim.countDocuments();
      await reject(start('c'),'claim_name_unsupported');assert.equal(await m.DeviceClaim.countDocuments(),count);
      await m.Merchant.updateOne({merchantId:'A'},{$set:{displayName:'Merchant A'}});
    });
    await t.test('index verification is read-only/idempotent and missing required indexes close the service',async()=>{
      const collections=await mongoose.connection.db.listCollections().toArray();
      assert((await verifyClaimIndexes()).ok);assert((await verifyClaimIndexes()).ok);
      const previousUrl=process.env.MONGO_URL,previousGate=process.env.QR2BUY_CLAIM_INDEX_CHECK;
      try { process.env.MONGO_URL=uri;process.env.QR2BUY_CLAIM_INDEX_CHECK='true';assert((await verifyIndexCommand()).ok); }
      finally { for(const [key,value] of [['MONGO_URL',previousUrl],['QR2BUY_CLAIM_INDEX_CHECK',previousGate]]) {if(value===undefined)delete process.env[key];else process.env[key]=value;} }
      assert.equal((await mongoose.connection.db.listCollections().toArray()).length,collections.length);
      await m.DeviceClaimAttempt.collection.dropIndex('deviceId_1_merchantId_1');
      const result=await verifyClaimIndexes();assert.equal(result.ok,false);assert(result.missing.includes('device_claim_attempts:deviceId+merchantId'));
      await reject(start('d'),'claim_indexes_unavailable');
      const confirmed=await m.DeviceClaim.findOne({deviceId:id});
      await reject(claims.confirm('A','A',confirmed.claimId,{code:'000000'}),'claim_indexes_unavailable');
      await m.DeviceClaimAttempt.createIndexes();assert((await verifyClaimIndexes()).ok);
      const fake={collection:()=>({listIndexes:()=>({toArray:async()=>[{key:{deviceId:1},unique:true,sparse:true}]})})};
      assert.equal((await verifyClaimIndexes(fake)).ok,false);
    });
  } finally {
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    if(store)await store.close();
    if(mongoose.connection.readyState)await mongoose.connection.dropDatabase();
    await mongoose.disconnect();await repl.stop();
  }
});
