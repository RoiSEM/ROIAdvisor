/* eslint-disable @typescript-eslint/no-require-imports */
// Scroll-linked homepage motion: pure geometry/progress helpers, the SSR
// output of the motion layer (progressive enhancement) and CSS safety rules.
// Real scroll behaviour is proven separately with Playwright.
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

function load(file) {
  const m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(read(file), {
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
      console,
      process,
      require(n) {
        if (n.endsWith(".css"))
          return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
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
            useRouter: () => ({ replace() {}, refresh() {}, push() {} }),
            useSearchParams: () => new URLSearchParams(),
            usePathname: () => "/",
          };
        if (n.startsWith("@/lib/")) return load("app/lib/" + n.slice(6) + ".ts");
        if (n.startsWith("@/components/")) return load("app/components/" + n.slice(13) + ".tsx");
        if (n.startsWith("./") && file.startsWith("app/components/home/"))
          return load("app/components/home/" + n.slice(2) + ".tsx");
        return require(n);
      },
    },
  );
  return m.exports;
}

// vm-realm objects have foreign prototypes; compare plain JSON copies.
const plain = (v) => JSON.parse(JSON.stringify(v));
const motion = () => {
  const m = load("app/lib/scroll-motion.ts");
  const wrap = {};
  for (const [k, v] of Object.entries(m)) wrap[k] = typeof v === "function" ? (...a) => plain(v(...a)) : v;
  return wrap;
};

// ---------- 1. card scroll ranges ----------
test("card range is tied to scroll position, staggers by column and finishes before reading position", () => {
  const { cardScrollRange } = motion();
  const vh = 1000;
  const a = cardScrollRange({ top: 3000, viewportHeight: vh, maxScroll: 9000, column: 0 });
  assert.deepEqual(a, { start: 3000 - 960, end: 3000 - 700 });
  const c = cardScrollRange({ top: 3000, viewportHeight: vh, maxScroll: 9000, column: 2 });
  assert.ok(c.start > a.start && c.end > a.end, "later columns start later");
  // Column offset is capped so wide grids never push cards into the reading zone.
  const far = cardScrollRange({ top: 3000, viewportHeight: vh, maxScroll: 9000, column: 9 });
  assert.deepEqual(far, c);
  // Fully entered while the card top is still in the lower part of the viewport.
  for (const r of [a, c]) assert.ok(3000 - r.end >= 0.6 * vh);
});

test("cards near the page end always finish entering at max scroll; cards visible at load stay static", () => {
  const { cardScrollRange } = motion();
  const late = cardScrollRange({ top: 5800, viewportHeight: 1000, maxScroll: 5000, column: 0 });
  assert.equal(late.end, 5000, "end clamps to max scroll");
  assert.equal(late.end - late.start, 260, "range length preserved");
  assert.equal(cardScrollRange({ top: 600, viewportHeight: 1000, maxScroll: 5000, column: 0 }), null);
  assert.equal(cardScrollRange({ top: 100, viewportHeight: 1000, maxScroll: 50, column: 0 }), null);
});

test("column index ranks cards that share a grid row and resets per row", () => {
  const { columnIndex } = motion();
  const boxes = [
    { left: 24, top: 100 },
    { left: 420, top: 101 },
    { left: 800, top: 100 },
    { left: 24, top: 600 },
  ];
  assert.deepEqual(boxes.map((_, i) => columnIndex(boxes, i)), [0, 1, 2, 0]);
  const stacked = [{ left: 16, top: 0 }, { left: 16, top: 500 }];
  assert.deepEqual(stacked.map((_, i) => columnIndex(stacked, i)), [0, 0]);
});

// ---------- 2. trace geometry ----------
test("trace snakes along section dividers and grid-snapped gutters at desktop", () => {
  const { buildTrace } = motion();
  const t = buildTrace({ width: 1440, contentLeft: 144, contentRight: 1296, dividers: [900, 1700, 2600], grid: 40 });
  assert.equal(t.mode, "snake");
  const xs = new Set(t.points.map((p) => p[0]));
  assert.deepEqual([...xs].sort((a, b) => a - b), [120.5, 1320.5], "gutters sit on 40px grid lines");
  for (const x of xs) assert.ok(x < 144 || x > 1296, "never over content columns");
  assert.deepEqual(t.points, [
    [120.5, 900.5], [1320.5, 900.5], [1320.5, 1700.5], [120.5, 1700.5], [120.5, 2600.5], [1320.5, 2600.5],
  ]);
  assert.equal(t.length, 1200 * 3 + 800 + 900);
  assert.match(t.d, /^M120\.5 900\.5 L1320\.5 900\.5 L1320\.5 1700\.5/);
});

