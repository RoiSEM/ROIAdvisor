# SiteGround PostgreSQL rollout

Convert can use the imported `convert_staging` schema for application data while retaining Supabase Google authentication.

## Enable only on SiteGround

Keep the existing `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` settings. The current connection expects loopback (`localhost`, `127.0.0.1`, or `::1`) on port 5432 with SSL disabled only for that local connection.

Add `DATA_BACKEND=postgres` to the SiteGround Node.js project's environment and redeploy. Do not add it to Vercel while Vercel is the fallback.

With no flag, application data continues using Supabase. An invalid flag fails closed. A PostgreSQL connection or query error does not fall back to Supabase.

After activation, open the signed-in admin endpoint `/api/admin/database-check`. It should report `application_data_backend: postgres`, `application_schema: convert_staging`, and `authentication_backend: supabase`. Check the dashboard, a client, and a report on the SiteGround host.

## Data boundaries

- Application tables: clients, reports, billing_accounts.
- Identity registry: imported legacy UUIDs in convert_staging.users. Verified Supabase users are provisioned by their existing UUID before application access; accounts are not linked by arbitrary email.
- Supabase still handles sign-in, sessions, sign-out, and the admin user list. Keep its credentials and project active.
- Stripe, Google Analytics, and AI remain separate services. No live purchase or webhook test is implied by this rollout.
- SiteGround edits are not mirrored to Vercel/Supabase. Switching the flag back is a backend rollback, not data synchronization.
- This data layer uses the owning PostgreSQL role. Application authentication and ownership filters are therefore mandatory; default-deny RLS alone is not sufficient for that role. Print reports and metadata enforce the same ownership boundary as the dashboard.
- Optional feature columns absent from the source schema retain the existing schema-fallback behavior.

## Diagnostics and rollback

The temporary import tool should be removed after the migration is accepted. Never commit the private import files or source exports.

To return SiteGround to its original data backend, remove `DATA_BACKEND` or set it to `supabase`, then redeploy. The PostgreSQL records remain intact. Reconcile any writes before making either backend authoritative after a rollback.

## Verification commands

```sh
node --test tests/*.test.cjs
npx tsc --noEmit
npm run build
```

The production build requires the existing service environment variables. Do not use invented credentials to make a build appear successful.
