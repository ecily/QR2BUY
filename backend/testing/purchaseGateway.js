// Loopback fixtures only: no .env, network access, credentials or production import.
export function purchaseGateway(now = () => new Date()) {
  const sessions = new Map(), keys = new Map(); let sequence = 0, loseResponse = false;
  const api = { checkout: { sessions: {
    async create(params, options) {
      if (keys.has(options.idempotencyKey)) return structuredClone(sessions.get(keys.get(options.idempotencyKey)));
      const id = 'cs_test_fixture_' + ++sequence;
      const s = { id, livemode: false, mode: params.mode, status: 'open', payment_status: 'unpaid',
        amount_total: params.line_items[0].price_data.unit_amount, currency: params.line_items[0].price_data.currency, customer_details:{email:'buyer@example.test'},
        metadata: params.metadata, client_reference_id: params.client_reference_id,
        url: 'https://checkout.stripe.com/c/pay/' + id, expires_at: params.expires_at, created: Math.floor(+now() / 1000), quantity: params.line_items[0].quantity };
      sessions.set(id, s); keys.set(options.idempotencyKey, id);
      if (loseResponse) { loseResponse = false; throw Error('fixture lost response'); }
      return structuredClone(s);
    },
    async retrieve(id) {
      const s = sessions.get(id); if (!s) throw Error('fixture session not found');
      if (s.status === 'open' && s.expires_at * 1000 <= +now()) s.status = 'expired';
      return structuredClone(s);
    },
    async expire(id) {
      const s = sessions.get(id); if (!s || s.status !== 'open') throw Error('fixture already complete');
      s.status = 'expired'; return structuredClone(s);
    },
    async list() { return { data: [...sessions.values()].map(s => structuredClone(s)), has_more: false }; },
    async listLineItems(id) { const s = sessions.get(id); return { data: [{ quantity: s.quantity, amount_total: s.amount_total }], has_more: false }; }
  } } };
  return { api, sessions, loseNextResponse() { loseResponse = true; }, event(id, type = 'checkout.session.completed') {
    const s = sessions.get(id); if (!s) throw Error('fixture session not found');
    if (type === 'checkout.session.completed') { s.status = 'complete'; s.payment_status = 'paid'; s.payment_intent = 'pi_fixture_' + id; }
    else if (type === 'checkout.session.expired') s.status = 'expired';
    return { id: 'evt_fixture_' + id + '_' + type, livemode: false, type, data: { object: structuredClone(s) } };
  } };
}
