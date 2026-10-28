import { appData } from "@/lib/data-store";
import ClientForm from "@/components/client-form";
import ServiceCta from "@/components/service-cta";
import SiteHeaderNav from "@/components/site-header-nav";
import SignOutButton from "@/components/sign-out-button";
import { getBillingSnapshot } from "@/lib/billing";
import { getSiteAccess } from "@/lib/pricing";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";
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

  let query = appData.from("clients").select("*");

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
    ? await appData
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
      : billingSnapshot.effectivePlan;

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

  const siteAccess =
    isAdmin || websiteLimit === null
      ? null
      : getSiteAccess({ plan: accountState, websiteLimit, sitesUsed });
  const siteLimitMessage = isAdmin
    ? "Admins can create and manage websites across accounts."
    : siteAccess
      ? siteAccess.message
      : "Website access follows your current plan.";

  const limitCta = siteAccess?.cta ?? null;
  const sectionLabel = isAdmin ? "Clients" : "Dashboard";
  const pageTitle = isAdmin
    ? "Manage client websites and approvals."
    : "Set up a site for conversion analysis.";
  const pageDescription = isAdmin
    ? "Review client websites, ownership, approvals, and reporting readiness in one place."
    : "Add a website, share the right context, and generate reports that show where leads are getting lost and what to fix next.";
  const addEntityLabel = isAdmin ? "client" : "website";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#eef2ff_45%,_#ffffff_78%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top,_#111827,_#0b0f19_55%,_#0b0f19_78%)] dark:text-slate-50">
      <SiteHeaderNav current="dashboard">
        <Link
          href="/pricing"
          className="hidden min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 lg:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          View pricing
        </Link>
        <SignOutButton />
      </SiteHeaderNav>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {sectionLabel}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                {pageTitle}
              </h1>
            </div>
            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
              {pageDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white dark:bg-emerald-500 dark:text-emerald-950">
              Admin
            </span>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">Signed in as {user.email}</p>
        </div>

        {!isAdmin && (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Website access
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {siteAccess ? siteAccess.headline : `${sitesUsed} websites used`}
                </p>
                <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {siteLimitMessage}
                </p>
              </div>

              {!canCreateSite && limitCta && (
                <Link
                  href={limitCta.href}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-emerald-500 dark:text-emerald-950"
                >
                  {limitCta.label}
                </Link>
              )}
            </div>
          </div>
        )}

        <ServiceCta
          variant="analyticsSetup"
          className="bg-white/80 backdrop-blur dark:bg-slate-900/80"
        />

        {canCreateSite && (
          <details
            id="add-website"
            className="group relative rounded-3xl border border-slate-200 bg-white p-1 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[calc(1.5rem-4px)] px-5 py-4 text-sm font-semibold marker:content-none">
              <span>Add {addEntityLabel}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 transition group-open:rotate-180 dark:border-slate-800">
                <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" />
              </span>
            </summary>

            <div className="border-t border-slate-100 px-5 py-5 dark:border-slate-800">
              <ClientForm isAdmin={isAdmin} />
            </div>
          </details>
        )}

        {!isAdmin && !canCreateSite && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-100">
              Website limit reached
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-amber-950 dark:text-amber-100">
              You have reached your current website limit.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-900 dark:text-amber-100">
              {siteAccess?.limitNotice ?? siteLimitMessage}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {limitCta && (
                <Link
                  href={limitCta.href}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-emerald-500 dark:text-emerald-950"
                >
                  {limitCta.label}
                </Link>
              )}
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100"
              >
                Learn how it works
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {clients.length === 0 && (
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur md:grid-cols-[1.25fr_0.75fr] dark:border-slate-800 dark:bg-slate-900/80">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  How setup works
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <Globe className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Add the website
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      Start with the business name, website URL, and core
                      details so the analysis is tied to the right site.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <BarChart3 className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Add goals and conversions
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      Define what counts as success, like calls, form fills, or
                      booked meetings, so reports focus on the outcomes that
                      matter.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <Sparkles className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Generate insights
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      The more complete your form is, the more accurate the
                      conversion analysis, priorities, and recommendations will
                      be.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  What you should have ready
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-100" />
                    <span>Your website URL and business name</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-100" />
                    <span>
                      Google Analytics access, if you want automatic data sync
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-100" />
                    <span>
                      The conversions you care about most, like calls or form
                      leads
                    </span>
                  </li>
                </ul>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-emerald-500 dark:text-emerald-950"
                  >
                    View pricing
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Learn how it works
                  </Link>
                </div>
                <ServiceCta
                  variant="analyticsSetup"
                  compact
                  className="mt-4"
                />
              </div>
            </div>
          )}
          {clients.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Get started
                  </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight">
                  Your first site setup only takes a few steps.
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                  A complete setup gives Convert the context it needs to produce
                  stronger insights. The more clearly you explain goals,
                  conversions, and funnel context, the better the analysis will
                  be.
                </p>
              </div>

                {canCreateSite && (
                  <a
                    href="#add-website"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-emerald-500 dark:text-emerald-950"
                  >
                    {isAdmin ? "Add your first client" : "Create your first website"}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Setup checklist
                  </p>
                  <ol className="mt-5 space-y-4">
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950">
                        1
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Add the site details
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                          Enter the website name, URL, and core business details
                          so the report starts with the right foundation.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950">
                        2
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Add goals and conversions
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                          Tell us what counts as a win, like calls, form fills,
                          purchases, or booked appointments.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950">
                        3
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Add marketing context
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                          Share where traffic comes from and what campaigns or
                          channels matter most to the business.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950">
                        4
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Explain the funnel and what success looks like
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                          The more we understand your offer, audience, and sales
                          process, the better we can spot friction and missed
                          opportunities.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    What better setup gives you
                  </p>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Conversion blockers
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Identify where forms, calls to action, landing pages, or
                        funnel steps are losing potential leads.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Clear priorities
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        Focus on the fixes most likely to improve conversions
                        based on your actual goals, not generic advice.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Business-aligned reporting
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
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
                className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <Link href={`/dashboard/${client.id}`} className="block">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
                      {client.name}
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                        (client.approval_status || "pending") === "approved"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                      }`}
                    >
                      {(client.approval_status || "pending") === "approved"
                        ? "Approved"
                        : "Pending"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {client.website || "No website"}
                  </p>
                  {(client.approval_status || "pending") !== "approved" && (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      This website is waiting for admin approval before reports
                      can be generated.
                    </p>
                  )}
                </Link>

                <Link
                  href={`/dashboard/${client.id}/edit`}
                  aria-label={`Edit ${client.name}`}
                  className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  <Settings size={18} aria-hidden="true" />
                </Link>
              </div>
            ),
          )}

          {clients.length === 1 &&
            !isAdmin &&
            accountState !== "agency" && (
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur md:grid-cols-[1.25fr_0.75fr] dark:border-slate-800 dark:bg-slate-900/80">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Want to add more sites?
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <Globe className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Up to 10 websites on Agency
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      Agency lets one account manage up to 10 websites. Free
                      and Business include 1 website.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <BarChart3 className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Unlimited reports on paid plans
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      Business and Agency include unlimited reports for normal
                      interactive use. Free includes 3 reports per month.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <Sparkles className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Date ranges
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      Business and Agency let you choose any custom date range
                      for a report. Free reports use the last 30 days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  What you should have ready
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-100" />
                    <span>Your website URL and business name</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-100" />
                    <span>
                      Google Analytics access, if you want automatic data sync
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-100" />
                    <span>
                      The conversions you care about most, like calls or form
                      leads
                    </span>
                  </li>
                </ul>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-emerald-500 dark:text-emerald-950"
                  >
                    Compare plans
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
