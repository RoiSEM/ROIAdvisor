/* eslint-disable @typescript-eslint/no-require-imports */
// Pricing UI copy/flow tests (Free / Business[pro] / Agency). Uses the repo's
// Node --test + TypeScript transpile + VM + SSR fixture style.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript"),
  React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function load(file, mocks = {}) {
  const m = { exports: {} },
    filename = path.join(root, file);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      Date,
      URL,
      console,
      process,
      require(n) {
        if (Object.hasOwn(mocks, n)) return mocks[n];
        if (n === "next/link")
          return {
            __esModule: true,
            default: ({ href, children, ...props }) =>
              React.createElement("a", { href, ...props }, children),
          };
        if (n === "next/navigation")
          return {
            useRouter: () => ({ replace() {}, refresh() {}, push() {} }),
            useSearchParams: () => new URLSearchParams(),
            usePathname: () => "/pricing",
          };
        if (n.startsWith("@/lib/")) return load("app/lib/" + n.slice(6) + ".ts", mocks);
        if (n.startsWith("@/components/"))
          return load("app/components/" + n.slice(13) + ".tsx", mocks);
        return require(n);
      },
    },
  );
  return m.exports;
}

const pricing = () => load("app/lib/pricing.ts");
const anon = { plan: "free", raw_plan: null, status: "inactive", can_manage_billing: false };

test("offer: Free $0, Business $19 (key pro), Agency $79; no Starter sale", () => {
  const { pricingPlans } = pricing();
  assert.equal(
    JSON.stringify(pricingPlans.map((p) => [p.priceKey, p.name])),
    JSON.stringify([["free", "Free"], ["pro", "Business"], ["agency", "Agency"]]),
  );
  const [free, business, agency] = pricingPlans;
  assert.match(free.price, /^\$0/);
  assert.match(business.price, /^\$19/);
  assert.match(agency.price, /^\$79/);
  const text = JSON.stringify(pricingPlans);
  assert.match(text, /3 (successfully )?generated reports/i);
  assert.match(text, /UTC calendar month/i);
  assert.match(text, /last 30 days/i);
  assert.match(text, /up to 10 websites/i);
  assert.match(text, /custom date ranges/i);
  assert.doesNotMatch(text, /starter|white-label|client access|branded|beta|tutorial|\$10\b|\$100|\$1000/i);
});

test("notes: fair use, UTC reset, USD, software-only", () => {
  const { pricingNotes } = pricing();
  const text = pricingNotes.join(" ");
  assert.match(text, /USD|US dollars/);
  assert.match(text, /normal interactive use/i);
  assert.match(text, /automated|bulk/i);
  assert.match(text, /no hidden monthly cap/i);
  assert.match(text, /implementation services/i);
  assert.match(text, /resets?.*UTC|UTC.*reset/i);
});

test("planDisplayName: pro is Business, unknown fails closed to Free", () => {
  const { planDisplayName } = pricing();
  assert.equal(planDisplayName("pro"), "Business");
  assert.equal(planDisplayName("agency"), "Agency");
  assert.equal(planDisplayName("free"), "Free");
  assert.match(planDisplayName("starter"), /legacy/i);
  assert.equal(planDisplayName("business"), "Free");
  assert.equal(planDisplayName(null), "Free");
});

test("anonymous: Free goes to /login, not Current plan; paid plans checkout", () => {
  const { getPlanAction } = pricing();
  const free = getPlanAction("free", anon);
  assert.equal(free.kind, "link");
  assert.equal(free.href, "/login");
  assert.equal(free.current, false);
  assert.doesNotMatch(free.label, /current/i);
  assert.deepEqual(
    [getPlanAction("pro", anon).kind, getPlanAction("pro", anon).plan],
    ["checkout", "pro"],
  );
  assert.deepEqual(
    [getPlanAction("agency", anon).kind, getPlanAction("agency", anon).plan],
    ["checkout", "agency"],
  );
});

test("authenticated free: Free is current and opens /dashboard", () => {
  const { getPlanAction } = pricing();
  const free = getPlanAction("free", { ...anon, authenticated: true });
  assert.equal(free.kind, "link");
  assert.equal(free.href, "/dashboard");
  assert.equal(free.current, true);
});

test("active/trialing/past_due paid subs route every paid change to portal", () => {
  const { getPlanAction } = pricing();
  for (const status of ["active", "trialing", "past_due"]) {
    for (const raw of ["pro", "agency", "starter"]) {
      const b = { plan: status === "past_due" ? "free" : raw, raw_plan: raw, status, can_manage_billing: true, authenticated: true };
      for (const key of ["pro", "agency"]) {
        assert.equal(getPlanAction(key, b).kind, "portal", `${raw}/${status}->${key}`);
      }
      assert.notEqual(getPlanAction("free", b).kind, "checkout");
    }
  }
  const pro = { plan: "pro", raw_plan: "pro", status: "active", can_manage_billing: true, authenticated: true };
  assert.equal(getPlanAction("pro", pro).current, true);
  assert.equal(getPlanAction("agency", pro).current, false);
});

