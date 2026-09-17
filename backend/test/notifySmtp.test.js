import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import tls from 'node:tls';
import { createDemoMailTransport } from '../src/demo/mail.js';

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
