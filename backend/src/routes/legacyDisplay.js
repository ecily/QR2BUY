// C:\ecily\ecily_landing\backend\src\routes\legacyDisplay.js
// Kompatibilitäts-Router für das bestehende Dashboard:
// - Fängt GET /api/config **ohne** deviceId ab (sonst next() → Firmware-Route).
// - Bietet POST /api/updateDisplay { text, url } und broadcastet Änderungen.

import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

/* ───────── Minimal-Model: DisplayState (Single-Doc) ───────── */
const DisplayStateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'current' },
    text: { type: String, default: 'Jetzt kaufen' },
    qr: { type: String, default: '' },
    version: { type: Number, default: 0 }
  },
  { timestamps: true }
);
const DisplayState =
  mongoose.models.DisplayState || mongoose.model('DisplayState', DisplayStateSchema);

/* GET /api/config
   - Wenn ?deviceId vorhanden → next() (Firmware-Route übernimmt).
   - Sonst: Legacy-State zurückgeben. */
router.get('/config', async (req, res, next) => {
  try {
    if (req.query.deviceId) return next();

    const doc =
      (await DisplayState.findById('current')) ||
      (await DisplayState.create({ _id: 'current' }));

    return res.json({
      ok: true,
      text: doc.text,
      qr: doc.qr || null,
      version: doc.version || 0,
      updatedAt: doc.updatedAt?.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/* POST /api/updateDisplay  { text, url }
   - Setzt Legacy-State, erhöht version und broadcastet. */
router.post('/updateDisplay', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    const url = String(req.body?.url || '').trim();

    if (!text) return res.status(400).json({ ok: false, error: 'text required' });
    if (!/^https?:\/\//i.test(url))
      return res.status(400).json({ ok: false, error: 'valid url (http/https) required' });

    const version = Date.now();

    const doc = await DisplayState.findByIdAndUpdate(
      'current',
      { $set: { text, qr: url, version } },
      { upsert: true, new: true }
    );

    // Broadcast über app.locals.broadcast (vom Server gesetzt)
    try {
      const broadcast = req.app?.locals?.broadcast;
      if (typeof broadcast === 'function') {
        broadcast('update', {
          text: doc.text,
          qr: doc.qr,
          version: doc.version,
          updatedAt: doc.updatedAt?.toISOString()
        });
        broadcast('version', {
          version: doc.version,
          updatedAt: doc.updatedAt?.toISOString()
        });
      }
    } catch {
      /* ignore broadcast errors */
    }

    return res.json({
      ok: true,
      text: doc.text,
      qr: doc.qr,
      version: doc.version,
      updatedAt: doc.updatedAt?.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;
