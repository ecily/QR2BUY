// C:\QR\frontend\src\pages\MockDisplay.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { ENDPOINTS } from '../config.js';

/**
 * Mock-Display für: Hailege 2.4" ILI9341 (240x320, Portrait)
 * - Pollt /api/config?deviceId=...
 * - Zeigt Text + QR wie auf der Hardware
 * - Bei status=SOLD: “VERKAUFT!” und QR ausgeblendet
 *
 * Route: /mock/:deviceId
 * Beispiel: /mock/ESP32-DEMO-001?scale=3
 *
 * Zusätzlich einbettbar per Props:
 *   <MockDisplay deviceId="ESP32-DEMO-001" scale={2} poll={1000} hideChrome />
 *
 * Feintuning via Query:
 *   ?scale=3            // UI-Skalierung
 *   &poll=1200          // Poll-Intervall (ms)
 *   &qr=112             // QR-Größe in LOGISCHEN px (ohne scale), Override
 *   &textcol=92         // Textspaltenbreite in LOGISCHEN px, Override
 */
export default function MockDisplay({
  deviceId: deviceIdProp,
  scale: scaleProp,
  poll: pollProp,
  hideChrome = false,
}) {
  const params = useParams();
  const [search] = useSearchParams();

  // Priorität: Prop > Query > Default
  const deviceId = deviceIdProp ?? params.deviceId ?? '';
  const scale = Math.max(1, Number(scaleProp ?? search.get('scale')) || 2);
  const pollMs = Math.max(700, Number(pollProp ?? search.get('poll')) || 1500);

  // TFT Logik-Abmessungen (unskaliert)
  const TFT_W = 240;
  const TFT_H = 320;

  // Innenabstände (logisch)
  const INSET = 8;
  const PAD = 6;
  const GRID_GAP = 8;

  // Optionales Tuning
  const TEXT_COL = Math.max(70, Math.min(130, Number(search.get('textcol')) || 92));

  // Daten vom Backend
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState('');
  const [lastAt, setLastAt] = useState(null);
  const abortRef = useRef(null);

  const status = (cfg?.status || '').toUpperCase();
  const isSold = status === 'SOLD' || status === 'VERKAUFT';

  const lines = useMemo(() => {
    const t = (cfg?.text ?? '').toString();
    return t.split(/\r?\n/).slice(0, 10);
  }, [cfg?.text]);

  useEffect(() => {
    if (!deviceId) return;
    let timer;
    const fetchOnce = async () => {
      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        const res = await fetch(ENDPOINTS.config(deviceId), { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        setCfg(json);
        setErr('');
        setLastAt(new Date());
      } catch (e) {
        setErr(String(e?.message || e));
      }
    };

    fetchOnce();
    timer = setInterval(fetchOnce, pollMs);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [deviceId, pollMs]);

  // Verfügbare Inhaltsbreite (logisch, unskaliert)
  const CONTENT_W = TFT_W - INSET * 2 - PAD * 2; // 240 - 16 - 12 = 212
  // QR-Box innerhalb CONTENT_W: QR = CONTENT_W - TEXT_COL - GAP
  const QR_LOGICAL_DEFAULT = Math.max(84, Math.min(140, CONTENT_W - TEXT_COL - GRID_GAP)); // ~112
  const QR_LOGICAL = Math.max(64, Math.min(160, Number(search.get('qr')) || QR_LOGICAL_DEFAULT));
  const QR_BOX = QR_LOGICAL; // Boxgröße (logisch)
  const QR_INNER = Math.floor(QR_BOX * 0.92); // kleine Innenmarge

  // Stile (skaliert)
  const displayStyle = {
    width: TFT_W * scale,
    height: TFT_H * scale,
    background: '#000',
    color: '#fff',
    borderRadius: 12 * scale,
    boxShadow: `0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.35)`,
    border: `${2 * scale}px solid #222`,
    position: 'relative',
    overflow: 'hidden',
    imageRendering: 'pixelated',
  };

  const bezelStyle = {
    position: 'absolute',
    inset: 0,
    padding: 8 * scale,
    background:
      'radial-gradient(120% 100% at 50% -10%, rgba(255,255,255,0.06), rgba(0,0,0,0.3))',
  };

  const glassStyle = {
    position: 'absolute',
    inset: 8 * scale,
    borderRadius: 8 * scale,
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.0))',
    boxShadow: `inset 0 0 ${12 * scale}px rgba(255,255,255,0.06)`,
  };

  const innerStyle = {
    position: 'absolute',
    top: INSET * scale,
    bottom: INSET * scale,
    left: INSET * scale,
    right: INSET * scale,
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    padding: `${PAD * scale}px`,
    gap: `${6 * scale}px`,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: 1.1,
  };

  const headerStyle = {
    fontSize: `${10 * scale}px`,
    letterSpacing: '0.5px',
    color: '#9bb0ff',
    opacity: 0.9,
  };

  const textAreaStyle = {
    display: 'grid',
    alignContent: 'start',
    gap: `${2 * scale}px`,
    fontSize: `${12 * scale}px`,
    whiteSpace: 'pre',
    wordBreak: 'break-word',
    maxWidth: `${TEXT_COL * scale}px`,
  };

  const footerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: `${6 * scale}px`,
  };

  const qrBoxStyle = {
    width: QR_BOX * scale,
    height: QR_BOX * scale,
    background: '#111',
    borderRadius: `${4 * scale}px`,
    display: 'grid',
    placeItems: 'center',
    border: `${1 * scale}px solid #222`,
  };

  const soldOverlayStyle = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontWeight: 800,
    fontSize: `${28 * scale}px`,
    letterSpacing: `${1.5 * scale}px`,
    textTransform: 'uppercase',
  };

  return (
    <div style={{ padding: hideChrome ? 0 : 16, display: 'grid', gap: 16 }}>
      {!hideChrome && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <strong>Mock ILI9341 (240×320)</strong>
          <span>
            Device: <code>{deviceId || '—'}</code>
          </span>
          <span>
            Poll: <code>{pollMs}ms</code>
          </span>
          <span>
            Scale: <code>{scale}×</code>
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 8,
              background: err ? '#7a1b1b' : '#16361f',
              color: err ? '#ffd8d8' : '#b6f3cf',
            }}
            title={err || 'OK'}
          >
            {err ? 'Error' : 'OK'}
          </span>
          <span style={{ opacity: 0.7 }}>
            {lastAt ? `Letztes Update: ${lastAt.toLocaleTimeString()}` : 'Warte auf Daten…'}
          </span>
          <Link to="/mock/ESP32-DEMO-001" style={{ marginLeft: 'auto' }}>
            Seed öffnen
          </Link>
        </div>
      )}

      {/* Display-Rahmen */}
      <div style={displayStyle} aria-label="ILI9341 Mock Display">
        <div style={bezelStyle} />
        <div style={glassStyle} />
        <div style={innerStyle}>
          {/* Header */}
          <div style={headerStyle}>
            qr2buy · v{cfg?.version ?? '—'} ·{' '}
            <span style={{ color: isSold ? '#ffb3b3' : '#8ff0c8' }}>
              {isSold ? 'SOLD' : (status || 'AVAILABLE')}
            </span>
          </div>

          {/* Content */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${TEXT_COL * scale}px ${GRID_GAP * scale}px ${QR_BOX * scale}px`,
              alignItems: 'start',
            }}
          >
            {/* Text */}
            <div style={textAreaStyle} aria-live="polite">
              {lines.length ? (
                lines.map((ln, i) => (
                  <div key={i} style={{ opacity: 0.95 }}>
                    {ln}
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.5 }}>Warte auf Backend…</div>
              )}
            </div>

            {/* Gap */}
            <div />

            {/* QR-Box */}
            <div style={qrBoxStyle} aria-hidden={isSold}>
              {!isSold && cfg?.qr ? (
                <QRCode
                  value={String(cfg.qr)}
                  size={QR_INNER * scale}
                  style={{ width: 'auto', height: 'auto' }}
                  viewBox="0 0 256 256"
                  level="M"
                  bgColor="#111"
                  fgColor="#fff"
                />
              ) : (
                !isSold && <div style={{ opacity: 0.5, fontSize: `${10 * scale}px` }}>kein QR</div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            <div
              style={{
                height: `${8 * scale}px`,
                width: `${8 * scale}px`,
                borderRadius: '50%',
                background: err ? '#ff5252' : '#2f8f6b',
                boxShadow: `0 0 ${6 * scale}px ${err ? '#ff5252' : '#2f8f6b'}`,
              }}
              title={err ? `Fehler: ${err}` : 'Verbunden'}
            />
            <div style={{ fontSize: `${9 * scale}px`, opacity: 0.7 }}>
              {cfg?.updatedAt ? `updated ${new Date(cfg.updatedAt).toLocaleTimeString()}` : ''}
            </div>
            <div style={{ fontSize: `${9 * scale}px`, opacity: 0.6, marginLeft: 'auto' }}>
              Brand: <span style={{ color: '#3b5ccc' }}>#3b5ccc</span> /{' '}
              <span style={{ color: '#2f8f6b' }}>#2f8f6b</span>
            </div>
          </div>
        </div>

        {/* SOLD Overlay */}
        {isSold && <div style={soldOverlayStyle}>VERKAUFT!</div>}
      </div>

      {!hideChrome && (
        <small style={{ fontFamily: 'system-ui, sans-serif', opacity: 0.7 }}>
          Tipps: `?scale=3` größer, `&poll=1000` schneller, `&qr=112` QR-Größe.
        </small>
      )}
    </div>
  );
}
