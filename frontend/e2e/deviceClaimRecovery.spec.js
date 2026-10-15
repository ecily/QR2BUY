import { test, expect } from '@playwright/test';

for(const scenario of ['rejected','lost-expired','timeout','lost-confirmation','expired','unknown-restart'])
test('claim recovery without reload: '+scenario,async({page})=>{
  await page.clock.install();
  const starts=[];let phase='NEW',confirmations=0,first=true,expiry;
  await page.route('**/api/**',async route=>{
    const r=route.request(),path=new URL(r.url()).pathname;let json,status=200;
    if(path==='/api/merchant-auth/me')json={ok:true,csrfToken:'test-only-csrf',account:{role:'OWNER'}};
    else if(path==='/api/merchant/me')json={ok:true,merchant:{displayName:'Merchant A'}};
    else if(path==='/api/merchant/locations')json={ok:true,items:[{locationId:'LA',name:'Window A',status:'ACTIVE'}]};
    else if(['/api/merchant/devices','/api/merchant/products','/api/merchant/offers'].includes(path))json={ok:true,items:[]};
    else if(path==='/api/merchant/device-claims'){
      const body=r.postDataJSON();starts.push(body);
      if(first){
        first=false;expiry=await page.evaluate(()=>Date.now()+120000);
        if(scenario==='rejected'){await route.fulfill({status:409,json:{ok:false,error:'device_update_required'}});return;}
        phase='PENDING';
        if(scenario==='lost-expired'||scenario==='unknown-restart'){await route.abort();return;}
        if(scenario==='timeout')return; // Server may have committed; browser must abort and preserve its key.
      }
      if(scenario==='unknown-restart'&&starts.length===2)expiry=await page.evaluate(()=>Date.now()+120000);
      if(phase!=='CONFIRMED'&&await page.evaluate(()=>Date.now())>=expiry){status=409;json={ok:false,error:'claim_expired'};}
      else json={ok:true,claimId:'a'.repeat(32),status:phase==='CONFIRMED'?'CONFIRMED':'PENDING',expiresAt:new Date(expiry).toISOString()};
    }else if(path.endsWith('/confirm')){
      confirmations++;phase='CONFIRMED';await route.abort();return;
    }else throw Error('Unexpected local mock request '+path);
    await route.fulfill({status,json});
  });
  await page.goto('/merchant/devices?lang=en');
  const form=page.locator('.merchant-device-claim'),start=form.getByRole('button',{name:'Show possession confirmation',exact:true});
  const setup=form.getByLabel('Setup code on the display (32 characters)',{exact:true});
  await form.getByLabel('Device ID',{exact:true}).fill('QR2B-000003');await form.getByLabel('Location',{exact:true}).selectOption('LA');
  await setup.fill('b'.repeat(32));await start.click();
  if(scenario==='timeout')await page.clock.fastForward(21000);
  if(['rejected','lost-expired','timeout','unknown-restart'].includes(scenario))await expect(form.getByRole('alert')).toBeVisible();
  if(scenario==='rejected'){
    await expect(form.getByLabel('Device ID',{exact:true})).toBeEnabled();await expect(setup).toHaveValue('');
    await setup.fill('c'.repeat(32));await start.click();await expect(form.getByLabel('Code on the display',{exact:true})).toBeVisible();
    expect(starts[0].requestKey).not.toBe(starts[1].requestKey);
  }else if(scenario==='timeout'){
    await form.getByRole('button',{name:'Check result again'}).click();await expect(form.getByLabel('Code on the display',{exact:true})).toBeVisible();expect(starts[0]).toEqual(starts[1]);
  }else if(scenario==='lost-confirmation'){
    await form.getByLabel('Code on the display',{exact:true}).fill('123456');await form.getByRole('button',{name:'Assign display to this location'}).click();
    await expect(form.getByRole('alert')).toBeVisible();await page.clock.fastForward(121000);
    await form.getByRole('button',{name:'Check result again'}).click();await expect(form.getByRole('status')).toContainText('Display assigned');expect(confirmations).toBe(1);expect(starts[0]).toEqual(starts[1]);
  }else if(scenario==='unknown-restart'){
    await page.clock.fastForward(141000);await form.getByRole('button',{name:'Prepare a new confirmation'}).click();
    await expect(setup).toBeEnabled();await setup.fill('c'.repeat(32));await start.click();await expect(form.getByLabel('Code on the display',{exact:true})).toBeVisible();expect(starts[0].requestKey).not.toBe(starts[1].requestKey);
  }else{
    await page.clock.fastForward(121000);
    if(scenario==='lost-expired')await form.getByRole('button',{name:'Check result again'}).click();
    else await form.getByRole('button',{name:'Prepare a new confirmation'}).click();
    await expect(setup).toBeEnabled();await expect(form.getByLabel('Device ID',{exact:true})).toBeEnabled();expect(confirmations).toBe(0);
  }
});
