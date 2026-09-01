import crypto from 'crypto';
import Stripe from 'stripe';
import { DEMO_STATUS } from '../models.js';
import { DEMO_PRODUCTS, getDemoProduct, isUniqueDemoProduct, publicDemoProduct } from './catalog.js';
import { buildDemoMail, createDemoMailTransport, maskDemoEmail, validDemoEmail } from './mail.js';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const RESET_MS = 20_000;
const CHECKOUT_TIMEOUT_MS = 15 * 60 * 1000;

export class DemoError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'DemoError';
    this.code = code;
    this.status = status;
  }
}

export function hashDemoToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function assertDemoToken(token) {
  if (!TOKEN_PATTERN.test(String(token || ''))) {
    throw new DemoError('invalid_session', 404);
  }
  return String(token);
}

function defaultTokenFactory() {
  return crypto.randomBytes(32).toString('base64url');
}

function defaultSchedule(delayMs, callback) {
  const timer = setTimeout(callback, delayMs);
  timer.unref?.();
}

function configuredTtlMs(rawValue) {
  const minutes = Number(rawValue ?? 120);
  return Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440
    ? minutes * 60_000
    : DEFAULT_TTL_MS;
}

function productState(session, productKey) {
  return session?.products?.find((item) => item.productKey === productKey) || null;
}

function serializeProductState(item) {
  return {
    productKey: item.productKey,
    status: item.status,
    eventVersion: item.eventVersion,
    changedAt: new Date(item.changedAt).toISOString(),
    resetAt: item.resetAt ? new Date(item.resetAt).toISOString() : null,
    demoOrderNumber: item.demoOrderNumber || null,
    paidAt: item.paidAt ? new Date(item.paidAt).toISOString() : null,
    mailStatus: item.mailStatus || 'NONE'
  };
}

function serializeSnapshot(session) {
  return {
    ok: true,
    session: {
      expiresAt: new Date(session.expiresAt).toISOString(),
      products: session.products.map((item) => serializeProductState(item))
    },
    products: DEMO_PRODUCTS.map(publicDemoProduct)
  };
}

function privateHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function publicBaseUrl(value, requirePublicHttps) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    if (url.username || url.password) throw new Error('credentials not allowed');
    if (requirePublicHttps && (url.protocol !== 'https:' || privateHostname(url.hostname))) {
      throw new Error('public https required');
    }
    return url.origin;
  } catch {
    throw new DemoError('invalid_public_base_url', 500);
  }
}

export function createStripeDemoClient(secretKey = process.env.STRIPE_DEMO_SECRET_KEY) {
  if (!secretKey || !secretKey.startsWith('sk_test_')) {
    throw new DemoError('demo_checkout_unavailable', 503);
  }
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

export function constructDemoWebhookEvent({ stripe, rawBody, signature, secret }) {
  if (!secret || !signature || !Buffer.isBuffer(rawBody)) {
    throw new DemoError('invalid_webhook_signature', 400);
  }
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new DemoError('invalid_webhook_signature', 400);
  }
}

