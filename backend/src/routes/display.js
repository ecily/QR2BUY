import { Router } from 'express';
import { DisplayState } from '../mongo.js';
import { updateSchema } from '../validators.js';
import { broadcastUpdate, broadcastVersion } from '../events.js';

const router = Router();

/**
 * GET /config
 * Für den ESP32: gibt den aktuellen Zustand zurück
 */
router.get('/config', async (_req, res) => {
  const doc =
    (await DisplayState.findById('current').lean()) ||
    (await DisplayState.create({ _id: 'current' }));
  res.json({
    text: doc.text,
    qr: doc.qr,
    version: doc.version,
    updatedAt: doc.updatedAt
  });
});

/**
 * POST /updateDisplay
 * Body: { text, url }
 * Speichert neuen Zustand; triggert Events (SSE + WS)
 */
router.post('/updateDisplay', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.errors });
  }

  const { text, url } = parsed.data;

  const updated = await DisplayState.findByIdAndUpdate(
    'current',
    { $set: { text, qr: url }, $inc: { version: 1 } },
    { new: true, upsert: true }
  ).lean();

  const payload = {
    text: updated.text,
    qr: updated.qr,
    version: updated.version,
    updatedAt: updated.updatedAt
  };

  // Push an alle Live-Clients
  broadcastUpdate(payload);
  broadcastVersion({ version: updated.version });

  return res.json({ ok: true, ...payload });
});

export default router;
