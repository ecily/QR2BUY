import { test, expect } from '@playwright/test';
import { pilotCopy } from '../src/pilotCopy.js';
import { merchantText } from '../src/merchantText.js';

for (const width of [320,375,390,430]) for (const lang of ['de','en']) {
  test(`pilot ${lang} ${width}: public merchant entry, country, private IDs and buyer availability`, async ({ page }) => {
    const t=merchantText[lang], p=pilotCopy[lang], errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.setViewportSize({width,height:900});
    let merchant={merchantId:'INTERNAL-MERCHANT-ID',displayName:'Pilot shop',contactEmail:'pilot@example.invalid',status:'ACTIVE',address:{_id:'INTERNAL-ADDRESS-ID',city:'Wien',country:'AT'}};
    const location={locationId:'L1',name:'Window',status:'ACTIVE',address:{_id:'INTERNAL-LOCATION-ID',country:'AT'}};
    let stock=5, active=true;
    await page.route('**/api/**', async route=>{
      const req=route.request(), path=new URL(req.url()).pathname;
      let json, status=200;
      if(path==='/api/merchant-auth/csrf') json={ok:true,csrfToken:'test-only'};
      else if(path==='/api/merchant-auth/me') json={ok:true,csrfToken:'test-only',account:{email:'pilot@example.invalid'}};
      else if(path==='/api/merchant/me') {
        if(req.method()==='PATCH') { const body=req.postDataJSON(); expect(body.address.country).toBe('DE'); expect(body.address._id).toBeUndefined(); merchant={...merchant,...body}; }
        json={ok:true,merchant};
      } else if(path==='/api/merchant/locations') json={ok:true,items:[location]};
      else if(['/api/merchant/products','/api/merchant/offers','/api/merchant/devices'].includes(path)) json={ok:true,items:[]};
      else if(path.startsWith('/api/public/merchant-offers/')) {
        status=active?200:404;
        json=active?{ok:true,merchant:{displayName:'Pilot shop'},location:{name:'Window'},product:{name:'Pilot product'},offer:{priceMinor:2290,currency:'EUR',stockQuantity:stock}}:{ok:false};
      } else throw new Error('Unexpected request: '+req.method()+' '+path);
      await route.fulfill({status,json});
    });
    const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.goto('/'+lang);
    await expect(page.locator('.landing-hero').getByRole('link',{name:p.merchantStart,exact:true})).toBeVisible();
    await expect(page.locator('.landing-header').getByRole('link',{name:p.merchantLogin,exact:true})).toBeVisible();
    await expect(page.locator('#merchants')).toContainText(p.commerceScope);
    await expect(page.locator('.landing-nav a[href="#demo"]')).toHaveCount(1);
    await noOverflow();
    await page.locator('.landing-hero').getByRole('link',{name:p.merchantStart,exact:true}).click();
    await expect(page).toHaveURL('/merchant/register?lang='+lang);
    await expect(page.getByRole('heading',{name:t.register,exact:true})).toBeVisible();
    await page.goto('/'+lang);
    await page.locator('.landing-header').getByRole('link',{name:p.merchantLogin,exact:true}).click();
    await expect(page).toHaveURL('/merchant/login?lang='+lang);
    await expect(page.getByRole('heading',{name:t.login,exact:true})).toBeVisible();
    await page.goto('/merchant/settings?lang='+lang);
    await expect(page.getByRole('heading',{name:'Pilot shop'})).toBeVisible();
    await expect(page.locator('main')).not.toContainText('INTERNAL-');
    await expect(page.locator('main')).toContainText(lang==='de'?'Österreich':'Austria');
    await page.getByRole('button',{name:t.edit,exact:true}).click();
    const country=page.getByRole('combobox',{name:t.country,exact:true});
    await expect(country).toHaveValue('AT');
    await expect(country.locator('option:checked')).toHaveText(lang==='de'?'Österreich':'Austria');
    await country.selectOption('DE'); await noOverflow();
    await page.getByRole('button',{name:t.save,exact:true}).click();
    await expect(page.getByRole('status')).toHaveText(t.saved);
    await expect(page.locator('main')).not.toContainText('INTERNAL-');
    await page.getByRole('button',{name:t.edit,exact:true}).click(); await expect(country).toHaveValue('DE');
    await page.goto('/merchant/locations?lang='+lang);
    await page.getByRole('button',{name:t.edit,exact:true}).click();
    await expect(page.getByRole('combobox',{name:t.country,exact:true})).toHaveValue('AT'); await noOverflow();
    const buyer='/o/'+ 'a'.repeat(32)+'?lang='+lang;
    await page.goto(buyer);
    await expect(page.getByRole('heading',{name:'Pilot product'})).toBeVisible();
    await expect(page.locator('main strong')).toContainText(lang==='de'?'22,90':'22.90');
    await expect(page.locator('main')).toContainText(lang==='de'?'Verfügbar':'Available');
    stock=0; await page.reload(); await expect(page.locator('main')).toContainText(lang==='de'?'Momentan ausverkauft':'Temporarily sold out');
    stock=5; await page.reload(); await expect(page.locator('main')).toContainText(lang==='de'?'Verfügbar':'Available');
    active=false; await page.reload(); await expect(page.getByRole('heading')).toHaveText(lang==='de'?'Angebot derzeit nicht verfügbar':'Offer currently unavailable');
    active=true; await page.reload(); await expect(page.getByRole('heading')).toHaveText('Pilot product');
    await expect(page.locator('main')).toContainText(lang==='de'?'noch nicht freigeschaltet':'not yet available');
    await expect(page.getByRole('button')).toHaveCount(0); await noOverflow(); expect(errors).toEqual([]);
  });
}
