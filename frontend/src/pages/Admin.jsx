// C:\QR\frontend\src\pages\Admin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  adminListProducts,
  adminCreateProduct,
  adminListDevices,
  adminCreateDevice,
  adminLink,
  adminUnlink,
  adminOverrideStatus,
  startCheckoutRedirectByShort
} from "../api.js";
import MockDisplay from "./MockDisplay.jsx";

function clsx(...parts) { return parts.filter(Boolean).join(" "); }

/* ───────── Kleine Helper für Draggable-Modal ───────── */
function useDraggable(initial = { x: 24, y: 24 }) {
  const [pos, setPos] = useState(initial);
  const draggingRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      const d = draggingRef.current;
      if (!d) return;
      const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
      const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
      const nx = clientX - d.offX;
      const ny = clientY - d.offY;
      const maxX = window.innerWidth - d.w;
      const maxY = window.innerHeight - d.h;
      setPos({
        x: Math.max(8, Math.min(nx, Math.max(8, maxX - 8))),
        y: Math.max(8, Math.min(ny, Math.max(8, maxY - 8)))
      });
    };
    const stop = () => { draggingRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  const start = (e, el) => {
    const rect = el.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    draggingRef.current = {
      offX: clientX - rect.left,
      offY: clientY - rect.top,
      w: rect.width,
      h: rect.height
    };
  };
  return { pos, start, setPos };
}

