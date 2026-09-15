import { test, expect } from '@playwright/test';
import { reservationText as copy } from '../src/reservation.js';
const origin='http://127.0.0.1:5178', fixture='http://127.0.0.1:3001';

for(const width of [320,375,390,430])for(const lang of ['de','en'])test(`real reservation journey ${lang} ${width}`,async({page,request},testInfo)=>{
 const t=copy[lang];await page.setViewportSize({width,height:850});
 const response=await request.post(fixture+'/__test__/offer',{data:{stockQuantity:2}}),o=await response.json();
 await page.goto('/o/'+o.publicOfferId+'?lang='+lang);
 await expect(page.getByRole('button',{name:t.reserve,exact:true})).toBeVisible();
 await page.getByRole('button',{name:t.reserve,exact:true}).click();
 await page.getByLabel(t.name,{exact:true}).fill('Browser Buyer');
 await page.getByRole('button',{name:t.submit,exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText(t.contactError);
 if(width===320)await page.getByLabel(t.phone,{exact:true}).fill('+43 123 456789');
 else await page.getByLabel(t.email,{exact:true}).fill('browser@example.test');
 await page.getByLabel(t.note,{exact:true}).fill('Pickup in store');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:t.submit,exact:true}).click();
 await expect(page).toHaveURL(/\/r\/[a-f0-9]{32}\?lang=/);
 await expect(page.getByRole('heading',{name:t.confirmed,exact:true})).toBeVisible();
 const statusUrl=page.url();await expect(page.locator('main')).toContainText('Merchant 0');
 await expect(page.locator('main')).not.toContainText('Browser Buyer');
 await expect(page.locator('main')).not.toContainText('browser@example.test');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===320)await page.screenshot({path:testInfo.outputPath('reservation-'+lang+'.png'),fullPage:true});
 await page.goto('/merchant/reservations?lang='+lang);
 await page.locator('input[type=email]').fill('merchant0@example.test');
 await page.locator('input[type=password]').fill('Reservation-test-only-123!');
 await page.locator('form button[type=submit]').click();
 await expect(page).toHaveURL('/merchant/reservations?lang='+lang);
 const card=page.locator('.reservation-ui article').filter({has:page.getByRole('heading',{name:'Reservation product '+o.productId.slice(1),exact:true})});
 await expect(card).toContainText('Browser Buyer');await card.getByRole('button',{name:t.details,exact:true}).click();
 const details=page.getByRole('article',{name:t.details});await expect(details).toContainText('Pickup in store');
 const cancel=width===320||width===390;
 await details.getByRole('button',{name:cancel?t.cancel:t.collect,exact:true}).click();
 await details.getByRole('button',{name:cancel?t.confirmCancel:t.confirmCollect,exact:true}).click();
 await expect(details.locator('.reservation-status')).toHaveText(cancel?t.CANCELLED:t.COLLECTED);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto(statusUrl);await expect(page.getByRole('heading',{name:cancel?t.CANCELLED:t.COLLECTED,exact:true})).toBeVisible();
 const availability=await (await request.get(origin+'/api/public/merchant-offers/'+o.publicOfferId)).json();
 expect(availability.offer.stockQuantity).toBe(cancel?2:1);
});

test('real last-unit race, expiry and disabled reservation states',async({browser,request})=>{
 const o=await (await request.post(fixture+'/__test__/offer',{data:{stockQuantity:1}})).json();
 const context=await browser.newContext(),first=await context.newPage(),second=await context.newPage();
 try{
 for(const page of [first,second]){
  await page.goto(origin+'/o/'+o.publicOfferId+'?lang=en');await page.getByRole('button',{name:'Reserve',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Race buyer');await page.getByLabel('Email',{exact:true}).fill('race@example.test');
 }
 const responses=await Promise.all([first,second].map(async page=>{const r=page.waitForResponse(r=>r.url().includes('/api/reservations/offers/')&&r.request().method()==='POST');await page.getByRole('button',{name:'Reserve now',exact:true}).click();return r;}));
 expect(responses.map(r=>r.status()).sort()).toEqual([201,409]);
 const winner=responses[0].status()===201?first:second,loser=winner===first?second:first;
 await expect(winner).toHaveURL(/\/r\//);await expect(loser.getByRole('alert')).toContainText(copy.en.out_of_stock);
 await loser.goto(origin+'/o/'+o.publicOfferId+'?lang=en');await expect(loser.locator('.buyer-availability')).toHaveText(copy.en.held);
 await expect(loser.getByRole('button',{name:'Reserve',exact:true})).toHaveCount(0);
 const status=winner.url();await request.post(fixture+'/__test__/advance');await winner.goto(status);
 await expect(winner.getByRole('heading',{name:copy.en.EXPIRED,exact:true})).toBeVisible();
 await loser.reload();await expect(loser.getByRole('button',{name:'Reserve',exact:true})).toBeVisible();
 for(const fields of [{reservable:false},{stockQuantity:0},{active:false}]){
  const disabled=await (await request.post(fixture+'/__test__/offer',{data:fields})).json();
  await loser.goto(origin+'/o/'+disabled.publicOfferId+'?lang=en');await expect(loser.locator('.buyer-product')).toBeVisible();
  await expect(loser.getByRole('button',{name:'Reserve',exact:true})).toHaveCount(0);
  await expect(loser.getByRole('button',{name:'Notify me',exact:true})).toHaveCount(fields.reservable===false?0:1);
 }
 }finally{await context.close();}
});
