// C:\QR\frontend\src\App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useParams,
  useSearchParams,
  useNavigate,
  Link
} from "react-router-dom";
import ky from "ky";
import "./App.css";
import LandingPage from "./pages/LandingPage.jsx";
import Admin from "./pages/Admin.jsx";
import { getPublicProductByShort, startCheckoutRedirectByShort } from "./api.js";
import MockDisplay from "./pages/MockDisplay.jsx";
import SuccessPage from "./pages/SuccessPage.jsx";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const api = ky.create({ prefixUrl: "/api", timeout: 8000 });

const isValidUrl = (value) => {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
};

function clsx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const nowIso = () => new Date().toISOString().replace("T", " ").slice(0, 19);

/* -------------------------------------------------------------------------- */
/* Tiny UI                                                                    */
/* -------------------------------------------------------------------------- */
function Chip({ tone = "neutral", children, title }) {
  return (
    <span
      title={title}
      className={clsx(
        "chip",
        tone === "success" && "chip--success",
        tone === "error" && "chip--error",
        tone === "warn" && "chip--warn",
        tone === "neutral" && "chip--neutral"
      )}
    >
      {children}
    </span>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
  type = "text",
  required,
  autoComplete,
  ariaDescription,
}) {
  const describedBy = error ? `${id}-error` : ariaDescription ? `${id}-desc` : undefined;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={clsx("input", error && "input--error")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      />
      {ariaDescription && !error && (
        <div id={`${id}-desc`} className="hint">
          {ariaDescription}
        </div>
      )}
      {error && (
        <div id={`${id}-error`} className="error">
          {error}
        </div>
      )}
    </div>
  );
}

function Button({ children, onClick, disabled, loading, variant = "primary", type = "button", title }) {
  return (
    <button
      type={type}
      className={clsx("btn", variant === "ghost" && "btn--ghost")}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
    >
      {loading ? "Bitte warten…" : children}
    </button>
  );
}

function Divider() {
  return <hr className="divider" />;
}

