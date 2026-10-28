/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(user, record = null, error = null) {
  const module = { exports: {} };
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return {data: record, error}; } };
  const source = fs.readFileSync(path.join(__dirname, '../app/api/billing/route.ts'), 'utf8');
  const billingSource = fs.readFileSync(path.join(__dirname, '../app/lib/billing.ts'), 'utf8');
  const billingModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(billingSource, { compilerOptions: {module: ts.ModuleKind.CommonJS} }).outputText, { module: billingModule, exports: billingModule.exports });
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {module: ts.ModuleKind.CommonJS} }).outputText, {
    module, exports: module.exports, Response,
    require(name) {
      if (name === '@/lib/supabase-server') return { getRequestUser: async () => ({user, error: null}) };
      if (name === '@/lib/data-store') return {appData: {from: () => query}};
      if (name === '@/lib/billing') return billingModule.exports;
      throw new Error(name);
    },
  });
  return module.exports.GET;
}
test('billing API identifies anonymous free access without claiming a subscription', async () => {
  const res = await load(null)();
  const body = await res.json();
  assert.equal(body.authenticated, false);
  assert.equal(body.plan, 'free');
});
test('billing API identifies signed-in Free access for dashboard CTA', async () => {
  const res = await load({id:'fixture-user'})();
  const body = await res.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.plan, 'free');
});
test('billing API preserves paid entitlements while exposing authentication state', async () => {
  const res = await load({id:'fixture-user'}, {plan:'pro',status:'active'})();
  const body = await res.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.plan, 'pro');
  assert.equal(body.can_use_custom_date_range, true);
  assert.equal(body.has_unlimited_reports, true);
});