/* ───────── Floating Modal Komponente ───────── */
function FloatingMock({
  open, onClose,
  deviceId, setDeviceId,
  scale, setScale,
  poll, setPoll
}) {
  const { pos, start, setPos } = useDraggable({ x: 24, y: 80 });

  // Breite dynamisch passend zum Mock (240×scale) + Padding
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const displayW = 240 * Math.max(1, scale || 1);
  const modalW = Math.min(vw - 24, Math.max(360, displayW + 40)); // 40px Puffer

  useEffect(() => {
    if (!open) return;
    // Bei Öffnen/Ändern der Größe an rechten Rand snappen
    const rightX = Math.max(8, vw - modalW - 16);
    setPos({ x: rightX, y: 80 });
  }, [open, modalW, setPos, vw]);

  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.15)", zIndex: 50 }}
      />
      <div
        style={{
          position: "fixed",
          left: pos.x, top: pos.y, zIndex: 51,
          width: modalW,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
          border: "1px solid #e5e7eb",
          overflow: "hidden"
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          onPointerDown={(e) => start(e, e.currentTarget.parentElement)}
          style={{
            cursor: "grab",
            background: "#3b5ccc", color: "#fff",
            padding: "8px 12px", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}
          title="Zum Verschieben greifen"
        >
          <span>Floating Display</span>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
            aria-label="Schließen"
          >×</button>
        </div>

        <div style={{ padding: 10, display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>
            DeviceId
            <input
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", marginTop: 4 }}
              value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ fontWeight: 600 }}>
              Scale
              <input
                type="number" min="1" max="5" step="1"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", marginTop: 4 }}
                value={scale} onChange={(e) => setScale(Number(e.target.value) || 2)}
              />
            </label>
            <label style={{ fontWeight: 600 }}>
              Poll (ms)
              <input
                type="number" min="500" step="100"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", marginTop: 4 }}
                value={poll} onChange={(e) => setPoll(Number(e.target.value) || 1000)}
              />
            </label>
          </div>
        </div>

        <div style={{ display: "grid", placeItems: "center", padding: "8px 0 12px" }}>
          <MockDisplay deviceId={deviceId} scale={scale} poll={poll} hideChrome />
        </div>
      </div>
    </>
  );
}

export default function Admin() {
  /* ───────── Data ───────── */
  const [products, setProducts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  /* ───────── Forms ───────── */
  const [pForm, setPForm] = useState({ name: "", price: "", currency: "EUR", shortId: "" });
  const [dForm, setDForm] = useState({ deviceId: "", name: "", deviceSecret: "" });
  const [linkForm, setLinkForm] = useState({ deviceId: "", productShortId: "" });

  /* ───────── Live-Mock Einstellungen ───────── */
  const [previewDeviceId, setPreviewDeviceId] = useState("ESP32-DEMO-001");
  const [previewScale, setPreviewScale] = useState(2);
  const [previewPoll, setPreviewPoll] = useState(1000);
  const [floatOpen, setFloatOpen] = useState(true); // ← standardmäßig offen

  const buyerBase = useMemo(() => window.location.origin, []);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setLoading(true);
    setMsg(null);
    try {
      const [p, d] = await Promise.all([adminListProducts(), adminListDevices()]);
      setProducts(p.products || []);
      setDevices(d.devices || []);
      if ((d.devices || []).length && !previewDeviceId) {
        setPreviewDeviceId(d.devices[0].deviceId);
      }
    } catch (e) {
      setMsg({ tone: "error", text: e.message || "Admin-API Fehler" });
    } finally {
      setLoading(false);
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

  /* ───────── Layout Styles ───────── */
  const styles = {
    container: { padding: 16, maxWidth: 1400, margin: "0 auto" },
    card: {
      width: "100%", background: "rgba(255,255,255,0.98)",
      border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14,
      boxShadow: "0 8px 24px rgba(0,0,0,0.06)", padding: 20
    },
    formWide: { display: "grid", gap: 12, maxWidth: 1100, width: "100%" },
    tableWrap: { width: "100%", overflowX: "auto" },
    table: { display: "grid", gap: 8, minWidth: 900 },
    thead: {
      display: "grid",
      gridTemplateColumns: "minmax(200px, 1.2fr) 160px 140px 140px minmax(280px, 1.2fr)",
      fontWeight: 700, fontSize: 14, color: "#334155", padding: "8px 4px", borderBottom: "1px solid #e5e7eb"
    },
    row: {
      display: "grid",
      gridTemplateColumns: "minmax(200px, 1.2fr) 160px 140px 140px minmax(280px, 1.2fr)",
      alignItems: "center", padding: "8px 4px", borderBottom: "1px solid #f1f5f9", fontSize: 14
    },
    actions: { display: "flex", gap: 8, flexWrap: "wrap" },
    btn: {
      background: "#3b5ccc", color: "#fff", border: "none", borderRadius: 10,
      padding: "8px 12px", fontWeight: 600, cursor: "pointer", textDecoration: "none"
    },
    btnGhost: {
      background: "transparent", color: "#3b5ccc", border: "1px dashed #c3cffb",
      borderRadius: 10, padding: "8px 12px", fontWeight: 600, cursor: "pointer"
    },
    input: { width: "100%", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px" },
    label: { display: "block", fontWeight: 600, marginBottom: 6 },

    layout: { display: "grid", gridTemplateColumns: "1fr", gap: 16 },
    layoutWide: { display: "grid", gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start", gap: 16 },
    sticky: { position: "sticky", top: 16 }
  };

  const isWide = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(min-width: 1100px)").matches;

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>qr2buy – Admin & Live-Display</h1>
        {!floatOpen && (
          <button style={styles.btnGhost} onClick={() => setFloatOpen(true)}>
            Floating Display öffnen
          </button>
        )}
      </div>

      {/* Layout: wenn Floating offen → nur linke Spalte; sonst 2 Spalten */}
      <div style={floatOpen ? styles.layout : (isWide ? styles.layoutWide : styles.layout)}>
        {/* Linke Spalte: Admin-Formulare & Listen */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Create Product */}
          <section style={styles.card}>
            <h2>Produkt anlegen</h2>
            <form onSubmit={createProduct} style={styles.formWide}>
              <div>
                <label style={styles.label}>Name</label>
                <input style={styles.input} value={pForm.name}
                       onChange={(e) => setPForm((s) => ({ ...s, name: e.target.value }))} required />
              </div>
              <div>
                <label style={styles.label}>Preis</label>
                <input style={styles.input} type="number" min="0" step="0.01" value={pForm.price}
                       onChange={(e) => setPForm((s) => ({ ...s, price: e.target.value }))} required />
              </div>
              <div>
                <label style={styles.label}>Währung</label>
                <input style={styles.input} value={pForm.currency}
                       onChange={(e) => setPForm((s) => ({ ...s, currency: e.target.value }))} />
              </div>
              <div>
                <label style={styles.label}>shortId (optional)</label>
                <input style={styles.input} value={pForm.shortId}
                       onChange={(e) => setPForm((s) => ({ ...s, shortId: e.target.value }))} />
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
                       onChange={(e) => setDForm((s) => ({ ...s, deviceId: e.target.value }))} required />
              </div>
              <div>
                <label style={styles.label}>Name (optional)</label>
                <input style={styles.input} value={dForm.name}
                       onChange={(e) => setDForm((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div>
                <label style={styles.label}>Device Secret (optional)</label>
                <input style={styles.input} value={dForm.deviceSecret}
                       onChange={(e) => setDForm((s) => ({ ...s, deviceSecret: e.target.value }))} />
              </div>
              <div>
                <button style={styles.btn} disabled={loading}>Anlegen</button>
              </div>
            </form>
          </section>

          {/* Link Device ↔ Product */}
          <section style={styles.card}>
            <h2>Link: Device ↔ Product</h2>
            <form onSubmit={linkDeviceProduct} style={styles.formWide}>
              <div>
                <label style={styles.label}>DeviceId</label>
                <input style={styles.input} value={linkForm.deviceId}
                       onChange={(e) => setLinkForm((s) => ({ ...s, deviceId: e.target.value }))} required />
              </div>
              <div>
                <label style={styles.label}>Product shortId</label>
                <input style={styles.input} value={linkForm.productShortId}
                       onChange={(e) => setLinkForm((s) => ({ ...s, productShortId: e.target.value }))} required />
              </div>
              <div>
                <button style={styles.btn} disabled={loading}>Verlinken</button>
              </div>
            </form>
          </section>

          {/* Produkte */}
          <section style={styles.card}>
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

          {/* Geräte */}
          <section style={styles.card}>
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
                        <button style={styles.btnGhost} onClick={() => setPreviewDeviceId(d.deviceId)}>Im Mock anzeigen</button>
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
              role="status" aria-live="polite"
            >
              {msg.text}
            </div>
          )}
        </div>

        {/* Rechte Spalte nur anzeigen, wenn Floating geschlossen ist */}
        {!floatOpen && (
          <aside style={styles.sticky}>
            <section style={styles.card}>
              <h2>Live-Mock Display</h2>
              <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                <label style={{ fontWeight: 600 }}>
                  DeviceId für Vorschau
                  <input
                    style={styles.input}
                    value={previewDeviceId}
                    onChange={(e) => setPreviewDeviceId(e.target.value)}
                    placeholder="z. B. ESP32-DEMO-001"
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ fontWeight: 600 }}>
                    Scale
                    <input
                      style={styles.input}
                      type="number" min="1" max="5" step="1"
                      value={previewScale}
                      onChange={(e) => setPreviewScale(Number(e.target.value) || 2)}
                    />
                  </label>
                  <label style={{ fontWeight: 600 }}>
                    Poll (ms)
                    <input
                      style={styles.input}
                      type="number" min="500" step="100"
                      value={previewPoll}
                      onChange={(e) => setPreviewPoll(Number(e.target.value) || 1000)}
                    />
                  </label>
                </div>
                <button style={styles.btnGhost} onClick={() => setFloatOpen(true)}>
                  Als Floating-Modal öffnen
                </button>
                <a
                  href={`/mock/${encodeURIComponent(previewDeviceId)}?scale=${previewScale}&poll=${previewPoll}`}
                  target="_blank" rel="noreferrer"
                  style={styles.btnGhost}
                  title="In neuem Tab öffnen"
                >
                  Im neuen Tab öffnen
                </a>
              </div>

              <div style={{ display: "grid", placeItems: "center" }}>
                <MockDisplay
                  deviceId={previewDeviceId}
                  scale={previewScale}
                  poll={previewPoll}
                  hideChrome
                />
              </div>
            </section>
          </aside>
        )}
      </div>

      {/* Draggable Floating Modal */}
      <FloatingMock
        open={floatOpen}
        onClose={() => setFloatOpen(false)}
        deviceId={previewDeviceId}
        setDeviceId={setPreviewDeviceId}
        scale={previewScale}
        setScale={setPreviewScale}
        poll={previewPoll}
        setPoll={setPreviewPoll}
      />
    </div>
  );
}
