/* eslint-disable @typescript-eslint/no-require-imports */
// Theme foundation + native homepage tests. Uses the repo's existing
// Node --test + TypeScript transpile fixture style against the real files.
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
        if (n.endsWith(".css")) {
          // CSS module: identity class-name proxy.
          return {
            __esModule: true,
            default: new Proxy({}, { get: (_, k) => String(k) }),
          };
        }
        if (n === "next/link")
          return {
            __esModule: true,
            default: ({ href, children, ...props }) => {
              delete props.prefetch;
              return React.createElement("a", { href, ...props }, children);
            },
          };
        if (n === "next/navigation")
          return {
            notFound() {
              throw new Error("not found");
            },
            useRouter: () => ({ replace() {}, refresh() {}, push() {} }),
            useSearchParams: () => new URLSearchParams(),
            usePathname: () => "/",
          };
        if (n === "next/font/google")
          return new Proxy(
            {},
            { get: () => () => ({ variable: "font-var", className: "font" }) },
          );
        if (n.startsWith("@/app/")) n = "@/" + n.slice(6);
        if (n.startsWith("@/lib/"))
          return load("app/lib/" + n.slice(6) + ".ts", mocks);
        if (n.startsWith("@/components/"))
          return load("app/components/" + n.slice(13) + ".tsx", mocks);
        if (n.startsWith("./") && file.startsWith("app/components/home/"))
          return load("app/components/home/" + n.slice(2) + ".tsx", mocks);
        return require(n);
      },
    },
  );
  return m.exports;
}

// ---------- fakes ----------
function fakeStorage(initial = {}, { deny = false } = {}) {
  const data = { ...initial };
  const guard = () => {
    if (deny) throw new Error("SecurityError: storage denied");
  };
  return {
    data,
    getItem: (k) => (guard(), Object.hasOwn(data, k) ? data[k] : null),
    setItem: (k, v) => (guard(), (data[k] = String(v))),
    removeItem: (k) => (guard(), delete data[k]),
  };
}
function fakeMedia(dark) {
  const listeners = new Set();
  const mql = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_t, fn) => listeners.add(fn),
    removeEventListener: (_t, fn) => listeners.delete(fn),
  };
  return {
    mql,
    matchMedia: () => mql,
    set(next) {
      mql.matches = next;
      for (const fn of [...listeners]) fn({ matches: next });
    },
    count: () => listeners.size,
  };
}
function fakeRoot() {
  const attrs = {};
  return {
    attrs,
    style: {},
    setAttribute: (k, v) => (attrs[k] = String(v)),
    getAttribute: (k) => attrs[k] ?? null,
  };
}

const theme = () => load("app/lib/theme.ts");

// ---------- 1. pure theme logic ----------
test("theme preference parsing rejects invalid stored values and resolves Auto from the system", () => {
  const t = theme();
  assert.equal(t.THEME_STORAGE_KEY, "convert-theme");
  assert.deepEqual([...t.THEME_PREFERENCES], ["light", "dark", "system"]);
  for (const bad of [null, undefined, "", "purple", "DARK", "system ", 1, {}])
    assert.equal(t.parseThemePreference(bad), "system", String(bad));
  assert.equal(t.parseThemePreference("light"), "light");
  assert.equal(t.parseThemePreference("dark"), "dark");
  assert.equal(t.resolveTheme("system", true), "dark");
  assert.equal(t.resolveTheme("system", false), "light");
  assert.equal(t.resolveTheme("light", true), "light");
  assert.equal(t.resolveTheme("dark", false), "dark");
});

test("storage access failures fall back to Auto and report unsaved writes instead of throwing", () => {
  const t = theme();
  const denied = fakeStorage({ "convert-theme": "dark" }, { deny: true });
  assert.equal(t.readThemePreference(() => denied), "system");
  assert.equal(
    t.readThemePreference(() => {
      throw new Error("localStorage getter blocked");
    }),
    "system",
  );
  assert.equal(t.readThemePreference(() => null), "system");
  assert.equal(t.writeThemePreference(() => denied, "dark"), false);
  const ok = fakeStorage({ "convert-theme": "purple" });
  assert.equal(t.readThemePreference(() => ok), "system");
  assert.equal(t.writeThemePreference(() => ok, "dark"), true);
  assert.equal(ok.data["convert-theme"], "dark");
  assert.equal(t.writeThemePreference(() => ok, "system"), true);
  assert.equal(Object.hasOwn(ok.data, "convert-theme"), false);
});

