const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function load(relative) {
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require,console,process});
 return mod.exports;
}
test('existing Google accounts preserve legacy ownership and session revocation on real PostgreSQL', async () => {
 const { PGlite } = await import('@electric-sql/pglite');
 const { getMigrations } = await import('better-auth/db/migration');
 const { betterAuth } = await import('better-auth');
 const db=new PGlite();
 const query=async(sql,values)=>{const r=(!values && sql.includes(';')) ? (await db.exec(sql)).at(-1) : await db.query(sql,values);return {...r,rowCount:r.affectedRows ?? r.rows.length};};
 const client={query,release(){}};
 const pool={query,connect:async()=>client,end:async()=>{}};
 const settings={baseURL:'https://convert.example.test',secret:'test-only-0123456789abcdefghijklmnopqrstuvwxyz',clientId:'test-client',clientSecret:'test-secret'};
 const options=load('app/lib/better-auth-options.ts').createBetterAuthOptions(pool,settings);
 try {
  const plan=await getMigrations(options);const sql=await plan.compileMigrations();
  await db.exec('CREATE SCHEMA convert_staging; CREATE TABLE convert_staging.users (id uuid PRIMARY KEY, email text, created_at timestamptz); CREATE TABLE convert_staging.clients(id uuid PRIMARY KEY, user_id uuid REFERENCES convert_staging.users(id));');
  const identity={user_id:'00000000-0000-4000-8000-000000000001',provider:'google',provider_account_id:'123456789',email:'fixture@example.test',email_verified:true,name:'Fixture',image:null,created_at:'2026-10-17T00:00:00Z'};
  await query('INSERT INTO convert_staging.users VALUES ($1,$2,$3)',[identity.user_id,identity.email,identity.created_at]);
  await query('INSERT INTO convert_staging.clients VALUES ($1,$2)',['00000000-0000-4000-8000-000000000002',identity.user_id]);
  // Test-only existing-account fixture, not an application migration/importer.
  await db.exec(sql);
  await query('INSERT INTO public.convert_auth_user (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,true,$4,$4)', [identity.user_id, identity.name, identity.email, identity.created_at]);
  await query('INSERT INTO public.convert_auth_account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES ($1,$2,\'google\',$3,$4,$4)', ['00000000-0000-4000-8000-000000000003', identity.provider_account_id, identity.user_id, identity.created_at]);
  const auth=betterAuth(options);const ctx=await auth.$context;
  const account=await ctx.internalAdapter.findAccountByKey({ accountId: identity.provider_account_id, providerId: 'google' });
  assert.equal(account.userId,identity.user_id);
  const user=await ctx.internalAdapter.findUserById(account.userId);assert.equal(user.email,identity.email);
  assert.equal((await query('SELECT count(*)::int AS n FROM convert_staging.clients WHERE user_id=$1',[account.userId])).rows[0].n,1);
  const session=await ctx.internalAdapter.createSession(user.id);assert.ok(session.token);
  const { makeSignature }=await import('better-auth/crypto');
  // Use the library's cookie signature, then exercise its actual session API.
  const signed=encodeURIComponent(`${session.token}.${await makeSignature(session.token, options.secret)}`);
  const headers=new Headers({cookie:`${ctx.authCookies.sessionToken.name}=${signed}`});
  const current=await auth.api.getSession({headers});assert.equal(current.user.id,identity.user_id);
  const rejected=await auth.handler(new Request(`${settings.baseURL}/api/auth/sign-out`,{method:'POST',headers:{origin:'https://evil.example.test','content-type':'application/json',cookie:headers.get('cookie')},body:'{}'}));
  assert.equal(rejected.status,403);
  const out=await auth.handler(new Request(`${settings.baseURL}/api/auth/sign-out`,{method:'POST',headers:{origin:settings.baseURL,'content-type':'application/json',cookie:headers.get('cookie')},body:'{}'}));assert.equal(out.status,200);
  assert.equal(await auth.api.getSession({headers}),null);
  const start=await auth.handler(new Request(`${settings.baseURL}/api/auth/sign-in/social`,{method:'POST',headers:{origin:settings.baseURL,'content-type':'application/json'},body:JSON.stringify({provider:'google',callbackURL:'/dashboard'})}));
  assert.equal(start.status,200);const redirect=new URL((await start.json()).url);
  assert.equal(redirect.searchParams.get('redirect_uri'),`${settings.baseURL}/api/auth/callback/google`);
  assert.ok(redirect.searchParams.get('state'));
 } finally {await db.close();}
});
