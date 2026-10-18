const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(env = {}) {
  const filename = require('node:path').join(__dirname, '../app/lib/auth-config.ts');
  assert.ok(fs.existsSync(filename), 'auth backend configuration must exist');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, process: { env }, URL });
  return module.exports;
}
const ready = { DATA_BACKEND: 'postgres', BETTER_AUTH_URL: 'https://georgea140.sg-host.com', BETTER_AUTH_SECRET: 'test-only-0123456789abcdefghijklmnopqrstuvwxyz', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' };
test('Better Auth requires PostgreSQL, explicit public origin, and complete private credentials', () => {
  assert.equal(load(ready).getBetterAuthSettings().baseURL, ready.BETTER_AUTH_URL);
  for (const key of Object.keys(ready)) {
    const env = { ...ready }; delete env[key];
    assert.throws(() => load(env).getBetterAuthSettings());
  }
  for (const value of ['https://example.test/path', 'https://user:pass@example.test', 'http://example.test', 'https://example.test?x=1']) {
    assert.throws(() => load({ ...ready, BETTER_AUTH_URL: value }).getBetterAuthSettings());
  }
  assert.throws(() => load({ ...ready, BETTER_AUTH_SECRET: 'short' }).getBetterAuthSettings());
});
test('auth backend remains Supabase by default; invalid settings fail closed', () => {
  assert.equal(load().getAuthBackend(), 'supabase');
  assert.equal(load({ AUTH_BACKEND: 'better-auth' }).getAuthBackend(), 'better-auth');
  assert.throws(() => load({ AUTH_BACKEND: 'typo' }).getAuthBackend(), /Unsupported/);
});
