const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real route and NextResponse; only external auth/cookie services
// are stubbed. No requests are sent to Supabase and no real tokens are used.
function loadRoute({ authError = null } = {}) {
  const filename = path.join(__dirname, '../app/auth/callback/route.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  let exchanges = 0;
  const mockedRequire = (name) => {
    if (name === 'next/headers') return { cookies: async () => ({ getAll: () => [] }) };
    if (name === '@supabase/ssr') return {
      createServerClient: (_url, _key, options) => ({ auth: {
        exchangeCodeForSession: async () => {
          exchanges++;
          if (!authError) options.cookies.setAll([
            { name: 'test-session', value: 'test-only-cookie', options: { httpOnly: true, path: '/' } },
          ]);
          return { error: authError };
        },
      } }),
    };
    return require(name);
  };
  vm.runInNewContext(source, {
    exports: module.exports, module, require: mockedRequire, URL, process,
    console: { error() {} },
  }, { filename });
  return { GET: module.exports.GET, exchanges: () => exchanges };
}

// Reproduce SiteGround's internal request origin, distinct from the public URL.
test('successful callback stays on the public browser origin and saves session cookies', async () => {
  const route = loadRoute();
  const response = await route.GET(new Request('https://localhost:64321/auth/callback?code=test-only-code'));
  assert.equal(response.headers.get('location'), '/dashboard');
  assert.equal(new URL(response.headers.get('location'), 'https://georgea140.sg-host.com/auth/callback').origin,
    'https://georgea140.sg-host.com');
  assert.equal(route.exchanges(), 1);
  assert.equal(response.cookies.get('test-session').value, 'test-only-cookie');
  assert.equal(response.status, 307);
});

test('missing code returns to login without exchanging a session', async () => {
  const route = loadRoute();
  const response = await route.GET(new Request('https://localhost:64321/auth/callback'));
  assert.equal(response.headers.get('location'), '/login');
  assert.equal(route.exchanges(), 0);
});

test('failed exchange returns to public login with an error', async () => {
  const route = loadRoute({ authError: new Error('test-only rejected exchange') });
  const response = await route.GET(new Request('https://localhost:64321/auth/callback?code=test-only-code'));
  assert.equal(response.headers.get('location'), '/login?error=auth_callback');
  assert.equal(response.cookies.get('test-session'), undefined);
});