test("controller: Auto follows live system changes, manual choice wins and persists", () => {
  const t = theme();
  const storage = fakeStorage();
  const media = fakeMedia(true);
  const rootEl = fakeRoot();
  const c = t.createThemeController({
    root: rootEl,
    getStorage: () => storage,
    matchMedia: media.matchMedia,
  });
  const seen = [];
  const unsub = c.subscribe(() => seen.push(c.getPreference()));
  const stop = c.start();
  assert.equal(c.getPreference(), "system");
  assert.equal(rootEl.attrs["data-theme"], "dark");
  assert.equal(rootEl.attrs["data-theme-preference"], "system");
  assert.equal(rootEl.style.colorScheme, "dark");
  media.set(false);
  assert.equal(rootEl.attrs["data-theme"], "light", "Auto reacts to system");
  c.setPreference("dark");
  assert.equal(storage.data["convert-theme"], "dark");
  assert.equal(rootEl.attrs["data-theme"], "dark");
  media.set(false);
  media.set(true);
  media.set(false);
  assert.equal(rootEl.attrs["data-theme"], "dark", "manual wins over system");
  c.setPreference("bogus");
  assert.equal(c.getPreference(), "system", "invalid input normalizes to Auto");
  assert.equal(rootEl.attrs["data-theme"], "light");
  assert.ok(seen.length >= 3);
  unsub();
  stop();
  assert.equal(media.count(), 0, "listener removed on stop");

  // A fresh controller (a reload) restores the stored manual choice.
  storage.data["convert-theme"] = "light";
  const media2 = fakeMedia(true);
  const root2 = fakeRoot();
  const c2 = t.createThemeController({
    root: root2,
    getStorage: () => storage,
    matchMedia: media2.matchMedia,
  });
  c2.start();
  assert.equal(c2.getPreference(), "light");
  assert.equal(root2.attrs["data-theme"], "light");
});

test("controller keeps an in-memory choice when storage is denied", () => {
  const t = theme();
  const media = fakeMedia(false);
  const rootEl = fakeRoot();
  const c = t.createThemeController({
    root: rootEl,
    getStorage: () => fakeStorage({}, { deny: true }),
    matchMedia: media.matchMedia,
  });
  c.start();
  assert.doesNotThrow(() => c.setPreference("dark"));
  assert.equal(c.getPreference(), "dark");
  assert.equal(rootEl.attrs["data-theme"], "dark");
});

test("pre-paint init script applies stored, Auto and invalid choices without throwing", () => {
  const t = theme();
  const run = ({ stored, dark, deny = false, noMatchMedia = false }) => {
    const rootEl = fakeRoot();
    const storage = fakeStorage(
      stored === undefined ? {} : { "convert-theme": stored },
      { deny },
    );
    const win = {
      localStorage: storage,
      matchMedia: noMatchMedia ? undefined : fakeMedia(dark).matchMedia,
    };
    vm.runInNewContext(t.THEME_INIT_SCRIPT, {
      window: win,
      document: { documentElement: rootEl },
    });
    return rootEl;
  };
  assert.equal(run({ stored: "dark", dark: false }).attrs["data-theme"], "dark");
  assert.equal(run({ stored: "light", dark: true }).attrs["data-theme"], "light");
  assert.equal(run({ stored: undefined, dark: true }).attrs["data-theme"], "dark");
  const invalid = run({ stored: "neon", dark: false });
  assert.equal(invalid.attrs["data-theme"], "light");
  assert.equal(invalid.attrs["data-theme-preference"], "system");
  assert.equal(run({ stored: "dark", dark: true, deny: true }).attrs["data-theme"], "dark");
  assert.equal(run({ stored: "dark", dark: false, deny: true }).attrs["data-theme"], "light");
  assert.equal(run({ dark: false, noMatchMedia: true }).attrs["data-theme"], "light");
  assert.ok(t.THEME_INIT_SCRIPT.includes(JSON.stringify(t.THEME_STORAGE_KEY)));
});

