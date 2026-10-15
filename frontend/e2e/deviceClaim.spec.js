import { test, expect } from '@playwright/test';

for (const lang of ['de','en']) for(const width of [320,430]) test(`initial claim ${lang} ${width}: physical proof, no product, stable retry`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const writes=[];let fail=true,confirmed=false;
  await page.route('**/api/**',async route=>{
    const r=route.request(),path=new URL(r.url()).pathname;let json;
    if(path==='/api/merchant-auth/me')json={ok:true,csrfToken:'test-only-csrf',account:{role:'OWNER'}};
    else if(path==='/api/merchant/me')json={ok:true,merchant:{displayName:'Merchant A'}};
    else if(path==='/api/merchant/locations')json={ok:true,items:[{locationId:'LA',name:'Window A',status:'ACTIVE'}]};
    else if(['/api/merchant/devices','/api/merchant/products','/api/merchant/offers'].includes(path))json={ok:true,items:[]};
    else if(path==='/api/merchant/device-claims'){
      const body=r.postDataJSON();writes.push(body);expect(r.headers()['x-csrf-token']).toBe('test-only-csrf');
      expect(body.deviceId).toBe('QR2B-000003');expect(body.locationId).toBe('LA');expect(body.requestKey).toMatch(/^[a-f0-9]{32}$/);
      expect(Object.keys(body).sort()).toEqual(['deviceId','locationId','requestKey']);
      if(fail){fail=false;await route.abort();return;}
      json={ok:true,deviceId:body.deviceId,locationId:body.locationId,claimId:'a'.repeat(32),status:'PENDING',expiresAt:new Date(Date.now()+120000).toISOString()};
    }else if(path==='/api/merchant/device-claims/'+'a'.repeat(32)+'/confirm'){
      expect(r.postDataJSON()).toEqual({code:'123456'});confirmed=true;json={ok:true,status:'CONFIRMED'};
    }else throw new Error('Unexpected request '+path);
    await route.fulfill({json});
  });
  await page.goto('/merchant/devices?lang='+lang);
  const form=page.locator('.merchant-device-claim');
  const start=form.getByRole('button',{name:lang==='de'?'Besitzbestätigung anzeigen':'Show possession confirmation'});
  await expect(start).toBeDisabled();
  await form.getByLabel(lang==='de'?'Geräte-ID':'Device ID',{exact:true}).fill('QR2B-000003');
  await form.getByLabel(lang==='de'?'Standort':'Location',{exact:true}).selectOption('LA');
  expect(writes).toHaveLength(0);await start.click();await expect(form.getByRole('alert')).toBeVisible();await start.click();
  expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);
  const confirm=form.getByRole('button',{name:lang==='de'?'Schild diesem Standort zuordnen':'Assign display to this location'});
  await expect(confirm).toBeDisabled();expect(confirmed).toBe(false);
  await form.getByLabel(lang==='de'?'Code auf dem Schild':'Code on the display',{exact:true}).fill('123456');await confirm.click();
  await expect(form.getByRole('status')).toContainText(lang==='de'?'Noch kein Produkt':'No product');
  expect(confirmed).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
