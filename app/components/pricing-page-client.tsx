"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import BillingAwarePricingCards from "@/components/billing-aware-pricing-cards";
import ManageBillingButton from "@/components/manage-billing-button";
import SiteHeaderNav from "@/components/site-header-nav";

type AccountPlan = "free" | "starter" | "pro" | "agency";
type BillingPlan = "starter" | "pro" | "agency";

type BillingResponse = {
  plan: AccountPlan;
  raw_plan: BillingPlan | null;
  status: string;
  can_use_custom_date_range: boolean;
  has_unlimited_reports: boolean;
  can_manage_billing: boolean;
};

const DEFAULT_BILLING: BillingResponse = {
  plan: "free",
  raw_plan: null,
  status: "inactive",
  can_use_custom_date_range: false,
  has_unlimited_reports: false,
  can_manage_billing: false,
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatPlanLabel(plan: AccountPlan) {
  if (plan === "free") {
    return "Free";
  }

  if (plan === "starter") {
    return "Starter";
  }

  return plan;
}

export default function PricingPageClient() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingResponse>(DEFAULT_BILLING);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const checkoutState = searchParams.get("checkout");

  const loadBilling = useCallback(async () => {
    const res = await fetch("/api/billing", {
      cache: "no-store",
    });

    const data = (await res.json()) as Partial<BillingResponse>;

    if (!res.ok) {
      throw new Error("Failed to load billing state");
    }

    const nextBilling: BillingResponse = {
      plan: data.plan ?? "free",
      raw_plan: data.raw_plan ?? null,
      status: data.status ?? "inactive",
      can_use_custom_date_range: Boolean(data.can_use_custom_date_range),
      has_unlimited_reports: Boolean(data.has_unlimited_reports),
      can_manage_billing: Boolean(data.can_manage_billing),
    };

    setBilling(nextBilling);
    return nextBilling;
  }, []);

  useEffect(() => {
    async function hydrateBilling() {
      try {
        await loadBilling();
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingBilling(false);
      }
    }

    hydrateBilling();
  }, [loadBilling]);

  useEffect(() => {
    if (checkoutState !== "success") {
      setUnlocking(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function pollForUnlock() {
      try {
        setUnlocking(true);
        const nextBilling = await loadBilling();

        if (cancelled) {
          return;
        }

        if (nextBilling.can_use_custom_date_range) {
          setUnlocking(false);
          return;
        }
      } catch (error) {
        console.error(error);
      }

      attempts += 1;

      if (!cancelled && attempts < 10) {
        timer = setTimeout(pollForUnlock, 1500);
        return;
      }

      if (!cancelled) {
        setUnlocking(false);
      }
    }

    pollForUnlock();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [checkoutState, loadBilling]);

  const statusBanner = useMemo(() => {
    if (checkoutState === "cancelled") {
      return {
        tone: "border-slate-200 bg-slate-50 text-slate-700",
        body: "Checkout was cancelled. Your current plan is unchanged.",
        title: "No changes made",
      };
    }

    if (checkoutState === "success" && unlocking) {
      return {
        tone: "border-blue-200 bg-blue-50 text-blue-900",
        body: "Payment completed. We’re syncing your plan and unlocking paid features now.",
        title: "Unlocking your account",
      };
    }

    if (checkoutState === "success" && billing.can_use_custom_date_range) {
      return {
        tone: "border-green-200 bg-green-50 text-green-900",
        body: "Your plan is active and paid features are ready to use immediately.",
        title: "Upgrade complete",
      };
    }

    if (checkoutState === "success") {
      return {
        tone: "border-amber-200 bg-amber-50 text-amber-900",
        body: "Payment succeeded, but the webhook has not updated your account yet. This usually clears in a few seconds.",
        title: "Still syncing",
      };
    }

    return null;
  }, [billing.can_use_custom_date_range, checkoutState, unlocking]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#eef2ff_45%,_#ffffff_78%)] text-slate-950">
      <SiteHeaderNav current="pricing">
        <Link
          href="/"
          className="hidden rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:inline-flex"
        >
          Home
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Open dashboard
        </Link>
      </SiteHeaderNav>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Pricing
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Upgrade when you need deeper reporting, not before.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Start lean, unlock custom date ranges and unlimited reporting when
            you are ready, and manage billing without emailing support.
          </p>
        </div>

        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Current access
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  billing.plan === "free"
                    ? "bg-slate-200 text-slate-900"
                    : billing.plan === "starter"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {loadingBilling ? "Loading" : formatPlanLabel(billing.plan)}
              </span>
              <span className="text-sm text-slate-500">
                Status: {loadingBilling ? "loading" : formatStatus(billing.status)}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {billing.can_use_custom_date_range
                ? "Paid features are unlocked, including custom date ranges and unlimited report generation."
                : billing.plan === "starter"
                  ? "You are on the Starter plan with up to 10 websites, the last 30 days, and limited report generation."
                  : "You are signed in with free access. You can set up one website and use the default 30-day report window until you choose Starter or upgrade."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">
              What happens after checkout
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <li>Stripe completes the payment securely.</li>
              <li>The webhook updates `billing_accounts` in your database.</li>
              <li>Your paid features unlock as soon as the billing record syncs.</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Open dashboard
              </Link>
              {billing.can_manage_billing && <ManageBillingButton />}
            </div>
          </div>
        </div>

        {statusBanner && (
          <div className={`rounded-2xl border p-5 ${statusBanner.tone}`}>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              {statusBanner.title}
            </p>
            <p className="mt-2 text-sm leading-7">{statusBanner.body}</p>
          </div>
        )}

        <BillingAwarePricingCards variant="pricing" />
      </section>
    </main>
  );
}
