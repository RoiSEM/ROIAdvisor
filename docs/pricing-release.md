# Convert pricing release

## Approved offer

| Public plan | USD / month | Websites | New reports | Date range |
|---|---:|---:|---|---|
| Free | $0 | 1 | 3 per UTC calendar month | Last 30 days |
| Business | $19 | 1 | Unlimited, normal interactive use | Custom |
| Agency | $79 | Up to 10 | Unlimited, normal interactive use | Custom |

Subscriptions buy software access only. Consulting, tracking setup and website implementation are separately quoted services. Do not advertise white-label reporting or client portals as included capabilities.

A generated-report allowance is not a saved-report storage cap. Existing durable report accounting is retained; deleting or reopening a report does not grant another generation. Existing short-window concurrency/admission safeguards remain separate from the monthly allowance. Paid plans have no hidden monthly report ceiling.

## Compatibility

Business retains the internal `pro` plan identifier so existing report entitlement SQL and subscription records do not need a destructive rename. `starter` / `trial` remain legacy identifiers, not saleable plans. No records or subscriptions are deleted or automatically repriced by this release. Existing over-limit website records remain; the release prevents additional sites rather than deleting customer work.

*Preexisting note*: The unrelated invoice event ordering race (between `invoice.paid` and `customer.subscription.*` events) is documented as preexisting and not modified within this scope.

## Production activation — separate authorization required (Pending live execution)

- [ ] Environment variables configured (**Unchecked / NOT done live** per deployment instructions).
1. Review the exact application patch, migration, and test results.
2. Confirm the actual production hostname. Conversation used `convert.whatyouwant.com`; the established project uses `convert.whachawant.com`. Do not change DNS or OAuth domains as part of pricing work.
3. Obtain a protected backup of the actual PostgreSQL database; apply only the matching `convert_staging` migration before dependent application rollout. The alternative public-schema migration is for Supabase compatibility, not a second migration to apply to this deployment.
4. Verify installed website-limit function/trigger and privileges. Keep hosted multi-connection acceptance separate from embedded database tests.
5. Create or select Stripe monthly recurring USD prices: Business 1900 cents; Agency 7900 cents. Configure `STRIPE_PRICE_BUSINESS` and `STRIPE_PRICE_AGENCY` on the actual deployment. Business checkout intentionally does not reuse `STRIPE_PRICE_PRO`, which may represent an old amount.
6. Retain legacy price mappings while existing subscriptions need webhook recognition. Confirm environment IDs belong to the secret key's mode; never put secret keys in source or chat.
7. Configure the billing portal's allowed products/prices to these exact packages. Existing paid subscribers change/cancel through the portal, not a duplicate subscription checkout. Review downgrade behavior for accounts already above the new website cap; never silently delete sites.
8. Verify signed webhook delivery at the actual application's endpoint. Complete an isolated test-mode purchase, renewal/cancellation, and resubscription exercise before any real charge. Do not send synthetic events to the live endpoint or alter customer subscriptions without explicit authorization.
9. Deploy only after approval, verify exact remote commit and intended hosting build, then exercise Free, Business, Agency and authenticated checkout. A local build is not a live payment verification.

## Acceptance boundaries

- Real SQL fixtures are embedded PGlite, not hosted multi-connection acceptance. Verify simultaneous site creation against the deployed database separately.
- The retained report ledger is website-scoped. Deleting a report does not restore allowance, but deleting/recreating a website remains an existing allowance-circumvention limitation; this release does not claim account-wide anti-abuse metering.
- Local payment tests use provider seams and offline Stripe signature verification, not real charges or hosted webhook delivery. Test live integration separately in isolated test mode.
- Baseline hook lint diagnostics are unchanged, not a claim of globally clean lint.

## Launch scope

Self-service grassroots launch first. No formal beta program, required interview, questionnaire, or training library is a release prerequisite. Record real use of George's own websites for later tutorials and progress updates; do not promise increased traffic, visibility or conversions.
