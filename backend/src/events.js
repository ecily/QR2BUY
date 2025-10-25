import { WebSocketServer } from 'ws';

// ─────────────────────────────────────────────
// SSE: Client-Registry + Heartbeat + Event IDs
// ─────────────────────────────────────────────
const sseClients = new Set();
const heartbeats = new Map();
let sseEventId = 1;

function writeSSE(res, event, payload, id = null) {
  try {
    if (id !== null) res.write(`id: ${id}\n`);
    // Client-seitiges Reconnect-Intervall (ms)
    res.write(`retry: 5000\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {}
}

export function registerSSE(res) {
  sseClients.add(res);

  // initial: ready + ping-heartbeat
  writeSSE(res, 'ready', { ok: true, ts: Date.now() }, sseEventId++);
  const ping = setInterval(() => {
    writeSSE(res, 'ping', Date.now());
  }, 15000);
  heartbeats.set(res, ping);

  res.on('close', () => {
    clearInterval(heartbeats.get(res));
    heartbeats.delete(res);
    sseClients.delete(res);
  });
}

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
    try {
      socket.send(JSON.stringify({ type: 'ready', ts: Date.now() }));
    } catch {}

    socket.on('pong', () => wsHeartbeat.set(socket, Date.now()));
  });

  // Server-Ping alle 20s; terminate bei ausbleibendem pong
  setInterval(() => {
    if (!wss) return;
    const now = Date.now();
    for (const client of wss.clients) {
      try {
        if (client.readyState === 1) {
          const last = wsHeartbeat.get(client) || 0;
          if (now - last > 45000) {
            client.terminate();
          } else {
            client.ping();
          }
        }
      } catch {}
    }
  }, 20000);
}

export function wsBroadcast(type, payload) {
  if (!wss) return;
  const data = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    try {
      if (client.readyState === 1) client.send(data);
    } catch {}
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
