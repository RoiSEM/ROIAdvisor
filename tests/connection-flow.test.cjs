/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.join(__dirname, "..");
function load(file, deps = {}) {
  const filename = path.join(root, file);
  if (!fs.existsSync(filename)) return {};
  const m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      Response,
      Request,
      Date,
      URL,
      console,
      require(n) {
        if (n in deps) return deps[n];
        if (n.startsWith("@/lib/"))
          return load("app/lib/" + n.slice(6) + ".ts", deps);
        return require(n);
      },
    },
  );
  return m.exports;
}
function fixture(options = {}) {
  let record = {
    id: "site",
    user_id: "owner",
    ga4_property_id: "123456",
    tracking_notes: "Original notes",
    approval_status: "approved",
    ...options.client,
  };
  const calls = { provider: 0, writes: 0 };
  const data = {
    from() {
      let update = null;
      const filters = [];
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        update(p) {
          update = p;
          return q;
        },
        maybeSingle: async () => {
          if (options.dbError) return { error: { message: "private DB" } };
          if (filters.some(([k, v]) => record[k] !== v))
            return { data: null, error: null };
          if (update) {
            calls.writes++;
            record = { ...record, ...update };
          }
          return { data: record, error: null };
        },
        single() {
          return q.maybeSingle();
        },
      };
      return q;
    },
  };
  const deps = {
    "@/lib/data-store": { appData: data },
    "@/lib/supabase-server": {
      getRequestUser: async () => ({
        user: options.signedOut ? null : { id: "owner" },
        error: null,
      }),
      isAdminUser: () => false,
    },
    "@/lib/usage": {
      withUsage: async (_, __, work) =>
        options.throttled ? Response.json({}, { status: 429 }) : work(),
    },
    "@/lib/analytics/ga4": {
      getGA4Report: async () => {
        calls.provider++;
        if (options.providerError) throw new Error("private credential");
        return { traffic: 0, conversions: 0 };
      },
    },
  };
  return { calls, deps, record: () => record };
}
const req = (body) =>
  new Request("https://convert.example/api/clients/site/connection", {
    method: "POST",
    headers: {
      origin: "https://convert.example",
      "content-type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
const params = { params: Promise.resolve({ id: "site" }) };
test("successful zero-activity connection immediately earns server evidence without creating a report", async () => {
  const f = fixture();
  const route = load("app/api/clients/[id]/connection/route.ts", f.deps);
  assert.equal(typeof route.POST, "function");
  const res = await route.POST(req(), params);
  assert.equal(res.status, 200);
  assert.equal(f.calls.provider, 1);
  assert.equal(f.calls.writes, 1);
  assert.equal(
    load("app/lib/connection-proof.ts").readConnectionProof(
      f.record().tracking_notes,
    ).propertyId,
    "123456",
  );
});
test("connection ownership/auth/approval/property validation precedes provider use", async () => {
  for (const options of [
    { signedOut: true },
    { client: { user_id: "other" } },
    { client: { approval_status: "pending" } },
    { client: { ga4_property_id: "not-a-property" } },
  ]) {
    const f = fixture(options);
    const res = await load(
      "app/api/clients/[id]/connection/route.ts",
      f.deps,
    ).POST(req(), params);
    assert.ok(res.status >= 400);
    assert.equal(f.calls.provider, 0);
    assert.equal(f.calls.writes, 0);
  }
});
test("failed and throttled connections never persist evidence or leak provider diagnostics", async () => {
  for (const options of [{ providerError: true }, { throttled: true }]) {
    const f = fixture(options);
    const res = await load(
      "app/api/clients/[id]/connection/route.ts",
      f.deps,
    ).POST(req(), params);
    assert.ok(res.status >= 400);
    assert.equal(f.calls.writes, 0);
    assert.doesNotMatch(await res.text(), /private credential/);
  }
});
test("client PATCH cannot forge connection proof and preserves it only for same property", async () => {
  const p = load("app/lib/connection-proof.ts");
  const forged = p.writeConnectionProof("User text", {
    source: "ga4",
    propertyId: "123456",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  for (const existing of [null, forged]) {
    const f = fixture({ client: { tracking_notes: existing } });
    const route = load("app/api/clients/[id]/route.ts", f.deps);
    const response = await route.PATCH(
      new Request("https://convert.example/api/clients/site", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Site",
          ga4_property_id: "123456",
          tracking_notes: forged,
        }),
      }),
      params,
    );
    assert.equal(response.status, 200);
    assert.equal(
      Boolean(p.readConnectionProof(f.record().tracking_notes)),
      Boolean(existing),
    );
  }
});
