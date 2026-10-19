# Report usage controls

## Preserved product rules

- Free and Starter: three successful report creations per website/client record per UTC calendar month.
- Pro and Agency: unlimited monthly report creations when their existing billing status is active, trialing or past_due. Other statuses retain the existing effective-Free behavior.
- Date-range entitlements and website limits are unchanged. This does not decide free versus $1 entry, change billing cadence, or implement the proposed one-site Starter offer.
- AI summaries and manual analytics refreshes do not spend another monthly report slot. Regeneration is still supported.

## Operational limits, separate from paid-plan entitlements

Every report creation, AI summary request and manual analytics refresh shares the same per-authenticated-actor guard:

- One admitted operation at a time, across processes using the same database.
- Ten admissions per anchored 60-second window, combined across those three routes.
- A 180-second lease allows recovery after an interrupted server process. A stale release token cannot unlock a newer lease.
- Failed admitted work still counts toward the short request window. Failed report inserts do not consume monthly report allowance.
- Denied requests receive HTTP 429 and Retry-After 60. Unavailable/missing guard or allowance infrastructure produces a sanitized HTTP 503 before provider work; it never falls back to unlimited use.

The guard persists in PostgreSQL rather than process memory. Its database clock controls admission and expiry. Authorization, report ownership, approval where already required, and saved-analytics validation happen before paid/provider work. Native PostgreSQL calls use schema-qualified functions. The Supabase adapter uses the private service-role RPCs, not anonymous browser queries.

OpenAI is constructed only after the usage gate, with a 60-second SDK timeout and automatic retries disabled. Existing model and output-token settings are unchanged. Each GA request has a 30-second SDK deadline with SDK retries disabled. Parallel GA calls settle before an early failure returns, so the actor's lease is not released while known sibling calls are still pending. Provider authentication/transport behavior and a crashed process are not an exactly-once execution guarantee.

## Monthly generation ledger

The report BEFORE INSERT trigger takes a client row lock, reads that website owner's current billing entitlement, checks the current database UTC month and records generation in report_ledger as part of the report's transaction. The report and ledger write commit or roll back together. The trigger is authoritative; the route's earlier allowance check only avoids unnecessary provider calls.

report_ledger has a unique report_id and a client/month index. It has no foreign-key cascade from reports or clients. Deleting report rows or their website cannot delete recorded generation history. Counts depend on generation time, not the report's requested date range or a supplied/backdated created_at value.

The migration backfills currently retained, client-linked reports once by their historical created_at UTC month. It does not reconstruct reports deleted before the ledger existed. Rows with missing owners need operator review; orphaned records have no client scope to meter. Reapplying the migration cannot reset retained history.

A failed allowance read after a report has already committed does not misreport creation as failed: the response still returns the saved report and marks usage_remaining_known=false. A null remaining value with that flag is unknown, not an assertion of unlimited access.

The form also distinguishes a saved report from a failed/rate-limited AI summary, refreshes the saved report list, and directs the user to retry its summary rather than create another report.

## Database requirements and security

Apply the migration as the intended schema owner. Report inserts and usage admission require PostgreSQL READ COMMITTED isolation; the functions explicitly reject snapshot-isolation modes rather than relying on stale quota snapshots. No transaction/connection remains open during upstream provider work. Runtime native pool statements already have a 15-second statement timeout.

New tables use RLS without browser-role policies. PUBLIC privileges are revoked independently of optional Supabase role existence. anon and authenticated receive neither table access nor usage-function execution. If service_role exists, it receives only the relevant usage RPC execution and schema usage grants. SECURITY DEFINER functions have a fixed pg_catalog, pg_temp search path and schema-qualified application objects. The normal native schema owner can execute them. These functions must never be exposed through an anonymous administrative endpoint.

## Rollout — migration before application deployment

This batch is local until an operator explicitly applies it. No hosted database migration, deployment, or live provider request is implied by local verification.

1. Back up the target database and confirm which data backend and schema the deployment actually uses. Check for retained reports with missing client/owner links and verify the default transaction isolation is read committed. Rehearse on a separate staging copy first.
2. Apply exactly the matching SQL file, as one transaction:
   - SiteGround native PostgreSQL: sql/2026-10-19_add_usage_ledger_and_guard.sql, targeting convert_staging.
   - Existing Supabase/PostgREST backend, only if actually in use: sql/2026-10-19_add_usage_ledger_and_guard_public.sql, targeting public.
3. Confirm the ledger backfill, trigger and functions exist; ensure browser roles cannot select metering tables or execute the RPCs. For PostgREST, refresh its schema cache using the provider's supported mechanism if new functions are not visible yet.
4. Deploy the application code only after that check. An unapplied/unavailable migration intentionally blocks provider operations rather than failing open. Older application code may display a generic error on a trigger quota denial, so keep the migration/application transition short or use a maintenance window.
5. Verify the matching hosted commit, runtime authentication/ownership, two-server competing requests, month boundaries, request denials, and user-visible saved-report/failed-summary behavior before marking deployment accepted. Use synthetic staging data and separately authorize any paid/provider calls.

Do not delete the ledger as an application rollback; doing so discards metering history. Retain it while investigating a failed rollout. Do not auto-run DDL from an HTTP request or silently disable the guard to restore availability.

## Verification boundaries

Local tests use the actual SQL migrations and a real PGlite PostgreSQL engine for both schemas, including billing-plan/status parity, rollback, backfill, retention, periods, permissions, lease expiry/fencing and request-window resets. Actual usage wrappers and API/form components are exercised with controlled service seams. PGlite serializes work in a single embedded backend: concurrent promises are not proof of live multi-connection/multi-host PostgreSQL behavior. Hosted rollout and provider behavior still need their own acceptance checks. No production credentials or fabricated provider responses are used as live-verification evidence.

This is not an account-wide monthly quota, a daily AI spending ceiling, global/IP anti-abuse protection, or durable request idempotency. Retrying a genuinely ambiguous creation request can still create a second report within the remaining allowance; creating a new client record creates a new per-site meter under the existing product rules. Those policies are separate decisions. Lease expiry permits recovery, not exactly-once upstream execution under every network failure.

References consulted: official PostgreSQL CREATE FUNCTION security guidance, transaction-isolation documentation, and installed google-gax CallOptions/mergeRetryOptions implementation. No framework, authentication, pricing or provider-connection redesign is included.
