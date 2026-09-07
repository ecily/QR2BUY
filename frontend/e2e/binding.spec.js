import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const productCode='a'.repeat(32);
for(const width of [320,375,390,430])for(const language of ['de','en']) {
  test(`${language} ${width}px: login, identify, preview, cancel, confirm`,async({page})=>{
    await page.setViewportSize({width,height:850});
    let confirmed=false;
    await page.route('**/api/binding/**',async route=>{
      const req=route.request();const path=new URL(req.url()).pathname;
      let body={ok:true,deviceId:'QR2B-000001',available:true};
      if(path.includes('/operator/')) {
        expect(req.headers().authorization).toBeTruthy();
        if(path.endsWith('/preview')) { expect(req.postDataJSON()).toEqual({method:'PRODUCT_CODE',value:productCode});body={ok:true,previewId:'b'.repeat(32),expiresAt:new Date(Date.now()+120000).toISOString(),product:{name:'Handgemachte Ledertasche'},offer:{priceMinor:12900,currency:'EUR'},device:{displayName:'Schild 1'}}; }
        else if(path.endsWith('/cancel'))body={ok:true,status:'CANCELLED'};
        else if(path.endsWith('/confirm')) { expect(req.postDataJSON().code).toBe('123456');confirmed=true;body={ok:true,status:'ACTIVE'}; }
        else body={ok:true,device:{displayName:'Schild 1',deviceId:'QR2B-000001'},products:[{name:'Handgemachte Ledertasche',productBindingId:productCode}]};
      }
      await route.fulfill({json:body});
    });
    await page.goto('/binding/QR2B-000001');
    const desired=language==='de'?'Schild verbinden':'Connect a display';
    if(!await page.getByRole('heading',{name:desired,exact:true}).isVisible())await page.getByRole('button',{name:language==='de'?'Deutsch':'English',exact:true}).click();
    await page.getByLabel(language==='de'?'Benutzername':'Username',{exact:true}).fill('test-operator');
    await page.getByLabel(language==='de'?'Passwort':'Password',{exact:true}).fill('test-only-password');
    await page.getByRole('button',{name:language==='de'?'Operator anmelden':'Operator sign in'}).click();
    await page.getByRole('combobox',{name:language==='de'?'Produkt':'Product',exact:true}).selectOption(productCode);
    const previewButton=()=>page.getByRole('button',{name:language==='de'?'Vorschau auf Schild zeigen':'Show preview on display'});
    await previewButton().click();
    await expect(page.getByRole('heading',{name:language==='de'?'Ist das das Produkt vor dir?':'Is this the product in front of you?'})).toBeVisible();
    const confirmButton=()=>page.getByRole('button',{name:language==='de'?'Ja, Schild aktivieren':'Yes, activate display'});
    await expect(confirmButton()).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`node_modules/.cache/binding-ui-results/preview-${language}-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:language==='de'?'Abbrechen':'Cancel',exact:true}).click();
    await previewButton().click();
    await page.getByLabel(language==='de'?'Code auf dem Schild':'Code on the display',{exact:true}).fill('123456');
    await confirmButton().click();
    await expect(page.getByRole('heading',{name:language==='de'?'Schild aktiviert':'Display activated'})).toBeVisible();expect(confirmed).toBe(true);
  });
}
test('public unknown and inactive device states do not offer login or binding',async({page})=>{
  await page.route('**/api/binding/devices/**',r=>r.fulfill({status:404,json:{ok:false,error:'device_not_found'}}));
  await page.goto('/binding/QR2B-999999');await expect(page.getByRole('status')).toContainText(/not found|nicht gefunden/);
  await expect(page.locator('form')).toHaveCount(0);
  await page.unroute('**/api/binding/devices/**');await page.route('**/api/binding/devices/**',r=>r.fulfill({json:{ok:true,available:false}}));
  await page.goto('/binding/QR2B-000001');await expect(page.getByRole('status')).toContainText(/unavailable|nicht verfügbar/);
});
test('print SVGs render from the exported files for independent QR decoding',async({page})=>{
  for(const n of [1,2]) {
    const id=`QR2B-00000${n}`;const svg=readFileSync(`../docs/exports/device-qrs/${id}-device-qr.svg`,'utf8');
    await page.setViewportSize({width:1000,height:1100});await page.setContent(svg);
    await page.locator('body > svg').evaluate(el=>{el.style.width='900px';el.style.height='990px';});
    await page.locator('body > svg').screenshot({path:`node_modules/.cache/binding-ui-results/${id}-svg-render.png`});
  }
});
test('EAN input and expired preview never offer activation',async({page})=>{
  await page.clock.install();
  await page.route('**/api/binding/**',async r=>{
    const path=new URL(r.request().url()).pathname;
    let body={ok:true,deviceId:'QR2B-000001',available:true};
    if(path.includes('/operator/'))body={ok:true,device:{displayName:'Schild 1'},products:[]};
    if(path.endsWith('/preview')) {
      expect(r.request().postDataJSON()).toEqual({method:'EAN',value:'1234567890123'});
      body={ok:true,previewId:'c'.repeat(32),expiresAt:new Date(Date.now()+120000).toISOString(),product:{name:'Test product'},offer:{priceMinor:2490,currency:'EUR'}};
    }
    await r.fulfill({json:body});
  });
  await page.goto('/binding/QR2B-000001');
  if(!await page.getByRole('heading',{name:'Connect a display',exact:true}).isVisible())await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByLabel('Username',{exact:true}).fill('test-operator');await page.getByLabel('Password',{exact:true}).fill('test-only-password');
  await page.getByRole('button',{name:'Operator sign in'}).click();
  await page.getByRole('combobox',{name:'Identify product',exact:true}).selectOption('EAN');
  await page.getByRole('textbox',{name:'EAN / barcode',exact:true}).fill('1234567890123');
  await page.getByRole('button',{name:'Show preview on display'}).click();
  await expect(page.getByRole('heading',{name:'Is this the product in front of you?'})).toBeVisible();
  await page.clock.fastForward(121000);
  await expect(page.getByRole('button',{name:'Yes, activate display'})).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('expired');
});
