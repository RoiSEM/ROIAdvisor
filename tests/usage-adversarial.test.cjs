/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');const {test}=require('node:test');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
test('the two deployment migrations have identical policy and permission logic',()=>{
 const base=fs.readFileSync(path.join(root,'sql/2026-10-19_add_usage_ledger_and_guard.sql'),'utf8');
 const alternate=fs.readFileSync(path.join(root,'sql/2026-10-19_add_usage_ledger_and_guard_public.sql'),'utf8');
 assert.equal(alternate===base.replaceAll('convert_staging','public'),true,'Schema variants must not drift');
});
const owner='11111111-1111-4111-8111-111111111111';const client='22222222-2222-4222-8222-222222222222';const report='33333333-3333-4333-8333-333333333333';
async function fixture(t,schema='convert_staging'){
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE SCHEMA IF NOT EXISTS ${schema};CREATE TABLE ${schema}.clients(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE ${schema}.billing_accounts(user_id uuid UNIQUE,plan text,status text);CREATE TABLE ${schema}.reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid REFERENCES ${schema}.clients(id),created_at timestamptz DEFAULT now(),traffic integer CHECK(traffic>=0));`);
 await db.query(`INSERT INTO ${schema}.clients VALUES($1,$2)`,[client,owner]);
 const migration=()=>db.exec(fs.readFileSync(path.join(root,'sql/2026-10-19_add_usage_ledger_and_guard'+(schema==='public'?'_public':'')+'.sql'),'utf8'));
 return {db,schema,migration,insert:(id=report,created=null)=>db.query(`INSERT INTO ${schema}.reports(id,client_id,created_at) VALUES($1,$2,COALESCE($3::timestamptz,clock_timestamp()))`,[id,client,created])};
}
test('migration backfills existing usage exactly once and retains deleted generations',async t=>{
 const f=await fixture(t);await f.insert();await f.migration();
 assert.equal((await f.db.query('SELECT count(*)::int AS used FROM convert_staging.report_ledger')).rows[0].used,1);
 await f.db.query('DELETE FROM convert_staging.reports');await f.migration();
 assert.equal((await f.db.query('SELECT count(*)::int AS used FROM convert_staging.report_ledger')).rows[0].used,1);
});

test('new generation accounting uses database UTC month and cannot be backdated',async t=>{
 const f=await fixture(t);await f.db.exec("SET timezone='Pacific/Honolulu'");await f.migration();await f.insert(report,'2000-01-15T00:00:00Z');
 const row=(await f.db.query("SELECT period_start = (date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS correct FROM convert_staging.report_ledger")).rows[0];
 assert.equal(row.correct,true);
 for(const suffix of ['334','335'])await f.insert('33333333-3333-4333-8333-333333333'+suffix,'2001-02-15T00:00:00Z');
 await assert.rejects(f.insert('33333333-3333-4333-8333-333333333336','2002-03-15T00:00:00Z'),/REPORT_QUOTA_EXCEEDED/);
});

test('operational admission counter resets for the full next window',async t=>{
 const f=await fixture(t);await f.migration();
 async function acquire(){return (await f.db.query('SELECT convert_staging.acquire_operational_guard($1,$2,$3) AS token',['actor','ai',0])).rows[0].token;}
 async function release(token){await f.db.query('SELECT convert_staging.release_operational_guard($1,$2)',['actor',token]);}
 for(let i=0;i<10;i++){const token=await acquire();assert.ok(token);await release(token);}
 assert.equal(await acquire(),null);
 assert.equal((await f.db.query('SELECT request_count FROM convert_staging.operational_guards')).rows[0].request_count,10);
 await f.db.exec("UPDATE convert_staging.operational_guards SET window_start=clock_timestamp()-interval '61 seconds'");
 for(let i=0;i<10;i++){const token=await acquire();assert.ok(token,'Every admission in the fresh window must be available');await release(token);}
 assert.equal(await acquire(),null);
});

test('migration revokes default public privileges even when Supabase roles are absent',async t=>{
 const f=await fixture(t);await f.db.exec('CREATE ROLE usage_visitor;ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC');await f.migration();
 const privileges=(await f.db.query("SELECT has_function_privilege('usage_visitor','convert_staging.acquire_operational_guard(text,text,bigint)','EXECUTE') AS execute,has_table_privilege('usage_visitor','convert_staging.report_ledger','SELECT') AS read")).rows[0];
 assert.equal(privileges.execute,false);assert.equal(privileges.read,false);
 const tables=(await f.db.query("SELECT relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='convert_staging' AND relname IN ('report_ledger','operational_guards')")).rows;assert.ok(tables.every(x=>x.relrowsecurity));
 const functions=(await f.db.query("SELECT proconfig FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace WHERE n.nspname='convert_staging'")).rows;assert.ok(functions.every(x=>x.proconfig.includes('search_path=pg_catalog, pg_temp')));
});

test('unsupported snapshot isolation is rejected instead of risking a stale quota count',async t=>{
 const f=await fixture(t);await f.migration();await f.db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');
 try {await assert.rejects(f.insert(),/USAGE_REQUIRES_READ_COMMITTED/);} finally {await f.db.exec('ROLLBACK');}
});

test('temporary types cannot shadow trusted types inside security-definer functions',async t=>{
 const f=await fixture(t);await f.migration();await f.db.exec("CREATE TEMP TABLE initialize_temp(x integer);CREATE DOMAIN pg_temp.uuid AS text CHECK(VALUE='blocked')");
 const lease=(await f.db.query("SELECT convert_staging.acquire_operational_guard('actor','ai',0) AS lease")).rows[0].lease;assert.ok(lease);
});
