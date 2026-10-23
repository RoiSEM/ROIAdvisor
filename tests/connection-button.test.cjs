/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
function fixture(ok) {
  let refresh = 0;
  const requests = [];
  const updates = [];
  const f = path.join(
    __dirname,
    "../app/components/check-connection-button.tsx",
  );
  if (!fs.existsSync(f)) return {};
  const m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
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
      fetch: async (...args) => {
        requests.push(args);
        return {
          ok,
          json: async () =>
            ok ? { connected: true } : { error: "Check Viewer access" },
        };
      },
      require(n) {
        if (n === "react")
          return {
            ...React,
            useState: (value) => [value, (next) => updates.push(next)],
          };
        if (n === "next/navigation")
          return { useRouter: () => ({ refresh: () => refresh++ }) };
        return require(n);
      },
    },
  );
  return {
    component: m.exports.default,
    requests,
    updates,
    refresh: () => refresh,
  };
}
function find(el) {
  if (el?.type === "button") return el;
  for (const c of React.Children.toArray(el?.props?.children)) {
    const b = find(c);
    if (b) return b;
  }
}
test("connection action makes an explicit authenticated POST and refreshes only on confirmed success", async () => {
  for (const ok of [true, false]) {
    const f = fixture(ok);
    assert.equal(typeof f.component, "function");
    const tree = f.component({ clientId: "site/id" });
    const button = find(tree);
    assert.ok(button);
    await button.props.onClick();
    assert.equal(f.requests[0][0], "/api/clients/site%2Fid/connection");
    assert.equal(f.requests[0][1].method, "POST");
    assert.equal(f.refresh(), ok ? 1 : 0);
    if (!ok) assert.ok(f.updates.includes("Check Viewer access"));
  }
});
