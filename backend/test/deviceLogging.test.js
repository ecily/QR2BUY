import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { createDeviceRouter } from '../src/routes/device.js';

test('actual production logger omits credential headers and device query strings, including error responses', async t => {
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  let captured = '';
  const stream = new Writable({ write(chunk, _encoding, done) { captured += chunk.toString(); done(); } });
  // Exercise the exact existing logger/serializer definitions without starting
  // index.js, loading .env, or connecting its production-default Mongo URI.
  const loggerSource = source.slice(source.indexOf('const logger = pino({'), source.indexOf('/*', source.indexOf('function sanitizeRequestUrl')));
  const { logger, sanitizeRequestUrl } = new Function('pino', 'LOG_LEVEL', `${loggerSource}\nreturn { logger, sanitizeRequestUrl };`)(options => pino(options, stream), 'info');
  const middlewareStart = source.indexOf('pinoHttp({');
  const middlewareEnd = source.indexOf('\n);', middlewareStart);
  const middleware = new Function('pinoHttp', 'logger', 'sanitizeRequestUrl', `return ${source.slice(middlewareStart, middlewareEnd)};`)(pinoHttp, logger, sanitizeRequestUrl);
  const secret = randomBytes(32).toString('hex');
  const authorization = 'Bearer TEST_ONLY_AUTHORIZATION';
  logger.info({ req: { rawHeaders: ['x-device-secret', secret], headers: { authorization, 'x-device-secret': secret, 'x-demo-pairing-secret': secret } },
    res: { req: { rawHeaders: ['x-device-secret', secret], headers: { 'x-device-secret': secret } } } });
  const app = express(); app.use(middleware);
  app.use(express.json());
  app.post('/api/binding/operator/devices/:deviceId/confirm', (_req,res) => res.status(400).json({ok:false,error:'incorrect_display_code'}));
  app.get('/synthetic-error', (_req, _res, next) => next(new Error(secret)));
  app.use('/api/device', createDeviceRouter({ config: async () => { throw new Error(secret); } }));
  const errorHandlerStart = source.indexOf('app.use((err, _req, res, _next) => {');
  const errorHandlerEnd = source.indexOf('\n});', errorHandlerStart) + 4;
  new Function('app', 'logger', source.slice(errorHandlerStart, errorHandlerEnd))(app, logger);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'x-device-id': 'QR2B-000001', 'x-device-secret': secret, 'x-device-credential-version': '1', authorization };
  const error = await fetch(`${origin}/api/device/config`, { headers });
  assert.equal(error.status, 503);
  assert.deepEqual(await error.json(), { ok: false, error: 'device_unavailable' });
  const query = await fetch(`${origin}/api/device/config?x-device-secret=${secret}`, { headers });
  assert.equal(query.status, 401); await query.text();
  const syntheticError = await fetch(origin + '/synthetic-error?token=' + secret);
  assert.equal(syntheticError.status, 500); await syntheticError.text();
  const binding = await fetch(`${origin}/api/binding/operator/devices/QR2B-000001/confirm?code=${secret}`, {
    method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ code: secret, previewId: secret })
  });
  assert.equal(binding.status,400);await binding.text();
  for (const path of ['/api/notify/offers/'+secret, '/notify/unsubscribe/'+secret, '/api/reservations/'+secret, '/api/merchant/reservations/'+secret+'/cancel', '/api/merchant/device-claims/'+secret+'/confirm']) {
    const r = await fetch(origin+path+'?buyerEmail='+secret, { method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({buyerName:secret,buyerEmail:secret,buyerPhone:secret,buyerNote:secret}) });
    await r.text();
  }
  for (const path of [
    '/api/MERCHANT/DEVICE-CLAIMS', '/API/merchant/device-claims/' + secret + '/confirm',
    '/%61pi/merchant/%64evice-claims/' + secret, '/%2561pi/merchant/device-claims/' + secret,
    '/api//merchant///device-claims/' + secret, '/api/binding/' + secret,
    '/api/device/' + secret, '/unknown/' + secret, '/api/merchant/device-claims%2f' + secret,
    '/api/merchant/device-claims%ZZ/' + secret, '/api/../' + secret,
    '//foreign.example/' + secret, '/api/demo/sessions/' + secret,
    '/api/notify/' + secret, '/health', '/unknown/' + [...secret].map(c => '%' + c.charCodeAt(0).toString(16)).join(''),
    '/api/merchant/device-claims%25252f' + secret, '/api\\merchant\\device-claims/' + secret
  ]) {
    const url = path + '?setupCode=' + secret + '&code=' + secret + '&token=' + secret;
    assert.ok(!sanitizeRequestUrl(url).includes(secret));
    assert.ok(!sanitizeRequestUrl(url).includes('?'));
    const response = await fetch(origin + url); await response.text();
  }
  assert.equal(sanitizeRequestUrl('/api/device/config?unexpected=' + secret), '/api/device/config');
  assert.equal(sanitizeRequestUrl('/health?token=' + secret), '/health');
  assert.equal(sanitizeRequestUrl('/api/purchases/'+secret+'?session='+secret), '/api/purchases/[REDACTED]');
  assert.equal(sanitizeRequestUrl('/buy/'+secret), '/api/purchases/[REDACTED]');
  assert.ok(captured.includes('/api/device/config'));
  assert.ok(!decodeURIComponent(captured).includes(secret));
  assert.ok(!captured.includes(secret)); assert.ok(!captured.includes(authorization));
  assert.ok(!captured.includes('?x-device-secret='));
  assert.ok(!captured.includes('?code='));
});
