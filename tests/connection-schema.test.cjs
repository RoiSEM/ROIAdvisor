/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '..');
const migration = path.join(root, 'sql/2026-10-23_add_client_tracking_notes.sql');
const owner = '10000000-0000-4000-8000-000000000001';
const site = '20000000-0000-4000-8000-000000000001';

function load(file, dependencies = {}) {
  const mod = { exports: {} };
  const filename = path.join(root, file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports, Request, Response, Date, URL, console,
    process: { env: { DATA_BACKEND: 'postgres' } },
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name.startsWith('@/lib/')) return load('app/lib/' + name.slice(6) + '.ts', dependencies);
      return require(name);
    },
  }, { filename });
  return mod.exports;
}

async function fixture() {
  const db = new PGlite();
  // Relevant columns match the imported schema. tracking_notes was NOT included.
  await db.exec(`CREATE SCHEMA convert_staging;
    CREATE TABLE convert_staging.clients (
      id uuid PRIMARY KEY, user_id uuid, ga4_property_id text,
      approval_status text NOT NULL DEFAULT 'pending', client_notes text
    );`);
  await db.query('INSERT INTO convert_staging.clients VALUES ($1,$2,$3,$4,$5)', [site, owner, '123456', 'approved', 'Keep the existing notes']);
  const { PostgresQuery } = load('app/lib/postgres-data.ts');
  const calls = { provider: 0, usage: 0 };
  const dependencies = {
    '@/lib/data-store': { appData: { from: table => new PostgresQuery(table, () => ({ query: (sql, values) => db.query(sql, values) })) } },
    '@/lib/supabase-server': { getRequestUser: async () => ({ user: { id: owner }, error: null }), isAdminUser: () => false },
    '@/lib/usage': { withUsage: async (_, __, work) => { calls.usage++; return work(); } },
    '@/lib/analytics/ga4': { getGA4Report: async () => { calls.provider++; return { traffic: 0, conversions: 0 }; } },
  };
  const route = load('app/api/clients/[id]/connection/route.ts', dependencies);
  const check = () => route.POST(new Request('https://convert.example/api/clients/' + site + '/connection', {
    method: 'POST', headers: { Origin: 'https://convert.example', 'Content-Type': 'application/json' }, body: '{}',
  }), { params: Promise.resolve({ id: site }) });
  return { db, calls, check };
}

test('imported schema reproduces the reported settings error; the migration restores actual connection evidence reads and writes', async () => {
  const { db, calls, check } = await fixture();
  try {
    const before = await check();
    assert.equal(before.status, 503);
    assert.equal((await before.json()).error, 'Unable to read website settings.');
    assert.equal(calls.provider, 0, 'The settings failure occurs before Google Analytics is called');
    assert.equal(calls.usage, 0);
    const { rows: unchanged } = await db.query('SELECT * FROM convert_staging.clients');
    assert.equal(unchanged[0].client_notes, 'Keep the existing notes');

    assert.ok(fs.existsSync(migration), 'The connection-evidence schema migration is missing');
    await db.exec(fs.readFileSync(migration, 'utf8'));
    const { rows: migrated } = await db.query('SELECT * FROM convert_staging.clients');
    assert.equal(migrated[0].tracking_notes, null, 'Adding a field must not invent connection evidence');
    assert.equal(migrated[0].client_notes, 'Keep the existing notes');
    assert.equal(migrated[0].user_id, owner);

    const after = await check();
    assert.equal(after.status, 200);
    assert.equal((await after.json()).connected, true);
    assert.equal(calls.provider, 1, 'A real server acquisition path is still required (provider stub only in this test)');
    const { rows: saved } = await db.query('SELECT * FROM convert_staging.clients');
    const proof = load('app/lib/connection-proof.ts').readConnectionProof(saved[0].tracking_notes);
    assert.equal(proof.source, 'ga4');
    assert.equal(proof.propertyId, '123456');
    assert.equal(saved[0].client_notes, 'Keep the existing notes');

    await db.exec(fs.readFileSync(migration, 'utf8'));
    const { rows: rerun } = await db.query('SELECT * FROM convert_staging.clients');
    assert.equal(rerun[0].tracking_notes, saved[0].tracking_notes, 'Reapplying the migration preserves verified evidence');
    assert.equal(rerun.length, 1);
  } finally {
    await db.close();
  }
});
