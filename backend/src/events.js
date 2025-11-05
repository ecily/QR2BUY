// C:\QR\backend\src\events.js
import { WebSocketServer } from 'ws';

/**
 * Robust SSE + WS utilities for qr2buy
 * - GET /api/events should call `registerSSE(res)`  (or use exported `sseHandler(req,res)`)
 * - WebSocket server is attached via `attachWebSocket(httpServer)` on path "/ws"
 * - Broadcast helpers: `sseBroadcast`, `wsBroadcast`, `broadcastUpdate`, `broadcastVersion`
 */

// ─────────────────────────────────────────────
// SSE: Client-Registry + Heartbeat + Event IDs
// ─────────────────────────────────────────────
const sseClients = new Set();            // stores `res`
const heartbeats = new Map();            // res -> intervalId
let sseEventId = 1;

/** Ensure correct headers and a non-buffered, long-lived connection. */
function ensureSseHeaders(res) {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Disable proxy buffering (NGINX, etc.)
    res.setHeader('X-Accel-Buffering', 'no');
    // Helpful for some CDNs/proxies
    res.setHeader('Transfer-Encoding', 'chunked');
    // CORS if needed (safe default; your router/middleware may already do this)
    if (!res.getHeader('Access-Control-Allow-Origin')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    // Flush headers now
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
  }
  // Keep socket alive indefinitely
  if (res.socket?.setTimeout) res.socket.setTimeout(0);
  if (res.socket?.setKeepAlive) res.socket.setKeepAlive(true, 60_000);
}

/** Low-level writer. Includes event id + client reconnection hint (retry). */
function writeSSE(res, event, payload, id = null) {
  try {
    // comment prelude keeps some proxies/CDNs happy
    res.write(`: keep-alive\n`);
    if (id !== null) res.write(`id: ${id}\n`);
    // client-side reconnect backoff hint (ms)
    res.write(`retry: 5000\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    // attempt to flush if compression/flush is present
    if (typeof res.flush === 'function') res.flush();
  } catch {
    // ignore broken pipe etc.
  }
}

/**
 * Register an SSE client on an Express response.
 * Usage in your router:
 *   app.get('/api/events', (req, res) => registerSSE(res));
 */
export function registerSSE(res) {
  ensureSseHeaders(res);
  sseClients.add(res);

  // initial hello
  writeSSE(res, 'ready', { ok: true, ts: Date.now() }, sseEventId++);

  // heartbeat: send minimal noise but keep connection warm
  const hb = setInterval(() => {
    // comment ping to keep intermediaries from buffering/closing
    try { res.write(`: ping ${Date.now()}\n\n`); if (typeof res.flush === 'function') res.flush(); } catch {}
  }, 15_000);
  heartbeats.set(res, hb);

  const clean = () => {
    const t = heartbeats.get(res);
    if (t) clearInterval(t);
    heartbeats.delete(res);
    sseClients.delete(res);
    try { res.end(); } catch {}
  };

  // cleanup on client disconnect
  res.on('close', clean);
  res.on('finish', clean);
  res.on('error', clean);
}

/**
 * Optional convenience handler if you want to mount directly:
 *   app.get('/api/events', sseHandler)
 */
export function sseHandler(req, res) {
  // If you want to use Last-Event-ID, you can read it from:
  // const lastId = req.headers['last-event-id'];
  registerSSE(res);
}

/** Broadcast an event to all SSE clients. */
export function sseBroadcast(event, payload) {
  const id = sseEventId++;
  for (const res of sseClients) writeSSE(res, event, payload, id);
}

// ─────────────────────────────────────────────
// WebSocket mit Heartbeat (ping/pong)
// ─────────────────────────────────────────────
let wss = null;
const wsHeartbeat = new WeakMap(); // socket -> lastPongTs

export function attachWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    wsHeartbeat.set(socket, Date.now());

    // initial ready
    try {
      socket.send(JSON.stringify({ type: 'ready', ts: Date.now() }));
    } catch {}

    // update last pong when client responds
    socket.on('pong', () => wsHeartbeat.set(socket, Date.now()));

    socket.on('close', () => {
      wsHeartbeat.delete(socket);
    });

    socket.on('error', () => {
      try { socket.terminate(); } catch {}
      wsHeartbeat.delete(socket);
    });
  });

  // Server-Ping alle 20s; terminate bei ausbleibendem pong > 45s
  setInterval(() => {
    if (!wss) return;
    const now = Date.now();
    for (const client of wss.clients) {
      try {
        if (client.readyState === 1 /* OPEN */) {
          const last = wsHeartbeat.get(client) || 0;
          if (now - last > 45_000) {
            client.terminate();
            wsHeartbeat.delete(client);
          } else {
            client.ping();
          }
        }
      } catch {
        // ignore; move on
      }
    }
  }, 20_000);
}

export function wsBroadcast(type, payload) {
  if (!wss) return;
  const data = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    try {
      if (client.readyState === 1 /* OPEN */) client.send(data);
    } catch {
      // ignore
    }
  }
}

// ─────────────────────────────────────────────
// Kombinierte Broadcasts
// ─────────────────────────────────────────────
export function broadcastUpdate(payload) {
  sseBroadcast('update', payload);
  wsBroadcast('update', payload);
}

export function broadcastVersion(payload) {
  sseBroadcast('version', payload);
  wsBroadcast('version', payload);
}
