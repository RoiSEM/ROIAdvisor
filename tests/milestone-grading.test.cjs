/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  vm = require("node:vm");
function load(file) {
  const m = { exports: {} },
    filename = path.join(__dirname, "..", file);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      Date,
      JSON,
      require(n) {
        if (n.startsWith("@/lib/"))
          return load("app/lib/" + n.slice(6) + ".ts");
        if (n.startsWith("./"))
          return load(path.join(path.dirname(file), n + ".ts"));
        return require(n);
      },
    },
  );
  return m.exports;
}
const g = load("app/lib/milestone-grading.ts"),
  proof = load("app/lib/connection-proof.ts");
const profile = {
  trackingTest: {
    date: "2026-09-01",
    outcome: "passed",
    note: "Submission receipt and recording checked",
  },
  inquiryProcess: "Review inquiry list every Monday",
  targetEventRate: 8,
  comparison: {
    startDate: "2026-08-02",
    endDate: "2026-08-31",
    traffic: 1000,
    conversions: 50,
  },
  experiment: {
    date: "2026-09-10",
    note: "Tested shorter form and reviewed outcomes",
    outcome: "improved",
  },
};
function client(p = profile) {
  return {
    ga4_property_id: "123456",
    main_cta: "Quote request form",
    conversion_types: ["Form Submission"],
    key_events: ["generate_lead"],
    primary_goal: "Leads",
    monthly_goal: 100,
    average_conversion_value: 50,
    conversion_tracking_status: "Yes",
    tracking_notes: proof.writeConnectionProof(
      g.serializeReadinessProfile("Human notes", p),
      {
        source: "ga4",
        propertyId: "123456",
        verifiedAt: "2026-09-01T00:00:00.000Z",
      },
    ),
  };
}
const report = {
  traffic: 1000,
  conversions: 100,
  start_date: "2026-09-01",
  end_date: "2026-09-30",
  notes: null,
};
test("unconnected gates all earned points at zero despite complete answers", () => {
  const c = client();
  c.tracking_notes = g.serializeReadinessProfile("", profile);
  const a = g.getMilestoneAssessment(report, c);
  assert.equal(a.score, 0);
  assert.equal(
    a.milestones.reduce((s, m) => s + m.points, 0),
    0,
  );
});
test("connection alone immediately earns40 with no report or traffic", () => {
  const c = client({});
  const a = g.getMilestoneAssessment(null, {
    ga4_property_id: c.ga4_property_id,
    tracking_notes: c.tracking_notes,
  });
  assert.equal(a.score, 40);
});
test("complete readiness with zero activity earns70 and full evidenced fixture earns99", () => {
  for (const [r, score] of [
    [{ ...report, traffic: 0, conversions: 0 }, 70],
    [report, 99],
  ]) {
    const a = g.getMilestoneAssessment(r, client());
    assert.equal(a.score, score);
    assert.equal(
      a.milestones.reduce((s, m) => s + m.points, 0),
      score,
    );
    assert.equal(a.milestones.length, 12);
  }
});
test("upload equivalence is labeled self-supplied not verified live data", () => {
  const a = g.getMilestoneAssessment(
    {
      ...report,
      notes: proof.writeConnectionProof("", {
        source: "upload",
        propertyId: null,
        verifiedAt: "2026-09-01T00:00:00.000Z",
      }),
    },
    {},
  );
  assert.equal(a.readinessScore, 40);
  assert.equal(a.connectionKind, "upload");
  assert.match(a.explanation, /upload|supplied/i);
});
test("changed property or legacy report without evidence remains unverified", () => {
  for (const c of [
    { ...client(), ga4_property_id: "999" },
    { ga4_property_id: "123456", conversion_tracking_status: "Yes" },
  ])
    assert.equal(g.getMilestoneAssessment(report, c).score, 0);
});
test("configured events need names; passing tests remain owner-reported", () => {
  const a = g.getMilestoneAssessment(report, { ...client(), key_events: [] });
  assert.equal(a.readinessScore, 65);
  assert.equal(a.resultsScore, 29);
  assert.match(
    a.milestones.find((m) => m.id === "tracking-check").evidence,
    /owner/i,
  );
});
test("missing/invalid/tiny samples and tracking contradictions earn no results", () => {
  for (const r of [
    { ...report, traffic: 0 },
    { ...report, conversions: 0 },
    { ...report, traffic: NaN },
    { ...report, conversions: null },
    { ...report, traffic: 99 },
    { ...report, conversions: 4 },
  ])
    assert.equal(g.getMilestoneAssessment(r, client()).resultsScore, 0);
  assert.equal(
    g.getMilestoneAssessment(report, {
      ...client(),
      conversion_tracking_status: "No",
    }).resultsScore,
    0,
  );
});
test("goal credit scales with actual progress", () => {
  assert.equal(
    g
      .getMilestoneAssessment({ ...report, conversions: 50 }, client())
      .milestones.find((m) => m.id === "goal-progress").points,
    4,
  );
  assert.equal(
    g.getMilestoneAssessment({ ...report, start_date: "2026-09-31" }, client())
      .resultsScore,
    0,
  );
});
test("future/malformed tracking checks cannot earn check credit", () => {
  for (const date of ["2999-01-01", "2026-02-30", "garbage"]) {
    const a = g.getMilestoneAssessment(
      report,
      client({ ...profile, trackingTest: { ...profile.trackingTest, date } }),
    );
    assert.equal(a.milestones.find((m) => m.id === "tracking-check").points, 0);
  }
});
test("events above sessions and zero/invalid owner target do not earn ratio credit", () => {
  assert.equal(
    g
      .getMilestoneAssessment({ ...report, conversions: 2000 }, client())
      .milestones.find((m) => m.id === "event-ratio").points,
    0,
  );
  assert.equal(
    g
      .getMilestoneAssessment(
        report,
        client({ ...profile, targetEventRate: 0 }),
      )
      .milestones.find((m) => m.id === "event-ratio").points,
    0,
  );
});
test("comparison requires nonoverlapping equal periods and actual improvement", () => {
  for (const comparison of [
    { ...profile.comparison, endDate: "2026-09-05" },
    { ...profile.comparison, startDate: "2026-08-01" },
    { ...profile.comparison, conversions: 100 },
    { ...profile.comparison, traffic: -10 },
  ]) {
    const a = g.getMilestoneAssessment(
      report,
      client({ ...profile, comparison }),
    );
    assert.equal(
      a.milestones.find((m) => m.id === "comparison-benchmark").points,
      0,
    );
    assert.equal(
      a.milestones.find((m) => m.id === "experiment-outcome").points,
      0,
    );
  }
});
test("experiment credit requires dated meaningful documentation in evaluated period", () => {
  for (const experiment of [
    { ...profile.experiment, note: "" },
    { ...profile.experiment, date: "2999-01-01" },
    { ...profile.experiment, outcome: "inconclusive" },
  ])
    assert.equal(
      g
        .getMilestoneAssessment(report, client({ ...profile, experiment }))
        .milestones.find((m) => m.id === "experiment-outcome").points,
      0,
    );
});
test("serialization preserves first-line server proof and ordinary notes; rejects invalid targets", () => {
  const text = g.serializeReadinessProfile(client().tracking_notes, {
    inquiryProcess: "Inbox list",
  });
  assert.equal(proof.readConnectionProof(text).propertyId, "123456");
  assert.match(text, /Human notes/);
  assert.equal(g.parseReadinessProfile(text).inquiryProcess, "Inbox list");
  assert.equal(
    g.parseReadinessProfile(
      "[convert-readiness-v1]{bad}[/convert-readiness-v1]",
    ).inquiryProcess,
    undefined,
  );
  assert.equal(
    g.parseReadinessProfile(
      '[convert-readiness-v1]{"targetEventRate":1000}[/convert-readiness-v1]',
    ).targetEventRate,
    undefined,
  );
});
test("next actions pin first incomplete and rotate remaining without repeats", () => {
  const a = g.getMilestoneAssessment(null, {}),
    x = g.getNextMilestones(a, 0),
    y = g.getNextMilestones(a, 1);
  assert.equal(x.length, 3);
  assert.equal(x[0].id, "connect-analytics");
  assert.equal(y[0].id, x[0].id);
  assert.notEqual(y[1].id, x[1].id);
  assert.equal(new Set(y.map((m) => m.id)).size, 3);
});
test("seen milestones do not celebrate again", () => {
  const a = g.getMilestoneAssessment(report, client());
  assert.equal(
    g.getCelebrationEvents(
      a,
      a.milestones.map((m) => m.id),
    ).length,
    0,
  );
  assert.equal(
    g.getCelebrationEvents(g.getMilestoneAssessment(null, {}), []).length,
    0,
  );
});
