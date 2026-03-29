import ClientForm from "@/components/client-form";
import SiteHeaderNav from "@/components/site-header-nav";
import SignOutButton from "@/components/sign-out-button";
import { getBillingSnapshot } from "@/lib/billing";
import {
  getRequestUser,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Globe,
  Settings,
  Sparkles,
} from "lucide-react";
import { redirect } from "next/navigation";

async function getClients() {
  const { user, error: userError } = await getRequestUser();

  if (userError || !user) {
    redirect("/login");
  }

  const isAdmin = isAdminUser(user);

  let query = supabaseAdmin.from("clients").select("*");

  if (!isAdmin) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Supabase getClients error:", error);
    throw new Error("Failed to load clients");
  }

  const { data: billing, error: billingError } = !isAdmin
    ? await supabaseAdmin
        .from("billing_accounts")
        .select("plan, status, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null, error: null };

  if (billingError) {
    console.error("Supabase billing error:", billingError);
    throw new Error("Failed to load billing");
  }

  const billingSnapshot = getBillingSnapshot(billing);
  const websiteLimit = isAdmin ? null : billingSnapshot.websiteOwnershipLimit;
  const sitesUsed = isAdmin ? 0 : (data ?? []).length;
  const canCreateSite = isAdmin || websiteLimit === null || sitesUsed < websiteLimit;
  const accountState = isAdmin
    ? "admin"
    : !billingSnapshot.hasActiveAccess
      ? "free"
      : billingSnapshot.effectivePlan === "starter"
        ? "starter"
        : "paid";

  return {
    clients: data ?? [],
    user,
    isAdmin,
    websiteLimit,
    sitesUsed,
    canCreateSite,
    accountState,
  };
}

