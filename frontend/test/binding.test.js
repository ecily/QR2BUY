import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindingText, previewExpired, codeFromScan, bindingError, bindingRequest } from '../src/binding.js';
test('DE/EN binding copy covers identification, physical preview, confirmation and cancel',()=>{
  assert.deepEqual(Object.keys(bindingText.de),Object.keys(bindingText.en));
  for(const lang of ['de','en'])for(const key of ['question','instruction','code','yes','cancel','expired','active'])assert(bindingText[lang][key]);
  assert.equal(bindingText.de.question,'Ist das das Produkt vor dir?');
});
test('EAN and product-code scan validation never interprets secrets or arbitrary URLs',()=>{
  assert.equal(codeFromScan('1234567890123','EAN'),'1234567890123');assert.equal(codeFromScan('01234567','EAN'),'01234567');
  assert.equal(codeFromScan('a'.repeat(32),'PRODUCT_CODE'),'a'.repeat(32));
  for(const raw of ['https://evil.invalid','abc','secret=123','123'])assert.equal(codeFromScan(raw,'EAN'),null);
});
test('preview TTL boundary and errors guide safe retry',()=>{
  assert(previewExpired(null));assert(!previewExpired({expiresAt:2000},1999));assert(previewExpired({expiresAt:2000},2000));
  assert(previewExpired({expiresAt:'invalid'}));
  assert.equal(bindingError('incorrect_display_code',bindingText.de),bindingText.de.wrong);
  assert.equal(bindingError('preview_expired',bindingText.en),bindingText.en.changed);
});
test('binding requests keep auth and physical code out of URLs and handle failure',async()=>{
  const original=globalThis.fetch;const requests=[];
  try{globalThis.fetch=async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({status:'ACTIVE'})};};
    assert.equal((await bindingRequest('QR2B-000001','confirm','Basic test-only',{previewId:'a'.repeat(32),code:'123456'})).status,'ACTIVE');
    assert(!requests[0].url.includes('123456'));assert.equal(requests[0].options.headers.Authorization,'Basic test-only');assert.equal(JSON.parse(requests[0].options.body).code,'123456');
    globalThis.fetch=async()=>({ok:false,json:async()=>({error:'preview_expired'})});await assert.rejects(bindingRequest('QR2B-000001','','Basic test-only'),/preview_expired/);
  }finally{globalThis.fetch=original;}
});
test('mobile page exposes scoped binding only, no persistent auth, buyer actions or dashboard',()=>{
  const page=readFileSync(new URL('../src/pages/DeviceBindingPage.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/pages/DeviceBindingPage.css',import.meta.url),'utf8');
  for(const forbidden of ['localStorage','sessionStorage','/api/demo','/api/checkout','hardwareUid'])assert(!page.includes(forbidden));
  assert(page.includes('BarcodeDetector'));assert(page.includes("'confirm'"));assert(page.includes("'cancel'"));assert(page.includes('preview && !expired'));
  assert(css.includes('min-height: 48px'));assert(css.includes('min-width: 0'));assert(css.includes('width: 100%'));
});
