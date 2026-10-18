# Convert: Google sign-in with Better Auth

## Production configuration

Convert's SiteGround deployment uses `AUTH_BACKEND=better-auth` and `DATA_BACKEND=postgres`. Application records remain in `convert_staging`; Better Auth 1.7.10 uses separate `public.convert_auth_*` tables. Existing Google accounts retain their original UUIDs and provider subjects. Accounts are not linked by email alone.

Required private SiteGround settings:

- Existing `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, retaining verified loopback/5432 configuration.
- `DATA_BACKEND=postgres` and `AUTH_BACKEND=better-auth`.
- `BETTER_AUTH_URL=https://convert.whachawant.com` and `NEXT_PUBLIC_SITE_URL=https://convert.whachawant.com`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the separate Convert Google Web application client.
- Stable private `BETTER_AUTH_SECRET`, at least 32 characters. Do not rotate it as part of this cleanup.

The production Google callback is `https://convert.whachawant.com/api/auth/callback/google`. Keep the original Supabase OAuth client untouched. If Google's audience remains External/Testing, access is limited to configured test users.

## Migration tools retired

After the production cutover and user-confirmed report access, the one-time tools were removed from source:

- `/admin/database-import` and `/admin/auth-migration`, including upload forms.
- `/api/admin/database-import`, `/api/admin/auth-migration`, and `/api/admin/database-check`.
- The application identity-import/schema-migration helper and tests specific to retired endpoints.

These routes are absent from the new build. Historical migration code remains recoverable from Git, not exposed as application endpoints. Do not restore web import tools or rerun imports against the live database.

No database tables, imported records, accounts, sessions, secrets or private exports are deleted by this cleanup. In particular, preserve `public.convert_auth_migration`: the auth runtime still checks its existing version-1 readiness marker before initializing login. Keep the separate auth and application PostgreSQL pools.

## Security and compatibility

- The auth pool preserves native PostgreSQL Date values; the application-data pool serializes timestamps for legacy APIs.
- Verified users retain UUID ownership; implicit and explicit email-based account linking remain disabled.
- Better Auth uses a fixed HTTPS origin, secure cookies, database sessions, encrypted OAuth tokens, and database-backed rate limits.
- Application mutations require the configured Origin. Supabase bearer tokens and its old callback do not authenticate in Better Auth mode, and errors never silently fall back.
- `getRequestUser` remains the shared authorization entry point. Pages and APIs enforce authentication and ownership.
- `AUTH_BACKEND` still defaults to `supabase` in untouched environments. Do not remove Supabase runtime support in a migration-tool cleanup.

## Verification and remaining work

Run `node --test tests/*.test.cjs`, TypeScript, targeted lint, `git diff --check`, and production builds for both supported auth modes. The PostgreSQL-engine test retains existing-account UUID ownership, signed sessions, OAuth-start, Origin rejection and sign-out coverage with test-only fixtures. Retirement tests check that the web tools are absent and the readiness gate still fails closed.

After deployment, verify the retired routes return 404, public HTTPS remains valid, and Google sign-in and reports still work. Build success alone is not hosted acceptance.

Payment and Stripe webhook testing is explicitly deferred; this cleanup does not verify billing. Backup/restore verification is separate. Keep `next build --webpack`. Recheck inode usage and use only SiteGround's managed build deletion for confirmed obsolete releases.

## Rollback boundaries

Authentication rollback changes `AUTH_BACKEND` to `supabase`, with a redeploy/restart; keep `DATA_BACKEND=postgres`. It is not data synchronization. Never drop the auth tables or application records as rollback cleanup.

Keep Vercel and Supabase fallback intact. Do not cancel Supabase while Offer or another application depends on it. Private exports and credentials remain outside Git.