// ---------- 2. root layout + CSS wiring ----------
test("root layout injects the pre-paint script and mounts the shared theme sync", () => {
  const layout = load("app/layout.tsx");
  const t = theme();
  const html = renderToStaticMarkup(
    React.createElement(layout.default, null, React.createElement("p", null, "child")),
  );
  assert.match(html, /<html[^>]*data-theme="light"/);
  assert.match(html, /<html[^>]*data-theme-preference="system"/);
  assert.ok(html.includes("<head><script>"), "script is first in head");
  assert.ok(html.includes(t.THEME_INIT_SCRIPT.slice(0, 40)));
  assert.match(read("app/layout.tsx"), /suppressHydrationWarning/);
  assert.match(read("app/layout.tsx"), /<ThemeSync\s*\/>/);
  assert.match(read("app/layout.tsx"), /colorScheme:\s*"light dark"/);
});

test("Tailwind dark variant follows the selected theme on screen only, never the OS media query", () => {
  const css = read("app/globals.css");
  assert.match(css, /@custom-variant dark\s*\{[\s\S]*@media screen[\s\S]*\[data-theme="?dark"?\][\s\S]*@slot/);
  assert.doesNotMatch(css, /prefers-color-scheme/, "no OS-only theming left");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /color-scheme:\s*light/);
  assert.match(print, /background:\s*#fff/);
});

// ---------- 3. theme switch control ----------
test("theme switch renders an accessible 3-option group with 44px targets and Auto pressed on the server", () => {
  const Switch = load("app/components/theme-switch.tsx").default;
  const html = renderToStaticMarkup(React.createElement(Switch));
  assert.match(html, /role="group"[^>]*aria-label="Color theme"/);
  const buttons = html.match(/<button[^>]*>/g) || [];
  assert.equal(buttons.length, 3);
  for (const b of buttons) {
    assert.match(b, /type="button"/);
    assert.match(b, /aria-pressed="(true|false)"/);
    assert.match(b, /min-h-11/);
    assert.match(b, /min-w-11/);
    assert.match(b, /focus-visible:outline/);
  }
  assert.match(html, /data-theme-option="system"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-theme-option="system"/);
  for (const name of ["Light", "Dark", "Auto"]) assert.match(html, new RegExp(`aria-label="${name}[^"]*"`));
});

test("shared navigation, login and guide pages expose the theme switch", async () => {
  const nav = renderToStaticMarkup(
    React.createElement(load("app/components/site-header-nav.tsx").default, { current: "pricing" }),
  );
  assert.match(nav, /aria-label="Color theme"/);
  assert.match(nav, /aria-current="page"[^>]*>Pricing|>Pricing<\/a>/);
  const login = renderToStaticMarkup(
    React.createElement(load("app/login/login-client.tsx").default),
  );
  assert.match(login, /aria-label="Color theme"/);
  assert.match(login, /Sign in with Google/);
  const guide = load("app/guides/[slug]/page.tsx");
  const g = renderToStaticMarkup(
    await guide.default({ params: Promise.resolve({ slug: "connect-analytics" }) }),
  );
  assert.match(g, /aria-label="Color theme"/);
  assert.match(g, /Before you start/);
});

// ---------- 4. native homepage ----------
const FAKE_CLAIMS =
  /1\.2M|99\.4|\+34%|14,200|4,200|852|94%|\+12\.4|Fix Script|remediation|Live Funnel|Autopsy|DOM|benchmark|ENGINES OPERATIONAL|guarantee(d|s)? (more|results)|40 points|\+40|40-point|revflow|users trust|customers? (love|trust)|\d+% (more|increase)/i;

function landing(props) {
  const Landing = load("app/components/home/home-landing.tsx").default;
  return renderToStaticMarkup(React.createElement(Landing, { year: 2026, ...props }));
}

test("homepage is native React (no iframe/HTML blob) with prototype banners replaced by illustration labels", () => {
  const src = read("app/components/home/home-landing.tsx") + read("app/page.tsx");
  assert.doesNotMatch(src, /<iframe|dangerouslySetInnerHTML|Homepage Light and Dark v1\.html/);
  const html = landing({ isSignedIn: false, canManageBilling: false });
  assert.doesNotMatch(html, /DRAFT PROTOTYPE|Draft copy|Unresolved in this draft|Prototype note|convert\.whachawant\.com/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /href="#main"[^>]*>Skip to content/);
  assert.match(html, /<h1[^>]*>Learn what your website data/);
  assert.match(html, /Illustration/);
  assert.match(html, /not a screenshot or real customer data/i);
  assert.match(html, /aria-label="Color theme"/);
  for (const id of ["what-you-learn", "how", "next-steps", "boundaries", "pricing", "start"])
    assert.match(html, new RegExp(`id="${id}"`));
});

test("homepage CTAs route signed-out visitors to sign-in and signed-in users to the dashboard", () => {
  const out = landing({ isSignedIn: false, canManageBilling: false });
  assert.match(out, /href="\/login"[^>]*>Sign in</);
  assert.match(out, /href="\/login"[^>]*>Start with your website/);
  assert.doesNotMatch(out, /Manage Billing/);
  const inn = landing({ isSignedIn: true, canManageBilling: true });
  assert.doesNotMatch(inn, />Sign in</);
  assert.match(inn, /href="\/dashboard"[^>]*>(<span[^>]*>)?(Open )?[Dd]ashboard/);
  assert.match(inn, /Manage Billing/);
  assert.doesNotMatch(inn, /href="\/login"/);
  const inNoBilling = landing({ isSignedIn: true, canManageBilling: false });
  assert.doesNotMatch(inNoBilling, /Manage Billing/);
  for (const html of [out, inn]) {
    assert.match(html, /href="\/pricing"/);
    assert.match(html, /href="\/privacy-policy"/);
    assert.match(html, /href="\/terms"/);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    for (const h of hrefs) {
      assert.ok(
        /^(\/[a-z0-9/#-]*|#[a-z-]+|mailto:george@roisem\.com(\?subject=[^"]+)?)$/i.test(h),
        `unexpected href ${h}`,
      );
      assert.notEqual(h, "#");
    }
    for (const anchor of hrefs.filter((h) => h.startsWith("#")))
      assert.match(html, new RegExp(`id="${anchor.slice(1)}"`), anchor);
  }
});

test("homepage help links are task-specific and DIY links point at real guide routes", () => {
  const guides = load("app/lib/milestone-guides.ts");
  const html = landing({ isSignedIn: false, canManageBilling: false });
  const subjects = [...html.matchAll(/mailto:george@roisem\.com\?subject=([^"]+)/g)].map((m) =>
    decodeURIComponent(m[1].replace(/&amp;/g, "&")),
  );
  assert.ok(subjects.length >= 4, "three step-specific + general question");
  assert.equal(new Set(subjects).size, subjects.length, "each help link has its own subject");
  const guideSlugs = [...html.matchAll(/href="\/guides\/([a-z-]+)"/g)].map((m) => m[1]);
  assert.equal(guideSlugs.length, 3);
  for (const s of guideSlugs) assert.ok(guides.getMilestoneGuide(s), s);
});

test("homepage copy has no invented metrics, live auditing, auto-fix, benchmarks or point allocations", () => {
  for (const signedIn of [false, true]) {
    const html = landing({ isSignedIn: signedIn, canManageBilling: signedIn });
    const text = html.replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(text, FAKE_CLAIMS);
    assert.doesNotMatch(text, /\$\d/, "no prices on homepage");
    assert.match(text, /never (reaches )?100/i);
    assert.match(text, /doesn.t (edit|change) your (site|website)/i);
  }
});

test("app/page.tsx keeps authenticated data access and passes billing state to the native homepage", async () => {
  const calls = [];
  const mkData = (row) => ({
    from(table) {
      calls.push(table);
      const q = {
        select: () => q,
        eq: (col, val) => (calls.push(`${col}=${val}`), q),
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return q;
    },
  });
  const run = async (user, row) => {
    calls.length = 0;
    const page = load("app/page.tsx", {
      "@/lib/supabase-server": { getRequestUser: async () => ({ user, error: null }) },
      "@/lib/data-store": { appData: mkData(row) },
    });
    return renderToStaticMarkup(await page.default());
  };
  const anon = await run(null, null);
  assert.deepEqual(calls, [], "no billing read when signed out");
  assert.match(anon, /href="\/login"[^>]*>Start with your website/);
  const paid = await run(
    { id: "u1" },
    { plan: "pro", status: "active", stripe_customer_id: "cus_x", stripe_subscription_id: "sub_x" },
  );
  assert.deepEqual(calls, ["billing_accounts", "user_id=u1"], "billing scoped to request user");
  assert.match(paid, /Manage Billing/);
  assert.match(paid, /href="\/dashboard"/);
});

// ---------- 6. regressions found in browser acceptance ----------
test("QA regressions: 44px brand/footer targets and transition-free print", () => {
  const nav = renderToStaticMarkup(
    React.createElement(load("app/components/site-header-nav.tsx").default, { current: "pricing" }),
  );
  assert.match(nav, /<a[^>]*aria-label="Convert by WhachaWant, home"[^>]*class="[^"]*min-w-11/);
  const legal = renderToStaticMarkup(
    React.createElement(load("app/components/legal-page-shell.tsx").default, {
      eyebrow: "Legal", title: "Terms", intro: "x", lastUpdated: "today", sections: [],
    }),
  );
  const footerLinks = legal.slice(legal.indexOf("<footer")).match(/<a [^>]*>/g) || [];
  assert.equal(footerLinks.length, 4);
  for (const a of footerLinks) assert.match(a, /min-h-11[^"]*min-w-11|min-w-11[^"]*min-h-11/);
  const pricing = read("app/components/pricing-page-client.tsx");
  for (const m of pricing.matchAll(/className="([^"]*(?<!:)bg-slate-950 [^"]*text-white[^"]*)"/g))
    assert.match(m[1], /min-h-11/, m[1].slice(0, 60));
  const home = read("app/components/home/home-landing.module.css");
  assert.match(home, /\.brand \{[^}]*min-width: 44px/);
  const homePrint = home.slice(home.lastIndexOf("@media print"));
  assert.match(homePrint, /\.btnPrimary \{[^}]*background: transparent/);
  const css = read("app/globals.css");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /transition:\s*none !important/);
  // Solid-background links lose their fill in print (text is forced to
  // inherit ink), so dark-on-dark buttons cannot appear on paper.
  assert.match(print, /a\[class\*="bg-"\][^{]*\{[^}]*background:\s*transparent !important/);
  // Placeholder "Logo" labels meet AA in light, dark and print.
  const printPage = read("app/reports/[id]/print/page.tsx");
  assert.doesNotMatch(printPage, /(?<![:\w-])text-slate-400 dark:/);
  assert.doesNotMatch(read("app/components/client-form.tsx"), /tracking-\[0\.16em\] text-slate-400"/);
});

// ---------- 5. bounded legacy theming ----------
const THEMED_FILES = [
  "app/login/login-client.tsx",
  "app/components/pricing-page-client.tsx",
  "app/components/billing-aware-pricing-cards.tsx",
  "app/components/site-header-nav.tsx",
  "app/components/sign-out-button.tsx",
  "app/clients/page.tsx",
  "app/clients/[id]/page.tsx",
  "app/clients/[id]/edit/page.tsx",
  "app/components/client-form.tsx",
  "app/components/report-form.tsx",
  "app/components/milestone-progress.tsx",
  "app/guides/[slug]/page.tsx",
  "app/components/legal-page-shell.tsx",
  "app/components/service-cta.tsx",
];
test("bounded app screens pair light surfaces and text with dark-theme variants", () => {
  const surface = /(?<![\w:/-])(bg-white|bg-slate-50|bg-slate-100|text-slate-950|text-slate-900|text-slate-600|border-slate-200)(?![\w/-])/;
  const misses = [];
  for (const f of THEMED_FILES) {
    const src = read(f);
    for (const m of src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
      const s = m[1] ?? m[2];
      const hit = s.match(surface);
      if (!hit) continue;
      const prop = hit[1].split("-")[0];
      if (!new RegExp(`dark:(hover:)?${prop}-`).test(s)) misses.push(`${f}: ${hit[1]} in "${s.slice(0, 80)}"`);
    }
  }
  assert.deepEqual(misses, []);
});
