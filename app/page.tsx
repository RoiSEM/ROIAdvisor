
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

const plans = [
  {
    name: "Trial",
    price: "$1",
    description:
      "A low-cost entry to test the platform and see real insights on your site.",
    features: [
      "Single site access",
      "Limited report generation",
      "Basic health score and insights",
    ],
  },
  {
    name: "Pro",
    price: "$100/mo",
    description:
      "Best for businesses that want consistent reporting and clear direction.",
    features: [
      "Custom date ranges",
      "Unlimited reports",
      "Full AI recommendations",
    ],
    featured: true,
  },
  {
    name: "Agency",
    price: "$1000/mo",
    description:
      "For agencies delivering reports and insights to multiple clients.",
    features: [
      "White-label reporting",
      "Client access",
      "Branded exports and PDFs",
    ],
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
            Convert helps business owners and agencies understand why their website is not converting. Track traffic, diagnose conversion blockers, and get clear actions to improve leads and revenue.
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
                  Primary blocker: form functionality issues are preventing users from submitting leads. Fix this first before investing more in traffic.
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
                <div key={item.title} className="rounded-2xl border border-slate-200 p-5">
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
              Start with a low-cost trial to validate the insights, then upgrade into deeper reporting and white-label delivery as your needs grow.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
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
          Start with a $1 trial, then use Convert to track what matters,
          uncover conversion blockers, and improve results.
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
        </div>
      </section>
    </main>
  );
}
