import mongoose from 'mongoose';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { Merchant, Location, MerchantProduct, Offer } from './models.js';
import { reservedQuantity } from './inventory.js';
import { DeviceApiError } from './deviceCredentials.js';
import { availabilityState, notifyStateAllowed } from './availabilityPolicy.js';
import { createAvailabilityMailTransport, availabilityConfirmationMessage, availabilityMessage } from './availabilityMail.js';

const schema = new mongoose.Schema({
  subscriptionId:{type:String,required:true,unique:true}, generation:{type:String,default:()=>randomUUID()}, merchantId:{type:String,required:true},
  locationId:{type:String,required:true}, productId:{type:String,required:true}, offerId:{type:String,required:true},
  emailNormalized:{type:String,required:true,select:false}, name:{type:String,default:null,select:false},
  status:{type:String,enum:['ACTIVE','NOTIFIED','CANCELLED','EXPIRED'],required:true},
  locale:{type:String,enum:['de','en'],required:true}, source:{type:String,enum:['BUYER_OFFER'],required:true},
  consentVersion:{type:String,default:'availability-single-opt-in-v1'},
  lastTriggerState:String, notifiedAt:Date, cancelledAt:Date, expiresAt:Date, deleteAfter:Date,
  unsubscribeHash:{type:String,required:true,select:false}, preDeliveryUnsubscribeHash:{type:String,select:false},
  delivery:{type:String,enum:['CONFIRMING','IDLE','SENDING','UNCERTAIN','FAILED','SENT'],default:'IDLE'},
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
const maxDeliveryAttempts = 5;
const fail = (code='notify_unavailable', status=409) => { throw new DeviceApiError(status,code); };
export function createAvailabilityService({now=()=>new Date(), transport=createAvailabilityMailTransport(),
  origin=()=>process.env.PUBLIC_BASE_URL, enabled=()=>transport.configured === true, onDeliveryIssue=()=>{}}={}) {
  const report = issue => { try { onDeliveryIssue(issue); } catch { /* operational reporting must not change delivery state */ } };
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
  return {
    async subscribe(id,input) {
      const data=subscriptionInput.parse(input);
      if (!enabled()) fail();
      if (!/^[a-f0-9]{32}$/.test(id)) throw new DeviceApiError(404,'offer_not_found');
      const context=await resolve(id);
      if (!context) throw new DeviceApiError(404,'offer_not_found');
      if (!notifyStateAllowed(context.state)) fail();
      const base=origin();
      if (!base || !/^https?:\/\/[^/]+$/.test(base)) fail('notify_unavailable',503);
      const at=now(), token=randomBytes(32).toString('hex'), tokenHash=hash(token), generation=randomUUID();
      const fields={merchantId:context.offer.merchantId,locationId:context.offer.locationId,productId:context.offer.productId,
        offerId:context.offer.offerId,emailNormalized:data.email};
      await AvailabilitySubscription.updateOne({offerId:fields.offerId,emailNormalized:data.email,status:'ACTIVE',
        expiresAt:{$lte:at},delivery:{$nin:['SENDING','CONFIRMING']}},{$set:{status:'EXPIRED'}});
      let confirmGeneration=null;
      try {
        const inserted=await AvailabilitySubscription.updateOne({offerId:fields.offerId,emailNormalized:data.email},{$setOnInsert:{...fields,
          subscriptionId:randomUUID(),generation,name:data.name||null,locale:data.locale,source:'BUYER_OFFER',status:'ACTIVE',delivery:'CONFIRMING',
          unsubscribeHash:tokenHash,preDeliveryUnsubscribeHash:tokenHash,lastTriggerState:context.state,expiresAt:new Date(+at+90*day),
          deleteAfter:new Date(+at+120*day),nextAttemptAt:at,createdAt:at}}, {upsert:true});
        if (inserted.upsertedCount === 1) confirmGeneration=generation;
      } catch(e) { if(e.code!==11000) throw e; }
      if (!confirmGeneration) {
        const renewed=await AvailabilitySubscription.findOneAndUpdate({...fields,status:{$in:['NOTIFIED','CANCELLED','EXPIRED']}},{$set:{
          status:'ACTIVE',generation,name:data.name||null,locale:data.locale,unsubscribeHash:tokenHash,preDeliveryUnsubscribeHash:tokenHash,
          delivery:'CONFIRMING',attempts:0,notifiedAt:null,cancelledAt:null,claimedAt:null,nextAttemptAt:at,lastTriggerState:context.state,
          expiresAt:new Date(+at+90*day),deleteAfter:new Date(+at+120*day)}},{new:true});
        if (renewed) confirmGeneration=generation;
      }
      if (!confirmGeneration) {
        await AvailabilitySubscription.updateOne({...fields,status:'ACTIVE'},{$set:{name:data.name||null,locale:data.locale}});
        await AvailabilitySubscription.updateOne({...fields,status:'ACTIVE',delivery:'FAILED'},{$set:{
          generation:randomUUID(),delivery:'IDLE',attempts:0,claimedAt:null,nextAttemptAt:at}});
        return {ok:true};
      }
      try {
        const sent=await transport.send({to:data.email,...availabilityConfirmationMessage(context,data.locale,base,token)});
        if (!sent.accepted) { const error=new Error('mail_unavailable'); error.retrySafe=true; throw error; }
        await AvailabilitySubscription.updateOne({...fields,generation:confirmGeneration,status:'ACTIVE',delivery:'CONFIRMING'},{$set:{
          delivery:'IDLE',claimedAt:null,nextAttemptAt:at}});
      } catch {
        await AvailabilitySubscription.updateOne({...fields,generation:confirmGeneration,status:'ACTIVE',delivery:'CONFIRMING'},{$set:{
          status:'CANCELLED',delivery:'FAILED',cancelledAt:now(),deleteAfter:new Date(+now()+30*day)}});
        report({stage:'CONFIRMATION',delivery:'FAILED',offerId:fields.offerId});
        fail('notify_unavailable',503);
      }
      return {ok:true};
    },
    async unsubscribe(token) {
      if (/^[a-f0-9]{64}$/.test(token)) {
        const tokenHash=hash(token);
        await AvailabilitySubscription.updateOne({status:{$in:['ACTIVE','NOTIFIED']},$or:[
          {unsubscribeHash:tokenHash},{preDeliveryUnsubscribeHash:tokenHash}]},
        {$set:{status:'CANCELLED',cancelledAt:now(),deleteAfter:new Date(+now()+30*day)}});
      }
      return {ok:true};
    },
    async run() {
      if (!enabled()) return;
      const at=now();
      await AvailabilitySubscription.updateMany({status:'ACTIVE',expiresAt:{$lte:at}},{$set:{status:'EXPIRED',deleteAfter:new Date(+at+30*day)}});
      // A process loss after SMTP DATA can have an unknowable outcome. Never blindly retry it.
      const stale=await AvailabilitySubscription.find({status:'ACTIVE',delivery:'SENDING',claimedAt:{$lte:new Date(+at-60000)}})
        .select('subscriptionId offerId attempts').lean();
      if (stale.length) {
        await AvailabilitySubscription.updateMany({_id:{$in:stale.map(row=>row._id)},status:'ACTIVE',delivery:'SENDING'},{$set:{delivery:'UNCERTAIN'}});
        for (const row of stale) report({stage:'AVAILABILITY',delivery:'UNCERTAIN',subscriptionId:row.subscriptionId,offerId:row.offerId,attempts:row.attempts});
      }
      const candidates=await AvailabilitySubscription.find({status:'ACTIVE',delivery:'IDLE',nextAttemptAt:{$lte:at}}).sort({nextAttemptAt:1}).limit(100).lean();
      for (const candidate of candidates) {
        const at=now();
        const offer=await Offer.findOne({offerId:candidate.offerId}).lean();
        const context=offer && await resolve(offer.publicOfferId);
        if (!context || context.state!=='READY' || context.offer.merchantId!==candidate.merchantId
            || context.offer.productId!==candidate.productId || context.offer.locationId!==candidate.locationId) {
          await AvailabilitySubscription.updateOne({_id:candidate._id,delivery:'IDLE'},{$set:{nextAttemptAt:new Date(+at+30000)}}); continue;
        }
        const base=origin();
        if (!base || !/^https?:\/\/[^/]+$/.test(base)) continue;
        const token=randomBytes(32).toString('hex');
        const claimed=await AvailabilitySubscription.findOneAndUpdate({_id:candidate._id,generation:candidate.generation,status:'ACTIVE',delivery:'IDLE',expiresAt:{$gt:at}},
          {$set:{delivery:'SENDING',claimedAt:at,unsubscribeHash:hash(token),lastTriggerState:'READY'},$inc:{attempts:1}}, {new:true}).select('+emailNormalized');
        if (!claimed) continue;
        try {
          // Recheck after claiming: cancellation or a new hold may have arrived.
          const fresh=await resolve(context.offer.publicOfferId);
          const stillActive=await AvailabilitySubscription.exists({_id:claimed._id,generation:claimed.generation,status:'ACTIVE',delivery:'SENDING'});
          if (!stillActive) continue;
          if (!fresh || fresh.state!=='READY') {
            await AvailabilitySubscription.updateOne({_id:claimed._id,generation:claimed.generation,delivery:'SENDING'},{$set:{delivery:'IDLE',nextAttemptAt:new Date(+at+30000)}}); continue;
          }
          const sent=await transport.send({to:claimed.emailNormalized,...availabilityMessage(fresh,claimed.locale,base,token)});
          if (!sent.accepted) { const error=new Error('mail_unavailable'); error.retrySafe=true; throw error; }
          await AvailabilitySubscription.updateOne({_id:claimed._id,generation:claimed.generation,status:'ACTIVE',delivery:'SENDING'},{$set:{status:'NOTIFIED',delivery:'SENT',notifiedAt:now(),deleteAfter:new Date(+now()+30*day)}});
        } catch(error) {
          const delivery=error.retrySafe === true ? (claimed.attempts >= maxDeliveryAttempts ? 'FAILED' : 'IDLE') : 'UNCERTAIN';
          await AvailabilitySubscription.updateOne({_id:claimed._id,generation:claimed.generation,status:'ACTIVE',delivery:'SENDING'},{$set:{
            delivery,nextAttemptAt:delivery==='IDLE' ? new Date(+at+Math.min(3600000,60000*2**Math.min(claimed.attempts,6))) : null}});
          if (delivery!=='IDLE') report({stage:'AVAILABILITY',delivery,subscriptionId:claimed.subscriptionId,offerId:claimed.offerId,attempts:claimed.attempts});
        }
      }
    }
  };
}
export function startAvailabilityNotifications(onError=()=>{}) {
  const onDeliveryIssue=issue=>console.warn(JSON.stringify({event:'availability_delivery_issue',...issue}));
  const service=createAvailabilityService({onDeliveryIssue}); let busy=false;
  const run=async()=>{if(busy)return;busy=true;try{await service.run();}catch{onError();}finally{busy=false;}};
  const timer=setInterval(run,30000);timer.unref();void run();return()=>clearInterval(timer);
}
