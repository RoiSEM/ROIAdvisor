/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');const {test}=require('node:test');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const root=path.join(__dirname,'..');
function view(file,summary){
 const client={id:'client',user_id:'owner',name:'Fixture business',website:'https://example.com',approval_status:'approved',monthly_goal:80,conversion_tracking_status:'Yes',conversion_types:['Form submission']};
 const report={id:'report',client_id:'client',month:'2026-09-19 to 2026-10-19',start_date:'2026-09-19',end_date:'2026-10-19',traffic:458,conversions:39,page_views:648,active_users:377,bounce_rate:.598,engagement_rate:.402,notes:'Fixture',ai_summary:summary,created_at:'2026-10-19',clients:client};
 const data={from(table){const q={select(){return q},eq(){return q},single:async()=>({data:table==='clients'?client:report,error:null}),maybeSingle:async()=>({data:client,error:null}),order:async()=>({data:[report],error:null})};return q;}};
 const cache=new Map();
 function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}};const filename=path.join(root,file);vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,URL,console,require(name){
  if(name==='@/lib/data-store')return {appData:data};
  if(name==='@/lib/supabase-server')return {getRequestUser:async()=>({user:{id:'owner'},error:null}),isAdminUser:()=>false};
  if(name==='next/navigation')return {redirect(){throw new Error('redirect')},notFound(){throw new Error('not found')}};
  if(name==='next/link')return {__esModule:true,default:({href,children})=>React.createElement('a',{href},children)};
  if(name==='@/components/report-markdown')return load('app/components/report-markdown.tsx');
  if(name.startsWith('@/components/'))return {__esModule:true,default:()=>null};
  if(name.startsWith('@/lib/'))return load('app/lib/'+name.slice(6)+'.ts');
  return require(name);
 }},{filename});cache.set(file,mod.exports);return mod.exports;}
 return load(file).default({params:Promise.resolve({id:file.includes('/print/')?'report':'client'})});
}
for(const file of ['app/clients/[id]/page.tsx','app/reports/[id]/print/page.tsx']){
 test('actual '+file+' renders safe report content with fixture auth/data',async()=>{
  const html=renderToStaticMarkup(await view(file,'## Summary Insights & Performance Summary\n\n**Useful finding**\n\n<img src="https://tracker.example/pixel" onerror="window.reportInjected=true">\n\n[Bad](javascript:alert(1))\n\n[Good](https://example.com/help)'));
  assert.match(html,/<strong>Useful finding<\/strong>/);assert.match(html,/href="https:\/\/example.com\/help"/);
  assert.doesNotMatch(html,/<script\b|onerror=|reportInjected|tracker\.example|href="javascript:/i);
 });
}
