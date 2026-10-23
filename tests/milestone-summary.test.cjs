/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.join(__dirname, "..");
function load(file) {
  const f = path.join(root, file),
    m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      URL,
      Date,
      Intl,
      console,
      require(n) {
        if (n.startsWith("@/lib/"))
          return load("app/lib/" + n.slice(6) + ".ts");
        return require(n);
      },
    },
  );
  return m.exports;
}
const report = {
  month: "2026-09-01 to 2026-09-30",
  traffic: 0,
  conversions: 0,
  notes: null,
  start_date: "2026-09-01",
  end_date: "2026-09-30",
};
test("report grade uses the shared zero-unconnected milestone model instead of URL points", () => {
  const s = load("app/lib/report-summary.ts");
  const h = s.getReportHealthScore(report, {
    website: "https://example.com",
    conversion_tracking_status: "Yes",
  });
  assert.equal(h.score, 0);
  assert.equal(h.setupScore + h.performanceAdjustment, h.score);
  assert.doesNotMatch(h.grade, /^(A\+?|B|C|D|F)$/);
});
test("preview and AI prompt disclose readiness/results separately with no invented benchmarks or diagnoses", () => {
  const s = load("app/lib/report-summary.ts");
  const client = { website: "https://example.com", monthly_goal: 80 };
  const preview = s.buildPreviewSummary(report, client);
  const prompt = s.buildSummaryPrompt({ report, client });
  assert.match(preview, /readiness/i);
  assert.match(prompt, /70/);
  assert.match(prompt, /29/);
  assert.doesNotMatch(
    preview + prompt,
    /\/90|inferred .*benchmark|goal appears unrealistic|indicating a conversion blocker|grade [A-F]\b/i,
  );
  assert.match(prompt, /untrusted/i);
  assert.match(prompt, /recorded events/i);
});
