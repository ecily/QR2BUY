// C:\QR\frontend\src\pages\Admin.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminClaimAuthorization from './AdminClaimAuthorization.jsx';
import {
  setAdminAuth,
  adminClaimRequest,
  adminListProducts,
  adminCreateProduct,
  adminListDevices,
  adminCreateDevice,
  adminLink,
  adminUnlink,
  adminOverrideStatus,
  startCheckoutRedirectByShort
} from "../api.js";

function clsx(...parts) { return parts.filter(Boolean).join(" "); }
function adminError(error) {
  return error.status === 401 ? 'Adminzugang abgelehnt (HTTP 401). Benutzer und Passwort im Formular prüfen. Der Browser-Auth-Dialog ist hierfür nicht zuständig.'
    : error.message === 'request_timeout' ? 'Admin-Anfrage hat das Zeitlimit überschritten. Kein HTTP-401-Nachweis; Verbindung prüfen und erneut anmelden.'
      : error.message === 'request_aborted' ? 'Admin-Anfrage wurde abgebrochen. Erneut anmelden.'
        : !error.status ? 'Admin-Anfrage ist am Netzwerkzugriff gescheitert. Verbindung oder Browserblockierung prüfen.'
          : 'Admin-Anfrage fehlgeschlagen (HTTP ' + error.status + ').';
}