export function createDemoService({
  repository,
  stripeClientFactory = () => createStripeDemoClient(),
  now = () => new Date(),
  tokenFactory = defaultTokenFactory,
  ttlMs = configuredTtlMs(process.env.DEMO_SESSION_TTL_MINUTES),
  schedule = defaultSchedule,
  broadcast = () => {},
  mailTransport = createDemoMailTransport(),
  requirePublicHttps = process.env.NODE_ENV === 'production'
}) {
  if (!repository) throw new Error('demo repository required');
  const maskedMailHints = new Map();

  function mailHintKey(sessionId, productKey) {
    return `${sessionId}:${productKey}`;
  }

  async function normalize(tokenHash) {
    const current = now();
    return repository.resetDue(
      tokenHash,
      current,
      new Date(current.getTime() - CHECKOUT_TIMEOUT_MS)
    );
  }

  async function requireSession(token) {
    const safeToken = assertDemoToken(token);
    const tokenHash = hashDemoToken(safeToken);
    const session = await normalize(tokenHash);
    if (!session || new Date(session.expiresAt) <= now()) {
      throw new DemoError('session_expired', 404);
    }
    return { safeToken, tokenHash, session };
  }

  async function publish(tokenHash, session) {
    const snapshot = serializeSnapshot(session);
    broadcast(tokenHash, snapshot);
    return snapshot;
  }

  function scheduleProductReset(tokenHash, productKey, resetAt) {
    const delay = Math.max(0, new Date(resetAt).getTime() - now().getTime());
    schedule(delay, async () => {
      try {
        const session = await normalize(tokenHash);
        if (session) await publish(tokenHash, session);
      } catch {
        // Polling and the next status request provide the durable fallback.
      }
    });
  }

  return {
    async createSession() {
      const token = tokenFactory();
      assertDemoToken(token);
      const createdAt = now();
      const session = await repository.create({
        tokenHash: hashDemoToken(token),
        products: DEMO_PRODUCTS.map((product) => ({
          productKey: product.key,
          status: DEMO_STATUS.READY,
          eventVersion: 0,
          changedAt: createdAt
        })),
        processedWebhookEvents: [],
        expiresAt: new Date(createdAt.getTime() + ttlMs)
      });
      return { token, ...serializeSnapshot(session) };
    },

    async getSnapshot(token) {
      const { session } = await requireSession(token);
      return serializeSnapshot(session);
    },

    async getProduct(token, productKey) {
      const product = getDemoProduct(productKey);
      if (!product) throw new DemoError('product_not_found', 404);
      const { session } = await requireSession(token);
      const state = productState(session, productKey);
      if (!state) throw new DemoError('product_not_found', 404);
      const hintKey = mailHintKey(session._id, productKey);
      if (state.status !== DEMO_STATUS.PAID) maskedMailHints.delete(hintKey);
      return {
        ok: true,
        product: publicDemoProduct(product),
        state: { ...serializeProductState(state), maskedEmail: maskedMailHints.get(hintKey) || null }
      };
    },

    async reserve(token, productKey) {
      const product = getDemoProduct(productKey);
      if (!product) throw new DemoError('product_not_found', 404);
      const { tokenHash } = await requireSession(token);
      const changedAt = now();
      const resetAt = isUniqueDemoProduct(productKey) ? null : new Date(changedAt.getTime() + RESET_MS);
      const session = await repository.reserve(tokenHash, productKey, changedAt, resetAt);
      if (!session) throw new DemoError('product_busy', 409);
      if (resetAt) scheduleProductReset(tokenHash, productKey, resetAt);
      return publish(tokenHash, session);
    },

    async startCheckout(token, productKey, baseUrl, locale = 'de') {
      const product = getDemoProduct(productKey);
      if (!product) throw new DemoError('product_not_found', 404);
      const { tokenHash, session: initialSession } = await requireSession(token);
      const operationId = crypto.randomUUID();
      const changedAt = now();
      const claimed = await repository.claimCheckout(tokenHash, productKey, operationId, changedAt);
      if (!claimed) throw new DemoError('product_busy', 409);
      await publish(tokenHash, claimed);

      try {
        const stripe = stripeClientFactory();
        const origin = publicBaseUrl(baseUrl, requirePublicHttps);
        const returnPath = `/demo/p/${encodeURIComponent(productKey)}`;
        const checkoutLocale = locale === 'en' ? 'en' : 'de';
        const checkoutNotice = checkoutLocale === 'en'
          ? 'LIVE DEMO: No charge and no real order. Use test card 4242 4242 4242 4242 only.'
          : 'LIVE-DEMO: Keine Abbuchung und keine echte Bestellung. Nur Testkarte 4242 4242 4242 4242 verwenden.';
        const addressNotice = checkoutLocale === 'en'
          ? 'Use fictional test details for name and shipping address.'
          : 'Für Name und Lieferadresse bitte frei erfundene Testdaten verwenden.';
        const checkout = await stripe.checkout.sessions.create({
          mode: 'payment',
          locale: checkoutLocale,
          success_url: `${origin}${returnPath}?checkout=return`,
          cancel_url: `${origin}${returnPath}?checkout=cancelled`,
          payment_method_types: ['card'],
          wallet_options: { link: { display: 'never' } },
          customer_creation: 'if_required',
          billing_address_collection: 'auto',
          shipping_address_collection: {
            allowed_countries: ['AT', 'DE', 'CH']
          },
          custom_text: {
            submit: { message: checkoutNotice },
            shipping_address: { message: addressNotice }
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: product.currency.toLowerCase(),
                unit_amount: Math.round(product.price * 100),
                product_data: {
                  name: product.name[checkoutLocale],
                  description: 'qr2buy Live-Demo – keine echte Bestellung oder Lieferung'
                }
              }
            }
          ],
          payment_intent_data: {
            description: `qr2buy Live-Demo – ${product.name.de} – keine echte Bestellung oder Lieferung`
          },
          metadata: {
            flow: 'qr2buy_demo',
            demoSessionId: String(initialSession._id),
            demoProductKey: product.key,
            demoTokenHash: tokenHash,
            demoLocale: checkoutLocale
          }
        });

        const attached = await repository.attachCheckout(
          tokenHash,
          productKey,
          operationId,
          checkout.id,
          now()
        );
        if (!attached) throw new Error('checkout state lost');
        await publish(tokenHash, attached);
        return { ok: true, url: checkout.url };
      } catch (error) {
        const rolledBack = await repository.rollbackCheckout(tokenHash, productKey, operationId, now());
        if (rolledBack) await publish(tokenHash, rolledBack);
        if (error instanceof DemoError) throw error;
        throw new DemoError('checkout_unavailable', 503);
      }
    },

    async cancelCheckout(token, productKey) {
      if (!getDemoProduct(productKey)) throw new DemoError('product_not_found', 404);
      const { tokenHash } = await requireSession(token);
      const changedAt = now();
      const resetAt = new Date(changedAt.getTime() + RESET_MS);
      const session = await repository.cancel(tokenHash, productKey, changedAt, resetAt);
      if (!session) {
        const current = await requireSession(token);
        return serializeSnapshot(current.session);
      }
      scheduleProductReset(tokenHash, productKey, resetAt);
      return publish(tokenHash, session);
    },

    async processWebhookEvent(event) {
      if (!event || !event.id) throw new DemoError('invalid_webhook_event', 400);
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
        return { ok: true, ignored: true };
      }

      const eventCheckout = event.data?.object;
      if (event.livemode !== false) throw new DemoError('live_event_rejected', 400);
      if (eventCheckout?.metadata?.flow !== 'qr2buy_demo') return { ok: true, ignored: true };
      if (!eventCheckout.id) throw new DemoError('invalid_webhook_event', 400);
      if (event.type === 'checkout.session.completed' && eventCheckout.payment_status !== 'paid') {
        return { ok: true, ignored: true, waitingForPayment: true };
      }

      const stripe = stripeClientFactory();
      let checkout;
      try {
        checkout = await stripe.checkout.sessions.retrieve(eventCheckout.id);
      } catch {
        throw new DemoError('checkout_verification_failed', 503);
      }
      if (checkout?.livemode !== false) throw new DemoError('live_event_rejected', 400);
      if (checkout?.payment_status !== 'paid') return { ok: true, ignored: true, waitingForPayment: true };
      if (
        checkout.metadata?.flow !== 'qr2buy_demo' ||
        checkout.metadata?.demoSessionId !== eventCheckout.metadata?.demoSessionId ||
        checkout.metadata?.demoProductKey !== eventCheckout.metadata?.demoProductKey
      ) throw new DemoError('invalid_webhook_event', 400);

      const sessionId = checkout.metadata.demoSessionId;
      const productKey = checkout.metadata.demoProductKey;
      if (!sessionId || !getDemoProduct(productKey) || !checkout.id) {
        throw new DemoError('invalid_webhook_event', 400);
      }

      const changedAt = now();
      const resetAt = new Date(changedAt.getTime() + RESET_MS);
      const demoOrderNumber = `DEMO-${changedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.createHash('sha256').update(checkout.id).digest('hex').slice(0, 8).toUpperCase()}`;
      const session = await repository.markPaid({
        sessionId,
        productKey,
        checkoutSessionId: checkout.id,
        eventId: event.id,
        now: changedAt,
        resetAt,
        demoOrderNumber
      });

      if (!session) return { ok: true, duplicate: true };
      scheduleProductReset(session.tokenHash, productKey, resetAt);
      await publish(session.tokenHash, session);

      const email = validDemoEmail(checkout.customer_details?.email);
      if (!email) return { ok: true, paid: true, mailStatus: 'NONE' };
      const claimed = await repository.claimMail(sessionId, productKey, checkout.id, now());
      if (!claimed) return { ok: true, paid: true, mailStatus: 'NONE' };

      let mailStatus = 'FAILED';
      try {
        const product = getDemoProduct(productKey);
        const message = buildDemoMail({
          product,
          demoOrderNumber,
          demoDate: changedAt,
          locale: checkout.metadata?.demoLocale
        });
        const delivery = await mailTransport.send({ to: email, ...message });
        mailStatus = delivery.accepted ? 'ACCEPTED' : (delivery.status || 'UNAVAILABLE');
      } catch {
        mailStatus = 'FAILED';
      }

      const completed = await repository.completeMail({
        sessionId,
        productKey,
        checkoutSessionId: checkout.id,
        status: mailStatus,
        now: now()
      });
      if (completed && mailStatus === 'ACCEPTED') maskedMailHints.set(mailHintKey(sessionId, productKey), maskDemoEmail(email));
      if (completed) await publish(completed.tokenHash, completed);
      return { ok: true, paid: true, mailStatus };
    },

    tokenHashFor(token) {
      return hashDemoToken(assertDemoToken(token));
    }
  };
}
