import {test,expect} from '@playwright/test';
import {notifyText} from '../src/notify.js';
const fixture='http://127.0.0.1:3001';
for(const width of [320,375,390,430])for(const lang of ['de','en'])test(`notify lifecycle ${lang} ${width}`,async({page,request},testInfo)=>{
  const t=notifyText[lang];await page.setViewportSize({width,height:850});
  const o=await (await request.post(fixture+'/__test__/offer',{data:{stockQuantity:0}})).json();
  await page.goto('/o/'+o.publicOfferId+'?lang='+lang);
  await expect(page.getByRole('heading',{name:t.question})).toBeVisible();
  await page.getByLabel(t.email,{exact:true}).fill('notify-'+o.offerId+'@example.test');
  await page.getByLabel(t.name,{exact:true}).fill('Mobile Reader');
  await page.getByLabel(t.consent,{exact:true}).check();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===320)await page.screenshot({path:testInfo.outputPath('notify-'+lang+'.png'),fullPage:true});
  await page.getByRole('button',{name:t.submit,exact:true}).click();
  await expect(page.getByRole('status')).toHaveText(t.success);
  // Duplicate through real HTTP receives the same non-enumerating response and no extra confirmation mail.
  const duplicate=await request.post('/api/notify/offers/'+o.publicOfferId,{headers:{Origin:'http://127.0.0.1:5178'},data:{email:'notify-'+o.offerId+'@example.test',locale:lang,consent:true}});
  expect(duplicate.status()).toBe(200);
  await request.post(fixture+'/__test__/notify/'+o.offerId+'/available');
  const result=await (await request.get(fixture+'/__test__/notify/'+o.offerId+'?publicId='+o.publicOfferId)).json();
  expect(result.statuses).toEqual(['NOTIFIED']);expect(result.mails).toBe(2);
  await request.post(fixture+'/__test__/notify/'+o.offerId+'/available');
  expect((await (await request.get(fixture+'/__test__/notify/'+o.offerId+'?publicId='+o.publicOfferId)).json()).mails).toBe(2);
  await page.reload();await expect(page.locator('.buyer-price')).toBeVisible();await expect(page.getByRole('heading',{name:t.question})).toHaveCount(0);
});

test('DE/EN eligibility, errors, SOLD exclusion and unsubscribe confirmation',async({page})=>{
  for(const lang of ['de','en'])for(const state of ['OUT_OF_STOCK','PAUSED','RESERVED','READY','SOLD']) {
    const t=notifyText[lang],id='a'.repeat(32);
    await page.route('**/api/public/merchant-offers/**',r=>r.fulfill({json:{ok:true,publicOfferId:id,merchant:{displayName:'Merchant'},location:{name:'Store'},product:{name:'Book'},
      offer:{active:state!=='PAUSED',priceMinor:1990,currency:'EUR',stockQuantity:state==='READY'?2:0},availabilityState:state,notifyAvailable:state!=='READY'&&state!=='SOLD'}}));
    await page.goto('/o/'+id+'?lang='+lang);
    await expect(page.getByRole('heading',{name:'Book',exact:true})).toBeVisible();
    if(['READY','SOLD'].includes(state)){await expect(page.locator('.notify-form')).toHaveCount(0);continue;}
    await page.route('**/api/notify/offers/**',r=>r.fulfill({status:503,json:{ok:false,error:'notify_unavailable'}}));
    await page.getByLabel(t.email,{exact:true}).fill('reader@example.test');await page.getByLabel(t.consent,{exact:true}).check();
    await page.getByRole('button',{name:t.submit,exact:true}).click();await expect(page.getByRole('alert')).toHaveText(t.error);
  }
  let writes=0;await page.route('**/api/notify/unsubscribe',r=>{writes++;return r.fulfill({json:{ok:true}});});
  await page.goto('/notify/unsubscribe/'+'b'.repeat(64)+'?lang=en');expect(writes).toBe(0);
  await page.getByRole('button',{name:notifyText.en.cancel,exact:true}).click();await expect(page.getByRole('status')).toHaveText(notifyText.en.cancelled);expect(writes).toBe(1);
});
