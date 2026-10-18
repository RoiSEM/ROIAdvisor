const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');

const retiredFiles = [
  'app/api/admin/database-import/route.ts',
  'app/api/admin/auth-migration/route.ts',
  'app/api/admin/database-check/route.ts',
  'app/admin/database-import/page.tsx',
  'app/admin/database-import/import-form.tsx',
  'app/admin/auth-migration/page.tsx',
  'app/admin/auth-migration/migration-form.tsx',
  'app/lib/auth-migration.ts',
];

test('one-time migration pages, endpoints, and importer are not shipped', () => {
  for (const relative of retiredFiles) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} must be retired`);
  }
});

function runtime(query) {
  const mod = { exports: {} };
  const instance = { fixture: true };
  let initialized = 0;
  const filename = path.join(root, 'app/lib/better-auth.ts');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === 'better-auth') return { betterAuth() { initialized++; return instance; } };
      if (name === './auth-postgres') return { authPostgresPool: () => ({ query }) };
      if (name === './auth-config') return { getBetterAuthSettings: () => ({}) };
      if (name === './better-auth-options') return { createBetterAuthOptions: () => ({}) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { get: mod.exports.getBetterAuth, instance, initialized: () => initialized };
}

test('existing auth readiness marker still gates login after importer retirement', async () => {
  const ready = runtime(async (sql) => {
    assert.match(sql, /SELECT version FROM public\.convert_auth_migration WHERE version = 1/);
    return { rowCount: 1 };
  });
  assert.equal(await ready.get(), ready.instance);
  assert.equal(await ready.get(), ready.instance);
  assert.equal(ready.initialized(), 1);

  const missing = runtime(async () => ({ rowCount: 0 }));
  await assert.rejects(missing.get(), /not ready/);
  assert.equal(missing.initialized(), 0);

  const unavailable = runtime(async () => { throw new Error('database unavailable'); });
  await assert.rejects(unavailable.get(), /database unavailable/);
  assert.equal(unavailable.initialized(), 0);
});