test("canceled customers can re-subscribe via checkout", () => {
  const { getPlanAction } = pricing();
  const b = { plan: "free", raw_plan: "pro", status: "canceled", can_manage_billing: true, authenticated: true };
  assert.equal(getPlanAction("pro", b).kind, "checkout");
  assert.equal(getPlanAction("agency", b).kind, "checkout");
});

test("site access: Free/Business cap points to Agency; Agency at 10 says limit reached", () => {
  const { getSiteAccess } = pricing();
  for (const plan of ["free", "pro", "starter"]) {
    const s = getSiteAccess({ plan, websiteLimit: 1, sitesUsed: 1 });
    assert.equal(s.atLimit, true);
    assert.match(s.cta.label, /Agency/);
    assert.equal(s.cta.href, "/pricing");
  }
  const a = getSiteAccess({ plan: "agency", websiteLimit: 10, sitesUsed: 10 });
  assert.equal(a.atLimit, true);
  assert.equal(a.cta, null);
  assert.match(a.message + a.limitNotice, /limit/i);
  assert.doesNotMatch(JSON.stringify(a), /unlimited|upgrade/i);
  const over = getSiteAccess({ plan: "free", websiteLimit: 1, sitesUsed: 3 });
  assert.match(over.limitNotice, /existing websites (stay|remain)/i);
  const open = getSiteAccess({ plan: "agency", websiteLimit: 10, sitesUsed: 2 });
  assert.equal(open.atLimit, false);
});

test("pricing cards SSR (anonymous default): no Current plan, no mailto, Free -> /login", () => {
  const Cards = load("app/components/billing-aware-pricing-cards.tsx").default;
  const html = renderToStaticMarkup(React.createElement(Cards, { variant: "pricing" }));
  assert.match(html, /Business/);
  assert.match(html, /\$19/);
  assert.match(html, /\$79/);
  assert.doesNotMatch(html, /Current plan/);
  assert.doesNotMatch(html, /mailto:/);
  assert.doesNotMatch(html, /Starter|Pro\b/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /normal interactive use/);
});

