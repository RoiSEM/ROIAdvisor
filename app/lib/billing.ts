export const BILLING_PLANS = ["trial", "pro", "agency"] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];

export type BillingRecord = {
  plan?: string | null;
  status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

const ACTIVE_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

export function normalizeBillingPlan(plan: string | null | undefined): BillingPlan {
  if (plan === "pro" || plan === "agency") {
    return plan;
  }

  return "trial";
}

export function normalizeBillingStatus(status: string | null | undefined) {
  if (!status) {
    return "inactive";
  }

  return status.toLowerCase();
}

export function hasPaidAccess(status: string | null | undefined) {
  return ACTIVE_ACCESS_STATUSES.has(normalizeBillingStatus(status));
}

export function getBillingSnapshot(record?: BillingRecord | null) {
  const rawPlan = normalizeBillingPlan(record?.plan);
  const status = normalizeBillingStatus(record?.status);
  const active = hasPaidAccess(status);
  const effectivePlan: BillingPlan =
    rawPlan !== "trial" && active ? rawPlan : "trial";

  return {
    rawPlan,
    status,
    effectivePlan,
    isTrial: effectivePlan === "trial",
    canUseCustomDateRange: effectivePlan !== "trial",
    hasUnlimitedReports: effectivePlan !== "trial",
    canManageBilling: Boolean(
      record?.stripe_customer_id || record?.stripe_subscription_id,
    ),
  };
}
