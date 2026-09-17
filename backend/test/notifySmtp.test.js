import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import tls from 'node:tls';
import { createDemoMailTransport } from '../src/demo/mail.js';
import { createAvailabilityMailTransport } from '../src/merchant/availabilityMail.js';

// In-process socket only: no DNS, network, credentials or real SMTP delivery.
for (const outcome of ['accepted','rejected','closed','timeout','pre-data-rejected']) {
  test(`notify SMTP classifies ${outcome}`, async t=>{
    let bodyWritten=false;
    const socket=new EventEmitter();
    socket.setTimeout=()=>{};
    socket.destroy=()=>{};
    socket.write=value=>{
      if(value==='QUIT\r\n')return;
      const body=!/^(EHLO|AUTH|MAIL FROM:|RCPT TO:|DATA)/.test(value);
      if(body)bodyWritten=true;
      setImmediate(()=>{
        if(body && outcome==='closed')return socket.emit('close');
        if(body && outcome==='timeout')return socket.emit('timeout');
        const rejection=(body && outcome==='rejected') || (value.startsWith('RCPT') && outcome==='pre-data-rejected');
        socket.emit('data',Buffer.from(rejection?'550 refused\r\n':value==='DATA\r\n'?'354 continue\r\n':'250 OK\r\n'));
      });
    };
    t.mock.method(tls,'connect',options=>{
      assert.equal(options.rejectUnauthorized,true);
      setImmediate(()=>{socket.emit('secureConnect');socket.emit('data',Buffer.from('220 test\r\n'));});
      return socket;
    });
    const transport=createDemoMailTransport({DEMO_MAIL_TRANSPORT:'smtp',DEMO_SMTP_FROM:'sender@example.test',
      DEMO_SMTP_HOST:'smtp.example.test',DEMO_SMTP_USER:'test-user',DEMO_SMTP_PASS:'test-only',DEMO_SMTP_HELO_NAME:'example.test'});
    const send=transport.send({to:'reader@example.test',subject:'Test',text:'Service test',html:'<p>Service test</p>'});
    if(outcome==='accepted')assert.equal((await send).accepted,true);
    else await assert.rejects(send,e=>e.retrySafe===['rejected','pre-data-rejected'].includes(outcome));
    assert.equal(bodyWritten,outcome!=='pre-data-rejected');
  });
}

const graphEnv={DEMO_MAIL_TRANSPORT:'microsoft',MAIL_FROM:'sender@example.test',
  MICROSOFT_TENANT_ID:'tenant-test',MICROSOFT_CLIENT_ID:'client-test',MICROSOFT_CLIENT_SECRET:'secret-test',
  MICROSOFT_GRAPH_TIMEOUT_MS:'1000'};
const response=(status,body)=>new Response(body===undefined?'':JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('notify Graph is explicit, fail-closed and uses the established Microsoft environment',async()=>{
  let calls=0;
  const fetchImpl=async(url,options)=>{
    calls++;
    if(calls===1){
      assert.match(url,/login\.microsoftonline\.com\/tenant-test\/oauth2\/v2\.0\/token$/);
      assert.match(String(options.body),/grant_type=client_credentials/);
      assert.match(String(options.body),/scope=https%3A%2F%2Fgraph.microsoft.com%2F.default/);
      return response(200,{access_token:'test-access-token'});
    }
    assert.match(url,/graph\.microsoft\.com\/v1\.0\/users\/sender%40example\.test\/sendMail$/);
    assert.equal(options.headers.authorization,'Bearer test-access-token');
    const mime=Buffer.from(options.body,'base64').toString('utf8');
    assert.match(mime,/From: qr2buy <sender@example\.test>/);
    assert.match(mime,/To: reader@example\.test/);
    assert.match(mime,new RegExp(Buffer.from('Service test').toString('base64')));
    return response(202);
  };
  assert.equal(createDemoMailTransport({...graphEnv,DEMO_MAIL_TRANSPORT:'disabled'},'qr2buy',{fetchImpl}).configured,false);
  assert.equal(createDemoMailTransport({...graphEnv,MICROSOFT_CLIENT_SECRET:''},'qr2buy',{fetchImpl}).configured,false);
  const transport=createDemoMailTransport(graphEnv,'qr2buy',{fetchImpl});
  assert.equal(transport.configured,true);
  assert.deepEqual(await transport.send({to:'reader@example.test',subject:'Graph test',text:'Service test',html:'<p>Service test</p>'}),
    {accepted:true,status:'ACCEPTED'});
  assert.equal(calls,2);
});

test('notify Graph classifies pre-send failures as retry-safe and ambiguous send as uncertain',async()=>{
  for(const outcome of ['token-network','token-rejected','mail-rejected','mail-network']){
    let calls=0;
    const fetchImpl=async()=>{
      calls++;
      if(outcome==='token-network')throw new Error('private network detail');
      if(outcome==='token-rejected')return response(401,{error:'invalid_client',error_description:'private detail'});
      if(calls===1)return response(200,{access_token:'test-access-token'});
      if(outcome==='mail-network')throw new Error('private network detail');
      return response(403,{error:{message:'private detail'}});
    };
    const transport=createDemoMailTransport(graphEnv,'qr2buy',{fetchImpl});
    await assert.rejects(transport.send({to:'reader@example.test',subject:'Test',text:'Test',html:'<p>Test</p>'}),
      error=>error.retrySafe===(outcome!=='mail-network') && !String(error).includes('private detail'));
    assert.equal(calls,outcome.startsWith('token-')?1:2);
  }
});

test('Notify requires both its enable flag and the explicit Microsoft provider',()=>{
  const base={...graphEnv,DEMO_MAIL_TRANSPORT:undefined};
  assert.equal(createAvailabilityMailTransport({...base,MAIL_PROVIDER:'microsoft'}).configured,false);
  assert.equal(createAvailabilityMailTransport({...base,NOTIFY_MAIL_ENABLED:'true'}).configured,false);
  assert.equal(createAvailabilityMailTransport({...base,NOTIFY_MAIL_ENABLED:'true',MAIL_PROVIDER:'microsoft'}).configured,true);
});
