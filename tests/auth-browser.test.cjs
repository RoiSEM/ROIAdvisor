const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load() {
 const filename=path.join(__dirname,'../app/lib/auth-browser.ts');
 assert.ok(fs.existsSync(filename),'browser auth bridge must exist');
 const calls=[]; let assigned;
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
  module:mod,exports:mod.exports,require:()=>{throw Error('Supabase must not load in Better Auth mode')},
  fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url==='/api/auth/config'?{backend:'better-auth'}:{url:'https://accounts.google.com/o/oauth2/v2/auth?test-only'}}},
  window:{location:{origin:'https://georgea140.sg-host.com',assign:u=>assigned=u}},URL,
 });
 return {...mod.exports,calls,assigned:()=>assigned};
}
test('browser Google login and signout use Better Auth without loading Supabase',async()=>{
 const app=load();await app.startGoogleSignIn();
 assert.match(app.assigned(),/^https:\/\/accounts.google.com/);
 const signin=app.calls.find(c=>c.url==='/api/auth/sign-in/social');
 assert.equal(JSON.parse(signin.options.body).callbackURL,'/dashboard');
 await app.signOut();assert.ok(app.calls.find(c=>c.url==='/api/auth/sign-out'));
});
