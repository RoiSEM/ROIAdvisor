const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
function load(user={email:'george@roisem.com'},backend='supabase') {
 const filename=path.join(__dirname,'../app/api/admin/auth-migration/route.ts');assert.ok(fs.existsSync(filename),'admin migration endpoint must exist');
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  module:mod,exports:mod.exports,Request,Response,Buffer,process:{env:{DB_NAME:'dbyrsugxc16oj2'}},
  require:n=>{
   if(n==='@/lib/supabase-server')return{getRequestUser:async()=>({user,error:null}),isAdminUser:u=>u?.email==='george@roisem.com'};
   if(n==='@/lib/auth-config')return{getAuthBackend:()=>backend,getBetterAuthSettings:()=>({baseURL:'https://georgea140.sg-host.com'})};
   if(n==='@/lib/auth-postgres')return{authPostgresPool:()=>{throw Error('must not access database for rejected requests')}};
   if(n==='@/lib/auth-migration')return{parseGoogleIdentities:()=>{throw Error('unapproved file')},APPROVED_GOOGLE_IMPORT_SHA256:'fixture-only'};
   if(n==='@/lib/better-auth-options')return{};
   if(n==='better-auth/db/migration')return{};
   return require(n);
  }
 });return mod.exports;
}
test('auth migration requires admin, staging origin, old auth, bounded approved upload',async()=>{
 const req=(origin='https://georgea140.sg-host.com',body='[]')=>new Request('https://localhost:1234/api/admin/auth-migration',{method:'POST',headers:{origin},body});
 assert.equal((await load(null).POST(req())).status,401);
 assert.equal((await load({email:'other@example.test'}).POST(req())).status,403);
 assert.equal((await load().POST(req('https://evil.example.test'))).status,403);
 assert.equal((await load(undefined,'better-auth').POST(req())).status,409);
 assert.equal((await load().POST(req(undefined,'x'.repeat(40000)))).status,413);
 assert.equal((await load().POST(req())).status,400);
});
