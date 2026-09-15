import { Router } from 'express';
import { ZodError } from 'zod';
import { createAvailabilityService } from '../merchant/availabilitySubscriptions.js';
import { DeviceApiError } from '../merchant/deviceCredentials.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

export function createAvailabilityRouter({service=createAvailabilityService(),origin=process.env.PUBLIC_BASE_URL,limit=10}={}) {
  const router=Router();
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');next();});
  router.use(createRateLimiter({windowMs:600000,max:limit}));
  router.use((req,res,next)=>{
    if(Object.keys(req.query).length || !origin || req.get('origin')!==origin || !req.is('application/json'))
      return res.status(403).json({ok:false,error:'request_rejected'});
    next();
  });
  router.post('/offers/:id',async(req,res,next)=>{try{res.json(await service.subscribe(req.params.id,req.body));}catch(e){next(e);}});
  router.post('/unsubscribe',async(req,res,next)=>{try{
    if(!req.body || typeof req.body.token!=='string' || Object.keys(req.body).length!==1) return res.status(400).json({ok:false,error:'invalid_input'});
    res.json(await service.unsubscribe(req.body.token));
  }catch(e){next(e);}});
  router.use((e,_req,res,_next)=>res.status(e instanceof DeviceApiError?e.status:e instanceof ZodError?400:503)
    .json({ok:false,error:e instanceof DeviceApiError?e.code:e instanceof ZodError?'invalid_input':'notify_unavailable'}));
  return router;
}
