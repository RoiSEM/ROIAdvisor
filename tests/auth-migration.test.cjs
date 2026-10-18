const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { createHash } = require('node:crypto');
function load() {
  const filename = path.join(__dirname, '../app/lib/auth-migration.ts');
  assert.ok(fs.existsSync(filename), 'identity migration validator must exist');
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, require });
  return mod.exports;
}
const identity = { user_id: '00000000-0000-4000-8000-000000000001', provider: 'google', provider_account_id: '123456789', email: 'fixture@example.test', email_verified: true, name: 'Fixture', image: null, created_at: '2026-10-17T00:00:00Z' };
function parse(rows) { const raw = JSON.stringify(rows); return load().parseGoogleIdentities(raw, createHash('sha256').update(raw).digest('hex')); }
test('identity seed preserves UUID/Google subject and rejects unapproved or unsafe imports', () => {
  assert.equal(parse([identity])[0].user_id, identity.user_id);
  assert.equal(parse([identity])[0].provider_account_id, identity.provider_account_id);
  assert.throws(() => load().parseGoogleIdentities('[]', 'not-the-approved-hash'), /approved/);
  assert.throws(() => parse([{ ...identity, email_verified: false }]), /identity/i);
  assert.throws(() => parse([{ ...identity, provider: 'github' }]), /identity/i);
  assert.throws(() => parse([{ ...identity, user_id: 'malformed' }]), /identity/i);
  assert.throws(() => parse([identity, identity]), /Duplicate/);
  assert.throws(() => parse([]), /identity/i);
});
