"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CheckoutButton from "@/components/checkout-button";
import ManageBillingButton from "@/components/manage-billing-button";
import { getPlanAction, pricingNotes, pricingPlans } from "@/lib/pricing";

type AccountPlan = "free" | "starter" | "pro" | "agency";
type BillingPlan = "starter" | "pro" | "agency";

type BillingResponse = {
  plan: AccountPlan;
  raw_plan: BillingPlan | null;
  status: string;
  can_use_custom_date_range: boolean;
  has_unlimited_reports: boolean;
  can_manage_billing: boolean;
  authenticated?: boolean;
};

const DEFAULT_BILLING: BillingResponse = {
  plan: "free",
  raw_plan: null,
  status: "inactive",
  can_use_custom_date_range: false,
  has_unlimited_reports: false,
  can_manage_billing: false,
};

type BillingAwarePricingCardsProps = {
  variant?: "home" | "pricing";
};

export default function BillingAwarePricingCards({
  variant = "pricing",
}: BillingAwarePricingCardsProps) {
  const [billing, setBilling] = useState<BillingResponse>(DEFAULT_BILLING);

  useEffect(() => {
    async function hydrateBilling() {
      try {
        const res = await fetch("/api/billing", {
          cache: "no-store",
        });

        const data = (await res.json()) as Partial<BillingResponse>;

        if (!res.ok) {
          return;
        }

        setBilling({
          plan: data.plan ?? "free",
          raw_plan: data.raw_plan ?? null,
          status: data.status ?? "inactive",
          can_use_custom_date_range: Boolean(data.can_use_custom_date_range),
          has_unlimited_reports: Boolean(data.has_unlimited_reports),
          can_manage_billing: Boolean(data.can_manage_billing),
          authenticated:
            typeof data.authenticated === "boolean" ? data.authenticated : undefined,
        });
      } catch (error) {
        console.error("Failed to load billing state", error);
      }
    }

    hydrateBilling();
  }, []);

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-3">
        {pricingPlans.map((plan) => {
          const action = getPlanAction(plan.priceKey, billing);
          const isCurrentPlan = action.current;
          const primaryButtonClass = `inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            plan.featured
              ? "bg-white text-slate-950 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
              : "bg-black text-white hover:opacity-90 dark:bg-emerald-500 dark:text-emerald-950"
          }`;

          const baseCardClass =
            variant === "home"
              ? plan.featured
                ? "border-slate-950 bg-slate-950 text-white dark:border-emerald-400 dark:bg-slate-800"
                : "border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
              : plan.featured
                ? "border-slate-950 bg-slate-950 text-white dark:border-emerald-400 dark:bg-slate-800"
                : "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50";

          return (
            <div
              key={plan.name}
              className={`rounded-3xl border p-8 shadow-sm ${baseCardClass}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className={`text-sm font-semibold uppercase tracking-[0.2em] ${
                      plan.featured ? "text-slate-300" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <p className="mt-4 text-4xl font-bold tracking-tight">
                    {plan.price}
                  </p>
                </div>

                {isCurrentPlan ? (
                  <span className="whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-950 ring-1 ring-inset ring-emerald-200 sm:text-[11px] dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-800">
                    Current plan
                  </span>
                ) : plan.featured ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Unlimited
                  </span>
                ) : null}
              </div>

              <p
                className={`mt-5 text-sm leading-7 ${
                  plan.featured ? "text-slate-200" : "text-slate-600 dark:text-slate-300"
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
                {action.kind === "link" ? (
                  <Link href={action.href} className={primaryButtonClass}>
                    {action.label}
                  </Link>
                ) : action.kind === "portal" ? (
                  <ManageBillingButton
                    label={action.label}
                    className={`inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition ${
                      plan.featured
                        ? "bg-white text-slate-950 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
                        : "border border-slate-300 bg-white text-slate-950 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
                    }`}
                  />
                ) : (
                  <CheckoutButton
                    plan={action.plan}
                    label={action.label}
                    featured={Boolean(plan.featured)}
                    className={primaryButtonClass}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mt-6 space-y-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
        {pricingNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
