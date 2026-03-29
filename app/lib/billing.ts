export const BILLING_PLANS = ["starter", "pro", "agency"] as const;
export const ACCOUNT_PLANS = ["free", ...BILLING_PLANS] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];
export type AccountPlan = (typeof ACCOUNT_PLANS)[number];

export type BillingRecord = {
  plan?: string | null;
  status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

const ACTIVE_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);
const STARTER_WEBSITE_LIMIT = 10;
const FREE_WEBSITE_LIMIT = 1;

export function normalizeBillingPlan(
  plan: string | null | undefined,
): BillingPlan {
  if (plan === "starter" || plan === "pro" || plan === "agency") {
    return plan;
  }

  return "starter";
}

export function parseBillingPlan(
  plan: string | null | undefined,
): BillingPlan | null {
  if (plan === "trial") {
    return "starter";
  }

  if (plan === "starter" || plan === "pro" || plan === "agency") {
    return plan;
  }

  return null;
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

export function getWebsiteOwnershipLimit(record?: BillingRecord | null) {
  const rawPlan = normalizeBillingPlan(record?.plan);
  const status = normalizeBillingStatus(record?.status);
  const active = hasPaidAccess(status);

  if (!active) {
    return FREE_WEBSITE_LIMIT;
  }

  if (rawPlan === "starter") {
    return STARTER_WEBSITE_LIMIT;
  }

  return null;
}

export function getBillingSnapshot(record?: BillingRecord | null) {
  const storedPlan = parseBillingPlan(record?.plan);
  const status = normalizeBillingStatus(record?.status);
  const active = hasPaidAccess(status);
  const rawPlan = storedPlan ?? "starter";
  const effectivePlan: AccountPlan = active ? rawPlan : "free";

  return {
    rawPlan: storedPlan,
    status,
    effectivePlan,
    isFree: effectivePlan === "free",
    isStarter: effectivePlan === "starter",
    hasActiveAccess: active,
    canUseCustomDateRange:
      effectivePlan === "pro" || effectivePlan === "agency",
    hasUnlimitedReports:
      effectivePlan === "pro" || effectivePlan === "agency",
    websiteOwnershipLimit: getWebsiteOwnershipLimit(record),
    canManageBilling: Boolean(
      record?.stripe_customer_id || record?.stripe_subscription_id,
    ),
  };
}
