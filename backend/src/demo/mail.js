import crypto from 'crypto';
import tls from 'tls';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

export function validDemoEmail(value) {
  const email = String(value || '').trim();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function maskDemoEmail(value) {
  const email = validDemoEmail(value);
  if (!email) return null;
  const [local, domain] = email.split('@');
  const domainParts = domain.split('.');
  const domainName = domainParts.shift();
  const suffix = domainParts.join('.');
  return `${local.slice(0, 1)}***@${domainName.slice(0, 1)}***${suffix ? `.${suffix}` : ''}`;
}

function money(value, currency, locale) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'de-DE', { style: 'currency', currency }).format(value);
}

export function buildDemoMail({ product, demoOrderNumber, demoDate, locale = 'de' }) {
  const language = locale === 'en' ? 'en' : 'de';
  const english = language === 'en';
  const subject = english ? '[DEMO] Your qr2buy confirmation – no charge' : '[DEMO] Deine qr2buy-Bestätigung – keine Abbuchung';
  const price = money(product.price, product.currency, language);
  const date = new Intl.DateTimeFormat(english ? 'en-GB' : 'de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(demoDate);
  const disclaimer = 'DEMO-BELEG · KEINE ECHTE RECHNUNG · NICHT STEUERLICH GÜLTIG';
  const labels = english ? {
    confirmed: 'Stripe test payment confirmed', product: 'Product', order: 'Demo order', price: 'Test price', date: 'Demo date',
    status: 'Status', noCharge: 'No charge', noOrder: 'No real order, delivery or reservation is created outside this demo.',
    purpose: 'This message only demonstrates the future qr2buy flow.', privacy: 'Your email address is used only for this single demo message.',
    explanation: 'This demo receipt only demonstrates the future qr2buy flow. It is not a payment request or real invoice and does not create an order, delivery or reservation.',
    contact: 'No marketing, newsletter or later contact.'
  } : {
    confirmed: 'Stripe-Testzahlung bestätigt', product: 'Produkt', order: 'Demo-Auftrag', price: 'Testpreis', date: 'Demo-Datum',
    status: 'Status', noCharge: 'Keine Abbuchung', noOrder: 'Es besteht keine echte Bestellung, Lieferung oder Reservierung außerhalb dieser Demo.',
    purpose: 'Diese Nachricht demonstriert ausschließlich den künftigen qr2buy-Ablauf.', privacy: 'Deine E-Mail-Adresse wird nur für diese eine Demo-Nachricht verwendet.',
    explanation: 'Dieser Demo-Beleg demonstriert ausschließlich den künftigen qr2buy-Ablauf. Er ist keine Zahlungsforderung, keine echte Rechnung und begründet keine Bestellung, Lieferung oder Reservierung.',
    contact: 'Kein Marketing, kein Newsletter, keine spätere Kontaktaufnahme.'
  };
  const text = [
    'qr2buy · LIVE-DEMO', '', labels.confirmed,
    `${labels.product}: ${product.name[language]}`, `${labels.order}: ${demoOrderNumber}`,
    `${labels.price}: ${price}`, '', disclaimer, `DEMO RECEIPT · NOT A REAL INVOICE · NOT VALID FOR TAX PURPOSES`,
    `${labels.date}: ${date}`, `${labels.status}: ${labels.noCharge}`, '', labels.noOrder, labels.purpose, labels.privacy
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f3efe6;color:#17251f;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#153d30;color:#fff;padding:24px;border-radius:18px 18px 0 0"><strong style="font-size:24px">qr2buy</strong><div style="margin-top:8px;color:#d8e9dc;font-size:12px;letter-spacing:.12em">LIVE-DEMO</div></div><div style="background:#fff;padding:28px;border-radius:0 0 18px 18px"><h1 style="margin:0 0 10px;font-size:26px">${labels.confirmed}</h1><p style="margin:0 0 22px;color:#59685f">${labels.noCharge}. ${labels.noOrder}</p><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:9px 0;color:#6b766f">${labels.product}</td><td style="padding:9px 0;text-align:right;font-weight:bold">${escapeHtml(product.name[language])}</td></tr><tr><td style="padding:9px 0;color:#6b766f">${labels.order}</td><td style="padding:9px 0;text-align:right;font-weight:bold">${escapeHtml(demoOrderNumber)}</td></tr><tr><td style="padding:9px 0;color:#6b766f">${labels.price}</td><td style="padding:9px 0;text-align:right;font-weight:bold">${escapeHtml(price)}</td></tr><tr><td style="padding:9px 0;color:#6b766f">${labels.date}</td><td style="padding:9px 0;text-align:right">${escapeHtml(date)}</td></tr><tr><td style="padding:9px 0;color:#6b766f">${labels.status}</td><td style="padding:9px 0;text-align:right;font-weight:bold">${labels.noCharge}</td></tr></table><div style="margin-top:24px;padding:18px;border:3px solid #b9553b;background:#fff4ef;color:#7a2f20;font-weight:bold;text-align:center">${disclaimer}<br>DEMO RECEIPT · NOT A REAL INVOICE · NOT VALID FOR TAX PURPOSES</div><p style="margin:22px 0 0;line-height:1.6;color:#536159">${labels.explanation}</p><p style="margin:16px 0 0;font-size:12px;color:#718078">${labels.contact}</p></div></div></body></html>`;
  return { subject, text, html };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(safeHeader(value)).toString('base64')}?=`;
}

function encodeBody(value) {
  return Buffer.from(value).toString('base64').match(/.{1,76}/g).join('\r\n');
}

function smtpMessage({ from, to, subject, text, html }) {
  const boundary = `qr2buy-${crypto.randomBytes(12).toString('hex')}`;
  const headers = [
    `From: qr2buy Live-Demo <${safeHeader(from)}>`, `To: ${safeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`, 'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    'Auto-Submitted: auto-generated', 'X-Auto-Response-Suppress: All'
  ];
  const body = [
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodeBody(text),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodeBody(html),
    `--${boundary}--`, ''
  ];
  return [...headers, '', ...body].join('\r\n').replace(/^\./gm, '..');
}

function smtpTlsSend(config, message) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: config.host, port: config.port, servername: config.host, rejectUnauthorized: true });
    socket.setTimeout(config.timeoutMs);
    let buffer = '';
    const pending = [];
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      error ? reject(error) : resolve();
    };

    const readResponse = () => new Promise((responseResolve, responseReject) => pending.push({ responseResolve, responseReject }));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!/^\d{3}[ -]/.test(line)) continue;
        if (line[3] === '-') continue;
        const waiter = pending.shift();
        if (!waiter) continue;
        const code = Number(line.slice(0, 3));
        if (code >= 200 && code < 400) waiter.responseResolve(code);
        else waiter.responseReject(new Error('smtp_rejected'));
      }
    });
    socket.on('timeout', () => finish(new Error('smtp_timeout')));
    socket.on('error', () => finish(new Error('smtp_connection_failed')));
    socket.on('close', () => { if (!settled) finish(new Error('smtp_connection_closed')); });

    socket.on('secureConnect', async () => {
      try {
        await readResponse();
        const command = async (value) => { socket.write(`${value}\r\n`); return readResponse(); };
        await command(`EHLO ${config.helloName}`);
        if (config.user) await command(`AUTH PLAIN ${Buffer.from(`\0${config.user}\0${config.pass}`).toString('base64')}`);
        await command(`MAIL FROM:<${config.from}>`);
        await command(`RCPT TO:<${config.to}>`);
        await command('DATA');
        socket.write(`${message}\r\n.\r\n`);
        await readResponse();
        socket.write('QUIT\r\n');
        finish();
      } catch (error) {
        finish(error);
      }
    });
  });
}

export function createDemoMailTransport(env = process.env) {
  const mode = String(env.DEMO_MAIL_TRANSPORT || 'disabled').toLowerCase();
  const from = validDemoEmail(env.DEMO_SMTP_FROM);
  const host = String(env.DEMO_SMTP_HOST || '').trim();
  const port = Number(env.DEMO_SMTP_PORT || 465);
  const user = String(env.DEMO_SMTP_USER || '');
  const pass = String(env.DEMO_SMTP_PASS || '');
  const helloName = safeHeader(env.DEMO_SMTP_HELO_NAME || '');
  const configured = mode === 'smtp' && from && host && user && pass && helloName && Number.isInteger(port) && port > 0 && port <= 65535;
  if (!configured) return { async send() { return { accepted: false, status: 'UNAVAILABLE' }; } };
  return {
    async send({ to, subject, text, html }) {
      const safeTo = validDemoEmail(to);
      if (!safeTo) return { accepted: false, status: 'UNAVAILABLE' };
      await smtpTlsSend({
        host, port, from, to: safeTo,
        user, pass, helloName, timeoutMs: 10_000
      }, smtpMessage({ from, to: safeTo, subject, text, html }));
      return { accepted: true, status: 'ACCEPTED' };
    }
  };
}

export function createMemoryDemoMailTransport({ fail = false } = {}) {
  const messages = [];
  return {
    messages,
    async send(message) {
      if (fail) throw new Error('mock_mail_failure');
      messages.push(structuredClone(message));
      return { accepted: true, status: 'ACCEPTED' };
    }
  };
}
