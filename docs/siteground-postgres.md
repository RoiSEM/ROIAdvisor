# SiteGround PostgreSQL operations

## Active backend

Convert uses `DATA_BACKEND=postgres` for application records in `convert_staging` and `AUTH_BACKEND=better-auth` for direct Google authentication. Existing UUIDs and ownership links are preserved. See `better-auth-migration.md` for auth settings and cleanup boundaries.

Keep the existing private `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` settings. The connection expects loopback (`localhost`, `127.0.0.1`, or `::1`) on port 5432, with SSL disabled only for that local connection. Auth uses a separate pool with native Date parsing.

Untouched environments still default to Supabase. Invalid backend flags fail closed, and PostgreSQL errors never silently fall back to Supabase. Do not change Vercel's flags while preserving it as fallback.

## Data boundaries

- Application tables: `convert_staging.clients`, `reports`, and `billing_accounts`.
- Identity registry: existing UUIDs in `convert_staging.users`. Verified users are provisioned by UUID, not arbitrary email matching.
- Better Auth tables and the existing readiness marker in `public.convert_auth_migration` must remain intact.
- The owning PostgreSQL role bypasses RLS, so application authentication and ownership filters remain mandatory, including print reports and metadata.
- Optional source-schema feature columns retain existing fallback behavior.
- SiteGround writes are not mirrored to Vercel/Supabase. Switching a backend flag is rollback, not synchronization; reconcile writes before making a different backend authoritative.
- Stripe, Analytics, and AI are separate integrations. Payments and webhooks remain untested and are deferred by the user.

## Retired tools and backups

The temporary database-import and auth-migration pages, upload endpoints, identity-import helper, and database-check endpoint have been removed from source. Do not use their historical URLs as operational health checks. Deployment acceptance must verify those routes are absent and normal login/report access remains functional.

This cleanup does not execute SQL or remove any tables, records, users, sessions, environment settings, service-account files, or protected exports. Keep private backups/exports outside Git. Backup and restore verification remains a separate operational task.

## Verification

```sh
node --test tests/*.test.cjs
npx tsc --noEmit
npm run build
```

Build with the intended backend settings and required service environment. Test-only credentials in isolated auth tests do not prove production integration access. After deployment, confirm public HTTPS, Google sign-in, existing reports, Analytics, and retired-route 404s separately.

To revert the application-data flag, remove `DATA_BACKEND` or set it to `supabase`, then redeploy. PostgreSQL records remain intact, but post-cutover writes are not synchronized automatically. Do not perform this rollback as part of tool cleanup.
