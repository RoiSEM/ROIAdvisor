import ManageBillingButton from "@/components/manage-billing-button";
import CheckoutButton from "@/components/checkout-button";
import { pricingPlans } from "@/lib/pricing";
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


export default function HomePage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
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
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Start trial
            </Link>
            <Link
              href="/clients"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Go to dashboard
            </Link>
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

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Pricing
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Simple pricing for conversion-focused reporting.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Start with a low-cost trial to validate the insights, then upgrade
              into deeper reporting and white-label delivery as your needs grow.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl border p-8 shadow-sm ${
                  plan.featured
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-950"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      className={`text-sm font-semibold uppercase tracking-[0.2em] ${
                        plan.featured ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {plan.name}
                    </p>
                    <p className="mt-4 text-4xl font-bold tracking-tight">
                      {plan.price}
                    </p>
                  </div>
                  {plan.featured && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      Most popular
                    </span>
                  )}
                </div>

                <p
                  className={`mt-5 text-sm leading-7 ${
                    plan.featured ? "text-slate-200" : "text-slate-600"
                  }`}
                >
                  {plan.description}
                </p>

                <ul className="mt-6 space-y-3 text-sm leading-7">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-current" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  {plan.priceKey === "agency" ? (
                    <a
                      href="mailto:george@roisem.com?subject=Agency%20Plan%20Inquiry"
                      className={`inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition ${
                        plan.featured
                          ? "bg-white text-slate-950 hover:bg-slate-100"
                          : "bg-black text-white hover:opacity-90"
                      }`}
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <CheckoutButton
                      plan={plan.priceKey}
                      label={plan.cta}
                      featured={Boolean(plan.featured)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center sm:px-8 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Find out why your website is not converting.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600">
          Start with a $1 trial, then use Convert to track what matters, uncover
          conversion blockers, and improve results.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Start trial
          </Link>
          <Link
            href="/clients"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            View dashboard
          </Link>
          <ManageBillingButton />
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
