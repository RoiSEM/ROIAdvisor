/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
function load(file, deps = {}, globals = {}) {
  const filename = path.join(root, file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module: mod,
      exports: mod.exports,
      Response,
      Request,
      console: { error() {}, warn() {} },
      process: { env: {} },
      require(name) {
        if (Object.hasOwn(deps, name)) return deps[name];
        if (name.startsWith("@/lib/"))
          return load("app/lib/" + name.slice(6) + ".ts", deps);
        if (name === "server-only") return {};
        return require(name);
      },
      ...globals,
    },
    { filename },
  );
  return mod.exports;
}
function fixture(options = {}) {
  const state = {
    rows: [],
    gaCalls: [],
    aiCalls: [],
    promptReports: [],
    selectedReports: [],
    writes: 0,
    usageCalls: [],
    allowanceCalls: [],
    aiInitializations: 0,
    aiConfigurations: [],
  };
  const client = {
    id: "client-fixture",
    user_id: "owner",
    approval_status: "approved",
    ga4_property_id: "123456",
    ...options.client,
  };
  const metrics = {
    traffic: 458,
    conversions: 39,
    pageViews: 648,
    activeUsers: 377,
    bounceRate: 0.598,
    engagementRate: 0.402,
    channelPerformance: [],
    landingPagePerformance: [],
    devicePerformance: [],
    keyEventPerformance: [],
    ...options.metrics,
  };
  const stored = {
    id: "saved-report",
    client_id: client.id,
    month: "2026-09-19 to 2026-10-19",
    traffic: 458,
    conversions: 39,
    page_views: 648,
    active_users: 377,
    bounce_rate: 0.598,
    engagement_rate: 0.402,
    notes: "Saved context",
    ...options.stored,
  };
  const data = {
    from(table) {
      let operation = "select",
        payload,
        fields;
      const filters = [];
      const query = {
        select(value) {
          fields = value;
          if (table === "reports") state.selectedReports.push(value);
          return query;
        },
        eq(key, value) {
          filters.push([key, value]);
          return query;
        },
        gte() {
          return query;
        },
        insert(value) {
          operation = "insert";
          payload = value;
          return query;
        },
        update(value) {
          operation = "update";
          payload = value;
          return query;
        },
        single: async () => {
          if (operation === "insert" && options.insertError)
            return { data: null, error: options.insertError };
          if (operation === "insert") {
            state.writes++;
            const row = { id: "new-report", ...payload[0] };
            state.rows.push(row);
            return { data: row, error: null };
          }
          if (options.missingReport) return { data: null, error: null };
          return {
            data:
              fields === "*"
                ? stored
                : Object.fromEntries(
                    fields.split(",").map((k) => [k.trim(), stored[k.trim()]]),
                  ),
            error: null,
          };
        },
        maybeSingle: async () => {
          if (table === "clients") {
            const ownerFilter = filters.find(([key]) => key === "user_id");
            return {
              data:
                ownerFilter && ownerFilter[1] !== client.user_id
                  ? null
                  : client,
              error: null,
            };
          }
          return { data: options.billing ?? null, error: null };
        },
        then(resolve, reject) {
          if (operation === "update") {
            state.writes++;
            state.lastUpdate = payload;
            return Promise.resolve({ data: payload, error: null }).then(
              resolve,
              reject,
            );
          }
          return Promise.resolve({
            count: options.count ?? state.rows.length,
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  class ConfigError extends Error {}
  class OpenAI {
    constructor(configuration) {
      state.aiInitializations++;
      state.aiConfigurations.push(configuration);
      this.chat = {
        completions: {
          create: async (value) => {
            state.aiCalls.push(value);
            return { choices: [{ message: { content: "Fixture summary" } }] };
          },
        },
      };
    }
  }
  const deps = {
    "@/lib/data-store": { appData: data },
    "@/lib/supabase-server": {
      getRequestUser: async () => ({
        user: options.signedOut ? null : { id: options.userId ?? "owner" },
        error: null,
      }),
      isAdminUser: () => options.admin ?? false,
    },
    "@/lib/analytics/ga4": {
      GoogleAnalyticsConfigError: ConfigError,
      getGA4Report: async (...args) => {
        state.gaCalls.push(args);
        if (options.gaFailure) throw new Error("private provider diagnostic");
        return metrics;
      },
    },
    "@/lib/report-summary": {
      buildSummaryPrompt: ({ report }) => {
        state.promptReports.push(report);
        return JSON.stringify(report);
      },
    },
    "@/lib/usage": {
      withUsage: async (actorId, operation, work) => {
        state.usageCalls.push({ actorId, operation });
        if (options.usageUnavailable)
          return Response.json(
            { error: "Usage tracking is unavailable." },
            { status: 503 },
          );
        if (options.usageDenied)
          return Response.json(
            { error: "Too many requests." },
            { status: 429, headers: { "Retry-After": "60" } },
          );
        return work();
      },
      getReportAllowance: async (clientId) => {
        state.allowanceCalls.push(clientId);
        if (options.allowanceFailsAfterInsert && state.rows.length)
          throw new Error("private DB diagnostic");
        const unlimited =
          ["pro", "agency"].includes(options.billing?.plan) &&
          ["active", "trialing", "past_due"].includes(options.billing?.status);
        const used = options.count ?? state.rows.length;
        return {
          used,
          limit: unlimited ? null : 3,
          remaining: unlimited ? null : Math.max(0, 3 - used),
        };
      },
    },
    openai: OpenAI,
  };
  return {
    state,
    metrics,
    stored,
    deps,
    create: load("app/api/reports/route.ts", deps),
    ai: () => load("app/api/ai-summary/route.ts", deps),
  };
}
function request(body) {
  return new Request("https://convert.example/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("sync validates measurements and writes property-bound provenance", async () => {
  for (const invalid of [false, true]) {
    const f = fixture({ metrics: invalid ? { traffic: -1 } : undefined });
    const res = await load(
      "app/api/reports/[id]/sync-analytics/route.ts",
      f.deps,
    ).POST(request({}), { params: Promise.resolve({ id: "saved-report" }) });
    if (invalid) {
      assert.equal(res.status, 502);
      assert.equal(f.state.writes, 0);
    } else {
      assert.equal(res.status, 200);
      assert.equal(
        load("app/lib/connection-proof.ts").readConnectionProof(
          f.state.lastUpdate.notes,
        )?.propertyId,
        "123456",
      );
      assert.match(f.state.lastUpdate.notes, /Saved context/);
    }
  }
});

test("saved acquisition provenance is server-selected and cannot be forged in user notes", async () => {
  for (const source of ["ga4", "upload"]) {
    const f = fixture();
    const response = await f.create.POST(
      request({
        client_id: "client-fixture",
        analytics_source: source,
        uploaded_analytics: source === "upload" ? f.metrics : undefined,
        notes:
          '[convert-connection-v1]{"source":"forged"}[/convert-connection-v1]',
      }),
    );
    assert.equal(response.status, 201);
    const p = load("app/lib/connection-proof.ts").readConnectionProof(
      f.state.rows[0].notes,
    );
    assert.equal(p?.source, source);
    assert.equal(p?.propertyId, source === "ga4" ? "123456" : null);
    assert.doesNotMatch(f.state.rows[0].notes, /forged/);
  }
});

test("every upstream route checks durable usage before provider work", async (t) => {
  for (const operation of ["report", "ai", "sync"]) {
    await t.test(operation, async () => {
      const f = fixture({ usageDenied: true });
      const response =
        operation === "report"
          ? await f.create.POST(
              request({ client_id: "client-fixture", analytics_source: "ga4" }),
            )
          : operation === "ai"
            ? await f.ai().POST(request({ reportId: "saved-report" }))
            : await load(
                "app/api/reports/[id]/sync-analytics/route.ts",
                f.deps,
              ).POST(request({}), {
                params: Promise.resolve({ id: "saved-report" }),
              });
      assert.equal(response.status, 429);
      assert.equal(response.headers.get("Retry-After"), "60");
      assert.equal(f.state.gaCalls.length, 0);
      assert.equal(f.state.aiCalls.length, 0);
      assert.equal(f.state.writes, 0);
      assert.equal(f.state.aiInitializations, 0);
      assert.equal(f.state.usageCalls[0].operation, operation);
    });
  }
});

test("usage outage fails closed before expensive report or AI work", async () => {
  const f = fixture({ usageUnavailable: true });
  assert.equal(
    (await f.create.POST(request({ client_id: "client-fixture" }))).status,
    503,
  );
  assert.equal(
    (await f.ai().POST(request({ reportId: "saved-report" }))).status,
    503,
  );
  assert.equal(f.state.gaCalls.length, 0);
  assert.equal(f.state.aiCalls.length, 0);
});

test("atomic quota denial is a safe403 without persisting a report", async () => {
  for (const error of [
    { code: "REPORT_LIMIT", message: "Report limit reached." },
    { code: "P0001", message: "REPORT_QUOTA_EXCEEDED" },
  ]) {
    const f = fixture({ insertError: error });
    const response = await f.create.POST(
      request({ client_id: "client-fixture" }),
    );
    assert.equal(response.status, 403);
    assert.equal(f.state.rows.length, 0);
  }
});
test("post-commit allowance read failure does not advertise a failed creation or unlimited use", async () => {
  const f = fixture({ allowanceFailsAfterInsert: true });
  const response = await f.create.POST(
    request({ client_id: "client-fixture" }),
  );
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(f.state.rows.length, 1);
  assert.equal(body.usage_remaining_known, false);
  assert.equal(body.reports_remaining, null);
  assert.equal(body.report.id, "new-report");
});

test("report quota precheck reads durable allowance rather than surviving report rows", async () => {
  const f = fixture({ count: 3 });
  const response = await f.create.POST(
    request({ client_id: "client-fixture", analytics_source: "ga4" }),
  );
  assert.equal(response.status, 403);
  assert.equal(f.state.gaCalls.length, 0);
  assert.deepEqual(f.state.allowanceCalls, ["client-fixture"]);
});

test("malformed uploads are rejected instead of converted into missing or invented metrics", async (t) => {
  for (const [name, uploaded] of [
    ["missing", undefined],
    ["empty", {}],
    ["array", []],
    ["missing conversions", { traffic: 10 }],
    ["negative", { traffic: -1, conversions: 2 }],
    ["text", { traffic: "10", conversions: 2 }],
    ["invalid rate", { traffic: 10, conversions: 2, bounceRate: 1.5 }],
  ]) {
    await t.test(name, async () => {
      const f = fixture();
      const response = await f.create.POST(
        request({
          client_id: "client-fixture",
          analytics_source: "upload",
          uploaded_analytics: uploaded,
        }),
      );
      assert.equal(response.status, 400);
      assert.equal(f.state.rows.length, 0);
      assert.equal(f.state.gaCalls.length, 0);
    });
  }
});

test("invalid provider measurements fail closed before saving", async () => {
  const f = fixture({ metrics: { traffic: NaN } });
  const response = await f.create.POST(
    request({ client_id: "client-fixture", analytics_source: "ga4" }),
  );
  assert.equal(response.status, 502);
  assert.equal(f.state.rows.length, 0);
});

test("AI uses saved authorized measurements and notes instead of browser overrides", async () => {
  const f = fixture();
  const response = await f
    .ai()
    .POST(
      request({
        reportId: "saved-report",
        traffic: 999999,
        conversions: 999999,
        month: "forged",
        notes: "forged context",
      }),
    );
  assert.equal(response.status, 200);
  assert.equal(f.state.aiConfigurations[0].timeout, 60000);
  assert.equal(f.state.aiConfigurations[0].maxRetries, 0);
  assert.equal(f.state.promptReports[0].traffic, 458);
  assert.equal(f.state.promptReports[0].conversions, f.stored.conversions);
  assert.equal(f.state.promptReports[0].month, f.stored.month);
  assert.equal(f.state.promptReports[0].notes, f.stored.notes);
});

test("AI rejects incomplete saved analytics instead of using browser replacements", async (t) => {
  for (const stored of [
    { traffic: null },
    { conversions: undefined },
    { bounce_rate: 2 },
    { traffic: NaN },
    { month: null },
  ]) {
    await t.test(JSON.stringify(stored), async () => {
      const f = fixture({ stored });
      const response = await f
        .ai()
        .POST(
          request({ reportId: "saved-report", traffic: 458, conversions: 39 }),
        );
      assert.equal(response.status, 409);
      assert.equal(f.state.aiCalls.length, 0);
      assert.equal(f.state.writes, 0);
    });
  }
});

test("report form uses the completed server report without a second analytics sync or browser metric payload", async () => {
  const calls = [];
  const Form = load(
    "app/components/report-form.tsx",
    {
      react: {
        useState: (initial) => [initial, () => {}],
        useRef: (initial) => ({ current: initial }),
        useEffect() {},
        useMemo: (fn) => fn(),
      },
      "next/navigation": { useRouter: () => ({ refresh() {} }) },
      "@/components/calendar": { ReportDatePicker() {} },
      "@/components/service-cta": { default() {}, __esModule: true },
    },
    {
      fetch: async (url, init) => {
        calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
        return Response.json(
          url === "/api/reports"
            ? { report: { id: "created-report" } }
            : { summary: "fixture" },
        );
      },
    },
  ).default;
  const form = Form({ clientId: "client-fixture" });
  await form.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(
    calls.map((call) => call.url),
    ["/api/reports", "/api/ai-summary"],
  );
  assert.deepEqual(calls[1].body, { reportId: "created-report" });
});

test("saved reports never invent top-page evidence when a source has no page breakdown", async () => {
  const f = fixture();
  const response = await f.create.POST(
    request({
      client_id: "client-fixture",
      analytics_source: "upload",
      uploaded_analytics: { traffic: 0, conversions: 0 },
    }),
  );
  assert.equal(response.status, 201);
  assert.equal(f.state.gaCalls.length, 0);
  assert.equal(f.state.rows[0].traffic, 0);
  assert.equal(f.state.rows[0].conversions, 0);
  assert.deepEqual(Array.from(f.state.rows[0].top_pages), []);
  assert.equal(f.state.rows[0].page_views, undefined);
});

test("valid Analytics is acquired once and saved before success", async () => {
  const f = fixture();
  const response = await f.create.POST(
    request({ client_id: "client-fixture", analytics_source: "ga4" }),
  );
  assert.equal(response.status, 201);
  assert.equal(f.state.gaCalls.length, 1);
  assert.equal(f.state.gaCalls[0][0], "123456");
  assert.equal(f.state.rows[0].traffic, 458);
  assert.equal(f.state.rows[0].conversions, 39);
  assert.equal(f.state.rows[0].page_views, 648);
});

test("ownership and approval are checked before Analytics acquisition or AI work", async (t) => {
  for (const options of [
    { signedOut: true },
    { userId: "someone-else" },
    { client: { approval_status: "pending" } },
  ]) {
    await t.test(JSON.stringify(options), async () => {
      const f = fixture(options);
      const response = await f.create.POST(
        request({ client_id: "client-fixture", analytics_source: "ga4" }),
      );
      assert.ok([401, 403, 404].includes(response.status));
      assert.equal(f.state.gaCalls.length, 0);
      assert.equal(f.state.writes, 0);
    });
  }
  const other = fixture({ userId: "someone-else" });
  assert.equal(
    (await other.ai().POST(request({ reportId: "saved-report" }))).status,
    404,
  );
  assert.equal(other.state.aiCalls.length, 0);
});

test("failed Analytics acquisition does not persist a publishable report or spend report allowance", async () => {
  const f = fixture({ gaFailure: true });
  const response = await f.create.POST(
    request({ client_id: "client-fixture", analytics_source: "ga4" }),
  );
  assert.equal(response.status, 502);
  assert.equal(f.state.rows.length, 0);
  assert.equal(f.state.gaCalls.length, 1);
  assert.doesNotMatch(await response.text(), /private provider diagnostic/);
});