export default function Admin() {
  /* ───────── Auth ───────── */
  const [auth, setAuth] = useState({
    user: "",
    pass: ""
  });
  const [authed, setAuthed] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [claimOptions, setClaimOptions] = useState(null);
  const loginLock = useRef(false), loginGeneration = useRef(0);
  const invalidateLogin = useCallback(() => { loginGeneration.current++; setAdminAuth(null); }, []);
  useEffect(() => {
    // Remove credentials persisted by the legacy admin page; never restore them.
    sessionStorage.removeItem('adm_user'); sessionStorage.removeItem('adm_pass');
    return invalidateLogin;
  }, [invalidateLogin]);

  /* ───────── Data ───────── */
  const [products, setProducts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  /* ───────── Forms ───────── */
  const [pForm, setPForm] = useState({ name: "", price: "", currency: "EUR", shortId: "" });
  const [dForm, setDForm] = useState({ deviceId: "", name: "", deviceSecret: "" });
  const [linkForm, setLinkForm] = useState({ deviceId: "", productShortId: "" });

  const buyerBase = useMemo(() => window.location.origin, []);

  const refresh = useCallback(async () => {
    const generation = loginGeneration.current;
    setLoading(true);
    setMsg(null);
    try {
      const [p, d] = await Promise.all([adminListProducts(), adminListDevices()]);
      if (generation !== loginGeneration.current) return;
      setProducts(p.products || []);
      setDevices(d.devices || []);
    } catch (e) {
      if (generation === loginGeneration.current) setMsg({ tone: "error", text: adminError(e) });
    } finally {
      if (generation === loginGeneration.current) setLoading(false);
    }
  }, []);
  useEffect(() => { if (authed) refresh(); }, [authed, refresh]);
  async function onAuthSave(e) {
    e?.preventDefault?.();
    if (loginLock.current || !auth.user || !auth.pass) return;
    loginLock.current = true; setLoginBusy(true); setAuthed(false);
    setClaimOptions(null); setProducts([]); setDevices([]); setMsg(null); setLoading(false);
    const generation = ++loginGeneration.current;
    try {
      setAdminAuth(auth.user, auth.pass);
      // One authoritative read first. No green status or parallel protected
      // requests before the server has accepted the form's credentials.
      const data = await adminClaimRequest();
      if (generation !== loginGeneration.current) return;
      setClaimOptions(data); setAuthed(generation);
    } catch (error) {
      if (generation !== loginGeneration.current) return;
      setAdminAuth(null); setMsg({ tone: 'error', text: adminError(error) });
    } finally {
      if (generation === loginGeneration.current) {
        setAuth(previous => ({ ...previous, pass: '' }));
        loginLock.current = false; setLoginBusy(false);
      }
    }
  }

  /* ───────── Handlers: Product ───────── */
  async function createProduct(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await adminCreateProduct({
        name: pForm.name.trim(),
        price: Number(pForm.price),
        currency: (pForm.currency || "EUR").toUpperCase(),
        shortId: pForm.shortId.trim() || undefined
      });
      setPForm({ name: "", price: "", currency: "EUR", shortId: "" });
      await refresh();
      setMsg({ tone: "success", text: "Produkt angelegt." });
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function overrideProductStatus(p, status) {
    setLoading(true);
    try {
      await adminOverrideStatus({ productId: p._id, status });
      await refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  /* ───────── Handlers: Device ───────── */
  async function createDevice(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await adminCreateDevice({
        deviceId: dForm.deviceId.trim(),
        name: dForm.name.trim() || undefined,
        deviceSecret: dForm.deviceSecret.trim() || undefined
      });
      setDForm({ deviceId: "", name: "", deviceSecret: "" });
      await refresh();
      setMsg({ tone: "success", text: "Gerät angelegt." });
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  /* ───────── Handlers: Link ───────── */
  async function linkDeviceProduct(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLink({
        deviceId: linkForm.deviceId.trim(),
        productShortId: linkForm.productShortId.trim().toLowerCase()
      });
      setLinkForm({ deviceId: "", productShortId: "" });
      await refresh();
      setMsg({ tone: "success", text: "Device ↔ Product verlinkt." });
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function unlinkDevice(device) {
    setLoading(true);
    try {
      await adminUnlink({ deviceId: device.deviceId });
      await refresh();
      setMsg({ tone: "success", text: "Verlinkung gelöst." });
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  /* ───────── Layout Styles (breiter) ───────── */
  const styles = {
    container: {
      padding: 16,
      maxWidth: 1280,         // ↑ deutlich breiter
      margin: "0 auto"
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 16
    },
    grid2: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 16
    },
    // Ab ~1024px zwei Spalten
    "@media (min-width:1024px)": {},
    card: {
      width: "100%",
      background: "rgba(255,255,255,0.98)",
      border: "1px solid rgba(0,0,0,0.06)",
      borderRadius: 14,
      boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      padding: 20
    },
    formWide: {
      display: "grid",
      gap: 12,
      maxWidth: 1100,        // ↑ vormals 520/720 → jetzt 1100
      width: "100%"
    },
    tableWrap: {
      width: "100%",
      overflowX: "auto"
    },
    table: {
      display: "grid",
      gap: 8,
      minWidth: 900          // ↑ sorgt für horizontales Scrollen statt crampen
    },
    thead: {
      display: "grid",
      gridTemplateColumns: "minmax(200px, 1.2fr) 160px 140px 140px minmax(280px, 1.2fr)",
      fontWeight: 700,
      fontSize: 14,
      color: "#334155",
      padding: "8px 4px",
      borderBottom: "1px solid #e5e7eb"
    },
    row: {
      display: "grid",
      gridTemplateColumns: "minmax(200px, 1.2fr) 160px 140px 140px minmax(280px, 1.2fr)",
      alignItems: "center",
      padding: "8px 4px",
      borderBottom: "1px solid #f1f5f9",
      fontSize: 14
    },
    actions: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    },
    btn: {
      background: "#3b5ccc",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "8px 12px",
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "none"
    },
    btnGhost: {
      background: "transparent",
      color: "#3b5ccc",
      border: "1px dashed #c3cffb",
      borderRadius: 10,
      padding: "8px 12px",
      fontWeight: 600,
      cursor: "pointer"
    },
    input: {
      width: "100%",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "10px 12px"
    },
    label: {
      display: "block",
      fontWeight: 600,
      marginBottom: 6
    }
  };

  // CSS Media Query Workaround inline:
  // Wir hängen auf große Screens dynamisch eine 2-Spalten-Grid an.
  const isWide = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;

  return (
    <div style={styles.container}>
      <h1 style={{ marginBottom: 12 }}>qr2buy – Admin</h1>

      {/* Auth */}
      <section style={styles.card}>
        <h2>Authentifizierung</h2>
        <form onSubmit={onAuthSave} style={styles.formWide}>
          <div>
            <label style={styles.label}>Benutzer</label>
            <input aria-label="Adminbenutzer" autoComplete="off" disabled={loginBusy} style={styles.input} value={auth.user} onChange={(e) => setAuth((s) => ({ ...s, user: e.target.value }))} />
          </div>
            <div>
            <label style={styles.label}>Passwort</label>
            <input aria-label="Adminpasswort" autoComplete="off" disabled={loginBusy} style={styles.input} type="password" value={auth.pass}
                   onChange={(e) => setAuth((s) => ({ ...s, pass: e.target.value }))} />
          </div>
          <div>
            <button style={styles.btn} type="submit" disabled={loginBusy || !auth.user || !auth.pass}>Login setzen</button>
            {loginBusy && <span role="status">Adminzugang wird geprüft …</span>}
            {authed && <button type="button" style={styles.btnGhost} onClick={() => { loginGeneration.current++; setAdminAuth(null); setAuth({ user: '', pass: '' }); setAuthed(false); setProducts([]); setDevices([]); }}>Admin abmelden</button>}
            {authed && <span style={{ marginLeft: 10, color: "#16a34a", fontWeight: 600 }}>✓ Backendzugang bestätigt</span>}
          </div>
        </form>
      </section>

      {!!authed && <AdminClaimAuthorization key={authed} initialOptions={claimOptions} />}
      {/* 2-Spalten-Bereich */}
      <div style={{ ...(isWide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } : { display: "grid", gridTemplateColumns: "1fr", gap: 16 }) }}>
        {/* Create Product */}
        <section style={styles.card}>
          <h2>Produkt anlegen</h2>
          <form onSubmit={createProduct} style={styles.formWide}>
            <div>
              <label style={styles.label}>Name</label>
              <input style={styles.input} value={pForm.name} onChange={(e) => setPForm((s) => ({ ...s, name: e.target.value }))} required/>
            </div>
            <div>
              <label style={styles.label}>Preis</label>
              <input style={styles.input} type="number" min="0" step="0.01" value={pForm.price}
                     onChange={(e) => setPForm((s) => ({ ...s, price: e.target.value }))} required/>
            </div>
            <div>
              <label style={styles.label}>Währung</label>
              <input style={styles.input} value={pForm.currency}
                     onChange={(e) => setPForm((s) => ({ ...s, currency: e.target.value }))}/>
            </div>
            <div>
              <label style={styles.label}>shortId (optional)</label>
              <input style={styles.input} value={pForm.shortId}
                     onChange={(e) => setPForm((s) => ({ ...s, shortId: e.target.value }))}/>
            </div>
            <div>
              <button style={styles.btn} disabled={loading}>Anlegen</button>
            </div>
          </form>
        </section>

        {/* Create Device */}
        <section style={styles.card}>
          <h2>Gerät anlegen</h2>
          <form onSubmit={createDevice} style={styles.formWide}>
            <div>
              <label style={styles.label}>DeviceId</label>
              <input style={styles.input} value={dForm.deviceId}
                     onChange={(e) => setDForm((s) => ({ ...s, deviceId: e.target.value }))} required/>
            </div>
            <div>
              <label style={styles.label}>Name (optional)</label>
              <input style={styles.input} value={dForm.name}
                     onChange={(e) => setDForm((s) => ({ ...s, name: e.target.value }))}/>
            </div>
            <div>
              <label style={styles.label}>Device Secret (optional)</label>
              <input style={styles.input} value={dForm.deviceSecret}
                     onChange={(e) => setDForm((s) => ({ ...s, deviceSecret: e.target.value }))}/>
            </div>
            <div>
              <button style={styles.btn} disabled={loading}>Anlegen</button>
            </div>
          </form>
        </section>
      </div>

      {/* Link */}
      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2>Link: Device ↔ Product</h2>
        <form onSubmit={linkDeviceProduct} style={styles.formWide}>
          <div>
            <label style={styles.label}>DeviceId</label>
            <input style={styles.input} value={linkForm.deviceId}
                   onChange={(e) => setLinkForm((s) => ({ ...s, deviceId: e.target.value }))} required/>
          </div>
          <div>
            <label style={styles.label}>Product shortId</label>
            <input style={styles.input} value={linkForm.productShortId}
                   onChange={(e) => setLinkForm((s) => ({ ...s, productShortId: e.target.value }))} required/>
          </div>
          <div>
            <button style={styles.btn} disabled={loading}>Verlinken</button>
          </div>
        </form>
      </section>

      {/* Listen */}
      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2>Produkte</h2>
        {loading && <p>Laden…</p>}
        {!loading && products.length === 0 && <p>Keine Produkte.</p>}
        {products.length > 0 && (
          <div style={styles.tableWrap}>
            <div style={styles.table}>
              <div style={styles.thead}>
                <div>Name</div>
                <div>shortId</div>
                <div>Preis</div>
                <div>Status</div>
                <div>Aktionen</div>
              </div>
              {products.map((p) => (
                <div style={styles.row} key={p._id}>
                  <div>{p.name}</div>
                  <div><code>{p.shortId}</code></div>
                  <div>{p.price} {p.currency}</div>
                  <div>{p.status}</div>
                  <div style={styles.actions}>
                    <a style={styles.btnGhost} href={`${buyerBase}/p/${p.shortId}`} target="_blank" rel="noreferrer">Buyer-URL</a>
                    <button style={styles.btn} onClick={() => startCheckoutRedirectByShort(p.shortId)}>Testkauf</button>
                    <button style={styles.btnGhost} onClick={() => overrideProductStatus(p, "AVAILABLE")}>AVAILABLE</button>
                    <button style={styles.btnGhost} onClick={() => overrideProductStatus(p, "SOLD")}>SOLD</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ ...styles.card, marginTop: 16 }}>
        <h2>Geräte</h2>
        {loading && <p>Laden…</p>}
        {!loading && devices.length === 0 && <p>Keine Geräte.</p>}
        {devices.length > 0 && (
          <div style={styles.tableWrap}>
            <div style={{ ...styles.table }}>
              <div style={{ ...styles.thead, gridTemplateColumns: "minmax(200px,1.2fr) 160px minmax(260px,1.2fr) minmax(240px,1.2fr)" }}>
                <div>DeviceId</div>
                <div>Status</div>
                <div>Product</div>
                <div>Aktionen</div>
              </div>
              {devices.map((d) => (
                <div style={{ ...styles.row, gridTemplateColumns: "minmax(200px,1.2fr) 160px minmax(260px,1.2fr) minmax(240px,1.2fr)" }} key={d._id}>
                  <div><code>{d.deviceId}</code></div>
                  <div>{d.status}</div>
                  <div>{d.productId ? <code>{d.productId}</code> : "—"}</div>
                  <div style={styles.actions}>
                    <button style={styles.btnGhost} onClick={() => unlinkDevice(d)}>Unlink</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {msg && (
        <div
          className={clsx("toast", msg.tone === "error" && "toast--error", msg.tone === "success" && "toast--success")}
          role="status" aria-live="polite" style={{ marginTop: 16 }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
