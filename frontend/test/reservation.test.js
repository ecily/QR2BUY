import test from 'node:test';
import assert from 'node:assert/strict';
import { canReserve, validBuyer, reservationText, money } from '../src/reservation.js';
test('reservation action requires real backend support, active offer, stock and reservable independently of purchase flag',()=>{
 const d={reservationAvailable:true,checkoutAvailable:false,offer:{active:true,reservable:true,purchasable:false,stockQuantity:1}};
 assert.equal(canReserve(d),true);
 for(const patch of [{active:false},{reservable:false},{stockQuantity:0}])assert.equal(canReserve({...d,offer:{...d.offer,...patch}}),false);
 assert.equal(canReserve({...d,reservationAvailable:false}),false);assert.equal(canReserve(null),false);
});
test('minimal buyer data: name and at least one valid contact',()=>{
 for(const contact of [{buyerEmail:'buyer@example.test'},{buyerPhone:'+43 123 456789'},{buyerEmail:'buyer@example.test',buyerPhone:'0123456789'}])assert.equal(validBuyer({buyerName:'Buyer',...contact}),true);
 for(const data of [{buyerName:'Buyer'},{buyerName:'',buyerEmail:'a@b.test'},{buyerName:'Buyer',buyerEmail:'broken'},{buyerName:'Buyer',buyerPhone:'123'},{buyerName:'Buyer',buyerEmail:'a@b.test',buyerPhone:'broken'}])assert.equal(validBuyer(data),false);
});
test('DE/EN labels cover all reservation states; price handles zero and three decimal currencies',()=>{
 assert.deepEqual(Object.keys(reservationText.de),Object.keys(reservationText.en));
 for(const lang of ['de','en'])for(const status of ['RESERVED','EXPIRED','CANCELLED','COLLECTED'])assert.ok(reservationText[lang][status]);
 assert.match(money({currency:'JPY',totalPriceMinor:100},'en'),/100/);
 assert.match(money({currency:'KWD',totalPriceMinor:1990},'en'),/1.990/);
});
