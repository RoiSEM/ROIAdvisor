const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const filename = path.join(__dirname, '../app/lib/postgres-data.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const env = {};
  vm.runInNewContext(source, { module, exports: module.exports, require, process: { env }, console }, { filename });
  return { ...module.exports, env };
}

// SQL generation tests use an explicit executor stub. The live SQL adapter was
// also exercised locally with PostgreSQL and the private source exports.
test('backend defaults to unchanged Vercel source, and invalid flags fail closed', () => {
  const { getDataBackend, env } = load();
  assert.equal(getDataBackend(), 'supabase');
  env.DATA_BACKEND = 'postgres';
  assert.equal(getDataBackend(), 'postgres');
  env.DATA_BACKEND = 'typo';
  assert.throws(getDataBackend, /Unsupported/);
});

test('values are bound parameters, never executable SQL', async () => {
  const { PostgresQuery } = load();
  let captured;
  const malicious = "test-only'; DROP TABLE clients; --";
  const executor = () => ({ query: async (sql, values) => { captured = { sql, values }; return { rows: [] }; } });
  await new PostgresQuery('clients', executor).select('id, name').eq('name', malicious);
  assert.doesNotMatch(captured.sql, /DROP TABLE/);
  assert.equal(captured.values[0], malicious);
  assert.match(captured.sql, /convert_staging\."clients"/);
});

test('table/column identifiers and unfiltered mutations are rejected', async () => {
  const { PostgresQuery } = load();
  let executions = 0;
  const executor = () => ({ query: async () => { executions++; return { rows: [] }; } });
  assert.throws(() => new PostgresQuery('clients; DROP TABLE users', executor));
  assert.ok((await new PostgresQuery('clients', executor).select('id; DROP TABLE users')).error);
  assert.ok((await new PostgresQuery('clients', executor).delete()).error);
  assert.ok((await new PostgresQuery('clients', executor).update({ name: 'test-only' })).error);
  assert.equal(executions, 0);
});

test('JSONB payloads serialize as JSON while text arrays remain arrays', async () => {
  const { PostgresQuery } = load();
  const captured = [];
  const executor = () => ({ query: async (sql, values) => { captured.push({ sql, values }); return { rows: [] }; } });
  await new PostgresQuery('reports', executor).insert({ top_pages: ['/'], key_event_performance: [{ count: 2 }] });
  assert.equal(captured[0].values[0], '["/"]');
  assert.equal(captured[0].values[1], '[{"count":2}]');
  await new PostgresQuery('clients', executor).insert({ name: 'test-only', conversion_types: ['Form'] });
  assert.equal(captured[1].values[1][0], 'Form');
});

test('count-only queries return counts rather than fake data rows', async () => {
  const { PostgresQuery } = load();
  const executor = () => ({ query: async () => ({ rows: [{ exact_count: 12 }] }) });
  const result = await new PostgresQuery('clients', executor).select('id', { count: 'exact', head: true });
  assert.equal(result.count, 12);
  assert.equal(result.data, null);
});

test('driver errors never expose raw connection messages and optional columns support fallback', async () => {
  const { PostgresQuery } = load();
  const executor = () => ({ query: async () => { throw Object.assign(new Error('password test-only-secret failed'), { code: '28P01' }); } });
  const result = await new PostgresQuery('clients', executor).select('*');
  assert.doesNotMatch(JSON.stringify(result), /test-only-secret/);
  const missing = () => ({ query: async () => { throw Object.assign(new Error('column "channel_performance" of relation "reports" does not exist'), { code: '42703' }); } });
  const fallback = await new PostgresQuery('reports', missing).update({ channel_performance: [] }).eq('id', 'test-only');
  assert.equal(fallback.error.message, "Could not find the 'channel_performance' column");
});