export default async function ClientsPage() {
  const {
    clients,
    user,
    isAdmin,
    websiteLimit,
    sitesUsed,
    canCreateSite,
    accountState,
  } = await getClients();

  const siteLimitMessage = isAdmin
    ? "Admins can create and manage websites across accounts."
    : websiteLimit === null
      ? "Your current plan includes unlimited websites."
      : accountState === "free"
        ? `You can create ${websiteLimit} website before choosing Starter or upgrading.`
        : `Your Starter plan includes up to ${websiteLimit} websites before you need to upgrade.`;

  const limitCtaLabel =
    accountState === "free" ? "Choose Starter for more sites" : "Upgrade to Pro";
  const sectionLabel = isAdmin ? "Clients" : "Dashboard";
  const pageTitle = isAdmin
    ? "Manage client websites and approvals."
    : "Set up a site for conversion analysis.";
  const pageDescription = isAdmin
    ? "Review client websites, ownership, approvals, and reporting readiness in one place."
    : "Add a website, share the right context, and generate reports that show where leads are getting lost and what to fix next.";
  const addEntityLabel = isAdmin ? "client" : "website";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#eef2ff_45%,_#ffffff_78%)] text-slate-950">
      <SiteHeaderNav current="dashboard">
        <Link
          href="/pricing"
          className="hidden rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:inline-flex"
        >
          View pricing
        </Link>
        <SignOutButton />
      </SiteHeaderNav>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              {sectionLabel}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                {pageTitle}
              </h1>
            </div>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {pageDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Admin
            </span>
          )}
          <p className="text-sm text-slate-500">Signed in as {user.email}</p>
        </div>

        {!isAdmin && (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Website access
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {websiteLimit === null
                    ? "Unlimited websites available"
                    : `${sitesUsed} of ${websiteLimit} websites used`}
                </p>
                <p className="mt-1 text-sm leading-7 text-slate-600">
                  {siteLimitMessage}
                </p>
              </div>

              {!canCreateSite && (
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  {limitCtaLabel}
                </Link>
              )}
            </div>
          </div>
        )}

        {canCreateSite && (
          <details
            id="add-website"
            className="group relative rounded-3xl border border-slate-200 bg-white p-1 shadow-sm transition hover:shadow-md"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[calc(1.5rem-4px)] px-5 py-4 text-sm font-semibold marker:content-none">
              <span>Add {addEntityLabel}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 transition group-open:rotate-180">
                <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" />
              </span>
            </summary>

            <div className="border-t border-slate-100 px-5 py-5">
              <ClientForm isAdmin={isAdmin} />
            </div>
          </details>
        )}

        {!isAdmin && !canCreateSite && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-900">
              Website limit reached
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-amber-950">
              You have reached your current website limit.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-900">
              {siteLimitMessage} Upgrade your account or choose Starter to add
              more websites while keeping your existing setup intact.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {limitCtaLabel}
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
              >
                Learn how it works
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {clients.length === 0 && (
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur md:grid-cols-[1.25fr_0.75fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  How setup works
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <Globe className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Add the website
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Start with the business name, website URL, and core
                      details so the analysis is tied to the right site.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <BarChart3 className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Add goals and conversions
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Define what counts as success, like calls, form fills, or
                      booked meetings, so reports focus on the outcomes that
                      matter.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <Sparkles className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Generate insights
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      The more complete your form is, the more accurate the
                      conversion analysis, priorities, and recommendations will
                      be.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">
                  What you should have ready
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900" />
                    <span>Your website URL and business name</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900" />
                    <span>
                      Google Analytics access, if you want automatic data sync
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900" />
                    <span>
                      The conversions you care about most, like calls or form
                      leads
                    </span>
                  </li>
                </ul>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    View pricing
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Learn how it works
                  </Link>
                </div>
              </div>
            </div>
          )}
          {clients.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Get started
                  </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight">
                  Your first site setup only takes a few steps.
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-600">
                  A complete setup gives Convert the context it needs to produce
                  stronger insights. The more clearly you explain goals,
                  conversions, and funnel context, the better the analysis will
                  be.
                </p>
              </div>

                {canCreateSite && (
                  <a
                    href="#add-website"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    {isAdmin ? "Add your first client" : "Create your first website"}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Setup checklist
                  </p>
                  <ol className="mt-5 space-y-4">
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        1
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Add the site details
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          Enter the website name, URL, and core business details
                          so the report starts with the right foundation.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        2
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Add goals and conversions
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          Tell us what counts as a win, like calls, form fills,
                          purchases, or booked appointments.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        3
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Add marketing context
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          Share where traffic comes from and what campaigns or
                          channels matter most to the business.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        4
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Explain the funnel and what success looks like
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          The more we understand your offer, audience, and sales
                          process, the better we can spot friction and missed
                          opportunities.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-slate-200 p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What better setup gives you
                  </p>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Conversion blockers
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Identify where forms, calls to action, landing pages, or
                        funnel steps are losing potential leads.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Clear priorities
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Focus on the fixes most likely to improve conversions
                        based on your actual goals, not generic advice.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Business-aligned reporting
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Turn your goals, funnel context, and findings into
                        reporting that clients and stakeholders can understand
                        quickly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        {clients.map(
          (client: {
            id: string;
            name: string;
            website: string | null;
            approval_status?: string | null;
          }) => (
              <div
                key={client.id}
                className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href={`/dashboard/${client.id}`} className="block">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-950">
                      {client.name}
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                        (client.approval_status || "pending") === "approved"
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {(client.approval_status || "pending") === "approved"
                        ? "Approved"
                        : "Pending"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {client.website || "No website"}
                  </p>
                  {(client.approval_status || "pending") !== "approved" && (
                    <p className="mt-3 text-sm text-slate-500">
                      This website is waiting for admin approval before reports
                      can be generated.
                    </p>
                  )}
                </Link>

                <Link
                  href={`/dashboard/${client.id}/edit`}
                  aria-label={`Edit ${client.name}`}
                  className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
                >
                  <Settings size={18} aria-hidden="true" />
                </Link>
              </div>
            ),
          )}

          {clients.length === 1 && (
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur md:grid-cols-[1.25fr_0.75fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Want to add more sites?
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <Globe className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Unlimited Sites
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Start with the business name, website URL, and the basic
                      context needed to analyze lead flow.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <BarChart3 className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Unlimited Reports
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Link Google Analytics for cleaner traffic and conversion
                      data, or add data later while you finish setup.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <Sparkles className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Date ranges
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Run a report to surface conversion blockers, performance
                      gaps, and the most important next actions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">
                  What you should have ready
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900" />
                    <span>Your website URL and business name</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900" />
                    <span>
                      Google Analytics access, if you want automatic data sync
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900" />
                    <span>
                      The conversions you care about most, like calls or form
                      leads
                    </span>
                  </li>
                </ul>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Upgrade to Pro
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Learn how it works
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
