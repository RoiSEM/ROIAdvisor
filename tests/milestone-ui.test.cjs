/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript"),
  React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file) {
  const m = { exports: {} },
    filename = path.join(__dirname, "..", file);
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
      require(n) {
        if (n === "next/link")
          return {
            __esModule: true,
            default: ({ href, children, ...props }) =>
              React.createElement("a", { href, ...props }, children),
          };
        if (n === "next/navigation")
          return {
            notFound() {
              throw new Error("not found");
            },
          };
        if (n.startsWith("@/app/")) n = "@/" + n.slice(6);
        if (n.startsWith("@/lib/"))
          return load("app/lib/" + n.slice(6) + ".ts");
        if (n.startsWith("@/components/"))
          return load("app/components/" + n.slice(13) + ".tsx");
        return require(n);
      },
    },
  );
  return m.exports;
}
test("actual milestone UI renders separate score breakdown and three task-specific DIY/help routes", () => {
  const g = load("app/lib/milestone-grading.ts");
  const html = renderToStaticMarkup(
    React.createElement(load("app/components/milestone-progress.tsx").default, {
      assessment: g.getMilestoneAssessment(null, {}),
      clientId: "site",
      userScope: "owner",
      clientName: "Example",
    }),
  );
  assert.match(html, /Your next steps/);
  assert.match(html, /Readiness.*70/);
  assert.match(html, /Results.*29/);
  assert.equal((html.match(/data-next-step=/g) || []).length, 3);
  assert.ok((html.match(/Get help from George/g) || []).length >= 3);
  assert.doesNotMatch(html, /Overall ROI|Verified Tutorial/);
});
test("every real engine milestone has a working guide with prerequisites steps checks and same-task help", async () => {
  const g = load("app/lib/milestone-grading.ts"),
    guides = load("app/lib/milestone-guides.ts"),
    page = load("app/guides/[slug]/page.tsx");
  for (const m of g.getMilestoneAssessment(null, {}).milestones) {
    const guide = guides.getMilestoneGuide(m.guideSlug);
    assert.ok(guide, m.guideSlug);
    const html = renderToStaticMarkup(
      await page.default({ params: Promise.resolve({ slug: m.guideSlug }) }),
    );
    assert.match(html, /Before you start/);
    assert.match(html, /Check the outcome/);
    assert.match(html, /mailto:george@roisem.com/);
    assert.doesNotMatch(html, /Verified Tutorial|500 monthly|OAuth|2-5%/);
  }
  for (const slug of ["missing", "toString", "__proto__"])
    await assert.rejects(
      () => page.default({ params: Promise.resolve({ slug }) }),
      /not found/,
    );
});
test("celebration history baselines existing progress and retains earned IDs across score drops", () => {
  const ui = load("app/components/milestone-progress.tsx"),
    g = load("app/lib/milestone-grading.ts");
  assert.equal(typeof ui.advanceMilestoneHistory, "function");
  const a = g.getMilestoneAssessment(null, {});
  const baseline = ui.advanceMilestoneHistory(a, null);
  assert.equal(baseline.events.length, 0);
  const completed = {
    ...a,
    milestones: a.milestones.map((m, i) =>
      i === 0 ? { ...m, points: 40, complete: true } : m,
    ),
  };
  const first = ui.advanceMilestoneHistory(completed, baseline.seenIds);
  assert.equal(first.events.length, 1);
  const drop = ui.advanceMilestoneHistory(a, first.seenIds);
  assert.equal(
    ui.advanceMilestoneHistory(completed, drop.seenIds).events.length,
    0,
  );
  assert.notEqual(
    ui.milestoneHistoryKey("u1", "site", "v1"),
    ui.milestoneHistoryKey("u2", "site", "v1"),
  );
});
