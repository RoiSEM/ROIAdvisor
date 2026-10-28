/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

const root = path.join(__dirname, '..');
function billingSnapshot(value) {
  const mod = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(root, 'app/lib/billing.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { module: mod, exports: mod.exports, process: { env: {} } }
  );
  return mod.exports.getBillingSnapshot(value);
}

for (const schema of ['convert_staging', 'public']) {
  test(`${schema} website limits and plan entitlements test`, async t => {
    // Test billing plan snapshot mapping
    const freeSnap = billingSnapshot({ plan: 'free', status: 'inactive' });
    assert.equal(freeSnap.effectivePlan, 'free');
    assert.equal(freeSnap.websiteOwnershipLimit, 1);

    const bizSnap = billingSnapshot({ plan: 'pro', status: 'active' });
    assert.equal(bizSnap.effectivePlan, 'pro');
    assert.equal(bizSnap.websiteOwnershipLimit, 1);
    assert.equal(bizSnap.hasUnlimitedReports, true);
    assert.equal(bizSnap.canUseCustomDateRange, true);

    const agencySnap = billingSnapshot({ plan: 'agency', status: 'active' });
    assert.equal(agencySnap.effectivePlan, 'agency');
    assert.equal(agencySnap.websiteOwnershipLimit, 10);
    assert.equal(agencySnap.hasUnlimitedReports, true);
    assert.equal(agencySnap.canUseCustomDateRange, true);

    const starterSnap = billingSnapshot({ plan: 'starter', status: 'active' });
    assert.equal(starterSnap.websiteOwnershipLimit, 1);
    assert.equal(starterSnap.hasUnlimitedReports, false);
    assert.equal(starterSnap.canUseCustomDateRange, false);

    const unknownSnap = billingSnapshot({ plan: 'enterprise', status: 'active' });
    assert.equal(unknownSnap.effectivePlan, 'free');
    assert.equal(unknownSnap.websiteOwnershipLimit, 1);

    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS ${schema};
      CREATE TABLE ${schema}.users (id uuid PRIMARY KEY, email text);
      CREATE TABLE ${schema}.clients (id uuid PRIMARY KEY, user_id uuid REFERENCES ${schema}.users(id), name text);
      CREATE TABLE ${schema}.billing_accounts (user_id uuid UNIQUE, plan text, status text);
    `);

    const userFree = randomUUID();
    const userBiz = randomUUID();
    const userAgency = randomUUID();
    const userStarter = randomUUID();
    const userUnknown = randomUUID();
    const userAgencySingle = randomUUID();

    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'free@example.com')`, [userFree]);
    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'biz@example.com')`, [userBiz]);
    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'agency@example.com')`, [userAgency]);
    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'starter@example.com')`, [userStarter]);
    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'unknown@example.com')`, [userUnknown]);
    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'agencysingle@example.com')`, [userAgencySingle]);

    await db.query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, 'free', 'inactive')`, [userFree]);
    await db.query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, 'pro', 'active')`, [userBiz]);
    await db.query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, 'agency', 'active')`, [userAgency]);
    await db.query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, 'starter', 'active')`, [userStarter]);
    await db.query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, 'enterprise', 'active')`, [userUnknown]);
    await db.query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, 'agency', 'active')`, [userAgencySingle]);

    // Seed 3 existing over-limit sites for userStarter BEFORE loading migration/trigger
    const starterSite1 = randomUUID();
    const starterSite2 = randomUUID();
    const starterSite3 = randomUUID();
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Starter 1')`, [starterSite1, userStarter]);
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Starter 2')`, [starterSite2, userStarter]);
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Starter 3')`, [starterSite3, userStarter]);

    // Now load migration/trigger
    const migrationSql = fs.readFileSync(path.join(root, schema === 'convert_staging' ? 'sql/2026-10-28_add_client_site_quota_trigger.sql' : 'sql/2026-10-28_add_client_site_quota_trigger_public.sql'), 'utf8');
    await db.exec(migrationSql);

    // 1. Free plan: 1 site allowed, 2nd denied
    const clientFree1 = randomUUID();
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Free Site 1')`, [clientFree1, userFree]);
    const clientFree2 = randomUUID();
    await assert.rejects(
      db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Free Site 2')`, [clientFree2, userFree]),
      /SITE_QUOTA_EXCEEDED/
    );

    // 2. Business plan ('pro'): 1 site allowed, 2nd denied
    const clientBiz1 = randomUUID();
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Biz Site 1')`, [clientBiz1, userBiz]);
    const clientBiz2 = randomUUID();
    await assert.rejects(
      db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Biz Site 2')`, [clientBiz2, userBiz]),
      /SITE_QUOTA_EXCEEDED/
    );

    // 3. Agency plan: 10 sites allowed, 11th denied
    for (let i = 1; i <= 10; i++) {
      await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, $3)`, [randomUUID(), userAgency, `Agency Site ${i}`]);
    }
    await assert.rejects(
      db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Agency Site 11')`, [randomUUID(), userAgency]),
      /SITE_QUOTA_EXCEEDED/
    );

    // 4. Existing overlimit retained / edit allowed (regular edit returns early)
    await db.query(`UPDATE ${schema}.clients SET name = 'Starter 1 Updated' WHERE id = $1`, [starterSite1]);
    await assert.rejects(
      db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Starter 4')`, [randomUUID(), userStarter]),
      /SITE_QUOTA_EXCEEDED/
    );

    // 5. Unknown active plan fails closed Free (limit 1)
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Unknown 1')`, [randomUUID(), userUnknown]);
    await assert.rejects(
      db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Unknown 2')`, [randomUUID(), userUnknown]),
      /SITE_QUOTA_EXCEEDED/
    );

    // 6. Reassignment test: reassigning site from userAgencySingle to userFree (who already has 1 site) should fail
    const agencySite = randomUUID();
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Agency Single Site')`, [agencySite, userAgencySingle]);
    await assert.rejects(
      db.query(`UPDATE ${schema}.clients SET user_id = $1 WHERE id = $2`, [userFree, agencySite]),
      /SITE_QUOTA_EXCEEDED/
    );

    // 7. Security definer trigger permissions check: PUBLIC, anon, authenticated must have no execution privileges
    const privs = await db.query(`
      SELECT grantee, privilege_type 
      FROM information_schema.routine_privileges 
      WHERE routine_name = 'check_client_site_limit_trigger'
    `);
    for (const row of privs.rows || []) {
      assert.notEqual(row.grantee, 'PUBLIC');
      assert.notEqual(row.grantee, 'anon');
      assert.notEqual(row.grantee, 'authenticated');
    }

    // 8. Free customer without billing row: should be locked and limited to 1 site
    const userNoBilling = randomUUID();
    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'nobilling@example.com')`, [userNoBilling]);
    const noBillingSite1 = randomUUID();
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'No Billing Site 1')`, [noBillingSite1, userNoBilling]);
    await assert.rejects(
      db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'No Billing Site 2')`, [randomUUID(), userNoBilling]),
      /SITE_QUOTA_EXCEEDED/
    );

    // 9. Uppercase plan 'AGENCY' or invalid plan does NOT grant 10 sites (should default to free/limit 1)
    const userUpperAgency = randomUUID();
    await db.query(`INSERT INTO ${schema}.users VALUES ($1, 'upperagency@example.com')`, [userUpperAgency]);
    await db.query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, 'AGENCY', 'active')`, [userUpperAgency]);
    await db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Upper Agency Site 1')`, [randomUUID(), userUpperAgency]);
    await assert.rejects(
      db.query(`INSERT INTO ${schema}.clients VALUES ($1, $2, 'Upper Agency Site 2')`, [randomUUID(), userUpperAgency]),
      /SITE_QUOTA_EXCEEDED/
    );
  });
}
