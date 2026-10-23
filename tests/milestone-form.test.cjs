/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.join(__dirname, "..");

function harness(options = {}) {
  const slots = [];
  let cursor = 0;
  const requests = [];
  const refreshes = [];
  const alerts = [];
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === "function" ? value(slots[i]) : value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useMemo: (fn) => fn(),
    useEffect() {},
  };

  const globals = {
    Response,
    alert: (message) => alerts.push(message),
    TextEncoder,
    console: { error() {}, warn() {} },
    fetch: async (url, init) => {
      requests.push({ url, body: init?.body ? JSON.parse(init.body) : null });
      return Response.json({ success: true });
    },
  };

  function load(file) {
    const mod = { exports: {} };
    const filename = path.join(root, file);
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
        module: mod,
        exports: mod.exports,
        ...globals,
        require(name) {
          if (name === "react") return hooks;
          if (name === "react/jsx-runtime")
            return {
              jsx: (type, props) => ({ type, props }),
              jsxs: (type, props) => ({ type, props }),
            };
          if (name === "next/link")
            return {
              default(props) {
                return { type: "a", props };
              },
              __esModule: true,
            };
          if (name === "next/navigation")
            return {
              useRouter: () => ({
                refresh() {
                  refreshes.push(true);
                },
                push() {},
              }),
            };
          if (name === "@/components/service-cta")
            return {
              default() {
                return null;
              },
              __esModule: true,
            };
          if (
            name === "@/lib/connection-proof" ||
            name === "./connection-proof"
          )
            return load("app/lib/connection-proof.ts");
          if (name.startsWith("@/lib/"))
            return load("app/lib/" + name.slice(6) + ".ts");
          return require(name);
        },
      },
    );
    return mod.exports;
  }

  const ClientForm = load("app/components/client-form.tsx").default;
  const grading = load("app/lib/milestone-grading.ts");
  const render = (props = {}) => {
    cursor = 0;
    return ClientForm({
      initialName: "Acme Corp",
      initialTrackingNotes: options.initialTrackingNotes || "",
      ...props,
    });
  };

  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }

  function text(node) {
    if (Array.isArray(node)) return node.map(text).join(" ");
    if (node && typeof node === "object") return text(node.props?.children);
    return node == null ? "" : String(node);
  }

  return { requests, refreshes, render, nodes, text, grading, alerts };
}

test("milestone-form readiness evidence fields roundtrip, preserve notes, nonfinite reject, and accessibility", async () => {
  const profileJson = JSON.stringify({
    trackingTest: {
      date: "2026-05-01",
      outcome: "passed",
      note: "Verified ok",
    },
    inquiryProcess: "Phone calls and CRM",
    targetEventRate: 45,
    comparison: {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      traffic: 1000,
      conversions: 50,
    },
    experiment: {
      date: "2026-04-01",
      note: "New headline",
      outcome: "improved",
    },
  });
  const h = harness({
    initialTrackingNotes: `Ordinary custom notes here\n[convert-readiness-v1]${profileJson}[/convert-readiness-v1]`,
  });

  const rendered = h.render({ isAdmin: false, clientId: "site" });
  const nds = h.nodes(rendered);
  const textContent = h.text(rendered);

  // Check section title and preservation of ordinary notes
  assert.match(textContent, /Tracking confidence/i);

  // Check service account public visibility and guide link
  assert.match(
    textContent,
    /ga4-service@roi-analytics-490813.iam.gserviceaccount.com/i,
  );
  assert.ok(nds.some((n) => n.props?.href === "/guides/connect-analytics"));
  assert.equal(
    nds.find((n) => n.props?.id === "readiness-testDate").props.value,
    "2026-05-01",
  );
  for (const control of nds.filter((n) =>
    n.props?.id?.startsWith("readiness-"),
  ))
    assert.ok(
      nds.some(
        (n) => n.type === "label" && n.props.htmlFor === control.props.id,
      ),
    );
  await rendered.props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests.length, 1);
  const saved = h.grading.parseReadinessProfile(
    h.requests[0].body.tracking_notes,
  );
  assert.equal(saved.inquiryProcess, "Phone calls and CRM");
  assert.equal(saved.comparison.traffic, 1000);
  assert.match(h.requests[0].body.tracking_notes, /Ordinary custom notes here/);
  nds
    .find((n) => n.props?.id === "readiness-targetEventRate")
    .props.onChange({ target: { value: "Infinity" } });
  const invalid = h.render({ isAdmin: false, clientId: "site" });
  await invalid.props.onSubmit({ preventDefault() {} });
  assert.equal(h.requests.length, 1);
  assert.ok(h.alerts.length);

  // Check that inputs/selects have proper htmlFor/ids and accessibility
  const labels = nds.filter((n) => n.type === "label");
  assert.ok(labels.length > 0);

  // Test submitting with invalid non-finite target event rate or bad numbers blocks submission or serializes properly
  const parsed = h.grading.parseReadinessProfile(
    h.grading.serializeReadinessProfile("Ordinary custom notes here", {
      targetEventRate: NaN,
      trackingTest: { date: "2026-05-01", outcome: "passed" },
    }),
  );
  assert.equal(parsed.targetEventRate, undefined);
  assert.equal(
    h.grading.removeReadinessProfile(
      "Hello\n[convert-readiness-v1]{}[/convert-readiness-v1]",
    ),
    "Hello",
  );
});
