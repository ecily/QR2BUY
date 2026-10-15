import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { DeviceApiError, verifyCredential, credentialVerifier } from '../src/merchant/deviceCredentials.js';
import { availabilityState, notifyStateAllowed } from '../src/merchant/availabilityPolicy.js';
import { bindingCode } from '../src/merchant/binding.js';

test('exact reproducible rollback tree preserves 0.3.11/0.3.12 device contracts without claim routes', async () => {
  const root = new URL('../../', import.meta.url);
  const metadata = JSON.parse(readFileSync(new URL('../rollback/p01-firmware-0312.json', import.meta.url)));
  const patch = Buffer.from(readFileSync(new URL('../rollback/p01-firmware-0312.patch', import.meta.url),'utf8').replaceAll('\r\n','\n'));
  assert.equal(createHash('sha256').update(patch).digest('hex'),metadata.patchSha256);
  // Reconstruct the exact standalone rollback even when its separate branch was not fetched.
  const folder = mkdtempSync(new URL('../../firmware/qr_display_fw/.pio/p3-validation/rollback-test-',import.meta.url));
  try {
    const env = {...process.env,GIT_INDEX_FILE:join(folder,'index')};
    const git = args => execFileSync('git',args,{cwd:root,env,encoding:'utf8'});
    git(['read-tree',metadata.base]);
    execFileSync('git',['apply','--cached','--unidiff-zero','--whitespace=error','-'],{cwd:root,env,input:patch});
    const tree=git(['write-tree']).trim();assert.equal(tree,metadata.tree);
    assert.deepEqual(git(['diff','--name-only',metadata.base,tree]).trim().split('\n'),[
      'backend/src/index.js', 'backend/src/merchant/binding.js', 'backend/src/merchant/deviceService.js',
      'backend/src/routes/checkout.js', 'backend/test/deviceLogging.test.js', 'backend/test/merchantMongo.integration.test.js'
    ]);
    assert.deepEqual(Object.keys(metadata.filesSha256).sort(), git(['diff','--name-only',metadata.base,tree]).trim().split('\n').sort());
    for (const [path, expected] of Object.entries(metadata.filesSha256)) {
      assert.equal(createHash('sha256').update(git(['show',tree+':'+path])).digest('hex'), expected);
    }
    // Logging is byte-identical to the reviewed fix; no claim route or auth change enters rollback.
    for (const path of ['src/index.js', 'src/routes/checkout.js', 'test/deviceLogging.test.js']) {
      assert.equal(git(['show',tree+':backend/'+path]), readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n'));
    }
    for (const path of ['deviceCredentials.js', 'deviceRepository.js', 'models.js']) {
      assert.equal(git(['show',tree+':backend/src/merchant/'+path]),git(['show',metadata.base+':backend/src/merchant/'+path]));
    }
    const indexedMongoTest=git(['show',tree+':backend/test/merchantMongo.integration.test.js']);
    assert(indexedMongoTest.includes('existing claim Unique indexes and audit/budget documents survive legacy device operations'));
    assert(!git(['show',tree+':backend/src/routes/merchantPortal.js']).includes('/device-claims'));
    const binding=git(['show',tree+':backend/src/merchant/binding.js']);
    assert.equal(binding,readFileSync(new URL('../src/merchant/binding.js',import.meta.url),'utf8').replaceAll('\r\n','\n'));
    const source=git(['show',tree+':backend/src/merchant/deviceService.js']).replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'');
    const rollback=new Function('deps',`const {availabilityState,notifyStateAllowed,createHash,DeviceApiError,verifyCredential,bindingCode,notifyConfigured,createDeviceRepository,checkoutConfigured}=deps;${source};return createDeviceService;`)({availabilityState,notifyStateAllowed,createHash,DeviceApiError,verifyCredential,bindingCode,notifyConfigured:()=>false,checkoutConfigured:()=>false,createDeviceRepository:()=>{throw Error('no production database');}});
    const at=new Date(),secret='fa'.repeat(32),pepper='bc'.repeat(32),deviceId='QR2B-000001';
    for(const hardwareVariant of ['ESP32_ILI9341_CS5','ESP32_ILI9341_NOCS'])for(const firmwareVersion of ['0.3.11','0.3.12'])
    for(const state of ['READY','RESERVED','OUT_OF_STOCK','SOLD','PAUSED','CHECKOUT_STARTED','PAID'])for(const notify of [false,true]){
      const read={device:async()=>({deviceId,status:'ACTIVE',hardwareVariant,lastSeenAt:at,firmwareVersion}),credential:async()=>({deviceId,credentialStatus:'ACTIVE',credentialVersion:1,verifier:credentialVerifier(deviceId,1,secret,pepper)}),assignment:async()=>({_id:'a',merchantId:'M',locationId:'L',validFrom:new Date(0)}),display:async()=>({merchantId:'M',locationId:'L',productId:'P',offerId:'O',verifiedAt:at}),preview:async()=>null,merchant:async()=>({merchantId:'M',status:'ACTIVE'}),location:async()=>({merchantId:'M',locationId:'L',status:'ACTIVE'}),product:async()=>({productId:'P',merchantId:'M',name:'Product',status:'ACTIVE'}),reserved:async()=>state==='RESERVED'?2:0,
        offer:async()=>({offerId:'O',merchantId:'M',locationId:'L',productId:'P',active:state!=='PAUSED',publicOfferId:'a'.repeat(32),priceMinor:1990,currency:'EUR',stockQuantity:['OUT_OF_STOCK','SOLD'].includes(state)?0:2,depletedByPurchase:state==='SOLD',purchasable:true,reservable:true,commerceState:['PAID','CHECKOUT_STARTED'].includes(state)?state:null,commerceUntil:new Date(+at+30000)})};
      const options={repository:{snapshot:work=>work(read),heartbeat:async()=>{}},now:()=>at,pepper:()=>pepper,publicOrigin:()=> 'https://example.invalid',notifyEnabled:()=>notify};
      const auth={deviceId,secret,version:1};
      assert.equal((await rollback(options).config(auth,firmwareVersion)).display.status,state);
      assert.deepEqual(await rollback(options).config(auth,firmwareVersion),await createDeviceService(options).config(auth,firmwareVersion));
      await assert.rejects(rollback(options).config({...auth,secret:'0'.repeat(64)},firmwareVersion),e=>e.status===401);
      read.assignment=async()=>null;read.device=async()=>({deviceId,status:'PROVISIONED',lastSeenAt:at,firmwareVersion});
      assert.deepEqual(await rollback(options).config(auth,firmwareVersion),{ok:true,deviceId,assigned:false});
    }
  } finally {
    assert(folder.startsWith(fileURLToPath(new URL('../../firmware/qr_display_fw/.pio/p3-validation/',import.meta.url))));
    rmSync(folder,{recursive:true,force:true});
  }
});
