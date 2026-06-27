# Security Notes

This file captures the current security model for the reporting app and the
main follow-up items to revisit later.

## Google Analytics Connection Model

The app does not currently use client-side Google Analytics OAuth. Clients do
not authorize their own Google account inside the dashboard.

Instead, GA4 data is read server-side with a Google service account:

```text
ga4-service@roi-analytics-490813.iam.gserviceaccount.com
```

The service account credentials are loaded from one of these environment
variables:

- `GA_SERVICE_ACCOUNT_JSON`
- `GA_SERVICE_ACCOUNT_KEY_PATH`

In local development, the app points at:

```text
roi-analytics-490813-0f47c11ee707.json
```

The client must add the service account email to their GA4 property with at
least Viewer access. The dashboard stores the client's numeric GA4 Property ID
on the client record.

## Customer Flow

1. Client signs in with Google to access the dashboard.
2. Client creates or edits a website record.
3. Client enters the numeric GA4 Property ID, not the Measurement ID.
4. Client or admin adds the service account email to the GA4 property's access
   management screen.
5. Admin confirms analytics access and marks the website approved.
6. Once approved, report generation can create a report, sync GA4 metrics, and
   generate an AI summary.

## Removing Access

To disconnect GA4 access for a client:

1. Open the client's GA4 property.
2. Go to Admin > Property access management.
3. Remove `ga4-service@roi-analytics-490813.iam.gserviceaccount.com`.
4. Optionally clear the client's GA4 Property ID in the dashboard.
5. Consider setting the website back to pending approval if reports should be
   locked until access is restored.

Once the service account is removed from GA4, future sync attempts should fail
because Google no longer allows this app to read the property.

## Current Guards

- Most sensitive API routes require an authenticated Supabase user.
- Admin status is currently determined by a hardcoded email list in
  `app/lib/supabase-server.ts`.
- Non-admin users are scoped to their own `clients.user_id` for client, report,
  sync, PDF, and summary operations.
- `public.billing_accounts` should have Row Level Security enabled. The app
  reads and writes billing data server-side through the Supabase service-role
  client, while authenticated direct table reads should only allow a user to
  select their own billing account.
- Product access is intended to be billing-gated: customers should only have
  active access while they are paying, and access should become inactive when
  they stop paying.
- New websites are created with `approval_status: "pending"`.
- Report generation is blocked until the website is approved.
- Free and Starter accounts have website/report limits.
- GA4 access requires the customer or admin to explicitly grant the service
  account access inside Google Analytics.
- Report deletion checks that the signed-in user can access the report's client
  before deleting it.
- Client deletion scopes non-admin users to their own client records.

## Known Gaps

- There is no visible client delete button in the UI, although a backend delete
  route exists.
- There is no self-serve full user account deletion flow.
- There is no rate limiting around report generation, analytics sync, AI
  summary generation, or PDF generation.
- There is no audit log for approval changes, report deletion, client deletion,
  analytics syncs, or admin actions.
- Admin access is a hardcoded email allowlist rather than a database-backed role
  or policy.
- `app/lib/billing.ts` currently treats `active`, `trialing`, and `past_due` as
  active paid access. If the pricing model should mean "paying only," revisit
  whether `past_due` should remain active.
- The server uses the Supabase service-role client, so route-level authorization
  checks are critical.
- The app stores GA4 Property IDs but does not currently track whether access
  was verified, when it was verified, or who verified it beyond approval fields.
- Removing the service account from GA4 is external to the app; the dashboard
  does not yet have a first-class "Disconnect analytics" action.

## Hardening Backlog

- Add rate limiting for:
  - report creation
  - GA4 sync
  - AI summary generation
  - PDF generation
- Add an admin audit log for:
  - client approval changes
  - GA4 Property ID changes
  - analytics sync attempts and failures
  - report deletion
  - client deletion
  - billing/plan changes
- Add a "Disconnect analytics" admin action that:
  - clears `ga4_property_id`
  - sets `approval_status` back to `pending`
  - records an audit event
- Add explicit analytics verification metadata:
  - `analytics_verified_at`
  - `analytics_verified_by_user_id`
  - `analytics_last_error`
  - `analytics_access_status`
- Replace the hardcoded admin email list with database-backed roles.
- Add a self-serve account deletion request or account deletion flow.
- Add client deletion UI with a clear confirmation step.
- Consider Supabase Row Level Security policies as a defense-in-depth layer,
  even though server routes currently enforce ownership.
- Apply `sql/2026-05-17_enable_billing_accounts_rls.sql` in Supabase to resolve
  the Security Advisor warning for `public.billing_accounts`.
- Move service account key management to the production host's secret manager
  and rotate the key on a schedule.
- Add monitoring/alerts for repeated GA4 permission failures or suspicious
  report generation volume.
- Confirm the final billing access policy and align `ACTIVE_ACCESS_STATUSES`
  with that policy. If access should only be active while payment is current,
  remove `past_due` from active access.

## Useful Code References

- `app/lib/billing.ts`: maps Stripe/billing status to effective access.
- `app/lib/analytics/ga4.ts`: loads service account credentials and queries GA4.
- `app/components/client-form.tsx`: captures `ga4_property_id`.
- `app/api/clients/route.ts`: creates clients as pending by default.
- `app/api/clients/[id]/route.ts`: updates and deletes client records.
- `app/api/reports/route.ts`: blocks report creation until approval.
- `app/api/reports/[id]/sync-analytics/route.ts`: reads GA4 metrics and updates
  reports.
- `app/api/reports/[id]/route.ts`: deletes reports after ownership checks.
- `app/lib/supabase-server.ts`: defines admin email allowlist and request user
  lookup.
