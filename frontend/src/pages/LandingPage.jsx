// C:\QR\frontend\src\pages\LandingPage.jsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * qr2buy – Landing Page (Investor-/Customer-ready)
 * JS-only, keine externen UI-Libs
 * Änderungen:
 * 1) QR-Demo-Bild (https://www.ecily.com)
 * 2) Online-Dot mit dezenter grüner Pulse-Animation
 * 3) Vereinfachte Sprache im Abschnitt „Sicherheit, Compliance & Betrieb“
 * 4) Footer: © 2025 ecily.com/Webentwicklung (verlinkt)
 * 5) Mail auf andreas.franz@ecily.com
 * 6) Mock-Display: Kein „Scan & Buy“-Button (realistischer)
 * 7) Live-Demo-Buttons navigieren als SPA-Link zu /admin (kein Server-Reload, kein 404)
 */

const colors = {
  brand: "var(--brand)",
  ink: "var(--brand-ink)",
  text: "var(--text)",
  muted: "var(--muted)",
  bg: "var(--bg)",
  panel: "var(--panel)",
  border: "var(--border)",
  ok: "var(--ok)",
};

const Container = ({ children, wide = false, style }) => (
  <div
    style={{
      maxWidth: wide ? 1200 : 980,
      margin: "0 auto",
      padding: "0 20px",
      ...style,
    }}
  >
    {children}
  </div>
);

const Logo = ({ size = 22 }) => (
  <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4, fontWeight: 800 }}>
    <span style={{ fontSize: size, lineHeight: 1, color: colors.brand }}>qr</span>
    <sup
      aria-label="hochgestellte 2"
      style={{
        fontSize: Math.round(size * 0.65),
        transform: "translateY(-0.25em)",
        color: colors.brand,
        fontWeight: 900,
        opacity: 0.9,
      }}
    >
      2
    </sup>
    <span style={{ fontSize: size, lineHeight: 1, color: colors.brand }}>buy</span>
  </div>
);

const Pill = ({ children }) => (
  <span
    style={{
      display: "inline-block",
      padding: "6px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.2,
      background: "rgba(127,130,140,0.08)",
      color: colors.muted,
      border: `1px solid ${colors.border}`,
    }}
  >
    {children}
  </span>
);

/**
 * Button: unterstützt
 * - to="/pfad"  → React Router Link (SPA, kein 404)
 * - href="https://…" → normales <a>
 * - sonst <button>
 */
const Button = ({ children, variant = "primary", onClick, href, to }) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
    border: "1px solid transparent",
    transition: "transform 120ms ease, filter 120ms ease, background 120ms ease, border-color 120ms ease",
    cursor: "pointer",
    willChange: "transform",
  };
  const styles = {
    primary: {
      background: colors.brand,
      color: "var(--brand-ink)",
      border: `1px solid ${colors.brand}`,
    },
    ghost: {
      background: "transparent",
      color: colors.text,
      border: `1px solid ${colors.border}`,
    },
  };

  const commonHandlers = {
    onMouseDown: (e) => (e.currentTarget.style.transform = "translateY(1px)"),
    onMouseUp:   (e) => (e.currentTarget.style.transform = "translateY(0)"),
    onMouseLeave:(e) => (e.currentTarget.style.transform = "translateY(0)"),
  };

  if (to) {
    return (
      <Link to={to} onClick={onClick} style={{ ...base, ...styles[variant] }} {...commonHandlers}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} onClick={onClick} style={{ ...base, ...styles[variant] }} {...commonHandlers}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} style={{ ...base, ...styles[variant] }} {...commonHandlers}>
      {children}
    </button>
  );
};

const Stat = ({ value, label }) => (
  <div
    style={{
      background: colors.panel,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 14,
      boxShadow: "var(--shadow)",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 22, fontWeight: 800, color: colors.text }}>{value}</div>
    <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{label}</div>
  </div>
);

const Check = ({ children }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <span aria-hidden style={{ marginTop: 2 }}>✔️</span>
    <span style={{ color: colors.muted, lineHeight: 1.6 }}>{children}</span>
  </div>
);

