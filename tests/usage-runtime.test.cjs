/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');const {test}=require('node:test');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
async function fixture(t,backend='postgres',options={}){
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();t.after(()=>db.close());const schema=backend==='postgres'?'convert_staging':'public';
 await db.exec(`CREATE SCHEMA IF NOT EXISTS ${schema};CREATE TABLE ${schema}.clients(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE ${schema}.billing_accounts(user_id uuid UNIQUE,plan text,status text);CREATE TABLE ${schema}.reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid REFERENCES ${schema}.clients(id),created_at timestamptz DEFAULT now());`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../sql/2026-10-19_add_usage_ledger_and_guard'+(backend==='postgres'?'':'_public')+'.sql'),'utf8'));
 const calls=[];const warnings=[];const execute=async(sql,args)=>{calls.push(sql);if(sql.includes('acquire_operational_guard') && Object.hasOwn(options,'invalidLease'))return {rows:[{lease_id:options.invalidLease,result:options.invalidLease}]};if(options.queryError)throw new Error('private DB diagnostic');return db.query(sql,args);};
 const deps={'./postgres-data':{getDataBackend:()=>backend,postgresPool:()=>({query:execute})},'./supabase-server':{supabaseAdmin:{from(){throw new Error('Usage access must use private RPCs');},async rpc(name,args){if(options.releaseError && name==='release_operational_guard')return {data:null,error:{message:'private release diagnostic'}};if(options.rpcError)return {data:null,error:{message:'private DB diagnostic'}};const parameters={acquire_operational_guard:[args.p_actor_id,args.p_operation,args.p_now_ms],release_operational_guard:[args.p_actor_id,args.p_lease_id],get_report_allowance:[args.p_client_id]}[name];try{const r=await execute(`SELECT ${schema}.${name}(${parameters.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,parameters);return {data:r.rows[0].result,error:null};}catch(error){return {data:null,error};}}}}};
 const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/lib/usage.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,Response,Date:options.skewClock?class extends Date{constructor(...args){super(...(args.length?args:['2000-01-01T00:00:00Z']))}}:Date,console:{warn:m=>warnings.push(m),error:m=>warnings.push(m)},require:name=>deps[name]??require(name)});
 return {db,schema,calls,warnings,usage:mod.exports};
}
test('real native usage wrapper acquires the schema-qualified guard and releases it',async t=>{
 const f=await fixture(t);let called=0;const response=await f.usage.withUsage('actor','ai',async()=>{called++;return Response.json({ok:true});});
 assert.equal(response.status,200);assert.equal(called,1);
 assert.equal((await f.db.query('SELECT lease_id FROM convert_staging.operational_guards')).rows[0].lease_id,null);
});

test('Supabase RPC outage is unavailable, not a fake rate-limit denial',async t=>{
 const f=await fixture(t,'supabase',{rpcError:true});let called=false;const response=await f.usage.withUsage('actor','ai',async()=>{called=true;return Response.json({ok:true})});
 assert.equal(response.status,503);assert.equal(called,false);assert.doesNotMatch(await response.text(),/private DB diagnostic/);
});

test('allowance and enforcement share database UTC time even when the application clock differs',async t=>{
 const f=await fixture(t,'postgres',{skewClock:true});const client='22222222-2222-4222-8222-222222222222';
 await f.db.query('INSERT INTO convert_staging.clients VALUES($1,$2)',[client,'11111111-1111-4111-8111-111111111111']);await f.db.query('INSERT INTO convert_staging.reports(client_id) VALUES($1)',[client]);
 const allowance=await f.usage.getReportAllowance(client);assert.equal(allowance.used,1);assert.equal(allowance.limit,3);assert.equal(allowance.remaining,2);
});

test('an unavailable allowance inside admitted work returns503 and releases its lease',async t=>{
 const f=await fixture(t);let response;
 try {response=await f.usage.withUsage('actor','report',async()=>{await f.usage.getReportAllowance('22222222-2222-4222-8222-222222222222');return Response.json({ok:true});});}
 catch {response=Response.json({error:'route caught error'},{status:500});}
 assert.equal(response.status,503);assert.equal((await f.db.query('SELECT lease_id FROM convert_staging.operational_guards')).rows[0].lease_id,null);
});

test('malformed admission metadata never authorizes upstream work',async t=>{
 for(const invalidLease of ['not-a-uuid',undefined,{fake:true}]) {
  const f=await fixture(t,'postgres',{invalidLease});let called=false;
  const response=await f.usage.withUsage('actor','ai',async()=>{called=true;return Response.json({ok:true})});
  assert.equal(response.status,503);assert.equal(called,false);
 }
});

test('failed RPC lease release is logged safely without falsely failing successful work',async t=>{
 const f=await fixture(t,'supabase',{releaseError:true});const response=await f.usage.withUsage('actor','ai',async()=>Response.json({ok:true}));
 assert.equal(response.status,200);assert.equal(f.warnings.length,1);assert.doesNotMatch(f.warnings.join(' '),/private release diagnostic/);
 assert.ok((await f.db.query('SELECT lease_id FROM public.operational_guards')).rows[0].lease_id);
});

for(const backend of ['postgres','supabase'])test(backend+' failed work still consumes admission budget and releases each lease',async t=>{
 const f=await fixture(t,backend);const error=new Error('Fixture work failure');let calls=0;
 for(let i=0;i<10;i++)await assert.rejects(f.usage.withUsage('actor','ai',async()=>{calls++;throw error;}),e=>e===error);
 const denied=await f.usage.withUsage('actor','ai',async()=>{calls++;return Response.json({ok:true});});
 assert.equal(denied.status,429);assert.equal(denied.headers.get('Retry-After'),'60');assert.equal(calls,10);
 const row=(await f.db.query(`SELECT lease_id,request_count FROM ${f.schema}.operational_guards`)).rows[0];assert.equal(row.lease_id,null);assert.equal(row.request_count,10);
});

for(const backend of ['postgres','supabase'])test(backend+' busy admission is rejected while a real wrapper holds the actor lease',async t=>{
 const f=await fixture(t,backend);let release;let enter;const entered=new Promise(resolve=>{enter=resolve});const wait=new Promise(resolve=>{release=resolve});
 const work=f.usage.withUsage('actor','report',async()=>{enter();await wait;return Response.json({ok:true});});await entered;
 const denied=await f.usage.withUsage('actor','ai',async()=>{throw new Error('Denied callback must not execute')});assert.equal(denied.status,429);release();assert.equal((await work).status,200);
});
