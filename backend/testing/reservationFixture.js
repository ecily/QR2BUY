import { AvailabilitySubscription, createAvailabilityService } from '../src/merchant/availabilitySubscriptions.js';
import { createAvailabilityRouter } from '../src/routes/availability.js';
import mongoose from 'mongoose';
import express from 'express';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Merchant, Location, MerchantProduct, Offer, MerchantReservation } from '../src/merchant/models.js';
import { MerchantAccount, hashPassword } from '../src/merchant/accounts.js';
import { createReservationService } from '../src/merchant/reservations.js';
import { createReservationRouter } from '../src/routes/reservations.js';
import { createMerchantPortal } from '../src/routes/merchantPortal.js';
import { createPublicOfferRouter } from '../src/routes/device.js';
import { createDeviceService } from '../src/merchant/deviceService.js';
import { expireReservations } from '../src/merchant/inventory.js';

export async function reservationFixture(origin = 'http://127.0.0.1:5178') {
  const repl = await MongoMemoryReplSet.create({binary:{version:'8.2.6',downloadDir:fileURLToPath(new URL('../node_modules/.cache/mongodb-memory-server',import.meta.url))},replSet:{count:1,ip:'127.0.0.1',storageEngine:'wiredTiger'}});
  const uri = repl.getUri('reservation_test_'+randomBytes(8).toString('hex'));
  if(!uri.startsWith('mongodb://127.0.0.1:'))throw Error('Test database must be loopback');
  await mongoose.connect(uri);
  await Promise.all([Merchant,Location,MerchantProduct,Offer,MerchantReservation,MerchantAccount,AvailabilitySubscription].map(m=>m.init()));
  const password = 'Reservation-test-only-123!';
  const hash = await hashPassword(password);
  for(const i of [0,1]){
    await Merchant.create({merchantId:'M'+i,displayName:'Merchant '+i,contactEmail:`merchant${i}@example.test`});
    await Location.create({locationId:'L'+i,merchantId:'M'+i,name:'Location '+i});
    await MerchantAccount.create({accountId:'A'+i,merchantId:'M'+i,email:`merchant${i}@example.test`,passwordHash:hash});
  }
  let offset = 0;
  const now=()=>new Date(Date.now()+offset);
  const service=createReservationService({now});
  const device=createDeviceService({now,notifyEnabled:()=>true});
  const messages=[];
  const transport={configured:true,async send(message){messages.push(message);return {accepted:true};}};
  const notify=createAvailabilityService({now,transport,origin:()=>origin});
  const app=express();app.use(express.json());
  app.use('/api/notify',createAvailabilityRouter({service:notify,origin,limit:100}));
  app.use('/api/reservations',createReservationRouter({service,origin,limit:100}));
  app.use('/api/public/merchant-offers',createPublicOfferRouter(device));
  app.use('/api',createMerchantPortal({secret:randomBytes(32).toString('hex'),origin,store:new session.MemoryStore(),production:false,reservations:service}));
  let seq=0;
  async function offer(fields={}){
    const id=String(++seq), productId='P'+id;
    await MerchantProduct.create({productId,merchantId:'M0',name:'Reservation product '+id,description:'A real local test product.'});
    return Offer.create({offerId:'O'+id,productId,merchantId:'M0',locationId:'L0',priceMinor:1990,currency:'EUR',stockQuantity:1,reservable:true,reservationDuration:30,...fields});
  }
  return {app,service,device,offer,now,password,notify,messages,transport,advance:async ms=>{offset+=ms;await expireReservations(now());},
    close:async()=>{await mongoose.disconnect();await repl.stop();}};
}
