const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadRoute({ user = { email: 'george@roisem.com' }, failure, env = {} } = {}) {
  const filename = path.join(__dirname, '../app/api/admin/database-check/route.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = { clients: 0, queries: [], ended: false };
  class TestClient {
    constructor(config) { calls.clients++; calls.config = config; }
    async connect() { if (failure) throw failure; }
    async query(sql) {
      calls.queries.push(sql);
      return { rows: [{ database: 'test-db', server_version: 'test-version', read_only: 'on' }] };
    }
    async end() { calls.ended = true; }
  }
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports, module, Response,
    process: { env: { DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'test-db', DB_USER: 'test-user', DB_PASSWORD: 'test-only-password', ...env } },
    require(name) {
      if (name === 'pg') return { Client: TestClient };
      if (name === '@/lib/supabase-server') return {
        getRequestUser: async () => ({ user, error: null }),
        isAdminUser: (value) => value?.email === 'george@roisem.com',
      };
      return require(name);
    },
  }, { filename });
  return { GET: module.exports.GET, calls };
}

test('admin can perform a bounded, read-only check and connection is closed', async () => {
  const { GET, calls } = loadRoute();
  const response = await GET(new Request('https://example.test/api/admin/database-check'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(calls.config.ssl, false);
  assert.equal(calls.config.options, '-c default_transaction_read_only=on');
  assert.equal(calls.config.connectionTimeoutMillis, 5000);
  assert.equal(calls.config.query_timeout, 5000);
  assert.equal(calls.queries.length, 1);
  assert.match(calls.queries[0], /^SELECT /);
  assert.equal(calls.ended, true);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('anonymous and non-admin callers never open a database connection', async () => {
  for (const user of [null, { email: 'other@example.test' }]) {
    const { GET, calls } = loadRoute({ user });
    assert.equal((await GET(new Request('https://example.test'))).status, user ? 403 : 401);
    assert.equal(calls.clients, 0);
  }
});

test('missing password fails before connection without returning credential values', async () => {
  const { GET, calls } = loadRoute({ env: { DB_PASSWORD: '' } });
  const response = await GET(new Request('https://example.test'));
  assert.equal(response.status, 503);
  assert.match(await response.text(), /DB_PASSWORD/);
  assert.equal(calls.clients, 0);
});

test('remote hosts are rejected rather than sent credentials with SSL disabled', async () => {
  const { GET, calls } = loadRoute({ env: { DB_HOST: 'remote.example.test' } });
  assert.equal((await GET(new Request('https://example.test'))).status, 503);
  assert.equal(calls.clients, 0);
});

test('database errors are sanitized and connections are closed on failure', async () => {
  const failure = Object.assign(new Error('password test-only-password failed'), { code: '28P01' });
  const { GET, calls } = loadRoute({ failure });
  const response = await GET(new Request('https://example.test'));
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.match(body, /28P01/);
  assert.doesNotMatch(body, /test-only-password/);
  assert.equal(calls.ended, true);
});
