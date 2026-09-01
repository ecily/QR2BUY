const clientsBySession = new Map();

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function registerDemoSse(tokenHash, res, initialSnapshot) {
  let clients = clientsBySession.get(tokenHash);
  if (!clients) {
    clients = new Set();
    clientsBySession.set(tokenHash, clients);
  }
  clients.add(res);
  writeEvent(res, 'snapshot', initialSnapshot);

  const heartbeat = setInterval(() => res.write(': demo-ping\n\n'), 20_000);
  res.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    if (clients.size === 0) clientsBySession.delete(tokenHash);
  });
}

export function broadcastDemoSnapshot(tokenHash, snapshot) {
  const clients = clientsBySession.get(tokenHash);
  if (!clients) return;
  for (const res of clients) {
    try {
      writeEvent(res, 'snapshot', snapshot);
    } catch {
      // The close handler removes disconnected clients.
    }
  }
}
