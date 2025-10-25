// C:\QR\backend\src\index.js
// Robust: Health immer 200, Mongo verbindet mit Retry (kein process.exit bei Fehlern)
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pino from 'pino';
import pinoHttp from 'pino-http';
import 'express-async-errors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';

/* Routers */
import legacyDisplayRouter from './routes/legacyDisplay.js';
import configRouter from './routes/config.js';
import adminRouter from './routes/admin.js';
import checkoutRouter from './routes/checkout.js';
import stripeWebhookRouter from './routes/stripeWebhook.js';
import publicRouter from './routes/public.js';

dotenv.config();

/* ───────────────── Env & Config ───────────────── */
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const MONGO_URL = process.env.MONGO_URL || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const SKIP_DB = process.env.SKIP_DB === '1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ───────────────── Logger ───────────────── */
const logger = pino({ level: LOG_LEVEL, base: { service: 'qr2buy_api' } });

/* ───────────────── App & Middleware ───────────────── */
const app = express();
app.set('trust proxy', 1);

/* HTTP Logger */
app.use(
  pinoHttp({
    logger,
    customLogLevel: (res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    }
  })
);

/* Security & CORS */
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

/* Stripe raw body (MUSS vor JSON-Parser stehen) */
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

/* JSON body (alle anderen Routen) */
app.use(express.json({ limit: '1mb' }));

/* ───────────────── MongoDB (non-fatal connect + retry) ───────────────── */
const dbState = {
  want: !SKIP_DB && !!MONGO_URL,
  connected: false,
  lastError: null,
  lastConnectedAt: null
};

function scheduleRetry(ms) {
  logger.warn({ msg: `[db] retry in ${ms} ms` });
  setTimeout(connectMongo, ms).unref();
}

async function connectMongo() {
  if (!dbState.want) {
    logger.warn({ msg: '[db] skipping connect (SKIP_DB=1 oder MONGO_URL leer)' });
    return;
  }
  try {
    await mongoose.connect(MONGO_URL);
    dbState.connected = true;
    dbState.lastError = null;
    dbState.lastConnectedAt = new Date().toISOString();
    logger.info({ msg: '[db] connected' });
  } catch (err) {
    dbState.connected = false;
    dbState.lastError = err?.message || String(err);
    logger.error({ msg: '[db] connection error', err: dbState.lastError });
    scheduleRetry(5000);
  }
}

mongoose.connection.on('disconnected', () => {
  if (!dbState.want) return;
  dbState.connected = false;
  logger.warn({ msg: '[db] disconnected' });
  scheduleRetry(3000);
});

connectMongo();

/* ───────────────── SSE (Server-Sent Events) ───────────────── */
const sseClients = new Set();

function sseBroadcast(event, data) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      // drop quietly
    }
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);
  sseClients.add(res);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

/* ───────────────── Health ───────────────── */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'qr2buy_api',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    db: {
      want: dbState.want,
      connected: dbState.connected,
      lastError: dbState.lastError,
      lastConnectedAt: dbState.lastConnectedAt
    }
  });
});

/* ───────────────── API Mounts (Reihenfolge wichtig) ───────────────── */
/* 1) Legacy vor Firmware, damit GET /api/config ohne deviceId abgefangen wird */
app.use('/api', legacyDisplayRouter);

/* 2) Buyer/Public + Admin + Checkout + Webhook + Firmware */
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/stripe', stripeWebhookRouter);
app.use('/api', configRouter); // enthält GET /config?deviceId=...

/* 404 */
app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not Found' }));

/* Error Handler */
app.use((err, _req, res, _next) => {
  logger.error({ msg: '[http] unhandled', err: err.message, stack: err.stack });
  res.status(500).json({ ok: false, error: 'Internal Server Error' });
});

/* ───────────────── HTTP Server & WS ───────────────── */
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();

function wsBroadcast(type, data) {
  const payload = JSON.stringify({ type, data });
  for (const ws of wsClients) {
    if (ws.readyState === 1) {
      try {
        ws.send(payload);
      } catch {
        // drop silently
      }
    }
  }
}

/* Gemeinsamer Broadcaster (SSE + WS) */
function broadcast(type, data) {
  sseBroadcast(type, data);
  wsBroadcast(type, data);
}

/* Für Router verfügbar machen (legacyDisplay nutzt req.app.locals.broadcast) */
app.locals.broadcast = broadcast;

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'hello', data: { ok: true, ts: Date.now() } }));
  ws.on('close', () => wsClients.delete(ws));
});

/* ───────────────── Static (Prod) ───────────────── */
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

/* ───────────────── Server Tunings ───────────────── */
server.keepAliveTimeout = 70_000;
server.headersTimeout = 75_000;
server.requestTimeout = 60_000;

/* ───────────────── Start ───────────────── */
server.listen(PORT, HOST, () => {
  logger.info({ msg: '[api] listening', url: `http://${HOST}:${PORT}` });
});

/* ───────────────── Process Safety ───────────────── */
process.on('unhandledRejection', (err) => {
  logger.error({ msg: '[node] unhandledRejection', err: String(err) });
});
process.on('uncaughtException', (err) => {
  logger.error({ msg: '[node] uncaughtException', err: err.message, stack: err.stack });
});
