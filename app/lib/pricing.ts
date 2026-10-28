// Public pricing offer + presentation helpers. Internal key "pro" is the
// Business plan (kept for stored billing records / report SQL compatibility).
export type PlanPriceKey = "free" | "pro" | "agency";
export type PaidPlanKey = Exclude<PlanPriceKey, "free">;

export const pricingPlans: Array<{
  name: string;
  price: string;
  description: string;
  features: string[];
  priceKey: PlanPriceKey;
  cta: string;
  featured?: boolean;
}> = [
  {
    name: "Free",
    price: "$0/mo",
    description: "Try Convert on one website with the default reporting window.",
    features: [
      "1 website",
      "3 successfully generated reports per UTC calendar month",
      "Default last 30 days report range",
    ],
    priceKey: "free",
    cta: "Start free",
  },
  {
    name: "Business",
    price: "$19/mo",
    description:
      "For a business that wants consistent reporting on its own website.",
    features: ["1 website", "Unlimited reports (fair use)", "Custom date ranges"],
    featured: true,
    priceKey: "pro",
    cta: "Choose Business",
  },
  {
    name: "Agency",
    price: "$79/mo",
    description: "For teams reporting on several websites from one account.",
    features: [
      "Up to 10 websites",
      "Unlimited reports (fair use)",
      "Custom date ranges",
    ],
    priceKey: "agency",
    cta: "Choose Agency",
  },
];

export const pricingNotes: string[] = [
  "Prices are in USD, billed monthly. Paid plans require an account.",
  "Free counts successfully generated reports only and resets at 00:00 UTC on the first day of each calendar month.",
  "Unlimited reports cover normal interactive use. Automated or bulk generation is not permitted, and short-window safeguards against rapid repeat requests still apply. There is no hidden monthly cap on paid plans.",
  "Convert is software only. Implementation services are quoted separately.",
];

export function planDisplayName(plan: string | null | undefined): string {
  if (plan === "pro") return "Business";
  if (plan === "agency") return "Agency";
  if (plan === "starter") return "Starter (legacy)";
  return "Free";
}

export type PricingBillingState = {
  plan: string;
  raw_plan: string | null;
  status: string;
  can_manage_billing: boolean;
  // Optional: only trusted when /api/billing reports it. When absent, a Free
  // response is treated as anonymous (never claims "Current plan").
  authenticated?: boolean;
};

const PAID_RAW_PLANS = ["starter", "pro", "agency"];
const PORTAL_STATUSES = ["active", "trialing", "past_due"];

export function hasExistingPaidSubscription(billing: PricingBillingState) {
  return (
    billing.can_manage_billing &&
    PAID_RAW_PLANS.includes(billing.raw_plan ?? "") &&
    PORTAL_STATUSES.includes(billing.status)
  );
}

export function isSignedIn(billing: PricingBillingState) {
  return (
    billing.authenticated === true ||
    billing.plan !== "free" ||
    billing.can_manage_billing ||
    billing.raw_plan !== null
  );
}

export type PlanAction =
  | { kind: "link"; href: string; label: string; current: boolean }
  | { kind: "checkout"; plan: PaidPlanKey; label: string; current: false }
  | { kind: "portal"; label: string; current: boolean };

export function getPlanAction(
  key: PlanPriceKey,
  billing: PricingBillingState,
): PlanAction {
  const plan = pricingPlans.find((p) => p.priceKey === key)!;
  const signedIn = isSignedIn(billing);
  const existingPaid = hasExistingPaidSubscription(billing);

  if (key === "free") {
    if (existingPaid) {
      return { kind: "portal", label: "Change in billing portal", current: false };
    }
    if (!signedIn) {
      return { kind: "link", href: "/login", label: plan.cta, current: false };
    }
    return {
      kind: "link",
      href: "/dashboard",
      label: "Open dashboard",
      current: billing.plan === "free",
    };
  }

  // Any paid-plan change for an existing active/trialing/past_due
  // subscription goes through the billing portal to avoid duplicates.
  if (existingPaid) {
    const current = billing.raw_plan === key && billing.plan === key;
    return {
      kind: "portal",
      label: current ? "Manage plan" : "Change in billing portal",
      current,
    };
  }

  return { kind: "checkout", plan: key, label: plan.cta, current: false };
}

export type SiteAccess = {
  headline: string;
  message: string;
  atLimit: boolean;
  limitNotice: string;
  cta: { href: string; label: string } | null;
};

export function getSiteAccess({
  plan,
  websiteLimit,
  sitesUsed,
}: {
  plan: string;
  websiteLimit: number;
  sitesUsed: number;
}): SiteAccess {
  const name = planDisplayName(plan);
  const isAgency = plan === "agency";
  const noun = websiteLimit === 1 ? "website" : "websites";
  const atLimit = sitesUsed >= websiteLimit;

  const message = isAgency
    ? `Agency includes up to ${websiteLimit} ${noun}.`
    : `${name} includes ${websiteLimit} ${noun}. Agency supports up to 10 websites.`;

  const limitNotice =
    sitesUsed > websiteLimit
      ? `You have more websites than ${name} allows. Your existing websites stay available, but you can't add another until you're under the limit${isAgency ? "" : " or move to Agency"}.`
      : isAgency
        ? `You've reached the Agency limit of ${websiteLimit} websites. Your existing websites stay available.`
        : `You've reached the ${name} website limit. Your existing websites stay available.`;

  return {
    headline: `${sitesUsed} of ${websiteLimit} ${noun} used`,
    message,
    atLimit,
    limitNotice,
    cta: isAgency
      ? null
      : { href: "/pricing", label: "Upgrade to Agency for up to 10 websites" },
  };
}
