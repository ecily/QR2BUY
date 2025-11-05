// C:\QR\frontend\src\pages\SuccessPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API_BASE } from '../config';

function formatCurrency(amount, currency = 'EUR', locale = 'de-AT') {
  if (typeof amount !== 'number') return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: String(currency || 'EUR').toUpperCase()
    }).format(amount / 100); // Stripe amounts sind Cent
  } catch {
    return `${(amount / 100).toFixed(2)} ${String(currency || 'EUR').toUpperCase()}`;
  }
}

function CopyInline({ text, label = 'Kopieren', title = 'In Zwischenablage kopieren' }) {
  const [ok, setOk] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setOk(true);
      setTimeout(() => setOk(false), 1200);
    } catch {/* noop */}
  };
  return (
    <button type="button" onClick={onCopy} title={title} aria-label={title}
      style={{
        marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1',
        background: '#fff', color: '#334155', cursor: 'pointer'
      }}>
      {ok ? '✓ Kopiert' : label}
    </button>
  );
}

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => searchParams.get('session_id'), [searchParams]);

  // phases: 'no-session' | 'checking' | 'pending' | 'ok' | 'error'
  const [state, setState] = useState({
    phase: sessionId ? 'checking' : 'no-session',
    tries: 0,
    lastError: null,
    payload: null
  });

  const isMounted = useRef(true);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  // Backoff-Folge (ms)
  const backoffs = useRef([0, 1500, 3000, 5000, 8000, 13000, 21000]); // ~48,5s

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let attempt = 0;

    const verifyOnce = async () => {
      if (!isMounted.current) return;

      // Abort vorheriger Versuch
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      try {
        if (attempt === 0) {
          setState(s => ({ ...s, phase: 'checking', tries: 1, lastError: null }));
        } else {
          setState(s => ({ ...s, tries: s.tries + 1 }));
        }

        const res = await fetch(
          `${API_BASE}/checkout/verify?session_id=${encodeURIComponent(sessionId)}`,
          { signal: abortRef.current.signal }
        );

        if (res.ok) {
          const json = await res.json();
          if (json?.ok) {
            if (!isMounted.current) return;
            setState({
              phase: 'ok',
              tries: attempt + 1,
              lastError: null,
              payload: json
            });
            return; // fertig
          }
          // ok=false: wie Fehler behandeln
          throw new Error(json?.error || 'Unbekannte Antwort vom Server');
        }

        // Nicht-200: besondere Behandlung für 409 (= Payment not completed / Webhook pending)
        const text = await res.text().catch(() => '');
        const errMsg = `HTTP ${res.status} ${res.statusText} ${text}`.trim();

        if (res.status === 409) {
          // Noch nicht final – Webhook/Stripe verarbeitet
          // -> in 'pending' wechseln und weiter versuchen bis Backoff erschöpft
          setState(s => ({ ...s, phase: 'pending', lastError: errMsg }));
        } else if (res.status >= 500) {
          // Serverproblem: retry
          setState(s => ({ ...s, lastError: errMsg }));
        } else {
          // 4xx != 409 → eher dauerhaftes Problem
          throw new Error(errMsg);
        }

        // Plan nächster Versuch
        const maxIdx = backoffs.current.length - 1;
        if (attempt >= maxIdx) {
          // genug probiert
          setState(s => ({ ...s, phase: 'error' }));
          return;
        }
        attempt++;
        timerRef.current = setTimeout(verifyOnce, backoffs.current[attempt]);
      } catch (e) {
        if (!isMounted.current) return;
        const maxIdx = backoffs.current.length - 1;
        setState(s => ({ ...s, lastError: String(e || 'Fehler') }));
        if (attempt >= maxIdx) {
          setState(s => ({ ...s, phase: 'error' }));
          return;
        }
        attempt++;
        timerRef.current = setTimeout(verifyOnce, backoffs.current[attempt]);
      }
    };

    // Starte erste Runde sofort (backoffs[0] = 0)
    timerRef.current = setTimeout(verifyOnce, backoffs.current[0]);

    // Cleanup bei neuem sessionId
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [sessionId]);

  const onManualRetry = () => {
    if (!sessionId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    backoffs.current = [0, 1500, 3000, 5000, 8000, 13000, 21000];
    setState({ phase: 'checking', tries: 0, lastError: null, payload: null });

    // One-off sofort
    (async () => {
      try {
        abortRef.current = new AbortController();
        setState(s => ({ ...s, phase: 'checking', tries: s.tries + 1, lastError: null }));
        const res = await fetch(
          `${API_BASE}/checkout/verify?session_id=${encodeURIComponent(sessionId)}`,
          { signal: abortRef.current.signal }
        );
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${res.statusText} ${t}`.trim());
        }
        const json = await res.json();
        if (json?.ok) {
          setState(s => ({ ...s, phase: 'ok', payload: json }));
        } else {
          throw new Error(json?.error || 'Unbekannte Antwort');
        }
      } catch (e) {
        setState(s => ({ ...s, phase: 'error', lastError: String(e || 'Fehler') }));
      }
    })();
  };

  const { phase, payload, lastError, tries } = state;
  const product = payload?.product || null;
  const order = payload?.order || null;
  const device = payload?.device || null;

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 16 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'white',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          padding: '24px 20px'
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>Vielen Dank – Zahlung</h1>

        {phase === 'no-session' && (
          <>
            <p>Es fehlt die <code>session_id</code> in der URL. Diese Seite wird normalerweise von Stripe nach dem Kauf aufgerufen.</p>
            <p style={{ marginTop: 12 }}>
              <Link to="/" style={btnGhost}>Zur Startseite</Link>
            </p>
          </>
        )}

        {phase === 'checking' && (
          <>
            <p>Wir bestätigen deinen Kauf … bitte einen Moment Geduld.</p>
            <small style={{ opacity: 0.7 }}>Versuch: {tries || 1}</small>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={onManualRetry} style={btnPrimary}>Erneut prüfen</button>
              {sessionId && (
                <span style={{ marginLeft: 12, fontSize: 13 }}>
                  Session: <code>{sessionId}</code> <CopyInline text={sessionId} />
                </span>
              )}
            </div>
          </>
        )}

        {phase === 'pending' && (
          <>
            <p style={{ color: '#a16207', fontWeight: 600, marginBottom: 8 }}>
              Bestätigung läuft noch (Webhook)
            </p>
            <p style={{ marginTop: 0 }}>
              Deine Zahlung wurde verarbeitet, die endgültige Bestätigung vom Server steht noch aus. Wir prüfen automatisch weiter.
            </p>
            <small style={{ opacity: 0.7 }}>Versuch: {tries}</small>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={onManualRetry} style={btnPrimary}>Jetzt erneut prüfen</button>
              {sessionId && (
                <span style={{ marginLeft: 12, fontSize: 13 }}>
                  Session: <code>{sessionId}</code> <CopyInline text={sessionId} />
                </span>
              )}
            </div>
          </>
        )}

        {phase === 'ok' && (
          <>
            <p style={{ color: '#2f8f6b', fontWeight: 700, marginBottom: 8 }}>
              Kauf bestätigt ✔
            </p>

            <div
              style={{
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 16,
                marginBottom: 16
              }}
            >
              <div style={{ display: 'grid', gap: 6 }}>
                <div>
                  <strong>Produkt:</strong> {product?.name || '—'}
                  {product?.shortId ? ` (/p/${product.shortId})` : ''}
                </div>
                <div>
                  <strong>Betrag:</strong>{' '}
                  {order?.amount != null
                    ? formatCurrency(order.amount, order.currency)
                    : product?.price != null
                      ? formatCurrency(product.price, product.currency)
                      : '—'}
                </div>
                {device?.deviceId && (
                  <div><strong>Gerät:</strong> {device.deviceId}</div>
                )}
                {(payload?.order?.sessionId || sessionId) && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>Session:&nbsp;</strong>
                    <code>{payload?.order?.sessionId || sessionId}</code>
                    <CopyInline text={payload?.order?.sessionId || sessionId} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {product?.shortId && (
                <a href={`/p/${product.shortId}`} style={btnPrimary}>Zur Produktseite</a>
              )}
              <Link to="/" style={btnGhost}>Zur Startseite</Link>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <p style={{ color: '#b00020', fontWeight: 700, marginBottom: 8 }}>
              Bestätigung aktuell nicht möglich
            </p>
            {lastError && (
              <pre
                style={{
                  background: '#fff5f5',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: 12,
                  whiteSpace: 'pre-wrap',
                  marginTop: 0
                }}
              >
                {lastError}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={onManualRetry} style={btnPrimary}>Erneut prüfen</button>
              <Link to="/" style={btnGhost}>Später erneut öffnen</Link>
              {sessionId && (
                <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                  Session: <code style={{ marginLeft: 6 }}>{sessionId}</code> <CopyInline text={sessionId} />
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btnPrimary = {
  display: 'inline-block',
  background: '#3b5ccc',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 8,
  textDecoration: 'none',
  cursor: 'pointer'
};

const btnGhost = {
  display: 'inline-block',
  background: 'white',
  color: '#3b5ccc',
  border: '1px solid #cbd5e1',
  padding: '10px 14px',
  borderRadius: 8,
  textDecoration: 'none',
  cursor: 'pointer'
};
