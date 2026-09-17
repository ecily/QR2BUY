import mongoose from 'mongoose';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import pino from 'pino';
import { Merchant, Location, MerchantProduct, Offer } from './models.js';
import { reservedQuantity } from './inventory.js';
import { DeviceApiError } from './deviceCredentials.js';
import { availabilityState, notifyStateAllowed } from './availabilityPolicy.js';
import { createAvailabilityMailTransport, availabilityMessage, confirmationMessage } from './availabilityMail.js';

const schema = new mongoose.Schema({
  subscriptionId:{type:String,required:true,unique:true}, generation:{type:String,default:()=>randomUUID()}, merchantId:{type:String,required:true},
  locationId:{type:String,required:true}, productId:{type:String,required:true}, offerId:{type:String,required:true},
  emailNormalized:{type:String,required:true,select:false}, name:{type:String,default:null,select:false},
  status:{type:String,enum:['CONFIRMING','ACTIVE','NOTIFIED','CANCELLED','EXPIRED'],required:true},
  locale:{type:String,enum:['de','en'],required:true}, source:{type:String,enum:['BUYER_OFFER'],required:true},
  consentVersion:{type:String,default:'availability-single-opt-in-v1'},
  lastTriggerState:String, notifiedAt:Date, cancelledAt:Date, expiresAt:Date, deleteAfter:Date,
  unsubscribeHash:{type:String,required:true,select:false},
  deliveryUnsubscribeHash:{type:String,select:false}, confirmationSentAt:Date,
  delivery:{type:String,enum:['IDLE','SENDING','UNCERTAIN','SENT','FAILED'],default:'IDLE'},
  claimedAt:Date, nextAttemptAt:Date, attempts:{type:Number,default:0}
},{timestamps:true,collection:'merchant_availability_subscriptions'});
schema.index({offerId:1,emailNormalized:1},{unique:true});
schema.index({status:1,delivery:1,nextAttemptAt:1});
schema.index({unsubscribeHash:1},{unique:true});
schema.index({deleteAfter:1},{expireAfterSeconds:0});
export const AvailabilitySubscription = mongoose.models.MerchantAvailabilitySubscription || mongoose.model('MerchantAvailabilitySubscription',schema);
export const subscriptionInput = z.object({email:z.string().trim().toLowerCase().email().max(254),
  name:z.string().trim().max(120).optional(),locale:z.enum(['de','en']).default('de'), consent:z.literal(true)}).strict();
