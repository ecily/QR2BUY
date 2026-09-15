import test from 'node:test';
import assert from 'node:assert/strict';
import { countryCodes, countryName, countryOptions, addressLabel } from '../src/countries.js';
import { pilotCopy } from '../src/pilotCopy.js';

test('country selection localizes ISO values, preserves legacy values and excludes internal address fields', () => {
  assert.equal(countryCodes.length, 249); assert.equal(new Set(countryCodes).size, 249);
  assert.equal(countryName('AT','de'), 'Österreich'); assert.equal(countryName('AT','en'), 'Austria');
  assert.equal(countryName('de','de'), 'Deutschland'); assert.equal(countryName('', 'en'), '');
  for (const lang of ['de','en']) {
    assert.equal(countryOptions(lang).find(c=>c.value==='AT').label, countryName('AT',lang));
    assert(countryOptions(lang,'ZZ').some(c=>c.value==='ZZ'));
  }
  assert.equal(addressLabel({_id:'internal-mongo-id',merchantId:'internal-merchant-id',line1:'Example 1',country:'AT'},'en'),'Example 1, Austria');
});

test('pilot copy covers both languages and distinguishes live merchant access from demo commerce', () => {
  assert.deepEqual(Object.keys(pilotCopy.de), Object.keys(pilotCopy.en));
  for (const lang of ['de','en']) {
    assert(pilotCopy[lang].merchantStart); assert(pilotCopy[lang].merchantLogin);
    assert.match(pilotCopy[lang].commerceScope, /noch nicht|not yet/);
    assert.match(pilotCopy[lang].heroTrust, /Demo|demo/);
  }
});
