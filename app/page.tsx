import BillingAwarePricingCards from "@/components/billing-aware-pricing-cards";
import ManageBillingButton from "@/components/manage-billing-button";
import SiteHeaderNav from "@/components/site-header-nav";
import { getBillingSnapshot } from "@/lib/billing";
import { getRequestUser, supabaseAdmin } from "@/lib/supabase-server";
import Link from "next/link";

const valueProps = [
  {
    title: "See what matters",
    description:
      "Track traffic, engagement, and conversions in one clear dashboard.",
  },
  {
    title: "AI diagnosis",
    description:
      "Understand what is broken, why it matters, and what to fix first.",
  },
  {
    title: "Clear next steps",
    description:
      "Get practical actions you can use to improve conversions and revenue.",
  },
];

export default async function HomePage() {
  const {
    user,
    error: userError,
  } = await getRequestUser();
  const signedInUser = !userError ? user : null;

  const { data: billing } = signedInUser
    ? await supabaseAdmin
        .from("billing_accounts")
        .select("plan, status, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", signedInUser.id)
        .maybeSingle()
    : { data: null };

  const billingSnapshot = getBillingSnapshot(billing);
  const isSignedIn = Boolean(signedInUser);
  const heroPrimaryHref = isSignedIn ? "/dashboard" : "/login";
  const heroPrimaryLabel = isSignedIn ? "Open dashboard" : "Choose Starter";
  const heroSecondaryHref = isSignedIn ? "/pricing" : "/dashboard";
  const heroSecondaryLabel = isSignedIn ? "View pricing" : "Go to dashboard";
  const ctaTitle = isSignedIn
    ? "Keep building your conversion reporting setup."
    : "Find out why your website is not converting.";
  const ctaDescription = isSignedIn
    ? billingSnapshot.isFree
      ? "You already have free access. Keep setting up your website, then choose Starter or upgrade when you want more reports and custom date ranges."
      : billingSnapshot.isStarter
        ? "Your Starter plan is active. Head back to the dashboard to keep building websites and generating conversion reports."
        : "Your paid plan is active. Head back to the dashboard to keep building websites and generating conversion reports."
    : "Start with the $10/month Starter plan, then use Convert to track what matters, uncover conversion blockers, and improve results.";

  return (
    <main className="bg-slate-50 text-slate-950">
      <SiteHeaderNav current="home">
        <Link
          href="/pricing"
          className="hidden rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:inline-flex"
        >
          View pricing
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Open dashboard
        </Link>
      </SiteHeaderNav>

      <section id="overview" className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Convert by WhachaWant
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            AI conversion reporting for websites that need more leads.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Convert helps business owners and agencies understand why their
            website is not converting. Track traffic, diagnose conversion
            blockers, and get clear actions to improve leads and revenue.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={heroPrimaryHref}
              className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {heroPrimaryLabel}
            </Link>
            <Link
              href={heroSecondaryHref}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              {heroSecondaryLabel}
            </Link>
            {isSignedIn && billingSnapshot.canManageBilling && (
              <ManageBillingButton />
            )}
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Example insight
            </p>
            <div className="mt-6 flex flex-col gap-6">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Report Health
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="inline-flex rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                        Critical
                      </span>
                      <span className="text-3xl font-bold tracking-tight">
                        20/100
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-base leading-7 text-slate-700">
                  Primary blocker: form functionality issues are preventing
                  users from submitting leads. Fix this first before investing
                  more in traffic.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Traffic
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight">852</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Conversions
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight">0</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Why it works
            </p>
            <div className="mt-6 space-y-5">
              {valueProps.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 p-5"
                >
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Pricing
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Simple pricing for conversion-focused reporting.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Start with the Starter plan to validate the insights, then upgrade
              into deeper reporting and white-label delivery as your needs grow.
            </p>
          </div>

          <div className="mt-10">
            <BillingAwarePricingCards variant="home" />
          </div>
        </div>
      </section>

      <section id="cta" className="mx-auto max-w-6xl px-6 py-16 text-center sm:px-8 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{ctaTitle}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600">
          {ctaDescription}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={heroPrimaryHref}
            className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {heroPrimaryLabel}
          </Link>
          <Link
            href={heroSecondaryHref}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            {heroSecondaryLabel}
          </Link>
          {isSignedIn && billingSnapshot.canManageBilling && <ManageBillingButton />}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>Convert by WhachaWant</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
            <Link
              href="/privacy-policy"
              className="transition hover:text-slate-900"
            >
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-slate-900">
              Terms &amp; Conditions
            </Link>
            <a
              href="mailto:george@roisem.com"
              className="transition hover:text-slate-900"
            >
              george@roisem.com
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
