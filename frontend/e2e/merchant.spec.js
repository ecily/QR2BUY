import { test, expect } from '@playwright/test';
import { merchantText } from '../src/merchantText.js';

for(const width of [320,375,390,430])for(const language of ['de','en'])test(`merchant ${language} ${width}: register, CRUD, session binding, logout`,async({page})=>{
  const t=merchantText[language];let signedIn=false;let confirmed=false;
  let merchant={displayName:'Test business',contactEmail:'owner@example.invalid',status:'ACTIVE',address:{}};
  const locations=[{locationId:'L1',name:'Window',status:'ACTIVE',address:{}}],products=[],offers=[];
  const devices=[{deviceId:'QR2B-000001',displayName:'Schild 1',online:true,lastSeenAt:new Date().toISOString(),firmwareVersion:'0.3.4',location:{locationId:'L1',name:'Window'},assignmentStatus:'PENDING',product:null,offer:null}];
  await page.setViewportSize({width,height:900});
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method(),body=method==='GET'?null:request.postDataJSON();
    let response={ok:true},status=200;
    if(path==='/api/binding/devices/QR2B-000001')response={ok:true,available:true,deviceId:'QR2B-000001'};
    else if(path==='/api/merchant-auth/csrf')response={ok:true,csrfToken:'test-only-csrf'};
    else if(path==='/api/merchant-auth/register'||path==='/api/merchant-auth/login'){expect(request.headers()['x-csrf-token']).toBe('test-only-csrf');signedIn=true;response={ok:true,account:{email:'owner@example.invalid'},csrfToken:'test-only-csrf'};}
    else if(path==='/api/merchant-auth/logout'){signedIn=false;}
    else if(!signedIn){status=401;response={ok:false,error:'login_required'};}
    else if(path==='/api/merchant-auth/me')response={ok:true,account:{email:'owner@example.invalid'},csrfToken:'test-only-csrf'};
    else {
      expect(request.headers().authorization).toBeUndefined();
      if(method!=='GET')expect(request.headers()['x-csrf-token']).toBe('test-only-csrf');
      if(path==='/api/merchant/me'){if(body)merchant={...merchant,...body};response={ok:true,merchant};}
      else if(path.includes('/binding/devices/')){
        if(path.endsWith('/preview'))response={ok:true,previewId:'b'.repeat(32),expiresAt:new Date(Date.now()+120000).toISOString(),product:{name:products[0].name},offer:{priceMinor:12900,currency:'EUR'},device:{displayName:devices[0].displayName}};
        else if(path.endsWith('/confirm')){expect(body.code).toBe('123456');confirmed=true;response={ok:true,status:'ACTIVE'};}
        else response={ok:true,device:devices[0],products:products.map(p=>({name:p.name,productBindingId:p.productBindingId}))};
      }else{
        const [, , ,kind,id]=path.split('/');const list={products,offers,devices,locations}[kind];
        if(!list){status=404;response={ok:false,error:'not_found'};}
        else if(method==='GET')response={ok:true,items:list};
        else if(method==='POST'){const key={products:'productId',offers:'offerId',locations:'locationId'}[kind];const item={...body,[key]:kind+'-new',...(kind==='products'?{productBindingId:'a'.repeat(32)}:{}),...(kind==='locations'?{status:'ACTIVE'}:{})};list.push(item);response={ok:true,item};}
        else {const key={products:'productId',offers:'offerId',devices:'deviceId',locations:'locationId'}[kind];const item=list.find(x=>x[key]===id);Object.assign(item,body);response={ok:true,item};}
      }
    }
    await route.fulfill({status,json:response});
  });
  await page.goto('/merchant?lang='+language);await expect(page).toHaveURL(/\/merchant\/login/);
  await page.getByRole('link',{name:t.newAccount}).click();
  await page.getByLabel(t.email,{exact:true}).fill('owner@example.invalid');await page.getByLabel(t.password,{exact:true}).fill('test-only-long-password');
  await page.getByLabel(t.business,{exact:true}).fill('Test business');await page.getByLabel(t.locationName,{exact:true}).fill('Window');await page.getByRole('button',{name:t.register,exact:true}).click();
  await expect(page.getByRole('heading',{name:t.overview,exact:true})).toBeVisible();
  await page.locator('nav').getByRole('link',{name:t.products,exact:true}).click();await expect(page.getByRole('heading',{name:t.products,exact:true})).toBeVisible();await page.getByRole('button',{name:t.newProduct}).click();
  let editor=page.locator('.merchant-editor');await editor.getByLabel(t.name,{exact:true}).fill('Handgemachte Ledertasche');await editor.getByRole('button',{name:t.save}).click();
  await expect(page.getByRole('heading',{name:'Handgemachte Ledertasche',exact:true})).toBeVisible();
  await page.getByRole('button',{name:t.edit,exact:true}).click();await editor.getByLabel(t.sku,{exact:true}).fill('BAG-1');await editor.getByRole('button',{name:t.save}).click();
  await page.getByRole('button',{name:t.newOffer}).click();await editor.getByLabel(t.price,{exact:true}).fill('129.00');await editor.getByLabel(t.stock,{exact:true}).fill('3');await editor.getByLabel(t.location,{exact:true}).selectOption('L1');await editor.getByRole('button',{name:t.save}).click();
  await expect(editor).toHaveCount(0);
  expect(offers[0].priceMinor).toBe(12900);expect(offers[0].stockQuantity).toBe(3);
  await page.locator('nav').getByRole('link',{name:t.locations,exact:true}).click();await expect(page.getByRole('heading',{name:t.locations,exact:true})).toBeVisible();await page.getByRole('button',{name:t.newLocation}).click();await editor.getByLabel(t.locationName,{exact:true}).fill('Second location');await editor.getByRole('button',{name:t.save}).click();await expect(page.getByRole('heading',{name:'Second location'})).toBeVisible();
  await page.locator('nav').getByRole('link',{name:t.settings,exact:true}).click();await expect(page.getByRole('heading',{name:t.settings,exact:true})).toBeVisible();await page.getByRole('button',{name:t.edit,exact:true}).click();await editor.getByLabel(t.business,{exact:true}).fill('Updated business');await editor.getByRole('button',{name:t.save}).click();await expect(page.getByRole('heading',{name:'Updated business'})).toBeVisible();
  await page.locator('nav').getByRole('link',{name:t.devices,exact:true}).click();await expect(page.getByRole('heading',{name:t.devices,exact:true})).toBeVisible();await page.getByRole('button',{name:t.rename}).click();await editor.getByLabel(t.name,{exact:true}).fill('Window left');await editor.getByRole('button',{name:t.save}).click();await expect(page.getByRole('heading',{name:'Window left'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`node_modules/.cache/binding-ui-results/merchant-${language}-${width}.png`,fullPage:true});
  await page.getByRole('link',{name:t.connect,exact:true}).click();
  const deHeading=page.getByRole('heading',{name:'Schild verbinden',exact:true});if(language==='de'&&!await deHeading.isVisible())await page.getByRole('button',{name:'Deutsch',exact:true}).click();if(language==='en'&&await deHeading.isVisible())await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Window left'})).toBeVisible();await expect(page.getByLabel(/Username|Benutzername/)).toHaveCount(0);
  await page.getByRole('combobox',{name:language==='de'?'Produkt':'Product',exact:true}).selectOption('a'.repeat(32));await page.getByRole('button',{name:language==='de'?'Vorschau auf Schild zeigen':'Show preview on display'}).click();
  await expect(page.getByRole('heading',{name:language==='de'?'Ist das das Produkt vor dir?':'Is this the product in front of you?'})).toBeVisible();
  await page.getByLabel(language==='de'?'Code auf dem Schild':'Code on the display',{exact:true}).fill('123456');await page.getByRole('button',{name:language==='de'?'Ja, Schild aktivieren':'Yes, activate display'}).click();await expect(page.getByRole('heading',{name:language==='de'?'Schild aktiviert':'Display activated',exact:true})).toBeVisible();expect(confirmed).toBe(true);
  await page.goto('/merchant?lang='+language);await page.getByRole('button',{name:t.logout,exact:true}).click();await expect(page.getByRole('heading',{name:t.login,exact:true})).toBeVisible();
  await page.getByLabel(t.email,{exact:true}).fill('owner@example.invalid');await page.getByLabel(t.password,{exact:true}).fill('test-only-long-password');await page.getByRole('button',{name:t.login,exact:true}).click();await expect(page.getByRole('heading',{name:t.overview,exact:true})).toBeVisible();
});
