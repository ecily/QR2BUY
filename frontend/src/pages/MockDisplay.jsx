// C:\QR\frontend\src\pages\MockDisplay.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { ENDPOINTS } from '../config.js';

/**
 * Mock-Display für: Hailege 2.4" ILI9341 (240x320, Portrait)
 * - Pollt /api/config?deviceId=...
 * - Zeigt Text + QR wie auf der Hardware
 * - SOLD: Vollbild-"VERKAUFT!"-Screen (Content wird NICHT gerendert)
 * - RESERVED: Keine QR-Render, gelber Hinweis mit Countdown mm:ss
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
  const isReserved = status === 'RESERVED';
  const reservedUntil = useMemo(
    () => (cfg?.reservedUntil ? new Date(cfg.reservedUntil) : null),
    [cfg?.reservedUntil]
  );

  // Countdown mm:ss bis reservedUntil
  const [remainMs, setRemainMs] = useState(0);
  useEffect(() => {
    const compute = () =>
      reservedUntil ? Math.max(0, reservedUntil.getTime() - Date.now()) : 0;
    setRemainMs(compute());
    if (!reservedUntil) return;
    const t = setInterval(() => setRemainMs(compute()), 1000);
    return () => clearInterval(t);
  }, [reservedUntil]);

  const mmss = useMemo(() => {
    const s = Math.floor(remainMs / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }, [remainMs]);

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

  const statusChipStyle = (tone) => ({
    display: 'inline-block',
    padding: `${1.5 * scale}px ${6 * scale}px`,
    borderRadius: 999,
    fontSize: `${9 * scale}px`,
    fontWeight: 700,
    letterSpacing: 0.4,
    background:
      tone === 'sold'
        ? '#7f1d1d'
        : tone === 'res'
        ? '#78350f'
        : '#0f5132',
    color:
      tone === 'sold'
        ? '#ffd0d0'
        : tone === 'res'
        ? '#ffe8b3'
        : '#b6f3cf',
    border:
      tone === 'sold'
        ? `${1 * scale}px solid #944`
        : tone === 'res'
        ? `${1 * scale}px solid #b45309`
        : `${1 * scale}px solid #1b7a56`,
  });

  const textAreaStyle = {
    display: 'grid',
    alignContent: 'start',
    gap: `${2 * scale}px`,
    fontSize: `${12 * scale}px`,
    whiteSpace: 'pre',
    wordBreak: 'break-word',
    maxWidth: `${TEXT_COL * scale}px`,
    opacity: isReserved ? 0.9 : 1,
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
    position: 'relative',
  };

  const reservedPanelStyle = {
    width: Math.floor(QR_BOX * scale),
    height: Math.floor(QR_BOX * scale),
    display: 'grid',
    placeItems: 'center',
    borderRadius: `${4 * scale}px`,
    background:
      'linear-gradient(180deg, rgba(254,240,138,0.95), rgba(250,204,21,0.95))',
    color: '#3f2d0c',
    border: `${1 * scale}px solid #b45309`,
    boxShadow: `0 ${2 * scale}px ${8 * scale}px rgba(255,200,0,0.25)`,
    textAlign: 'center',
    animation: `reserved-pulse 1600ms ease-in-out infinite`,
    padding: `${6 * scale}px`,
  };

  const soldOverlayStyle = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(180deg, rgba(0,0,0,1), rgba(0,0,0,1))',
    color: '#fff',
    textAlign: 'center',
    padding: `${12 * scale}px`,
  };

  const soldBoxStyle = {
    display: 'grid',
    gap: `${8 * scale}px`,
    placeItems: 'center',
    transform: 'translateY(0)',
    animation: `sold-in 300ms ease-out`,
  };

  const soldHeadlineStyle = {
    fontWeight: 900,
    fontSize: `${28 * scale}px`,
    letterSpacing: `${1.5 * scale}px`,
    textTransform: 'uppercase',
  };

  const soldSubStyle = {
    fontSize: `${11 * scale}px`,
    opacity: 0.85,
  };

  // Inline Keyframes (einmalig)
  useEffect(() => {
    const id = 'qr2buy-anim-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
      @keyframes sold-in {
        0% { opacity: 0; transform: translateY(${6 * scale}px) scale(0.985); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes reserved-pulse {
        0%   { transform: scale(1); }
        50%  { transform: scale(1.015); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }, [scale]);

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

        {/* Inhalt NUR rendern, wenn NICHT SOLD */}
        {!isSold && (
          <div style={innerStyle}>
            {/* Header */}
            <div style={headerStyle}>
              qr2buy · v{cfg?.version ?? '—'} ·{' '}
              <span
                style={
                  isReserved
                    ? statusChipStyle('res')
                    : statusChipStyle('ok')
                }
              >
                {isReserved ? 'RESERVIERT' : (status || 'AVAILABLE')}
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
              <div style={qrBoxStyle} aria-live="polite" aria-atomic="true">
                {/* RESERVED → KEIN QR, stattdessen gelbe Hinweisfläche */}
                {isReserved ? (
                  <div style={reservedPanelStyle}>
                    <div
                      style={{
                        fontWeight: 900,
                        letterSpacing: 1 * scale,
                        textTransform: 'uppercase',
                        fontSize: `${12 * scale}px`,
                      }}
                    >
                      RESERVIERT
                    </div>
                    <div
                      style={{
                        marginTop: `${4 * scale}px`,
                        fontSize: `${14 * scale}px`,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 800,
                      }}
                      aria-label="Countdown bis zur Freigabe"
                    >
                      {mmss}
                    </div>
                    {reservedUntil && (
                      <div style={{ marginTop: `${2 * scale}px`, opacity: 0.85, fontSize: `${9 * scale}px` }}>
                        bis {reservedUntil.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ) : cfg?.qr ? (
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
                  <div style={{ opacity: 0.5, fontSize: `${10 * scale}px` }}>kein QR</div>
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
                  background: err ? '#ff5252' : isReserved ? '#b45309' : '#2f8f6b',
                  boxShadow: `0 0 ${6 * scale}px ${err ? '#ff5252' : isReserved ? '#b45309' : '#2f8f6b'}`,
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
        )}

        {/* SOLD Vollbild-Screen */}
        {isSold && (
          <div style={soldOverlayStyle} aria-live="assertive">
            <div style={soldBoxStyle}>
              <div
                style={{
                  width: `${44 * scale}px`,
                  height: `${44 * scale}px`,
                  borderRadius: '50%',
                  background: '#2f8f6b',
                  boxShadow: `0 0 ${10 * scale}px rgba(47,143,107,0.6)`,
                  display: 'grid',
                  placeItems: 'center',
                }}
                aria-hidden
              >
                <svg
                  width={24 * scale}
                  height={24 * scale}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={soldHeadlineStyle}>VERKAUFT!</div>
              <div style={soldSubStyle}>Vielen Dank für Ihren Einkauf</div>
            </div>
          </div>
        )}
      </div>

      {!hideChrome && (
        <small style={{ fontFamily: 'system-ui, sans-serif', opacity: 0.7 }}>
          Tipps: <code>?scale=3</code> größer, <code>&poll=1000</code> schneller, <code>&qr=112</code> QR-Größe.
        </small>
      )}
    </div>
  );
}
