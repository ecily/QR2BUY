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
  app.use('/api/device', createDeviceRouter({ config: async () => { throw new Error(secret); } }));
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
  const binding = await fetch(`${origin}/api/binding/operator/devices/QR2B-000001/confirm?code=${secret}`, {
    method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ code: secret, previewId: secret })
  });
  assert.equal(binding.status,400);await binding.text();
  assert.ok(captured.includes('/api/device/config'));
  assert.ok(!captured.includes(secret)); assert.ok(!captured.includes(authorization));
  assert.ok(!captured.includes('?x-device-secret='));
  assert.ok(!captured.includes('?code='));
});
