/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('usage controls and durable quota ledger PGlite tests', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const query = async (sql, values) => {
    const r = (!values && sql.includes(';')) ? (await db.exec(sql)).at(-1) : await db.query(sql, values);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };

  // Setup schema
  await db.exec(`
    CREATE SCHEMA convert_staging;
    CREATE TABLE convert_staging.users (id uuid PRIMARY KEY, email text, created_at timestamptz);
    CREATE TABLE convert_staging.clients (id uuid PRIMARY KEY, user_id uuid REFERENCES convert_staging.users(id), name text);
    CREATE TABLE convert_staging.billing_accounts (id uuid PRIMARY KEY, user_id uuid REFERENCES convert_staging.users(id), plan text, status text);
    CREATE TABLE convert_staging.reports (id uuid PRIMARY KEY, client_id uuid REFERENCES convert_staging.clients(id), month text, created_at timestamptz DEFAULT now());
  `);

  const sqlMigration = fs.readFileSync(path.join(__dirname, '../sql/2026-10-19_add_usage_ledger_and_guard.sql'), 'utf8');
  await db.exec(sqlMigration);

  const userId = '00000000-0000-4000-8000-000000000001';
  const clientId = '00000000-0000-4000-8000-000000000002';
  await query('INSERT INTO convert_staging.users VALUES ($1, $2, now())', [userId, 'test@example.com']);
  await query('INSERT INTO convert_staging.clients VALUES ($1, $2, $3)', [clientId, userId, 'Test Client']);
  await query('INSERT INTO convert_staging.billing_accounts VALUES ($1, $2, $3, $4)', ['00000000-0000-4000-8000-000000000003', userId, 'starter', 'active']);

  // 1. Quota success (3 reports allowed for starter/free)
  for (let i = 1; i <= 3; i++) {
    const reportId = `00000000-0000-4000-8000-00000000000${i + 3}`;
    await query('INSERT INTO convert_staging.reports (id, client_id, month) VALUES ($1, $2, $3)', [reportId, clientId, '2026-10']);
  }

  // 4th report should fail with REPORT_QUOTA_EXCEEDED
  let failed = false;
  try {
    await query('INSERT INTO convert_staging.reports (id, client_id, month) VALUES ($1, $2, $3)', ['00000000-0000-4000-8000-000000000009', clientId, '2026-10']);
  } catch (err) {
    if (err.message.includes('REPORT_QUOTA_EXCEEDED')) failed = true;
  }
  assert.equal(failed, true);

  // 2. Deletion retains usage
  await query('DELETE FROM convert_staging.reports WHERE client_id = $1', [clientId]);
  const ledgerCount = (await query('SELECT count(*)::int AS c FROM convert_staging.report_ledger WHERE client_id = $1', [clientId])).rows[0].c;
  assert.equal(ledgerCount, 3);

  // 3. Unlimited plan (Pro / agency)
  await query('UPDATE convert_staging.billing_accounts SET plan = $1, status = $2 WHERE user_id = $3', ['pro', 'active', userId]);
  // Now should allow insertion beyond 3
  const proReportId = '00000000-0000-4000-8000-0000000000aa';
  await query('INSERT INTO convert_staging.reports (id, client_id, month) VALUES ($1, $2, $3)', [proReportId, clientId, '2026-10']);

  // 4. Operational guard tests
  const actorId = 'actor-1';
  const l1 = (await query('SELECT convert_staging.acquire_operational_guard($1, $2, $3) AS id', [actorId, 'report', Date.now()])).rows[0].id;
  assert.ok(l1);

  // Concurrent acquisition should return null (busy)
  const l2 = (await query('SELECT convert_staging.acquire_operational_guard($1, $2, $3) AS id', [actorId, 'report', Date.now()])).rows[0].id;
  assert.equal(l2, null);

  // Release guard
  await query('SELECT convert_staging.release_operational_guard($1, $2)', [actorId, l1]);

  // Acquire again after release
  const l3 = (await query('SELECT convert_staging.acquire_operational_guard($1, $2, $3) AS id', [actorId, 'report', Date.now()])).rows[0].id;
  assert.ok(l3);
  await query('SELECT convert_staging.release_operational_guard($1, $2)', [actorId, l3]);

  await db.close();
});
