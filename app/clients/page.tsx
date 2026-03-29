import ClientForm from "@/components/client-form";
import SignOutButton from "@/components/sign-out-button";
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
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getClients() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // console.log("USER EMAIL:", user.email);

  const ADMIN_EMAILS = ["george@roisem.com"];
  const isAdmin = ADMIN_EMAILS.includes(user.email || "");

  let query = supabase.from("clients").select("*");

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

  return {
    clients: data ?? [],
    user,
    isAdmin,
  };
}

export default async function ClientsPage() {
  const { clients, user, isAdmin } = await getClients();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#eef2ff_45%,_#ffffff_78%)] text-slate-950">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Websites
            </p>
            <div className="mt-4 flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Set up a site for conversion analysis.
              </h1>
            </div>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Add a website, connect analytics, and generate reports that show
              where leads are getting lost and what to fix next.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start">
            <SignOutButton />
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

        {isAdmin && (
          <details
            id="add-website"
            className="group relative rounded-3xl border border-slate-200 bg-white p-1 shadow-sm transition hover:shadow-md"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[calc(1.5rem-4px)] px-5 py-4 text-sm font-semibold marker:content-none">
              <span>Add website</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 transition group-open:rotate-180">
                <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" />
              </span>
            </summary>

            <div className="border-t border-slate-100 px-5 py-5">
              <ClientForm isAdmin={isAdmin} />
            </div>
          </details>
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
                      Start with the business name, website URL, and the basic
                      context needed to analyze lead flow.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <BarChart3 className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Connect analytics
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      Link Google Analytics for cleaner traffic and conversion
                      data, or add data later while you finish setup.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <Sparkles className="h-5 w-5 text-slate-900" />
                    <h2 className="mt-4 text-lg font-semibold">
                      Generate insights
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
                    Once a site is added, Convert can organize traffic, surface
                    weak points in the funnel, and generate conversion-focused
                    analysis you can act on quickly.
                  </p>
                </div>

                {isAdmin && (
                  <a
                    href="#add-website"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Add your first website
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
                          Enter the website name, URL, and any client context
                          that helps frame the analysis.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        2
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Connect or confirm analytics
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          Use Google Analytics when available so reports include
                          traffic, engagement, and conversion behavior.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        3
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Generate the first report
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          Start with a baseline report to identify immediate
                          conversion blockers and low-performing pages.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                        4
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Upgrade when you need deeper tracking
                        </p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          Paid plans unlock custom date ranges, unlimited
                          reporting, and easier ongoing monitoring.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-slate-200 p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What the analysis gives you
                  </p>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Conversion blockers
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Identify where forms, calls to action, or landing pages
                        are losing potential leads.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Clear priorities
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Focus on the fixes that are most likely to improve
                        conversions instead of guessing what matters.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">
                        Shareable reporting
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        Turn your findings into reports clients and stakeholders
                        can understand quickly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {clients.map(
            (client: { id: string; name: string; website: string | null }) => (
              <div
                key={client.id}
                className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href={`/clients/${client.id}`} className="block">
                  <h2 className="text-xl font-semibold text-slate-950">
                    {client.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {client.website || "No website"}
                  </p>
                </Link>

                <Link
                  href={`/clients/${client.id}/edit`}
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