test("narrow screens fall back to a left-edge spine on the grid with no line over content", () => {
  const { buildTrace } = motion();
  for (const width of [360, 390]) {
    const t = buildTrace({ width, contentLeft: 16, contentRight: width - 16, dividers: [800, 2000, 3100], grid: 40 });
    assert.equal(t.mode, "spine");
    assert.deepEqual(t.points, [[0.5, 800.5], [0.5, 3100.5]]);
    assert.equal(t.length, 2300);
  }
  assert.equal(buildTrace({ width: 390, contentLeft: 16, contentRight: 374, dividers: [800], grid: 40 }), null);
  const tablet = buildTrace({ width: 820, contentLeft: 24, contentRight: 796, dividers: [800, 2000], grid: 40 });
  assert.equal(tablet.mode, "snake");
  assert.deepEqual([...new Set(tablet.points.map((p) => p[0]))], [0.5, 800.5]);
});

test("trace length follows the scroll anchor monotonically and reverses symmetrically", () => {
  const { buildTrace, anchorForScroll, lengthAtAnchor } = motion();
  const t = buildTrace({ width: 1440, contentLeft: 144, contentRight: 1296, dividers: [900, 1700, 2600], grid: 40 });
  const vh = 900, max = 3000;
  assert.equal(anchorForScroll(0, vh, max), 0);
  assert.equal(anchorForScroll(max, vh, max), max + vh, "end of scroll reaches the document end");
  assert.equal(anchorForScroll(1500, vh, max), 1500 + 450);
  const down = [], up = [];
  for (let s = 0; s <= max; s += 50) down.push(lengthAtAnchor(t.knots, anchorForScroll(s, vh, max)));
  for (let s = max; s >= 0; s -= 50) up.push(lengthAtAnchor(t.knots, anchorForScroll(s, vh, max)));
  for (let i = 1; i < down.length; i++) assert.ok(down[i] >= down[i - 1]);
  assert.deepEqual(up.reverse(), down, "same position gives same progress either direction");
  assert.equal(down[0], 0);
  assert.equal(down.at(-1), t.length);
  // Horizontal run on a divider is drawn while that divider is near the anchor.
  assert.equal(lengthAtAnchor(t.knots, 900), 600);
});

// ---------- 3. SSR output: progressive enhancement ----------
test("homepage SSR marks cards for motion without hiding anything and ships a decorative trace", () => {
  const Landing = load("app/components/home/home-landing.tsx").default;
  const html = renderToStaticMarkup(React.createElement(Landing, { year: 2026, isSignedIn: false, canManageBilling: false }));
  const cards = html.match(/data-motion-card=/g) || [];
  assert.equal(cards.length, 16, "value, side, path, step, boundary, pricing and closing cards");
  assert.doesNotMatch(html, /style="[^"]*(opacity|transform|visibility)/i, "no pre-hidden inline styles");
  const svg = html.match(/<svg[^>]*data-motion-trace[^>]*>/);
  assert.ok(svg, "trace svg rendered");
  assert.match(svg[0], /aria-hidden="true"/);
  assert.match(svg[0], /focusable="false"/);
  // The hero stays static: it is the first thing read.
  const hero = html.slice(html.indexOf("hero-title"), html.indexOf('id="what-you-learn"'));
  assert.doesNotMatch(hero, /data-motion-card/);
});

test("motion CSS never hides content without JS and forces static, visible cards for print/reduced motion/focus", () => {
  const css = read("app/components/home/home-landing.module.css");
  assert.doesNotMatch(css, /\[data-motion-card\][^{]*\{[^}]*opacity:\s*0[;\s]/, "no blanket pre-JS hiding");
  const trace = css.match(/\.trace \{[^}]*\}/);
  assert.ok(trace, ".trace rule");
  assert.match(trace[0], /pointer-events:\s*none/);
  assert.match(trace[0], /display:\s*none/, "trace only appears once motion is enabled");
  assert.match(css, /\.home\[data-motion="on"\] \.trace \{[^}]*display:\s*block/);
  const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduce.slice(0, 600), /\[data-motion-card\][^{]*\{[^}]*opacity:\s*1 !important[^}]*transform:\s*none !important/);
  assert.match(reduce.slice(0, 600), /\.trace \{[^}]*display:\s*none !important/);
  const print = css.slice(css.lastIndexOf("@media print"));
  assert.match(print, /\[data-motion-card\][^{]*\{[^}]*opacity:\s*1 !important[^}]*transform:\s*none !important/);
  assert.match(print, /\.trace \{[^}]*display:\s*none !important/);
  assert.match(css, /\[data-motion-card\]:focus-within \{[^}]*opacity:\s*1 !important[^}]*transform:\s*none !important/);
});

test("motion layer loads GSAP lazily, gates on reduced motion and reverts on unmount", () => {
  const src = read("app/components/home/home-scroll-motion.tsx");
  assert.match(src, /^"use client";/);
  assert.match(src, /import\("gsap"\)/);
  assert.match(src, /import\("gsap\/ScrollTrigger"\)/);
  assert.match(src, /prefers-reduced-motion: no-preference/);
  assert.match(src, /\.revert\(\)/);
  assert.doesNotMatch(src, /ScrollSmoother|pin:\s*true|preventDefault|normalizeScroll/);
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.dependencies.gsap, /^\d+\.\d+\.\d+$/, "gsap pinned exactly");
});