test("pricing page SSR: no Starter/Pro labels", () => {
  const Page = load("app/components/pricing-page-client.tsx", {
    "@/components/site-header-nav": { __esModule: true, default: ({ children }) => React.createElement("nav", null, children) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.doesNotMatch(html, /Starter|\bPro\b/);
  assert.match(html, /Business/);
});

test("calendar: Free last-30-day copy and Business upgrade label", () => {
  const Picker = load("app/components/calendar.tsx").ReportDatePicker;
  const html = renderToStaticMarkup(
    React.createElement(Picker, { isPro: false, onChange() {}, onUpgradeClick() {} }),
  );
  assert.match(html, /Business/);
  assert.match(html, /last 30 days/);
  assert.doesNotMatch(html, /\bPro\b|Trial/);
});

test("checkout button accepts agency; report form/clients use Business labels", () => {
  const cb = read("app/components/checkout-button.tsx");
  assert.match(cb, /plan: "pro" \| "agency"/);
  const Button = load("app/components/checkout-button.tsx").default;
  assert.match(renderToStaticMarkup(React.createElement(Button, { plan: "agency", label: "Choose Agency" })), /Choose Agency/);
  const rf = read("app/components/report-form.tsx");
  assert.match(rf, /planDisplayName/);
  assert.doesNotMatch(rf, /"Starter"/);
  const clients = read("app/clients/page.tsx");
  assert.doesNotMatch(clients, /Upgrade to Pro|Choose Starter|Unlimited Sites|unlimited websites/);
  assert.match(clients, /getSiteAccess/);
});

// ---- UI review fixes L1-L5 (2026-10-28) ----

// Render the pricing page with a fixed post-hydration state. useState calls in
// PricingPageClient are, in order: billing, loadingBilling, unlocking.
function renderPricingPage(billing, { search = "" } = {}) {
  const states = [billing, false, false];
  let i = 0;
  const reactMock = {
    ...React,
    useState: (init) => [i < states.length ? states[i++] : init, () => {}],
    useEffect() {},
  };
  const Page = load("app/components/pricing-page-client.tsx", {
    react: reactMock,
    "next/navigation": {
      useRouter: () => ({ replace() {}, refresh() {}, push() {} }),
      useSearchParams: () => new URLSearchParams(search),
      usePathname: () => "/pricing",
    },
    "@/components/site-header-nav": { __esModule: true, default: ({ children }) => React.createElement("nav", null, children) },
    "@/components/billing-aware-pricing-cards": { __esModule: true, default: () => null },
    "@/components/manage-billing-button": { __esModule: true, default: () => React.createElement("button", null, "Manage billing") },
  }).default;
  return renderToStaticMarkup(React.createElement(Page));
}
const panel = (html) => html.split("What happens after checkout")[0].split("Current access")[1] ?? "";
const base = { raw_plan: null, status: "inactive", can_use_custom_date_range: false, has_unlimited_reports: false, can_manage_billing: false };

test("L1: pricing notes are neutral, no imperative sign-in to paying users", () => {
  const { pricingNotes } = pricing();
  assert.doesNotMatch(pricingNotes.join(" "), /sign in/i);
  assert.match(pricingNotes[0], /Prices are in USD, billed monthly\. Paid plans require an account\./);
});

test("L2: pricing client keeps the authenticated flag (type, default, hydration)", () => {
  const src = read("app/components/pricing-page-client.tsx");
  assert.match(src, /type BillingResponse = \{[^}]*authenticated: boolean;/s);
  assert.match(src, /const DEFAULT_BILLING: BillingResponse = \{[^}]*authenticated: false,/s);
  assert.match(src, /authenticated: data\.authenticated === true/);
});

test("L2: anonymous Current access says not signed in and prompts sign-in", () => {
  const p = panel(renderPricingPage({ ...base, plan: "free", authenticated: false }));
  assert.match(p, /Not signed in/);
  assert.match(p, /href="\/login"/);
  assert.match(p, /Sign in/);
  assert.doesNotMatch(p, />Free</);
  assert.doesNotMatch(p, /Status: inactive/);
});

test("L2: authenticated Free still shows Free; paid shows correct plan", () => {
  const free = panel(renderPricingPage({ ...base, plan: "free", authenticated: true }));
  assert.match(free, />Free</);
  assert.match(free, /Status: inactive/);
  assert.doesNotMatch(free, /Not signed in/);
  const biz = panel(renderPricingPage({ ...base, plan: "pro", raw_plan: "pro", status: "active", can_use_custom_date_range: true, has_unlimited_reports: true, can_manage_billing: true, authenticated: true }));
  assert.match(biz, />Business</);
  assert.match(biz, /Status: active/);
  assert.doesNotMatch(biz, /Not signed in/);
  const agency = panel(renderPricingPage({ ...base, plan: "agency", raw_plan: "agency", status: "active", can_use_custom_date_range: true, has_unlimited_reports: true, can_manage_billing: true, authenticated: true }));
  assert.match(agency, />Agency</);
});

test("L2: checkout success still syncs via polling on can_use_custom_date_range", () => {
  const src = read("app/components/pricing-page-client.tsx");
  assert.match(src, /checkoutState !== "success"/);
  assert.match(src, /nextBilling\.can_use_custom_date_range/);
  const html = renderPricingPage({ ...base, plan: "pro", raw_plan: "pro", status: "active", can_use_custom_date_range: true, can_manage_billing: true, authenticated: true }, { search: "checkout=success" });
  assert.match(html, /Upgrade complete/);
});

test("L3: checkout box uses customer-facing copy, no internal table names", () => {
  const html = renderPricingPage({ ...base, plan: "free", authenticated: true });
  assert.match(html, /Your plan updates automatically after payment\./);
  assert.doesNotMatch(html, /billing_accounts|webhook updates|`/);
  assert.doesNotMatch(read("app/components/pricing-page-client.tsx"), /billing_accounts/);
});

test("L4: clients one-site upsell bodies match headings and hide for Agency/admin", () => {
  const src = read("app/clients/page.tsx");
  const start = src.indexOf("Want to add more sites?");
  const block = src.slice(start, src.indexOf("What you should have ready", start));
  assert.match(block, /Agency[\s\S]*up to 10 websites/i);
  assert.match(block, /unlimited reports[\s\S]*normal\s+interactive use/i);
  assert.match(block, /custom date\s+range/i);
  assert.doesNotMatch(block, /business name, website URL|Link Google Analytics|Run a report to surface/);
  assert.match(src, /clients\.length === 1 &&\s*!isAdmin &&\s*accountState !== "agency" &&/);
});

test("L5: calendar non-custom copy is plan-neutral (legacy Starter is paying)", () => {
  const Picker = load("app/components/calendar.tsx").ReportDatePicker;
  const html = renderToStaticMarkup(
    React.createElement(Picker, { isPro: false, onChange() {}, onUpgradeClick() {} }),
  );
  assert.match(html, /Your plan uses the last 30 days\./);
  assert.doesNotMatch(html, /Free reports/);
});
