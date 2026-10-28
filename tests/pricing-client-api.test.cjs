/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.join(__dirname,'..');
function load(file,errors={}){
 const m={exports:{}};
 const query={select(){return this},eq(){return this},insert(){return this},update(){return this},maybeSingle:async()=>({data:{id:'site-1',ga4_property_id:null,tracking_notes:null},error:null}),single:async()=>({data:null,error:errors})};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  module:m,exports:m.exports,Response,console,
  require(name){
   if(name==='@/lib/data-store')return {appData:{from:()=>query}};
   if(name==='@/lib/supabase-server')return {getRequestUser:async()=>({user:{id:'admin-fixture',email:'admin@example.test'},error:null}),isAdminUser:()=>true};
   if(name==='@/lib/connection-proof')return {removeConnectionProof:x=>x,preserveConnectionProof:x=>x};
   if(name==='@/lib/billing')return {};
   throw new Error('Unexpected import '+name);
  }
 });return m.exports;
}
for(const [label,file,method]of [['create','app/api/clients/route.ts','POST'],['ownership update','app/api/clients/[id]/route.ts','PATCH']]){
 for(const [description,error,status]of [
  ['native adapter denial',{code:'SITE_LIMIT',message:'Website limit reached for this account plan.'},403],
  ['exact SQL denial',{code:'P0001',message:'SITE_QUOTA_EXCEEDED'},403],
  ['unrelated SITE SQL exception',{code:'P0001',message:'SITE_LIMIT_REQUIRES_READ_COMMITTED'},500],
  ['database failure',{code:'08006',message:'fixture backend unavailable'},500],
 ])test(`${label}: ${description} has the correct HTTP status`,async()=>{
  const route=load(file,error);
  const res=await route[method](new Request('http://localhost/api/clients/site-1',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Fixture site',website:'https://example.test',user_id:'owner-fixture'})}),{params:Promise.resolve({id:'site-1'})});
  assert.equal(res.status,status);
  if(status===403){const body=await res.json();assert.doesNotMatch(body.error,/P0001|SITE_QUOTA_EXCEEDED/);assert.match(body.error,/website limit/i);}
 });
}
