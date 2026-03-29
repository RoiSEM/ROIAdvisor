export type PlanPriceKey = "trial" | "pro" | "agency";

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
    name: "Trial",
    price: "$1",
    description:
      "A low-cost entry to test the platform and see real insights on your site.",
    features: [
      "Single site access",
      "Limited report generation",
      "Basic health score and insights",
    ],
    priceKey: "trial",
    cta: "Start trial",
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
    priceKey: "pro",
    cta: "Upgrade to Pro",
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
    priceKey: "agency",
    cta: "Contact for Agency",
  },
];
