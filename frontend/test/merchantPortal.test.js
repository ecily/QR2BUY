import test from 'node:test';
import assert from 'node:assert/strict';
import { merchantRequest, minorFromInput, priceInput, safeReturn, merchantSummary } from '../src/merchantApi.js';
import { merchantText } from '../src/merchantText.js';

test('merchant DE/EN translations are complete and no fake commerce metrics',()=>{
  assert.deepEqual(Object.keys(merchantText.de),Object.keys(merchantText.en));
  for(const language of Object.values(merchantText))for(const value of Object.values(language))assert(value);
  assert.deepEqual(merchantSummary([{}],[{active:true},{active:false}],[{online:true,product:null},{online:false,product:{name:'Bag'}}]),{products:1,devices:2,online:1,unassigned:1,activeOffers:1});
});
test('merchant money inputs preserve integer minor units and reject precision loss',()=>{
  assert.equal(minorFromInput('129,01','EUR'),12901);assert.equal(minorFromInput('1.234','KWD'),1234);assert.equal(minorFromInput('129','JPY'),129);
  for(const value of ['1.001','1e3','-1','NaN','Infinity','1.2.3'])assert.throws(()=>minorFromInput(value,'EUR'));
  assert.equal(priceInput(1234,'KWD'),'1.234');assert.equal(priceInput(12900,'EUR'),'129.00');
});
test('merchant return targets cannot redirect to another origin or legacy admin',()=>{
  for(const value of ['//evil.invalid','https://evil.invalid','/admin','/merchant/login','/merchant/register','/binding/invalid'])assert.equal(safeReturn(value),'/merchant');
  assert.equal(safeReturn('/binding/QR2B-000001'),'/binding/QR2B-000001');
});
test('merchant API uses same-origin cookies and CSRF headers, never Basic credentials or URL secrets',async()=>{
  const original=globalThis.fetch;let request;
  try{
    globalThis.fetch=async(path,options)=>{request={path,options};return {ok:true,json:async()=>({ok:true})};};
    await merchantRequest('/api/merchant/products',{name:'Test'},'POST','test-only-csrf');
    assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.headers['x-csrf-token'],'test-only-csrf');assert.equal(request.options.headers.Authorization,undefined);assert(!request.path.includes('csrf'));
    globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error:'login_required'})});await assert.rejects(merchantRequest('/api/merchant/me'),e=>e.status===401);
  }finally{globalThis.fetch=original;}
});
