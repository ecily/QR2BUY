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
    }).format(amount / 100); // Stripe amounts are usually in cents
  } catch {
    return `${(amount / 100).toFixed(2)} ${String(currency || 'EUR').toUpperCase()}`;
  }
}

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => searchParams.get('session_id'), [searchParams]);

  const [state, setState] = useState({
    phase: sessionId ? 'checking' : 'no-session', // 'checking' | 'ok' | 'error' | 'no-session'
    tries: 0,
    lastError: null,
    payload: null
  });

  const isMounted = useRef(true);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const backoffs = useRef([0, 1000, 2000, 4000, 8000, 16000]); // ~31s total

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

    const run = async () => {
      if (!isMounted.current) return;

      const wait = backoffs.current[Math.min(attempt, backoffs.current.length - 1)];
      if (wait > 0) {
        timerRef.current = setTimeout(run, wait);
        attempt++; // schedule next attempt after waiting
        return;
      }
      // First attempt executes immediately (wait=0), subsequent ones are scheduled above.

      try {
        // Set phase to checking only for the immediate attempts (cosmetic)
        if (attempt === 0) {
          setState(s => ({ ...s, phase: 'checking', tries: 1, lastError: null }));
        } else {
          setState(s => ({ ...s, tries: s.tries + 1 }));
        }

        // Abort controller per attempt
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        const res = await fetch(
          `${API_BASE}/checkout/verify?session_id=${encodeURIComponent(sessionId)}`,
          { signal: abortRef.current.signal }
        );

        if (!res.ok) {
          // e.g., 404 while Stripe session is not finalized yet
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`.trim());
        }

        const json = await res.json();

        if (json && json.ok) {
          if (!isMounted.current) return;
          setState({
            phase: 'ok',
            tries: attempt + 1,
            lastError: null,
            payload: json
          });
          return; // success → stop retries
        } else {
          throw new Error(json?.error || 'Unbekannte Antwort vom Server');
        }
      } catch (err) {
        if (!isMounted.current) return;
        const maxIdx = backoffs.current.length - 1;
        if (attempt >= maxIdx) {
          // Give control to user after final attempt
          setState(s => ({
            ...s,
            phase: 'error',
            lastError: String(err || 'Fehler'),
          }));
          return;
        }
        // schedule next attempt
        const nextWait = backoffs.current[Math.min(attempt + 1, maxIdx)];
        timerRef.current = setTimeout(run, nextWait);
        attempt++;
        setState(s => ({ ...s, lastError: String(err || 'Fehler') }));
      }
    };

    run();

    // restart if sessionId changes
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [sessionId]);

  const onManualRetry = () => {
    if (!sessionId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setState({ phase: 'checking', tries: 0, lastError: null, payload: null });
    // trigger effect by tweaking searchParams (no-op) or call a local runner:
    // simplest: force a reload to re-run the effect cleanly
    // but we avoid full reload; instead, bump a dummy key by updating state:
    // We'll mimic initial mount by toggling sessionId via history replace (no change).
    const url = new URL(window.location.href);
    window.history.replaceState({}, '', url.toString());
    // kick a fresh run by updating a backoff array (cheap trick)
    backoffs.current = [0, 1000, 2000, 4000, 8000, 16000];
    // Start a new run quickly:
    setTimeout(() => {
      // re-run the effect body manually by changing a benign state:
      // Instead, we will simply perform a one-off verify attempt now:
      oneOffVerify(sessionId);
    }, 0);
  };

  const oneOffVerify = async (sid) => {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setState(s => ({ ...s, phase: 'checking', lastError: null, tries: s.tries + 1 }));
      const res = await fetch(
        `${API_BASE}/checkout/verify?session_id=${encodeURIComponent(sid)}`,
        { signal: abortRef.current.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.ok) {
        setState(s => ({ ...s, phase: 'ok', payload: json }));
      } else {
        throw new Error(json?.error || 'Unbekannte Antwort');
      }
    } catch (e) {
      setState(s => ({ ...s, phase: 'error', lastError: String(e || 'Fehler') }));
    }
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
          maxWidth: 680,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          padding: '24px 20px'
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>Vielen Dank – Zahlung eingegangen</h1>

        {phase === 'no-session' && (
          <>
            <p>Es fehlt die <code>session_id</code> in der URL. Diese Seite wird normalerweise von Stripe nach dem Kauf aufgerufen.</p>
            <p>
              <Link to="/">Zur Startseite</Link>
            </p>
          </>
        )}

        {phase === 'checking' && (
          <>
            <p>Wir bestätigen deinen Kauf … bitte einen Moment Geduld.</p>
            <small style={{ opacity: 0.7 }}>Versuch: {tries || 1}</small>
            <div style={{ marginTop: 16 }}>
              <button onClick={onManualRetry} style={btnStyle}>Erneut prüfen</button>
            </div>
          </>
        )}

        {phase === 'ok' && (
          <>
            <p style={{ color: '#2f8f6b', fontWeight: 600, marginBottom: 8 }}>
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
                <div><strong>Produkt:</strong> {product?.name || '—'}{product?.shortId ? ` (/${product.shortId})` : ''}</div>
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
                {payload?.order?.sessionId && (
                  <div><strong>Session:</strong> {payload.order.sessionId}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {product?.shortId && (
                <a href={`/p/${product.shortId}`} style={btnStyle}>Zur Produktseite</a>
              )}
              <Link to="/" style={btnGhost}>Zur Startseite</Link>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <p style={{ color: '#b00020', fontWeight: 600, marginBottom: 8 }}>
              Bestätigung noch nicht möglich
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
              <button onClick={onManualRetry} style={btnStyle}>Erneut prüfen</button>
              <Link to="/" style={btnGhost}>Später erneut öffnen</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
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
