/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const RealStripe = require('stripe');

const root = path.join(__dirname, '..');

// Helper to compile TS file with VM context and path mapping
function loadModule(relativePath, env = {}) {
  const filePath = path.resolve(root, relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} must exist`);
  const content = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  
  const mergedEnv = { ...process.env, ...env };
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: (id) => {
      if (id.includes('supabase-server')) {
        return { getRequestUser: (...args) => mockGetRequestUser(...args) };
      }
      if (id.includes('data-store')) {
        return { appData: mockAppData };
      }
      if (id.startsWith('@/lib/')) {
        const libName = id.replace('@/lib/', '');
        if (libName === 'stripe-pricing') {
          const pricingMod = loadModule(`app/lib/stripe-pricing.ts`, env);
          return {
            ...pricingMod,
            getStripeClient: () => new FullMockStripe('sk_test_123')
          };
        }
        return loadModule(`app/lib/${libName}.ts`, env);
      }
      if (id.startsWith('./') || id.startsWith('../')) {
        const absoluteTarget = path.resolve(path.dirname(filePath), id + (path.extname(id) ? '' : '.ts'));
        const relativeTarget = path.relative(root, absoluteTarget);
        if (relativeTarget.includes('supabase-server')) {
          return { getRequestUser: (...args) => mockGetRequestUser(...args) };
        }
        if (relativeTarget.includes('data-store')) {
          return { appData: mockAppData };
        }
        if (relativeTarget.includes('stripe-pricing')) {
          const pricingMod = loadModule('app/lib/stripe-pricing.ts', env);
          return {
            ...pricingMod,
            getStripeClient: () => new FullMockStripe('sk_test_123')
          };
        }
        if (fs.existsSync(absoluteTarget) || fs.existsSync(absoluteTarget + '.ts') || fs.existsSync(absoluteTarget + '.tsx')) {
          return loadModule(relativeTarget, env);
        }
      }
      if (id === '@/lib/billing' || id.endsWith('/billing')) {
        return loadModule('app/lib/billing.ts', env);
      }
      if (id === '@/lib/stripe-pricing' || id.endsWith('/stripe-pricing')) {
        const pricingMod = loadModule('app/lib/stripe-pricing.ts', env);
        return {
          ...pricingMod,
          getStripeClient: () => new FullMockStripe('sk_test_123')
        };
      }
      if (id === 'stripe') {
        return RealStripe;
      }
      if (id === 'next/server') {
        return {
          NextResponse: {
            json: (body, init) => ({ body, status: init?.status || 200, json: async () => body })
          }
        };
      }
      if (id === 'next/headers') {
        return {
          headers: async () => new Map(Object.entries(mockHeaders || {}))
        };
      }
      return require(id);
    },
    process: { env: mergedEnv },
    console,
    URL,
    Request,
    Response,
  };
  vm.runInNewContext(transpiled, sandbox);
  return mod.exports;
}

let mockBillingData = null;
let mockBillingError = null;
let mockInsertCallback = null;
let mockUpdateCallback = null;
let mockUpdateError = null;
let capturedCheckoutPayload = null;

let mockAppData = {
  from: () => {
    const qb = {
      select: () => qb,
      eq: () => qb,
      maybeSingle: async () => ({ data: mockBillingData, error: mockBillingError }),
      single: async () => ({ data: mockBillingData, error: mockBillingError }),
      insert: async (payload) => {
        if (mockInsertCallback) mockInsertCallback(payload);
        return { error: null };
      },
      update: (payload) => {
        if (mockUpdateCallback) mockUpdateCallback(payload);
        const updateQb = {
          eq: async () => {
            if (mockUpdateError) return { error: mockUpdateError };
            return { error: null };
          }
        };
        return updateQb;
      }
    };
    return qb;
  }
};

let mockGetRequestUser = async () => ({ user: { id: 'user-1', email: 'test@example.com' }, error: null });
let mockHeaders = { 'stripe-signature': 'sig_test' };

class FullMockStripe {
  constructor(key, options) {
    if (!key) throw new Error('Missing Stripe secret key');
    this.key = key;
    this.webhooks = RealStripe.webhooks;
    this.prices = {
      retrieve: async (priceId) => {
        if (priceId === 'price_inactive') {
          return { active: false, currency: 'usd', unit_amount: 1900, recurring: { interval: 'month', interval_count: 1 } };
        }
        if (priceId === 'price_eur') {
          return { active: true, currency: 'eur', unit_amount: 1900, recurring: { interval: 'month', interval_count: 1 } };
        }
        if (priceId === 'price_wrong_amount') {
          return { active: true, currency: 'usd', unit_amount: 10000, recurring: { interval: 'month', interval_count: 1 } };
        }
        if (priceId === 'price_wrong_interval') {
          return { active: true, currency: 'usd', unit_amount: 1900, recurring: { interval: 'year', interval_count: 1 } };
        }
        if (priceId === 'price_tiered') {
          return { active: true, currency: 'usd', unit_amount: 1900, billing_scheme: 'tiered', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
        }
        if (priceId === 'price_metered') {
          return { active: true, currency: 'usd', unit_amount: 1900, billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } };
        }
        if (priceId === 'price_transform') {
          return { active: true, currency: 'usd', unit_amount: 1900, billing_scheme: 'per_unit', transform_quantity: { divide_by: 2 }, recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
        }
        if (priceId === process.env.STRIPE_PRICE_BUSINESS || priceId === 'price_biz') {
          return { active: true, currency: 'usd', unit_amount: 1900, billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
        }
        if (priceId === process.env.STRIPE_PRICE_AGENCY || priceId === 'price_ag') {
          return { active: true, currency: 'usd', unit_amount: 7900, billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
        }
        throw new Error('Price not found');
      }
    };
    this.checkout = {
      sessions: {
        create: async (data) => {
          capturedCheckoutPayload = data;
          return { url: 'https://checkout.stripe.com/test-session', id: 'cs_test_123' };
        }
      }
    };
    this.subscriptions = {
      retrieve: async (subId) => {
        if (subId === 'sub_unknown') {
          return {
            id: subId,
            status: 'active',
            items: { data: [{ price: { id: 'price_malicious_unknown' } }] }
          };
        }
        return {
          id: subId,
          status: 'active',
          items: { data: [{ price: { id: process.env.STRIPE_PRICE_BUSINESS || 'price_biz' } }] }
        };
      }
    };
  }
}

test('Stripe pricing helper validates active USD monthly exact prices and rejects metered/tiered/transform', async () => {
  const stripePricing = loadModule('app/lib/stripe-pricing.ts', {
    STRIPE_PRICE_BUSINESS: 'price_biz',
    STRIPE_PRICE_AGENCY: 'price_ag',
  });
  
  const stripe = new FullMockStripe('sk_test_123');
  
  // Valid business price
  const bizPrice = await stripePricing.validateCheckoutPrice(stripe, 'price_biz', 'pro');
  assert.equal(bizPrice.active, true);

  // Valid agency price
  const agPrice = await stripePricing.validateCheckoutPrice(stripe, 'price_ag', 'agency');
  assert.equal(agPrice.active, true);

  // Inactive price fails closed
  await assert.rejects(() => stripePricing.validateCheckoutPrice(stripe, 'price_inactive', 'pro'), /active/i);

  // Currency mismatch fails closed
  await assert.rejects(() => stripePricing.validateCheckoutPrice(stripe, 'price_eur', 'pro'), /usd/i);

  // Amount mismatch fails closed
  await assert.rejects(() => stripePricing.validateCheckoutPrice(stripe, 'price_wrong_amount', 'pro'), /amount|unit/i);

  // Interval mismatch fails closed
  await assert.rejects(() => stripePricing.validateCheckoutPrice(stripe, 'price_wrong_interval', 'pro'), /monthly|interval/i);

  // Tiered billing scheme fails closed
  await assert.rejects(() => stripePricing.validateCheckoutPrice(stripe, 'price_tiered', 'pro'), /billing scheme|per_unit/i);

  // Metered usage type fails closed
  await assert.rejects(() => stripePricing.validateCheckoutPrice(stripe, 'price_metered', 'pro'), /usage type|licensed/i);

  // Quantity transform fails closed
  await assert.rejects(() => stripePricing.validateCheckoutPrice(stripe, 'price_transform', 'pro'), /quantity transformation/i);
});

test('Stripe pricing plan mapping maps correct price IDs and rejects unknown / starter prices', () => {
  const stripePricing = loadModule('app/lib/stripe-pricing.ts', {
    STRIPE_PRICE_BUSINESS: 'price_biz',
    STRIPE_PRICE_AGENCY: 'price_ag',
    STRIPE_PRICE_PRO: 'price_old_pro',
    STRIPE_PRICE_STARTER: 'price_starter',
  });

  assert.equal(stripePricing.getPlanFromPriceId('price_biz'), 'pro');
  assert.equal(stripePricing.getPlanFromPriceId('price_ag'), 'agency');
  assert.equal(stripePricing.getPlanFromPriceId('price_old_pro'), 'pro');
  assert.equal(stripePricing.getPlanFromPriceId('price_starter'), 'starter');
  assert.equal(stripePricing.getPlanFromPriceId('price_unknown'), null);
  assert.equal(stripePricing.getPlanFromPriceId(null), null);
});

test('Checkout route rejects unauthorized requests, starter/invalid plans, active subscriptions (including unknown mapped plan), malformed JSON, and DB errors', async () => {
  const checkoutRoute = loadModule('app/api/stripe/checkout/route.ts', {
    STRIPE_SECRET_KEY: 'sk_test_123',
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
    STRIPE_PRICE_BUSINESS: 'price_biz',
    STRIPE_PRICE_AGENCY: 'price_ag',
  });

  // Reset mocks
  mockBillingError = null;

  // 1. Unauthorized
  mockGetRequestUser = async () => ({ user: null, error: 'Unauthorized' });
  let res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'pro' })
  }));
  assert.equal(res.status, 401);

  // 2. Authorized user
  mockGetRequestUser = async () => ({ user: { id: 'user-1', email: 'test@example.com' }, error: null });

  // Malformed JSON (400)
  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: 'invalid-json'
  }));
  assert.equal(res.status, 400);

  // Starter plan rejection (no starter sales)
  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'starter' })
  }));
  assert.equal(res.status, 400);

  // Invalid plan rejection
  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'invalid' })
  }));
  assert.equal(res.status, 400);

  // DB error during billing lookup (503, sanitized message)
  mockBillingError = { message: 'Database connection failed internal detail' };
  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'pro' })
  }));
  assert.equal(res.status, 503);
  const errBody = await res.json();
  assert.equal(errBody.error, 'Service unavailable');
  mockBillingError = null;

  // Active subscription duplicate prevention (409) - recognized plan
  mockBillingData = { plan: 'pro', status: 'active', stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123' };

  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'agency' })
  }));
  assert.equal(res.status, 409);

  // Active subscription duplicate prevention (409) - UNKNOWN mapped plan but active subscription ID present
  mockBillingData = { plan: 'unknown_custom_plan', status: 'active', stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123' };

  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'pro' })
  }));
  assert.equal(res.status, 409);

  // Canceled subscription allows resubscription & captures exact payload
  mockBillingData = { plan: 'pro', status: 'canceled', stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123' };

  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'pro', success_path: '//malicious.com', cancel_path: '/custom-cancel' })
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.url);

  // Verify captured checkout payload for Business plan ($19)
  assert.equal(capturedCheckoutPayload.mode, 'subscription');
  assert.equal(capturedCheckoutPayload.line_items[0].price, 'price_biz');
  assert.equal(capturedCheckoutPayload.line_items[0].quantity, 1);
  assert.equal(capturedCheckoutPayload.client_reference_id, 'user-1');
  assert.equal(capturedCheckoutPayload.success_url, 'https://example.com/pricing?checkout=success'); // Malicious success_path fallback
  assert.equal(capturedCheckoutPayload.cancel_url, 'https://example.com/custom-cancel');

  // Verify captured checkout payload for Agency plan ($79)
  mockBillingData = null;
  res = await checkoutRoute.POST(new Request('https://example.com/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan: 'agency' })
  }));
  assert.equal(res.status, 200);
  assert.equal(capturedCheckoutPayload.line_items[0].price, 'price_ag');
});

test('Webhook route verifies real signed Stripe signatures offline, handles postgres backend, rejects unknown price from granting paid plan, and handles update chain errors', async () => {
  const webhookRoute = loadModule('app/api/stripe/webhook/route.ts', {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    DATA_BACKEND: 'postgres',
    STRIPE_PRICE_BUSINESS: 'price_biz',
    STRIPE_PRICE_AGENCY: 'price_ag',
  });

  let upsertedRecord = null;
  mockBillingData = { id: 'rec_123', user_id: 'user-1', stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123', stripe_price_id: 'price_biz', plan: 'pro' };
  mockInsertCallback = (payload) => { upsertedRecord = payload; };
  mockUpdateCallback = (payload) => { upsertedRecord = payload; };
  mockUpdateError = null;

  // Test checkout.session.completed with unknown price ID and malicious selected_plan metadata
  const eventPayload = {
    id: 'evt_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_123',
        client_reference_id: 'user-1',
        customer: 'cus_123',
        subscription: {
          id: 'sub_unknown',
          items: { data: [{ price: { id: 'price_malicious_unknown' } }] }
        },
        metadata: { selected_plan: 'agency' } // Malicious metadata attempt
      }
    }
  };

  const payloadString = JSON.stringify(eventPayload);
  const validHeader = RealStripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret: 'whsec_test',
  });

  // 1. Invalid signature should fail
  mockHeaders = { 'stripe-signature': 't=123,v1=invalid' };
  const invalidReq = new Request('https://example.com/api/stripe/webhook', {
    method: 'POST',
    body: payloadString,
  });
  const invalidRes = await webhookRoute.POST(invalidReq);
  assert.equal(invalidRes.status, 500);

  // 2. Valid signature succeeds and unknown price does NOT grant plan from arbitrary metadata -> plan should be null
  mockHeaders = { 'stripe-signature': validHeader };
  const validReq = new Request('https://example.com/api/stripe/webhook', {
    method: 'POST',
    body: payloadString,
  });

  const res = await webhookRoute.POST(validReq);
  assert.equal(res.status, 200);
  assert.equal(upsertedRecord?.plan, null);

  // 3. Test webhook update chain error handling (when update `.eq` fails)
  mockUpdateError = { message: 'Database update constraint violation' };
  const updateEventPayload = {
    id: 'evt_124',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: { data: [{ price: { id: 'price_biz' } }] }
      }
    }
  };
  const updatePayloadString = JSON.stringify(updateEventPayload);
  const updateHeader = RealStripe.webhooks.generateTestHeaderString({
    payload: updatePayloadString,
    secret: 'whsec_test',
  });

  mockHeaders = { 'stripe-signature': updateHeader };
  const updateReq = new Request('https://example.com/api/stripe/webhook', {
    method: 'POST',
    body: updatePayloadString,
  });

  const updateRes = await webhookRoute.POST(updateReq);
  assert.equal(updateRes.status, 500);
  mockUpdateError = null;
});
