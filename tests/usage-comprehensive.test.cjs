/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('path');

test('comprehensive usage controls and quota ledger tests', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const query = async (sql, values) => {
    const r = (!values && sql.includes(';')) ? (await db.exec(sql)).at(-1) : await db.query(sql, values);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };

  // Test both convert_staging and public schemas
  for (const schema of ['convert_staging', 'public']) {
    await db.exec(`
      DROP SCHEMA IF EXISTS ${schema} CASCADE;
      CREATE SCHEMA ${schema};
      CREATE TABLE ${schema}.users (id uuid PRIMARY KEY, email text, created_at timestamptz);
      CREATE TABLE ${schema}.clients (id uuid PRIMARY KEY, user_id uuid REFERENCES ${schema}.users(id), name text);
      CREATE TABLE ${schema}.billing_accounts (id uuid PRIMARY KEY, user_id uuid REFERENCES ${schema}.users(id), plan text, status text);
      CREATE TABLE ${schema}.reports (id uuid PRIMARY KEY, client_id uuid REFERENCES ${schema}.clients(id), month text, created_at timestamptz DEFAULT now());
    `);

    const rawSql = fs.readFileSync(path.join(__dirname, schema === 'convert_staging' ? '../sql/2026-10-19_add_usage_ledger_and_guard.sql' : '../sql/2026-10-19_add_usage_ledger_and_guard_public.sql'), 'utf8');
    await db.exec(rawSql);

    const userId = '11111111-1111-4111-8111-111111111111';
    const clientId = '22222222-2222-4222-8222-222222222222';
    await query(`INSERT INTO ${schema}.users VALUES ($1, $2, now())`, [userId, 'user@example.test']);
    await query(`INSERT INTO ${schema}.clients VALUES ($1, $2, $3)`, [clientId, userId, 'Client A']);
    await query(`INSERT INTO ${schema}.billing_accounts VALUES ($1, $2, $3, $4)`, ['33333333-3333-4333-8333-333333333333', userId, 'starter', 'active']);

    // 3 reports quota limit
    for (let i = 1; i <= 3; i++) {
      await query(`INSERT INTO ${schema}.reports (id, client_id, month) VALUES ($1, $2, $3)`, [`44444444-4444-4444-8444-44444444000${i}`, clientId, '2026-10']);
    }

    let quotaExceeded = false;
    try {
      await query(`INSERT INTO ${schema}.reports (id, client_id, month) VALUES ($1, $2, $3)`, ['44444444-4444-4444-8444-444444440009', clientId, '2026-10']);
    } catch (err) {
      if (err.message.includes('REPORT_QUOTA_EXCEEDED')) quotaExceeded = true;
    }
    assert.equal(quotaExceeded, true);

    // Deletion retains usage in ledger
    await query(`DELETE FROM ${schema}.reports WHERE client_id = $1`, [clientId]);
    const ledgerCount = (await query(`SELECT count(*)::int AS c FROM ${schema}.report_ledger WHERE client_id = $1`, [clientId])).rows[0].c;
    assert.equal(ledgerCount, 3);

    // Operational guard test
    const actor = 'test-actor';
    const l1 = (await query(`SELECT ${schema}.acquire_operational_guard($1, $2, $3) AS id`, [actor, 'ai', Date.now()])).rows[0].id;
    assert.ok(l1);

    // Busy check
    const l2 = (await query(`SELECT ${schema}.acquire_operational_guard($1, $2, $3) AS id`, [actor, 'ai', Date.now()])).rows[0].id;
    assert.equal(l2, null);

    // Fenced release
    await query(`SELECT ${schema}.release_operational_guard($1, $2)`, [actor, '00000000-0000-0000-0000-000000000000']); // old/wrong lease
    const l3 = (await query(`SELECT ${schema}.acquire_operational_guard($1, $2, $3) AS id`, [actor, 'ai', Date.now()])).rows[0].id;
    assert.equal(l3, null); // still locked by l1

    // Correct release
    await query(`SELECT ${schema}.release_operational_guard($1, $2)`, [actor, l1]);
    const l4 = (await query(`SELECT ${schema}.acquire_operational_guard($1, $2, $3) AS id`, [actor, 'ai', Date.now()])).rows[0].id;
    assert.ok(l4);
    await query(`SELECT ${schema}.release_operational_guard($1, $2)`, [actor, l4]);
  }

  await db.close();
});
