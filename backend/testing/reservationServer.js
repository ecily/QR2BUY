// Isolated browser-test backend. Never imports the production entrypoint or .env.
import { reservationFixture } from './reservationFixture.js';
const fixture=await reservationFixture();
fixture.app.get('/__test__/health',(_req,res)=>res.json({ok:true}));
fixture.app.post('/__test__/offer',async(req,res)=>res.json(await fixture.offer(req.body)));
fixture.app.post('/__test__/advance',async(req,res)=>{await fixture.advance(31*60000);res.json({ok:true});});
const server=fixture.app.listen(3001,'127.0.0.1');
async function close(){server.close();await fixture.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