const FeatureCard = ({ title, text, icon }) => (
  <div
    style={{
      background: colors.panel,
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: 18,
      display: "flex",
      gap: 14,
      alignItems: "flex-start",
      boxShadow: "var(--shadow)",
    }}
  >
    <div
      aria-hidden
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: "rgba(127,130,140,0.08)",
        display: "grid",
        placeItems: "center",
        color: colors.brand,
        fontSize: 18,
        fontWeight: 800,
      }}
    >
      {icon}
    </div>
    <div>
      <h3 style={{ margin: "2px 0 6px", fontSize: 17, color: colors.text }}>{title}</h3>
      <p style={{ margin: 0, color: colors.muted, lineHeight: 1.6 }}>{text}</p>
    </div>
  </div>
);

export default function LandingPage() {
  useEffect(() => {
    document.title = "qr2buy – From window to checkout.";
  }, []);

  return (
    <div
      style={{
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
        color: colors.text,
        background: colors.bg,
      }}
    >
      {/* Inline Keyframes für den grünen Online-Dot */}
      <style>{`
        @keyframes pulse {
          0% { opacity: .35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1); }
          100% { opacity: .35; transform: scale(0.9); }
        }
        .dot-online {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 999px;
          background: ${colors.ok};
          margin: 0 6px;
          animation: pulse 1.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .dot-online { animation: none; }
        }
      `}</style>

      {/* NAV */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: colors.panel,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Container
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
          }}
        >
          <a href="/" aria-label="qr2buy home"><Logo size={20} /></a>
          <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="#case" style={{ color: colors.muted, textDecoration: "none", fontWeight: 600 }}>
              Buchhändler-Case
            </a>
            <a href="#how" style={{ color: colors.muted, textDecoration: "none", fontWeight: 600 }}>
              So funktioniert’s
            </a>
            <a href="#trust" style={{ color: colors.muted, textDecoration: "none", fontWeight: 600 }}>
              Sicherheit/DSGVO
            </a>
            {/* SPA-Link zur Admin-Seite */}
            <Button to="/admin" variant="primary">Live-Demo</Button>
          </nav>
        </Container>
      </header>

      {/* HERO */}
      <section style={{ background: colors.panel }}>
        <Container wide style={{ padding: "54px 20px 28px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div>
              <Pill>24/7 „Through-the-glass“ Commerce</Pill>
              <h1
                style={{
                  fontSize: 44,
                  lineHeight: 1.08,
                  margin: "14px 0 10px",
                  letterSpacing: -0.2,
                  color: colors.text,
                }}
              >
                From <span style={{ color: colors.brand }}>window</span> to{" "}
                <span style={{ color: colors.brand }}>checkout</span> — in unter 60 Sekunden.
              </h1>
              <p style={{ margin: "0 0 18px", fontSize: 18, color: colors.muted, lineHeight: 1.7 }}>
                qr2buy macht jedes sichtbare Produkt sofort kaufbar: QR scannen, mobil bezahlen,
                Rechnung automatisch per E-Mail. Kein Personal, keine App — das Display bestätigt
                in Echtzeit: <strong>„Danke“ → „VERKAUFT!“</strong>
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {/* SPA-Link zur Admin-Seite */}
                <Button to="/admin" variant="primary">Live-Demo öffnen</Button>
                <Button href="#case" variant="ghost">Buchhändler-Beispiel</Button>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <Stat value="< 60 s" label="vom Scan bis zum Bezahl-Finish" />
                <Stat value="24/7" label="Umsatz außerhalb der Öffnungszeiten" />
                <Stat value="0 Apps" label="Kamera reicht • DSGVO-konform" />
              </div>
            </div>

            {/* Device Mock */}
            <div style={{ display: "grid", placeItems: "center" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: 520,
                  aspectRatio: "16/10",
                  borderRadius: 20,
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  boxShadow: "var(--shadow)",
                  padding: 20,
                }}
                aria-label="Geräte-Vorschau"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Logo size={16} />
                  <span style={{ fontSize: 12, color: colors.muted }}>
                    #Display-A12 <span className="dot-online" aria-hidden /> Online
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, height: "calc(100% - 32px)" }}>
                  {/* QR: Demo für https://www.ecily.com */}
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      display: "grid",
                      placeItems: "center",
                      background: "#fff",
                      padding: 12,
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent("https://www.ecily.com")}`}
                      alt="QR-Demo: https://www.ecily.com"
                      width={180}
                      height={180}
                      style={{ display: "block" }}
                    />
                  </div>

                  {/* Produktkarte – ohne CTA-Button (realistisches Display) */}
                  <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, color: colors.text }}>Roman „Stadtlichter“</div>
                    <div style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>Hardcover • sofort verfügbar</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: colors.text }}>€ 24,90</span>
                      <span style={{ fontSize: 12, color: colors.muted }}>inkl. USt</span>
                    </div>
                    {/* Optischer Ausgleich statt CTA */}
                    <div style={{ height: 6 }} />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </Container>
      </section>

      {/* BUCHHÄNDLER CASE */}
      <section id="case" style={{ padding: "48px 0", borderTop: `1px solid ${colors.border}`, background: colors.bg }}>
        <Container wide>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 28, margin: "0 0 12px" }}>Fallstudie: Innenstadt-Buchhändler</h2>
              <p style={{ color: colors.muted, margin: "0 0 16px", lineHeight: 1.7 }}>
                Abends & am Wochenende bleibt die Tür zu — die Auslage wirkt trotzdem. Ein qr2buy-Display vor dem Produkt reicht: QR scannen, mobil bezahlen – ganz ohne Verkäufer, in unter einer Minute.
                <strong> Scannen → Checkout → Bestätigung am Display. Fertig</strong>.
              </p>

              <div style={{ display: "grid", gap: 12 }}>
                <Check><strong>+12–25 % zusätzlicher Umsatz</strong> außerhalb der Öffnungszeiten (Innenstadt-Lagen mit hoher Frequenz profitieren besonders).</Check>
                <Check><strong>{'< 60 Sekunden'} End-to-End</strong> von QR-Scan bis Zahlung — kein Account, keine App.</Check>
                <Check><strong>„Danke → VERKAUFT!“</strong> Live-Update auf dem Display reduziert Doppelverkäufe und steigert Vertrauen.</Check>
                <Check><strong>Zustellung/Abholung</strong> direkt im Checkout wählbar; automatische AT-Rechnung per E-Mail.</Check>
                <Check><strong>Bestandssync</strong> im Dashboard; Produkte anlegen/ändern, Displays zuordnen, Telemetrie in Echtzeit.</Check>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
                <Stat value="≈ 1 min" label="Zeit bis Kaufabschluss" />
                <Stat value="0 Personal" label="auch außerhalb der Öffnungszeiten" />
                <Stat value="100 %" label="automatisierte Belege (AT)" />
              </div>
            </div>

            <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, boxShadow: "var(--shadow)", padding: 18 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 17 }}>Ablauf am Beispiel „Buch in der Auslage“</h3>
              <ol style={{ margin: 0, paddingLeft: 18, color: colors.muted, lineHeight: 1.7 }}>
                <li>Kundin scannt den QR im Schaufenster (Kamera-App reicht).</li>
                <li>Stripe Checkout öffnet: Titel ist vorausgewählt, Preis fixiert.</li>
                <li>Option „Zustellen“ oder „Zur Abholung reservieren“ wählen.</li>
                <li>Zahlung abschließen → Display zeigt „Danke“ → „VERKAUFT!“.</li>
                <li>PDF-Rechnung (AT-konform) kommt automatisch per E-Mail.</li>
              </ol>
              <hr style={{ border: "none", borderTop: `1px solid ${colors.border}`, margin: "14px 0" }} />
              <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Mehrwert auf einen Blick</h4>
              <ul style={{ margin: 0, paddingLeft: 18, color: colors.muted, lineHeight: 1.7 }}>
                <li>Monetarisiert Abend-/Wochenend-Frequenz ohne Personal.</li>
                <li>Verhindert Kauf-Abbruch: Impuls trifft Checkout ohne Reibung.</li>
                <li>Live-Signal am Display (Vertrauen, Knappheit, Social Proof).</li>
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "48px 0", background: colors.panel, borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }}>
        <Container>
          <h2 style={{ fontSize: 28, margin: "0 0 12px" }}>So funktioniert’s</h2>
          <p style={{ margin: "0 0 18px", color: colors.muted }}>
            Produkte im Web anlegen → Display zuordnen → Kunde scannt QR → Stripe-Checkout →
            <strong> „Danke“</strong> → <strong>„VERKAUFT!“</strong> → Rechnung per E-Mail.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <FeatureCard icon="①" title="Anlegen" text="Preis, Beschreibung & Bestand im Dashboard pflegen. Jedem Produkt wird ein Display zugeteilt." />
            <FeatureCard icon="②" title="Scannen" text="Passant:in scannt den QR-Code mit der Handy-Kamera — keine App nötig." />
            <FeatureCard icon="③" title="Kaufen" text="Checkout in Sekunden. Display zeigt ‚Danke‘ → ‚VERKAUFT!‘. Bestand & Beleg laufen automatisch." />
          </div>
        </Container>
      </section>

      {/* TRUST / SECURITY / DSGVO – vereinfacht */}
      <section id="trust" style={{ padding: "44px 0", background: colors.bg }}>
        <Container>
          <h2 style={{ fontSize: 28, margin: "0 0 12px" }}>Sicherheit, Compliance & Betrieb</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <Check><strong>Bewährte Zahlung mit Stripe</strong> – sicher, vertraut, weltweit im Einsatz.</Check>
              <Check><strong>Datenschutz zuerst</strong> – wir verwenden nur, was nötig ist (z. B. E-Mail für die Rechnung).</Check>
              <Check><strong>Immer aktuell</strong> – Geräte erhalten bei Bedarf Updates und bleiben zuverlässig.</Check>
              <Check><strong>Auch offline robust</strong> – das Display behält den letzten Stand, falls die Verbindung hakt.</Check>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Check><strong>Klare Zugriffsregeln</strong> – jedes Gerät ist eindeutig und nur für seine Aufgaben freigeschaltet.</Check>
              <Check><strong>Transparenter Betrieb</strong> – Status & Verkäufe sind live im Dashboard sichtbar.</Check>
              <Check><strong>Skalierbar gedacht</strong> – wächst mit der Anzahl deiner Produkte und Standorte.</Check>
              <Check><strong>Konforme Belege</strong> – automatische, rechtskonforme Rechnungen (AT).</Check>
            </div>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section id="demo" style={{ padding: "54px 0", background: colors.panel }}>
        <Container style={{ textAlign: "center" }}>
          <Pill>Ready to try</Pill>
          <h2 style={{ fontSize: 30, margin: "12px 0 8px" }}>Your window, now a store.</h2>
          <p style={{ color: colors.muted, margin: "0 0 18px" }}>
            In 10 Minuten zeigen wir dir den kompletten „Scan → Pay → VERKAUFT!“-Flow an einem realen Beispiel.
          </p>
          <Button href="mailto:andreas.franz@ecily.com?subject=Demo%20anfragen%20zu%20qr2buy" variant="primary">
            Kurze Demo anfragen
          </Button>
        </Container>
      </section>

      {/* FOOTER */}
      <footer id="contact" style={{ background: colors.panel }}>
        <Container
          style={{
            padding: "20px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={16} />
            <span style={{ color: colors.muted, fontSize: 14 }}>
              © 2025 <a href="https://www.ecily.com" target="_blank" rel="noreferrer noopener" style={{ color: colors.text, textDecoration: "none", fontWeight: 600 }}>ecily.com/Webentwicklung</a>
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a href="#" style={{ color: colors.muted, textDecoration: "none" }}>Impressum</a>
            <a href="#" style={{ color: colors.muted, textDecoration: "none" }}>Datenschutz</a>
            <a
              href="mailto:andreas.franz@ecily.com"
              style={{ color: colors.brand, textDecoration: "none", fontWeight: 600 }}
            >
              andreas.franz@ecily.com
            </a>
          </div>
        </Container>
      </footer>

      {/* RESPONSIVE */}
      <style>{`
        @media (max-width: 1024px) {
          h1 { font-size: 36px !important; }
          section > div[style*="grid-template-columns: 1.1fr 0.9fr"] { grid-template-columns: 1fr !important; }
          section > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      @media (max-width: 720px) {
          h1 { font-size: 30px !important; }
          section > div[style*="grid-template-columns: repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