function CopyInline({ text, label = "Kopieren", title = "In Zwischenablage kopieren" }) {
  const [ok, setOk] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || "");
      setOk(true);
      setTimeout(() => setOk(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <button type="button" className="copy" onClick={onCopy} title={title} aria-label={title}>
      {ok ? "✓ Kopiert" : label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard (bestehend)                                                      */
/* -------------------------------------------------------------------------- */
function Dashboard() {
  const [healthOk, setHealthOk] = useState(false);
  const [healthTs, setHealthTs] = useState("");
  const [sseConnected, setSseConnected] = useState(false);
  const [version, setVersion] = useState("-");
  const [updatedAt, setUpdatedAt] = useState("");
  const [preview, setPreview] = useState({ text: "", qr: "", version: "-" });

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState({ text: "", url: "" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [dark, setDark] = useState(false);

  const sseRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const h = await api.get("health").json();
        if (!cancelled) {
          setHealthOk(!!h?.ok);
          setHealthTs(nowIso());
        }
      } catch {
        if (!cancelled) {
          setHealthOk(false);
          setHealthTs(nowIso());
        }
      }
      try {
        const cfg = await api.get("config").json();
        if (!cancelled) {
          const next = {
            text: cfg?.text ?? "",
            qr: cfg?.qr ?? "",
            version: cfg?.version ?? "-",
          };
          setPreview(next);
          setText(next.text);
          setUrl(cfg?.qr ?? "");
          setVersion(cfg?.version ?? "-");
          setUpdatedAt(cfg?.updatedAt ? cfg.updatedAt : nowIso());
        }
      } catch {
        /* ignore */
      }
      startSSE();
    };

    bootstrap();

    const iv = setInterval(async () => {
      try {
        const h = await api.get("health").json();
        setHealthOk(!!h?.ok);
        setHealthTs(nowIso());
      } catch {
        setHealthOk(false);
        setHealthTs(nowIso());
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(iv);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, []);

  const startSSE = () => {
    try {
      const es = new EventSource("/api/events");
      sseRef.current = es;
      es.addEventListener("open", () => setSseConnected(true));
      es.addEventListener("error", () => setSseConnected(false));
      es.addEventListener("ready", () => setSseConnected(true));
      es.addEventListener("version", (evt) => {
        try {
          const data = JSON.parse(evt.data || "{}");
          if (data.version) setVersion(String(data.version));
          if (data.updatedAt) setUpdatedAt(data.updatedAt);
        } catch {}
      });
      es.addEventListener("update", (evt) => {
        try {
          const data = JSON.parse(evt.data || "{}");
          const next = {
            text: data?.text ?? preview.text,
            qr: data?.qr ?? preview.qr,
            version: data?.version ?? version,
          };
          setPreview(next);
          if (data?.version) setVersion(String(data.version));
          if (data?.updatedAt) setUpdatedAt(data.updatedAt);
        } catch {}
      });
    } catch {
      setSseConnected(false);
    }
  };

  const validate = () => {
    const errs = { text: "", url: "" };
    if (!text.trim()) errs.text = "Bitte Text eingeben.";
    if (text.trim().length > 80) errs.text = "Maximal 80 Zeichen.";
    if (!url.trim()) errs.url = "Bitte eine URL eingeben.";
    else if (!isValidUrl(url.trim())) errs.url = "Ungültige URL (erwarte http(s)://…).";
    setErrors(errs);
    return !errs.text && !errs.url;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const optimistic = { text: text.trim(), qr: url.trim(), version };
    setPreview(optimistic);
    setBusy(true);
    setToast(null);

    try {
      const res = await api
        .post("updateDisplay", { json: { text: optimistic.text, url: optimistic.qr } })
        .json();
      const next = {
        text: res?.text ?? optimistic.text,
        qr: res?.qr ?? optimistic.qr,
        version: res?.version ?? version,
      };
      setPreview(next);
      if (res?.version) setVersion(String(res.version));
      if (res?.updatedAt) setUpdatedAt(res.updatedAt);
      setToast({ tone: "success", msg: "Anzeige aktualisiert." });
    } catch {
      setToast({
        tone: "error",
        msg: "Update fehlgeschlagen. Bitte Verbindung prüfen und erneut versuchen.",
      });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 1800);
    }
  };

  const versionLabel = useMemo(() => `v${version}`, [version]);

  return (
    <div className="app">
      <div className="project-banner">
        Ein Projekt von{" "}
        <a href="https://www.ecily.com" target="_blank" rel="noopener noreferrer">
          ecily.com/Webentwicklung
        </a>
      </div>

      <header className="header" role="banner">
        <div className="header__left">
          <h1 className="title">qr2buy – Dashboard</h1>
        </div>
        <div className="header__right">
          <Button variant="ghost" onClick={() => setDark((d) => !d)} title="Dark-Mode umschalten">
            {dark ? "☀︎ Light" : "🌙 Dark"}
          </Button>
        </div>
      </header>

      <section className="statusbar" aria-label="Systemstatus">
        <div className="statusbar__group">
          <span className="status-label">Backend:</span>
          <Chip tone={healthOk ? "success" : "error"} title={healthTs}>
            {healthOk ? "OK" : "Fail"}
          </Chip>
          <span className="status-ts">{healthTs && `• ${healthTs}`}</span>
        </div>
        <div className="statusbar__group">
          <span className="status-label">SSE:</span>
          <Chip tone={sseConnected ? "success" : "warn"}>{sseConnected ? "verbunden" : "getrennt"}</Chip>
        </div>
        <div className="statusbar__group">
          <span className="status-label">Version:</span>
          <Chip tone="neutral">{versionLabel}</Chip>
          {updatedAt && <span className="status-ts">• {updatedAt}</span>}
        </div>
      </section>

      <main className="container" role="main">
        <section className="card" aria-labelledby="form-title">
          <div className="card__header">
            <h2 id="form-title" className="card__title">
              Anzeige aktualisieren
            </h2>
            <p className="card__subtitle">Text (≤ 80) & Ziel-URL für den QR-Code</p>
          </div>

          <form className="form" onSubmit={onSubmit} noValidate>
            <Field
              id="text"
              label="Text"
              value={text}
              onChange={setText}
              placeholder="z. B. JETZT KAUFEN"
              maxLength={80}
              error={errors.text}
              required
              ariaDescription="Maximal 80 Zeichen. Wird groß am Display gezeigt."
              autoComplete="off"
            />
            <Field
              id="url"
              label="URL"
              value={url}
              onChange={setUrl}
              placeholder="https://…"
              error={errors.url}
              required
              ariaDescription="Der ESP rendert den QR lokal aus dieser URL."
              autoComplete="off"
            />
            <div className="form__actions">
              <Button type="submit" loading={busy}>
                Aktualisieren
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setText(preview.text || "");
                  setUrl(preview.qr || "");
                  setErrors({ text: "", url: "" });
                  setToast({ tone: "neutral", msg: "Zur aktuellen Vorschau zurückgesetzt." });
                  setTimeout(() => setToast(null), 1200);
                }}
              >
                Zurücksetzen
              </Button>
            </div>
          </form>
        </section>

        <section className="card" aria-labelledby="preview-title">
          <div className="card__header">
            <h2 id="preview-title" className="card__title">
              Live-Vorschau
            </h2>
            <p className="card__subtitle">
              Diese Vorschau zeigt, was der ESP als <em>String</em> erhält (QR wird auf dem ESP gerendert).
            </p>
          </div>

          <div className="preview">
            <div className="preview__row">
              <span className="preview__label">Text</span>
              <span className="preview__value">{preview.text || "—"}</span>
            </div>
            <Divider />
            <div className="preview__row">
              <span className="preview__label">QR-URL</span>
              <span className="preview__value">
                <span className="truncate" title={preview.qr}>
                  {preview.qr || "—"}
                </span>
                <CopyInline text={preview.qr} />
              </span>
            </div>
            <Divider />
            <div className="preview__meta">
              <Chip tone="neutral">Version v{version}</Chip>
              {updatedAt && <Chip tone="neutral">Update {updatedAt}</Chip>}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()}{" "}
        <a href="https://www.ecily.com" target="_blank" rel="noopener noreferrer">
          ecily.com/Webdevelopment
        </a>
      </footer>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={clsx(
            "toast",
            toast.tone === "success" && "toast--success",
            toast.tone === "error" && "toast--error",
            toast.tone === "neutral" && "toast--neutral"
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Buyer-Flow Pages                                                           */
/* -------------------------------------------------------------------------- */

function ProductRoute() {
  const { shortId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, product: null, busy: false });

  const deviceId = useMemo(() => {
    const q = searchParams.get('device') || searchParams.get('dev') || searchParams.get('deviceId');
    return q || localStorage.getItem('qr2buy_deviceId') || '';
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getPublicProductByShort(shortId);
        if (!alive) return;
        setState((s) => ({ ...s, loading: false, product: data.product || null }));
      } catch (e) {
        if (!alive) return;
        setState((s) => ({ ...s, loading: false, error: String(e.message || e) }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [shortId]);

  if (state.loading) {
    return (
      <main style={styles.main}>
        <Card>
          <h1 style={styles.h1}>Lädt …</h1>
          <p style={styles.muted}>Produkt wird geladen.</p>
        </Card>
      </main>
    );
  }

  if (state.error || !state.product) {
    return (
      <main style={styles.main}>
        <Card>
          <h1 style={styles.h1}>Produkt nicht gefunden</h1>
          <p style={styles.muted}>{state.error || 'Bitte QR erneut scannen oder zurück zur Startseite.'}</p>
          <div style={styles.row}>
            <Link to="/" style={styles.btnSecondary}>Zur Startseite</Link>
          </div>
        </Card>
      </main>
    );
  }

  const p = state.product;
  const isSold = p.status === 'SOLD';
  const price = new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: (p.currency || 'EUR').toUpperCase()
  }).format(p.price);

  return (
    <main style={styles.main}>
      <Card>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12 }} />
          ) : null}
          <div>
            <h1 style={{ ...styles.h1, marginBottom: 4 }}>{p.name}</h1>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{price}</div>
            <div style={{ marginTop: 6 }}>
              {isSold ? (
                <span style={styles.badgeSold}>VERKAUFT!</span>
              ) : (
                <span style={styles.badgeAvailable}>Sofort verfügbar</span>
              )}
            </div>
          </div>
        </div>

        {!isSold ? (
          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              style={styles.btnPrimary}
              disabled={state.busy}
              onClick={async () => {
                try {
                  setState((s) => ({ ...s, busy: true }));
                  if (deviceId) localStorage.setItem('qr2buy_deviceId', deviceId);
                  await startCheckoutRedirectByShort(shortId, { deviceId, quantity: 1 });
                } catch (e) {
                  alert('Checkout konnte nicht gestartet werden: ' + (e.message || e));
                  setState((s) => ({ ...s, busy: false }));
                }
              }}
            >
              {state.busy ? 'Weiterleiten …' : 'Jetzt kaufen'}
            </button>

            <button
              style={styles.btnGhost}
              onClick={() => navigate('/')}
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <p style={styles.muted}>Dieser Artikel ist bereits verkauft. Danke fürs Interesse!</p>
            <Link to="/" style={styles.btnSecondary}>Weitere Angebote</Link>
          </div>
        )}

        {deviceId ? (
          <p style={{ ...styles.muted, marginTop: 12 }}>
            Gerät: <code>{deviceId}</code>
          </p>
        ) : null}
      </Card>
    </main>
  );
}

function CancelPage() {
  return (
    <main style={styles.main}>
      <Card>
        <h1 style={styles.h1}>Abgebrochen</h1>
        <p style={{ marginTop: 6 }}>Der Checkout wurde abgebrochen. Du kannst es jederzeit erneut versuchen.</p>
        <div style={styles.row}>
          <Link to="/" style={styles.btnSecondary}>Zur Startseite</Link>
        </div>
      </Card>
    </main>
  );
}

/* ───────────────── UI helpers for buyer pages ───────────────── */
function Card({ children }) {
  return (
    <section
      style={{
        margin: '72px auto',
        maxWidth: 720,
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        padding: 24
      }}
    >
      {children}
    </section>
  );
}

const styles = {
  main: {
    minHeight: '60vh',
    padding: '16px'
  },
  h1: {
    fontSize: 28,
    lineHeight: 1.2,
    margin: 0
  },
  muted: {
    color: '#667085',
    fontSize: 14
  },
  row: {
    marginTop: 16,
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap'
  },
  btnPrimary: {
    background: '#3b5ccc',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 16px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none'
  },
  btnSecondary: {
    background: '#eef2ff',
    color: '#3b5ccc',
    border: '1px solid #dbe2ff',
    borderRadius: 10,
    padding: '10px 16px',
    fontWeight: 600,
    textDecoration: 'none'
  },
  btnGhost: {
    background: 'transparent',
    color: '#3b5ccc',
    border: '1px dashed #c3cffb',
    borderRadius: 10,
    padding: '10px 16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  badgeSold: {
    background: '#ffe4e6',
    color: '#b91c1c',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3
  },
  badgeAvailable: {
    background: '#e6fff4',
    color: '#0f766e',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3
  }
};

/* -------------------------------------------------------------------------- */
/* App Router                                                                 */
/* -------------------------------------------------------------------------- */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/mock/:deviceId" element={<MockDisplay />} />
      <Route path="/p/:shortId" element={<ProductRoute />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/cancel" element={<CancelPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
