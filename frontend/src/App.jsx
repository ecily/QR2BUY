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
import { ENDPOINTS } from "./config.js";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidShortId(v) {
  return /^[a-z0-9\-]{3,32}$/i.test(String(v || "").trim());
}

function formatCurrency(amount, currency = "EUR", locale = "de-AT") {
  if (typeof amount !== "number") return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: String(currency || "EUR").toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${String(currency || "EUR").toUpperCase()}`;
  }
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const styles = {
  main: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "24px 16px",
  },
  h1: { fontSize: 28, lineHeight: "32px", margin: "0 0 10px 0" },
  h2: { fontSize: 22, lineHeight: "28px", margin: "18px 0 8px" },
  muted: { color: "#64748b", fontSize: 14 },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  btn: {
    appearance: "none",
    border: "none",
    background: "#3b5ccc",
    color: "white",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  btnSecondary: {
    appearance: "none",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  badge: {
    display: "inline-block",
    background: "#e2e8f0",
    color: "#0f172a",
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    fontWeight: 600,
  },
  price: {
    fontSize: 24,
    fontWeight: 700,
    marginTop: 8,
  },
  danger: { color: "#b00020" },
};

function Card({ children }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children, tone = "neutral" }) {
  const bg = tone === "success" ? "#dcfce7" : tone === "error" ? "#fee2e2" : "#e2e8f0";
  const fg = tone === "success" ? "#166534" : tone === "error" ? "#991b1b" : "#0f172a";
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color: fg,
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        fontWeight: 600,
      }}
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
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
        }}
      />
      {ariaDescription && !error ? (
        <div id={`${id}-desc`} style={{ ...styles.muted, marginTop: 6 }}>
          {ariaDescription}
        </div>
      ) : null}
      {error ? (
        <div id={`${id}-error`} style={{ ...styles.muted, color: "#b00020", marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

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
        tone === "warn" && "chip--warn"
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard (Demo/Admin)                                                     */
/* -------------------------------------------------------------------------- */
function Dashboard() {
  const [state, setState] = useState({
    health: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await ky.get("/api/health").json();
        if (!alive) return;
        setState({ loading: false, error: null, health: res });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, error: e?.message || String(e), health: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main style={styles.main}>
      <Card>
        <h1 style={styles.h1}>Dashboard</h1>
        <p style={styles.muted}>Kleiner Health-Check und Demo.</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(state.health, null, 2)}
        </pre>
      </Card>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Produktseite                                                               */
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
        setState({ loading: false, error: null, product: data?.product || null, busy: false });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, error: e?.message || String(e), product: null, busy: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [shortId]);

  /* ---------- Live-Updates via SSE ---------- */
  const sseRef = useRef(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    const startSSE = () => {
      try {
        const es = new EventSource(ENDPOINTS.events()); // ← nutzt VITE_API_BASE
        sseRef.current = es;
        es.addEventListener("open", () => setSseConnected(true));
        es.addEventListener("error", () => setSseConnected(false));
        es.addEventListener("ready", () => setSseConnected(true));
        es.addEventListener("version", (evt) => {
          try {
            const data = JSON.parse(evt.data || "{}");
            if (data.version) setVersion(String(data.version));
          } catch { /* noop */ }
        });
        es.addEventListener("product", (evt) => {
          try {
            const data = JSON.parse(evt.data || "{}");
            const changedShort = String(data?.shortId || "").toLowerCase();
            if (changedShort && changedShort === String(shortId || "").toLowerCase()) {
              // Minimal nachladen für genau dieses Produkt
              (async () => {
                try {
                  const refreshed = await getPublicProductByShort(shortId);
                  setState((s) => ({ ...s, product: refreshed?.product || s.product }));
                } catch { /* ignore */ }
              })();
            }
          } catch { /* noop */ }
        });
      } catch {
        setSseConnected(false);
      }
    };

    startSSE();
    return () => {
      if (sseRef.current) {
        try { sseRef.current.close(); } catch {}
        sseRef.current = null;
      }
    };
  }, [shortId]);

  const p = state.product;

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

  const isSold = String(p?.status || "").toUpperCase() === "SOLD";

  return (
    <main style={styles.main}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ ...styles.h1, margin: 0 }}>{p?.name || "Produkt"}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Chip tone={sseConnected ? "success" : "warn"} title={sseConnected ? "Live verbunden" : "Live getrennt"}>
              LIVE
            </Chip>
            {version ? <span style={styles.badge}>v{version}</span> : null}
          </div>
        </div>

        <div style={styles.price}>{formatCurrency(Number(p?.price || 0), p?.currency || "EUR")}</div>
        <div style={{ marginTop: 8 }}>
          {isSold ? <Label tone="error">VERKAUFT</Label> : <Label tone="success">VERFÜGBAR</Label>}
        </div>

        {!isSold && (
          <div style={{ marginTop: 16 }}>
            <button
              style={styles.btn}
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
              Jetzt kaufen
            </button>
          </div>
        )}

        {isSold && (
          <div style={{ marginTop: 12 }}>
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

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */
function CancelPage() {
  return (
    <main style={styles.main}>
      <Card>
        <h1 style={styles.h1}>Checkout abgebrochen</h1>
        <p style={{ marginTop: 6 }}>
          Der Checkout wurde abgebrochen. Du kannst es jederzeit erneut versuchen.
        </p>
        <div style={styles.row}>
          <Link to="/" style={styles.btnSecondary}>Zur Startseite</Link>
        </div>
      </Card>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* App                                                                         */
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