const hash = token => createHash('sha256').update(token).digest('hex');
const day = 86400000;
const logger = pino();
const openStatuses = ['CONFIRMING','ACTIVE'];
const fail = (code= 'notify_unavailable') => { throw new DeviceApiError(409,code); };
export function createAvailabilityService({now=()=>new Date(), transport=createAvailabilityMailTransport(),
  origin=()=>process.env.PUBLIC_BASE_URL, enabled=()=>transport.configured === true,
  operatorLog=record=>logger.warn(record,'availability delivery requires review')}={}) {
  async function resolve(publicOfferId) {
    const offer = await Offer.findOne({publicOfferId}).lean();
    if (!offer) return null;
    const [merchant,location,product] = await Promise.all([
      Merchant.findOne({merchantId:offer.merchantId,status:'ACTIVE'}).lean(),
      Location.findOne({merchantId:offer.merchantId,locationId:offer.locationId,status:'ACTIVE'}).lean(),
      MerchantProduct.findOne({merchantId:offer.merchantId,productId:offer.productId,status:'ACTIVE'}).lean()]);
    if (!merchant || !location || !product) return null;
    return {offer,merchant,location,product,state:availabilityState(offer,await reservedQuantity(offer.offerId,now()))};
  }
  function logDelivery(row, delivery) {
    operatorLog({event:'availability_delivery',subscriptionId:row.subscriptionId,generation:row.generation,
      status:row.status,delivery,attempts:row.attempts});
  }
  async function deliver(candidate) {
    const at=now(), confirming=candidate.status==='CONFIRMING';
    const offer=await Offer.findOne({offerId:candidate.offerId}).lean();
    const context=offer && await resolve(offer.publicOfferId);
    const validScope=c=>c && c.offer.merchantId===candidate.merchantId
      && c.offer.productId===candidate.productId && c.offer.locationId===candidate.locationId;
    const eligible=c=>validScope(c) && (confirming || c.state==='READY');
    const filter={_id:candidate._id,generation:candidate.generation,status:candidate.status,delivery:'IDLE'};
    if (!eligible(context)) {
      await AvailabilitySubscription.updateOne(filter,{$set:{nextAttemptAt:new Date(+at+30000)}}); return;
    }
    const base=origin();
    if (!base || !/^https?:\/\/[^/]+$/.test(base)) return;
    const token=randomBytes(32).toString('hex');
    // Keep the first mail's link valid; availability mail gets a separate hash.
    const tokenField=confirming?'unsubscribeHash':'deliveryUnsubscribeHash';
    const claimed=await AvailabilitySubscription.findOneAndUpdate({...filter,expiresAt:{$gt:at},
      nextAttemptAt:{$lte:at},attempts:{$lt:5}},{$set:{delivery:'SENDING',claimedAt:at,
        [tokenField]:hash(token),lastTriggerState:context.state},$inc:{attempts:1}}, {new:true}).select('+emailNormalized');
    if (!claimed) return;
    const claim={_id:claimed._id,generation:claimed.generation,status:claimed.status,delivery:'SENDING'};
    try {
      const fresh=await resolve(context.offer.publicOfferId);
      if (!await AvailabilitySubscription.exists({...claim,expiresAt:{$gt:now()}})) return;
      if (!eligible(fresh)) {
        await AvailabilitySubscription.updateOne(claim,{$set:{delivery:'IDLE',nextAttemptAt:new Date(+now()+30000)},$inc:{attempts:-1}}); return;
      }
      const message=confirming?confirmationMessage:availabilityMessage;
      const sent=await transport.send({to:claimed.emailNormalized,...message(fresh,claimed.locale,base,token)});
      if (!sent.accepted) { const error=new Error('mail_unavailable'); error.retrySafe=true; throw error; }
      await AvailabilitySubscription.updateOne(claim,{$set:confirming
        ? {status:'ACTIVE',delivery:'IDLE',confirmationSentAt:now(),attempts:0,claimedAt:null,nextAttemptAt:now()}
        : {status:'NOTIFIED',delivery:'SENT',notifiedAt:now(),deleteAfter:new Date(+now()+30*day)}});
    } catch(error) {
      const delivery=error.retrySafe===true?(claimed.attempts>=5?'FAILED':'IDLE'):'UNCERTAIN';
      const result=await AvailabilitySubscription.updateOne(claim,{$set:{delivery,
        nextAttemptAt:delivery==='IDLE'?new Date(+now()+Math.min(3600000,60000*2**Math.min(claimed.attempts,6))):null}});
      if(result.modifiedCount && ['FAILED','UNCERTAIN'].includes(delivery)) logDelivery(claimed,delivery);
    }
  }
  return {
    async subscribe(id,input) {
      const data=subscriptionInput.parse(input);
      if (!enabled()) fail();
      if (!/^[a-f0-9]{32}$/.test(id)) throw new DeviceApiError(404,'offer_not_found');
      const context=await resolve(id);
      if (!context) throw new DeviceApiError(404,'offer_not_found');
      if (!notifyStateAllowed(context.state)) fail();
      const at=now(), token=randomBytes(32).toString('hex');
      const fields={merchantId:context.offer.merchantId,locationId:context.offer.locationId,productId:context.offer.productId,
        offerId:context.offer.offerId,emailNormalized:data.email};
      await AvailabilitySubscription.updateOne({offerId:fields.offerId,emailNormalized:data.email,status:{$in:openStatuses},
        expiresAt:{$lte:at},delivery:{$nin:['SENDING','UNCERTAIN']}},{$set:{status:'EXPIRED'}});
      const existing=await AvailabilitySubscription.findOne(fields).lean();
      // Atomic unique key prevents simultaneous duplicate opt-ins. An ACTIVE row,
      // especially an uncertain delivery, is never reset by a repeated request.
      try {
        await AvailabilitySubscription.updateOne({offerId:fields.offerId,emailNormalized:data.email},{$setOnInsert:{...fields,
          subscriptionId:randomUUID(),name:data.name||null,locale:data.locale,source:'BUYER_OFFER',status:'CONFIRMING',
          unsubscribeHash:hash(token),lastTriggerState:context.state,expiresAt:new Date(+at+90*day),
          deleteAfter:new Date(+at+120*day),nextAttemptAt:at,createdAt:at}}, {upsert:true});
      } catch(e) { if(e.code!==11000) throw e; }
      if(existing) await AvailabilitySubscription.updateOne({...fields,generation:existing.generation,
        status:existing.status,delivery:existing.delivery,$or:[{status:{$in:['NOTIFIED','CANCELLED','EXPIRED']}},
        {status:{$in:openStatuses},delivery:'FAILED'}]},{$set:{
        status:'CONFIRMING',generation:randomUUID(),name:data.name||null,locale:data.locale,unsubscribeHash:hash(token),delivery:'IDLE',attempts:0,
        deliveryUnsubscribeHash:null,confirmationSentAt:null,
        notifiedAt:null,cancelledAt:null,claimedAt:null,nextAttemptAt:at,lastTriggerState:context.state,
        expiresAt:new Date(+at+90*day),deleteAfter:new Date(+at+120*day)}});
      // Metadata only: repeated opt-ins never reset a live claim or uncertain send.
      await AvailabilitySubscription.updateOne({...fields,status:{$in:openStatuses}},{$set:{locale:data.locale,
        ...(data.name!==undefined?{name:data.name||null}:{})}});
      const row=await AvailabilitySubscription.findOne(fields).lean();
      if(row?.status==='CONFIRMING' && row.delivery==='IDLE') await deliver(row);
      const current=await AvailabilitySubscription.findById(row._id).lean();
      // Never claim a confirmation was sent when SMTP has not accepted it.
      return current.confirmationSentAt?{ok:true}:{ok:true,confirmationPending:true};
    },
    async unsubscribe(token) {
      if (/^[a-f0-9]{64}$/.test(token)) await AvailabilitySubscription.updateOne({
        $or:[{unsubscribeHash:hash(token)},{deliveryUnsubscribeHash:hash(token)}],status:{$in:[...openStatuses,'NOTIFIED']}},
        {$set:{status:'CANCELLED',cancelledAt:now(),deleteAfter:new Date(+now()+30*day)}});
      return {ok:true};
    },
    async run() {
      if (!enabled()) return;
      const at=now();
      // A crash after SMTP DATA has an unknowable outcome. Never blindly retry it.
      const stale=await AvailabilitySubscription.find({status:{$in:openStatuses},delivery:'SENDING',claimedAt:{$lte:new Date(+at-60000)}}).lean();
      for(const row of stale) {
        const result=await AvailabilitySubscription.updateOne({_id:row._id,generation:row.generation,status:row.status,
          delivery:'SENDING',claimedAt:row.claimedAt},{$set:{delivery:'UNCERTAIN',nextAttemptAt:null}});
        if(result.modifiedCount) logDelivery(row,'UNCERTAIN');
      }
      await AvailabilitySubscription.updateMany({status:{$in:openStatuses},expiresAt:{$lte:at}},{$set:{status:'EXPIRED',deleteAfter:new Date(+at+30*day)}});
      const candidates=await AvailabilitySubscription.find({status:{$in:openStatuses},delivery:'IDLE',nextAttemptAt:{$lte:at}}).sort({nextAttemptAt:1}).limit(100).lean();
      for (const candidate of candidates) await deliver(candidate);
    }
  };
}
export function startAvailabilityNotifications(onError=()=>{}) {
  const service=createAvailabilityService(); let busy=false;
  const run=async()=>{if(busy)return;busy=true;try{await service.run();}catch{onError();}finally{busy=false;}};
  const timer=setInterval(run,30000);timer.unref();void run();return()=>clearInterval(timer);
}
