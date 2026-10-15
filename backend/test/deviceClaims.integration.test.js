import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import { randomBytes, createHmac } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as m from '../src/merchant/models.js';
import { MerchantAccount, hashPassword } from '../src/merchant/accounts.js';
import MongoStore from 'connect-mongo';
import { createMerchantPortal } from '../src/routes/merchantPortal.js';
import { bindingTransaction } from '../src/merchant/binding.js';
import { createDeviceClaimService, createClaimAuthorizationService, claimSetup, claimNameSupported } from '../src/merchant/deviceClaims.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { createCredentialService } from '../src/merchant/deviceCredentials.js';
import { verifyClaimIndexes } from '../src/merchant/claimIndexes.js';
import { createClaimAuthorizationRouter } from '../src/routes/claimAuthorizations.js';

const key = () => randomBytes(16).toString('hex');
test('authorized first assignment: isolated replica set, short proof and unchanged identities', { timeout: 180000 }, async t => {
  const repl = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, ip: '127.0.0.1' } });
  let server, store;
  const savedEnv = Object.fromEntries(['ADMIN_USER','ADMIN_PASS','PUBLIC_BASE_URL'].map(k => [k,process.env[k]]));
  try {
    await mongoose.connect(repl.getUri('qr2buy_claim_test_'+key()));
    await Promise.all([...Object.values(m).filter(x => x?.modelName), MerchantAccount].map(Model => Model.init()));
    for (const Model of [m.DeviceClaim,m.DeviceClaimAttempt,m.DeviceClaimAuthorization,m.DeviceClaimAudit]) {
      await Model.createCollection(); await Model.createIndexes();
    }
    let at = new Date(); const now = () => at, pepper = () => 'ef'.repeat(32);
    const claims = createDeviceClaimService({now,pepper}), grants = createClaimAuthorizationService({now});
    const devices = createDeviceService({now,pepper}), credentials = createCredentialService({now,pepper});
    const reject = (promise,code) => assert.rejects(promise,e => e.code === code);
    for (const id of ['A','B']) {
      await m.Merchant.create({merchantId:id,displayName:'Merchant '+id,contactEmail:id+'@example.invalid'});
      await m.Location.create({merchantId:id,locationId:'L'+id,name:'Location '+id});
      for (const accountId of [id,id+'2']) await MerchantAccount.create({merchantId:id,accountId,email:accountId+'@example.invalid',passwordHash:'synthetic-unused',role:accountId===id?'OWNER':'ADMIN'});
    }
    let sequence=100;
    async function fixture(version='0.3.13') {
      const deviceId='QR2B-'+String(sequence++).padStart(6,'0');
      await m.ManagedDevice.create({deviceId,displayName:'Synthetic device',hardwareUid:'test-'+deviceId,hardwareVariant:'ESP32_ILI9341_CS5',status:'PROVISIONED',firmwareVersion:version,lastSeenAt:at});
      const auth=await credentials.rotate(deviceId);
      return {deviceId,auth};
    }
    const issue = (f,merchantId='A',requestKey=key()) => grants.issue('synthetic-operator',{deviceId:f.deviceId,merchantId,requestKey});
    const config = f => devices.config(f.auth,'0.3.13');
    const input = async (f,merchant='A',requestKey=key()) => ({deviceId:f.deviceId,locationId:'L'+merchant,requestKey,setupCode:(await config(f)).claimSetup.code});
    const start = async (f,merchant='A') => claims.start(merchant,merchant,await input(f,merchant));
    const wrong = code => (code[0]==='0'?'1':'0')+code.slice(1);
    const protectedDevices=[];
    for (const deviceId of ['QR2B-000001','QR2B-000002']) {
      await m.ManagedDevice.create({deviceId,displayName:'Existing',hardwareUid:'test-'+deviceId,hardwareVariant:deviceId.endsWith('1')?'ESP32_ILI9341_CS5':'ESP32_ILI9341_NOCS',status:'ACTIVE',firmwareVersion:'0.3.11',lastSeenAt:at});
      await credentials.rotate(deviceId);
      await m.DeviceMerchantAssignment.create({deviceId,merchantId:'A',locationId:'LA',status:'ACTIVE',usageType:'PILOT',validFrom:at});
      protectedDevices.push(deviceId);
    }
    const snapshot = async () => JSON.stringify(await Promise.all([m.ManagedDevice,m.DeviceCredential,m.DeviceMerchantAssignment].map(Model=>Model.find({deviceId:{$in:protectedDevices}}).select('+verifier').sort({deviceId:1}).lean())));
    const before=await snapshot();
    await t.test('operator auth, CSRF, JSON, origin and query gates cannot be bypassed by merchant role',async()=>{
      process.env.ADMIN_USER='synthetic-admin'; process.env.ADMIN_PASS='synthetic-password';process.env.PUBLIC_BASE_URL='https://example.invalid';
      let calls=0;
      const app=express();app.use(express.json());app.use('/admin',createClaimAuthorizationRouter({issue:async actor=>{calls++;assert.equal(actor,'synthetic-admin');return {ok:true};},revoke:async()=>({ok:true})}));
      server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
      const url='http://127.0.0.1:'+server.address().port+'/admin';
      const good={authorization:'Basic '+Buffer.from('synthetic-admin:synthetic-password').toString('base64'),'content-type':'application/json','x-qr2buy-admin-action':'claim-authorization'};
      for(const [headers,status,path] of [[{},401,''],[{...good,authorization:'Bearer merchant-session'},401,''],[{...good,origin:'https://evil.invalid'},403,''],[{...good,'x-qr2buy-admin-action':''},400,''],[{...good,'content-type':'text/plain'},415,''],[good,400,'?token=synthetic']]) {
        assert.equal((await fetch(url+path,{method:'POST',headers,body:'{}'})).status,status);
      }
      assert.equal(calls,0);assert.equal((await fetch(url,{method:'POST',headers:good,body:'{}'})).status,200);assert.equal(calls,1);
      await new Promise(r=>server.close(r));server=null;
    });
    await t.test('no authorization, legacy proof and unsupported firmware fail closed',async()=>{
      const f=await fixture();assert.equal((await config(f)).claimSetup,undefined);
      await reject(claims.start('A','A',{deviceId:f.deviceId,locationId:'LA',setupCode:'00000000',requestKey:key()}),'claim_not_authorized');
      await assert.rejects(claims.start('A','A',{deviceId:f.deviceId,locationId:'LA',setupCode:'a'.repeat(32),requestKey:key()}),e=>e.name==='ZodError');
      for(const version of ['0.3.11','0.3.12']) await reject(issue(await fixture(version)),'device_update_required');
      for(const deviceId of protectedDevices) await reject(grants.issue('operator',{deviceId,merchantId:'A',requestKey:key()}),'device_unavailable');
      await reject(grants.issue('',{deviceId:f.deviceId,merchantId:'A',requestKey:key()}),'claim_forbidden');
    });
    await t.test('only one merchant, persistent five guesses and no foreign lockout across accounts',async()=>{
      const f=await fixture();await issue(f);const body=await input(f);const invalid=wrong(body.setupCode);
      const grant=await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId}).lean();
      await reject(claims.start('A','A2',{...body,setupCode:invalid}),'claim_forbidden');
      for(let i=0;i<12;i++) await reject(claims.start('B','B',{...body,locationId:'LB',requestKey:key(),setupCode:invalid}),'claim_not_authorized');
      assert.equal((await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).attempts,0);
      for(let i=0;i<5;i++) {
        // A second OWNER-like account in the same merchant must share the exact grant budget.
        if(i===2) {await MerchantAccount.updateOne({accountId:'A'},{$set:{role:'ADMIN'}});await MerchantAccount.updateOne({accountId:'A2'},{$set:{role:'OWNER'}});}
        const actor=i<2?'A':'A2';
        await reject(createDeviceClaimService({now,pepper}).start('A',actor,{...body,requestKey:key(),setupCode:invalid}),'invalid_setup_code');
      }
      await MerchantAccount.updateOne({accountId:'A2'},{$set:{role:'ADMIN'}});await MerchantAccount.updateOne({accountId:'A'},{$set:{role:'OWNER'}});
      await reject(claims.start('A','A',body),'claim_locked');
      assert.equal((await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).attempts,5);
      assert.equal((await config(f)).claimSetup,undefined);
      await grants.revoke('operator',{deviceId:f.deviceId,authorizationId:grant.authorizationId});
      await reject(issue(f,'B'),'authorization_cooldown');
    });
    await t.test('parallel guesses commit at most five attempts; parallel issue/start has one winner',async()=>{
      const f=await fixture();const issued=await Promise.allSettled([issue(f),issue(f,'B')]);assert.equal(issued.filter(x=>x.status==='fulfilled').length,1);
      const grant=await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId});const merchant=grant.merchantId;const body=await input(f,merchant);
      await Promise.allSettled(Array.from({length:12},()=>claims.start(merchant,merchant,{...body,requestKey:key(),setupCode:wrong(body.setupCode)})));
      assert.equal((await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).attempts,5);
      const other=await fixture();await issue(other);const good=await input(other);
      const results=await Promise.allSettled([claims.start('A','A',good),claims.start('A','A',{...good,requestKey:key()})]);
      assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
      assert.equal(await m.DeviceClaim.countDocuments({deviceId:other.deviceId}),1);
    });
    await t.test('expiry, revocation, one-time grants, issuance replay and audit actor/time',async()=>{
      const f=await fixture();const requestKey=key();const issued=await issue(f,'A',requestKey);
      assert.deepEqual(await issue(f,'A',requestKey),issued);
      const body=await input(f);at=new Date(+at+120001);await m.ManagedDevice.updateMany({status:'PROVISIONED'},{$set:{lastSeenAt:at}});
      await reject(claims.start('A','A',body),'claim_not_authorized');
      assert.equal((await config(f)).claimSetup,undefined);
      at=new Date(+at+600001);await m.ManagedDevice.updateMany({status:'PROVISIONED'},{$set:{lastSeenAt:at}});
      const again=await issue(f);await reject(issue(f,'A',requestKey),'authorization_replay');
      const pending=await start(f);const shown=(await config(f)).claimPreview;
      await grants.revoke('second-operator',{deviceId:f.deviceId,authorizationId:again.authorizationId});
      await reject(claims.confirm('A','A',pending.claimId,{code:shown.code}),'claim_expired');
      assert.equal((await config(f)).claimPreview,undefined);
      const audit=await m.DeviceClaimAudit.find({deviceId:f.deviceId}).lean();assert(audit.some(e=>e.event==='REVOKED'&&e.actor==='second-operator'));assert(audit.every(e=>e.at instanceof Date&&!('code' in e)));
    });
    await t.test('success and lost HTTP result resume idempotently without extending expiry or binding a product',async()=>{
      const f=await fixture();await issue(f);const original=await input(f);const p=await claims.start('A','A',original);
      for(const legacy of ['0.3.11','0.3.12'])assert.deepEqual(await devices.config(f.auth,legacy),{ok:true,deviceId:f.deviceId,assigned:false});
      await config(f); // Restore the synthetic caller's actual firmware heartbeat after legacy probes.
      assert.deepEqual(await claims.start('A','A',original),p);
      const shown=(await config(f)).claimPreview;assert.match(shown.code,/^[0-9]{6}$/);assert.equal(shown.protocol,3);
      assert(!JSON.stringify(p).includes('code'));assert.equal(p.status,'PENDING');
      await reject(claims.confirm('B','B',p.claimId,{code:shown.code}),'claim_not_found');
      const results=await Promise.all([claims.confirm('A','A',p.claimId,{code:shown.code}),claims.confirm('A','A',p.claimId,{code:shown.code})]);
      assert(results.every(r=>r.status==='CONFIRMED'));assert.equal((await claims.start('A','A',original)).status,'CONFIRMED');
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:f.deviceId}),1);assert.equal(await m.DisplayAssignment.countDocuments({deviceId:f.deviceId}),0);
      assert.equal((await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).status,'CONSUMED');
      assert.equal((await m.DeviceCredential.findOne({deviceId:f.deviceId})).credentialVersion,f.auth.version);
      await reject(grants.revoke('operator',{deviceId:f.deviceId,authorizationId:(await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).authorizationId}),'authorization_finished');
    });
    await t.test('six-digit confirmation retains persistent five-attempt budget and scope/name/credential guards',async()=>{
      const f=await fixture();await issue(f);const body=await input(f);
      await reject(claims.start('A','A',{...body,locationId:'LB'}),'claim_forbidden');
      await m.Merchant.updateOne({merchantId:'A'},{$set:{displayName:'Unsupported \u00df'}});await reject(claims.start('A','A',body),'claim_name_unsupported');
      await m.Merchant.updateOne({merchantId:'A'},{$set:{displayName:'Merchant A'}});
      const p=await claims.start('A','A',body);const shown=(await config(f)).claimPreview;
      for(let i=0;i<5;i++) await reject(claims.confirm('A','A',p.claimId,{code:wrong(shown.code)}),'invalid_claim_code');
      await reject(claims.confirm('A','A',p.claimId,{code:shown.code}),'claim_locked');
      assert.equal((await config(f)).claimPreview,undefined);
      const rotated=await fixture();await issue(rotated);const c=await start(rotated);const code=(await config(rotated)).claimPreview.code;
      await credentials.rotate(rotated.deviceId);await reject(claims.confirm('A','A',c.claimId,{code}),'claim_expired');
      for(const name of ['Merchant A','Mu\u00e4'])assert(claimNameSupported(name));for(const name of ['\u00df','\n','x'.repeat(65)])assert(!claimNameSupported(name));
    });
    await t.test('authenticated portal enforces session, CSRF and immutable merchant scope; rollback is atomic',async()=>{
      const password='synthetic-login-password';
      await MerchantAccount.updateOne({accountId:'A'},{$set:{passwordHash:await hashPassword(password)}});
      store=MongoStore.create({mongoUrl:mongoose.connection.client.s.url,collectionName:'synthetic_claim_sessions'});
      await store.collectionP;
      const origin='http://127.0.0.1:5173',app=express();app.use(express.json());
      app.use('/api',createMerchantPortal({secret:'synthetic-session-secret-'+'x'.repeat(32),origin,production:false,store,claims}));
      server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
      const base='http://127.0.0.1:'+server.address().port;let cookie='',csrf='';
      async function call(path,body,headers={}) {
        const response=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:origin,'x-csrf-token':csrf}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
        if(response.headers.getSetCookie().length)cookie=response.headers.getSetCookie()[0].split(';')[0];
        const data=await response.json();if(data.csrfToken)csrf=data.csrfToken;return{status:response.status,data};
      }
      assert.equal((await call('merchant/device-claims',{})).status,401);
      await call('merchant-auth/csrf');assert.equal((await call('merchant-auth/login',{email:'A@example.invalid',password})).status,200);
      const f=await fixture();await issue(f);const body=await input(f);
      assert.equal((await call('merchant/device-claims',body,{'x-csrf-token':''})).status,403);
      assert.equal((await call('merchant/device-claims',body,{Origin:'https://foreign.invalid'})).status,403);
      assert.equal((await call('merchant/device-claims',{...body,merchantId:'B'})).status,400);
      assert.equal((await call('merchant/device-claims',{...body,locationId:'LB'})).status,403);
      const pending=(await call('merchant/device-claims',body)).data;
      assert.equal(pending.status,'PENDING');assert(!JSON.stringify(pending).includes('code'));
      const code=(await config(f)).claimPreview.code;
      const rollback=createDeviceClaimService({now,pepper,transaction:work=>bindingTransaction(async session=>{await work(session);throw Error('synthetic rollback');})});
      await assert.rejects(rollback.confirm('A','A',pending.claimId,{code}),/synthetic rollback/);
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:f.deviceId}),0);
      assert.equal((await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).status,'CLAIMED');
      assert.equal(await m.DeviceClaimAudit.countDocuments({deviceId:f.deviceId,event:'CONSUMED'}),0);
      const path='merchant/device-claims/'+pending.claimId+'/confirm';
      assert.equal((await call(path,{code})).data.status,'CONFIRMED');
      assert.equal((await call('merchant/device-claims',body)).data.status,'CONFIRMED');
      await new Promise(r=>server.close(r));server=null;await store.close();store=null;
    });
    await t.test('unbiased rejection-sampled derivation preserves leading zeros and grant scope',async()=>{
      const grant={deviceId:'QR2B-000999',credentialVersion:1,merchantId:'A',status:'AUTHORIZED',attempts:0,expiresAt:new Date(+at+120000)};
      let leading=false,rejected=false;
      for(let i=0;i<200;i++) {
        grant.authorizationId=String(i);const result=claimSetup(grant.deviceId,1,at,pepper(),grant);
        assert.match(result.code,/^[0-9]{8}$/);if(result.code[0]==='0')leading=true;assert.equal(result.protocol,3);
        const digest=createHmac('sha256',Buffer.from(pepper(),'hex')).update(JSON.stringify(['qr2buy-claim-setup-v3',grant.deviceId,1,grant.authorizationId,'A',0])).digest();
        if(digest.readUInt32BE(0)>=4_200_000_000) {
          rejected=true;let offset=4;while(offset<32&&digest.readUInt32BE(offset)>=4_200_000_000)offset+=4;
          if(offset<32)assert.equal(result.code,String(digest.readUInt32BE(offset)%100_000_000).padStart(8,'0'));
        }
      }
      assert(leading);assert(rejected);assert.equal(claimSetup('QR2B-999999',1,at,pepper(),grant),null);
      await assert.rejects(claims.start('A','A',{deviceId:'../bad',locationId:'LA',setupCode:'00000000',requestKey:key()}),e=>e.name==='ZodError');
    });
    await t.test('index gate is read-only and fail-closed; Device 1/2 remain byte-identical',async()=>{
      assert.equal((await verifyClaimIndexes()).ok,true);
      const f=await fixture();const blocked=createClaimAuthorizationService({now,checkIndexes:async()=>({ok:false})});
      await reject(blocked.issue('operator',{deviceId:f.deviceId,merchantId:'A',requestKey:key()}),'claim_indexes_unavailable');
      assert.equal(await snapshot(),before);
    });
    await t.test('authorization plus audit roll back together; missing authorization index closes claims',async()=>{
      const f=await fixture();
      const rollback=createClaimAuthorizationService({now,transaction:work=>bindingTransaction(async session=>{await work(session);throw Error('synthetic rollback');})});
      await assert.rejects(rollback.issue('operator',{deviceId:f.deviceId,merchantId:'A',requestKey:key()}),/synthetic rollback/);
      assert.equal(await m.DeviceClaimAuthorization.countDocuments({deviceId:f.deviceId}),0);
      assert.equal(await m.DeviceClaimAudit.countDocuments({deviceId:f.deviceId}),0);
      await m.DeviceClaimAuthorization.collection.dropIndex('deviceId_1');
      assert((await verifyClaimIndexes()).missing.includes('device_claim_authorizations:deviceId'));
      await reject(issue(f),'claim_indexes_unavailable');
      await m.DeviceClaimAuthorization.createIndexes();
      assert.equal((await verifyClaimIndexes()).ok,true);
    });
    await t.test('lost committed issue response resumes exactly once; revoke/confirm serialize',async()=>{
      const f=await fixture(), requestKey=key();let loseResponse=true;
      const uncertain=createClaimAuthorizationService({now,transaction:async work=>{
        const value=await bindingTransaction(work);
        if(loseResponse){loseResponse=false;throw Error('synthetic lost response');}return value;
      }});
      const body={deviceId:f.deviceId,merchantId:'A',requestKey};
      await assert.rejects(uncertain.issue('operator',body),/synthetic lost response/);
      const resumed=await uncertain.issue('operator',body);
      assert.equal(resumed.authorizationId,requestKey);
      assert.equal(await m.DeviceClaimAudit.countDocuments({deviceId:f.deviceId,event:'AUTHORIZED'}),1);
      const pending=await start(f),code=(await config(f)).claimPreview.code;
      await Promise.allSettled([claims.confirm('A','A',pending.claimId,{code}),grants.revoke('operator',{deviceId:f.deviceId,authorizationId:requestKey})]);
      const grant=await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId});
      assert(['CONSUMED','REVOKED'].includes(grant.status));
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:f.deviceId}),grant.status==='CONSUMED'?1:0);
    });
    async function deadlineFixture() {
      const f=await fixture();await issue(f);const body=await input(f);
      const pending=await claims.start('A','A',body),code=(await config(f)).claimPreview.code;
      const grant=await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId}).lean();
      return {...f,body,pending,code,expiresAt:grant.expiresAt};
    }
    async function untouched(f) {
      assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:f.deviceId}),0);
      assert.equal((await m.ManagedDevice.findOne({deviceId:f.deviceId})).status,'PROVISIONED');
      assert.equal((await m.DeviceClaim.findOne({deviceId:f.deviceId})).status,'PENDING');
      assert.equal((await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).status,'CLAIMED');
      assert.equal(await m.DeviceClaimAudit.countDocuments({deviceId:f.deviceId,event:'CONSUMED'}),0);
    }
    for(const offset of [-1,0,1]) await t.test(`confirmation deadline boundary ${offset}ms`,async()=>{
      const saved=at,f=await deadlineFixture();
      try {
        at=new Date(+f.expiresAt+offset);
        if(offset<0) assert.equal((await claims.confirm('A','A',f.pending.claimId,{code:f.code})).status,'CONFIRMED');
        else {await reject(claims.confirm('A','A',f.pending.claimId,{code:f.code}),'claim_expired');await untouched(f);}
      } finally {at=saved;}
    });
    for(const point of ['lock','assignment','audit','consume-response']) await t.test(`expiry during asynchronous ${point} rolls back all effects`,async()=>{
      const saved=at,f=await deadlineFixture();at=new Date(+f.expiresAt-1);
      const Model=point==='lock'?m.ManagedDevice:point==='assignment'?m.DeviceMerchantAssignment:point==='audit'?m.DeviceClaimAudit:m.DeviceClaimAuthorization;
      const method=point==='assignment'||point==='audit'?'create':'updateOne',original=Model[method];let crossed=false;
      Model[method]=async function(...args) {
        const value=await original.apply(this,args);
        const hit=point==='lock'?args[0].deviceId===f.deviceId&&args[1].$inc?.bindingRevision
          :point==='assignment'?args[0][0]?.deviceId===f.deviceId
          :point==='audit'?args[0][0]?.deviceId===f.deviceId&&args[0][0]?.event==='CONSUMED'
          :args[0].deviceId===f.deviceId&&args[1].$set?.status==='CONSUMED';
        if(hit){crossed=true;at=new Date(+f.expiresAt+1);}
        return value;
      };
      try {await reject(claims.confirm('A','A',f.pending.claimId,{code:f.code}),'claim_expired');assert(crossed);await untouched(f);}
      finally {Model[method]=original;at=saved;}
    });
    await t.test('Mongo server deadline rejects consumption even if the application clock is behind',async()=>{
      const saved=at,f=await deadlineFixture();
      try {
        const expiry=new Date(1000);at=new Date(999);
        await m.DeviceClaimAuthorization.updateOne({deviceId:f.deviceId},{$set:{expiresAt:expiry}});
        await m.DeviceClaim.updateOne({deviceId:f.deviceId},{$set:{expiresAt:expiry}});
        await m.ManagedDevice.updateOne({deviceId:f.deviceId},{$set:{lastSeenAt:new Date(0)}});
        await reject(claims.confirm('A','A',f.pending.claimId,{code:f.code}),'claim_expired');await untouched(f);
      } finally {at=saved;}
    });
    for(const offset of [-1,0]) await t.test(`parallel confirmations at deadline ${offset}ms`,async()=>{
      const saved=at,f=await deadlineFixture();
      try {
        at=new Date(+f.expiresAt+offset);
        const results=await Promise.allSettled(Array.from({length:4},()=>claims.confirm('A','A',f.pending.claimId,{code:f.code})));
        if(offset<0){assert(results.every(r=>r.status==='fulfilled'&&r.value.status==='CONFIRMED'));assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:f.deviceId}),1);}
        else {assert(results.every(r=>r.status==='rejected'&&r.reason.code==='claim_expired'));await untouched(f);}
      } finally {at=saved;}
    });
    await t.test('lost response after timely commit resumes after expiry without a second consumption',async()=>{
      const saved=at,f=await deadlineFixture();at=new Date(+f.expiresAt-1);
      const uncertain=createDeviceClaimService({now,pepper,transaction:async work=>{
        await bindingTransaction(work);at=new Date(+f.expiresAt+1000);throw Error('synthetic lost confirmation response');
      }});
      try {
        await assert.rejects(uncertain.confirm('A','A',f.pending.claimId,{code:f.code}),/synthetic lost confirmation response/);
        assert.equal((await claims.confirm('A','A',f.pending.claimId,{code:f.code})).status,'CONFIRMED');
        assert.equal((await claims.start('A','A',f.body)).status,'CONFIRMED');
        assert.equal(await m.DeviceMerchantAssignment.countDocuments({deviceId:f.deviceId}),1);
        assert.equal(await m.DeviceClaimAudit.countDocuments({deviceId:f.deviceId,event:'CONSUMED'}),1);
      } finally {at=saved;}
    });
    await t.test('a transient transaction retry rechecks the deadline and cannot retain staged success',async()=>{
      const saved=at,f=await deadlineFixture();at=new Date(+f.expiresAt-1);let attempts=0;
      const retrying=createDeviceClaimService({now,pepper,transaction:work=>bindingTransaction(async session=>{
        attempts++;
        const value=await work(session);
        if(attempts===1) {
          at=new Date(+f.expiresAt);
          const error=new mongoose.mongo.MongoServerError({message:'synthetic transaction retry',code:112});
          error.addErrorLabel('TransientTransactionError');throw error;
        }
        return value;
      })});
      try {await reject(retrying.confirm('A','A',f.pending.claimId,{code:f.code}),'claim_expired');assert.equal(attempts,2);await untouched(f);}
      finally {at=saved;}
    });
    for(const event of ['AUTHORIZED','CLAIMED','SETUP_REJECTED']) await t.test(`expiry during ${event} audit cannot publish an expired grant or start`,async()=>{
      const saved=at,f=await fixture();let body,expiry;
      if(event!=='AUTHORIZED'){await issue(f);body=await input(f);expiry=(await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId})).expiresAt;}
      const original=m.DeviceClaimAudit.create;
      m.DeviceClaimAudit.create=async function(rows,...args){const value=await original.call(this,rows,...args);if(rows[0]?.deviceId===f.deviceId&&rows[0].event===event)at=new Date(event==='AUTHORIZED'?+at+120001:+expiry+1);return value;};
      try {
        const operation=event==='AUTHORIZED'?issue(f):claims.start('A','A',event==='SETUP_REJECTED'?{...body,setupCode:wrong(body.setupCode)}:body);
        await reject(operation,'claim_expired');
        assert.equal(await m.DeviceClaim.countDocuments({deviceId:f.deviceId}),0);
        assert.equal(await m.DeviceClaimAudit.countDocuments({deviceId:f.deviceId,event}),0);
        const grant=await m.DeviceClaimAuthorization.findOne({deviceId:f.deviceId});
        if(event==='AUTHORIZED')assert.equal(grant,null);else {assert.equal(grant.status,'AUTHORIZED');assert.equal(grant.attempts,0);}
      } finally {m.DeviceClaimAudit.create=original;at=saved;}
    });
    await t.test('late config response omits an expired TFT proof',async()=>{
      const saved=at,f=await deadlineFixture();
      // Use the real snapshot read, but let its response cross the local deadline.
      const {createDeviceRepository}=await import('../src/merchant/deviceRepository.js');
      const repository=createDeviceRepository(),snapshot=repository.snapshot;
      repository.snapshot=async work=>{const value=await snapshot(work);at=new Date(+f.expiresAt+1);return value;};
      try {assert.deepEqual(await createDeviceService({now,pepper,repository}).config(f.auth,'0.3.13'),{ok:true,deviceId:f.deviceId,assigned:false});}
      finally {at=saved;}
    });
    assert.equal(await snapshot(),before); // Include all deadline/race probes in Device-1/2 isolation.
  } finally {
    if(server)await new Promise(r=>server.close(r));
    if(store)await store.close();
    for(const [k,v]of Object.entries(savedEnv)) {if(v===undefined)delete process.env[k];else process.env[k]=v;}
    await mongoose.disconnect();await repl.stop();
  }
});
