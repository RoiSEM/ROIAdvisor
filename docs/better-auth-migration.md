# Convert: direct Google sign-in with Better Auth

## Scope and current status

This change adds an opt-in auth backend. `AUTH_BACKEND` defaults to `supabase`; Vercel and existing logins stay unchanged unless the flag is explicitly changed. `DATA_BACKEND=postgres` continues to use `convert_staging` for application records.

Better Auth 1.7.10 stores users, Google accounts, sessions, verification state and rate limits in separate `public.convert_auth_*` tables. Migration imports stable Google provider subjects linked to existing UUIDs, not email-only account matches. The private identity export and credentials must never be committed.

Next.js and its ESLint configuration are updated together to 16.4.2, with compatible dependency security updates. Keep `next build --webpack` for SiteGround's process/port restrictions. The production dependency audit is separate from lint-tooling advisories.

## Required SiteGround settings

- Existing `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`; retain verified loopback/5432 configuration.
- `DATA_BACKEND=postgres`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the new Google Web application client, entered privately.
- `BETTER_AUTH_URL=https://georgea140.sg-host.com`.
- `BETTER_AUTH_SECRET`: a cryptographically random value, at least 32 characters, generated privately (for example using a password manager). Do not paste it into chat, screenshots, logs, or source control. Keep it stable across deployments.
- Keep `AUTH_BACKEND` unset or `supabase` while preparing tables. Do not remove the Supabase configuration yet.

Google authorized redirect URI: `https://georgea140.sg-host.com/api/auth/callback/google`. If Google's audience remains External/Testing, ensure the accounts used for testing are in its test-user list. The new client must not replace the original Supabase OAuth client.

## Staged rollout

1. Add the secret privately. Obtain approval before pushing to the auto-deployed branch. Deploy this code with the current Supabase authentication still enabled.
2. Sign in as the existing admin on the temporary SiteGround host and open `/admin/auth-migration`.
3. Select the private, unmodified `google-identities.json` export from the migration source folder. The endpoint accepts only the pinned file hash and expected eight mappings; it checks admin access, staging Origin, database destination, and bounded upload size. It does not accept arbitrary SQL.
4. Run the import once. The schema and seed run in a single transaction under an advisory lock; any existing auth tables cause refusal rather than overwrite. The migration does not modify clients, reports, billing or their ownership.
5. Read back status. Require `ok: true`, `ready: true`, and the expected eight imported identities/Google accounts. Importing identities does not switch login.
6. Only after readiness is verified, set `AUTH_BACKEND=better-auth` on SiteGround and deploy/restart through the provider's normal controls. Do not set this flag on Vercel while preserving fallback.
7. In a private browser window, sign in with Google. Confirm the public callback/dashboard URL, original account UUID and records, ownership isolation, admin user directory, session persistence, and sign-out/revocation. Verify `/api/admin/database-check` reports `authentication_backend: better-auth` and PostgreSQL application data. Local tests cannot prove the real Google/client/proxy combination works.
8. Recheck inode usage after deployment. Use SiteGround's managed `Delete build` control for confirmed obsolete builds; preserve the active build and a known-good rollback. Do not manually prune `.nodeapp`, `node_modules`, `.next` or environment settings.

## Security and compatibility

- Use a separate bounded auth connection pool with native PostgreSQL Date parsing. Do not reuse the application-data pool, which serializes timestamps as strings.
- New users get UUIDs; verified sessions provision the same UUID in the legacy app registry before accessing owner-bound data.
- Implicit and explicit email-based account linking are disabled. Imported accounts are matched by stable Google subject.
- Better Auth uses explicit HTTPS base URL/trusted Origin, secure cookies, database sessions, encrypted stored OAuth tokens and persistent database rate limiting. Application mutations in Better Auth mode require the configured Origin.
- Supabase bearer tokens and the old callback do not authenticate in Better Auth mode. Errors never silently fall back to Supabase.
- `getRequestUser` remains the shared app authorization entry point. The proxy skips Supabase refresh in Better Auth mode; pages and APIs still enforce authentication and ownership.
- The schema migration endpoint refuses POST after cutover. Remove the temporary migration/import diagnostics after hosted acceptance.

## Rollback and final cutover

To roll back authentication, set `AUTH_BACKEND=supabase` and redeploy/restart. Keep `DATA_BACKEND=postgres`; changing the data backend would not synchronize writes back to Supabase. Do not delete the new tables or application data as a rollback action.

At the production-domain cutover, update Better Auth's base URL, Google authorized callback, application site URL and applicable Stripe endpoint configuration deliberately. Re-test Google sign-in on the production domain. Sessions on the temporary host will not automatically transfer to a different domain.

Do not cancel Supabase while Offer, the Vercel fallback, or any other application still depends on it.

## Local verification

- `node --test tests/*.test.cjs` (includes real PostgreSQL-engine schema, subject/UUID ownership, signed-session, OAuth-start, Origin-rejection, rollback and sign-out tests via PGlite).
- `npx tsc --noEmit`.
- Targeted ESLint for changed source files; `git diff --check`.
- `npm run build` with each auth backend's intended environment. Better Auth builds must not need Supabase credentials.
- `npm audit --omit=dev` for runtime dependency advisories; inspect development-tooling advisories separately.

These checks are local. Schema import, hosted OAuth return, and account authorization remain separate acceptance steps.
