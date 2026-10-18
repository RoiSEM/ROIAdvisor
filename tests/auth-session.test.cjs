const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(backend, session) {
  const ensured = [];
  const filename = path.join(__dirname, '../app/lib/supabase-server.ts');
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, process: { env: {} }, console,
    require(name) {
      if (name === './auth-config') return { getAuthBackend: () => backend, getBetterAuthSettings: () => ({ baseURL: 'https://example.test' }) };
      if (name === './better-auth') return { getBetterAuth: async () => ({ api: { getSession: async () => session } }) };
      if (name === './postgres-data') return { ensurePostgresUser: async u => ensured.push(u) };
      if (name === 'next/headers') return { headers: async () => new Headers(), cookies: async () => ({ getAll: () => [] }) };
      if (name === '@supabase/ssr') return { createServerClient: () => { throw Error('Supabase must not be called'); } };
      if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: { getUser: async () => { throw Error('Supabase must not be called'); } } }) };
      return require(name);
    },
  });
  return { ...mod.exports, ensured };
}
test('Better Auth session retains legacy UUID without accepting Supabase bearer fallback', async () => {
  const u = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.test', emailVerified: true, createdAt: new Date('2026-10-17T00:00:00Z') };
  const app = load('better-auth', { user: u });
  const { user, error } = await app.getRequestUser(new Request('https://example.test', { headers: { Authorization: 'Bearer old-supabase-token' } }));
  assert.equal(error, null); assert.equal(user.id, u.id); assert.equal(app.ensured[0].id, u.id);
});
test('cookie-authenticated application mutations reject missing or cross-origin requests', async () => {
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.test', emailVerified: true, createdAt: new Date() };
  const app = load('better-auth', { user });
  for (const origin of [null, 'https://evil.example.test']) {
    const req = new Request('https://example.test/api/clients', { method: 'POST', headers: origin ? { origin } : {} });
    assert.equal((await app.getRequestUser(req)).user, null);
  }
  const req = new Request('https://example.test/api/clients', { method: 'POST', headers: { origin: 'https://example.test' } });
  assert.equal((await app.getRequestUser(req)).user.id, user.id);
});
test('missing or unverified Better Auth sessions are denied', async () => {
  assert.equal((await load('better-auth', null).getRequestUser()).user, null);
  assert.equal((await load('better-auth', { user: { emailVerified: false } }).getRequestUser()).user, null);
});
