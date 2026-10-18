const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function options() {
  const filename = path.join(__dirname, '../app/lib/better-auth-options.ts');
  assert.ok(fs.existsSync(filename), 'Better Auth options must exist');
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, require, process, console });
  return mod.exports.createBetterAuthOptions;
}
const settings = { baseURL: 'https://georgea140.sg-host.com', secret: 'test-only-0123456789abcdefghijklmnopqrstuvwxyz', clientId: 'test-client', clientSecret: 'test-client-secret' };
test('Google auth uses fixed origin, UUIDs, isolated tables, and no email-based account linking', () => {
  const opts = options()({}, settings);
  assert.equal(opts.baseURL, settings.baseURL);
  assert.equal(opts.advanced.database.generateId, 'uuid');
  assert.equal(opts.account.accountLinking.enabled, false);
  assert.equal(opts.account.accountLinking.disableImplicitLinking, true);
  assert.equal(opts.user.modelName, 'convert_auth_user');
  assert.equal(opts.session.cookieCache.enabled, false);
  assert.equal(opts.rateLimit.storage, 'database');
  assert.equal(opts.socialProviders.google.clientId, settings.clientId);
  assert.ok(opts.user.validateUserInfo({ user: { emailVerified: false } }));
  assert.equal(opts.user.validateUserInfo({ user: { emailVerified: true } }), undefined);
});
test('auth PostgreSQL pool retains native Date parsing and rejects non-loopback connections', () => {
 const filename = path.join(__dirname, '../app/lib/auth-postgres.ts');
 assert.ok(fs.existsSync(filename), 'auth-native PostgreSQL pool must exist');
 const mod={exports:{}};let configuration;
 const env={DB_HOST:'remote.example.test',DB_PORT:'5432',DB_NAME:'test-only',DB_USER:'test-only',DB_PASSWORD:'test-only'};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,process:{env},console,require:n=>n==='pg'?{Pool:class{constructor(config){configuration=config;}on(){}}}:require(n)});
 assert.throws(() => mod.exports.authPostgresPool(), /local PostgreSQL/);
 env.DB_HOST='localhost';
 mod.exports.authPostgresPool();assert.equal(configuration.types,undefined);assert.equal(configuration.ssl,false);
});
module.exports = { options, settings };
