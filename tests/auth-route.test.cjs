const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps) {
 const filename = path.join(__dirname, '..', file);
 assert.ok(fs.existsSync(filename), 'auth endpoint must exist');
 const mod = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, require: n => deps[n] ?? require(n), Response, console });
 return mod.exports;
}
test('Better Auth endpoints remain disabled until explicit cutover', async () => {
 const route=load('app/api/auth/[...all]/route.ts', { '@/lib/auth-config': { getAuthBackend: () => 'supabase' }, '@/lib/better-auth': { getBetterAuth: () => { throw Error('must not initialize'); } } });
 assert.equal((await route.POST(new Request('https://example.test/api/auth/sign-in/social', { method: 'POST' }))).status, 404);
});
test('Better Auth endpoints forward requests and sanitize initialization failures', async () => {
 const deps={ '@/lib/auth-config': { getAuthBackend: () => 'better-auth' }, '@/lib/better-auth': { getBetterAuth: async () => ({ handler: async () => new Response('handled') }) } };
 const route=load('app/api/auth/[...all]/route.ts',deps);
 assert.equal(await (await route.GET(new Request('https://example.test/api/auth/get-session'))).text(), 'handled');
 deps['@/lib/better-auth'].getBetterAuth=async () => {throw Error('private-password')};
 const failure=await route.GET(new Request('https://example.test/api/auth/get-session'));
 assert.equal(failure.status,503); assert.doesNotMatch(await failure.text(), /private-password/);
});
