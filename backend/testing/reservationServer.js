import { Offer } from '../src/merchant/models.js';
import { AvailabilitySubscription } from '../src/merchant/availabilitySubscriptions.js';
// Isolated browser-test backend. Never imports the production entrypoint or .env.
import { reservationFixture } from './reservationFixture.js';
const fixture=await reservationFixture();
fixture.app.get('/__test__/health',(_req,res)=>res.json({ok:true}));
fixture.app.post('/__test__/offer',async(req,res)=>res.json(await fixture.offer(req.body)));
fixture.app.post('/__test__/advance',async(req,res)=>{await fixture.advance(31*60000);res.json({ok:true});});
fixture.app.post('/__test__/notify/:id/available',async(req,res)=>{await Offer.updateOne({offerId:req.params.id},{$set:{active:true,stockQuantity:2}});await fixture.notify.run();res.json({ok:true});});
fixture.app.get('/__test__/notify/:id',async(req,res)=>{
  const items=await AvailabilitySubscription.find({offerId:req.params.id}).lean();
  const mails=fixture.messages.filter(m=>m.text.includes('/o/'+req.query.publicId));
  res.json({statuses:items.map(i=>i.status),mails:mails.length,
    confirmationLink:mails[0]?.text.match(/http:\/\/127\.0\.0\.1:5178\/notify\/unsubscribe\/[a-f0-9]{64}\?lang=(de|en)/)?.[0]});
});
const server=fixture.app.listen(3001,'127.0.0.1');
async function close(){server.close();await fixture.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
