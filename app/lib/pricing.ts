export type PlanPriceKey = "starter" | "pro" | "agency";

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
    name: "Starter",
    price: "$10/mo",
    description:
      "The first paid tier for businesses that want consistent conversion reporting without jumping straight to Pro.",
    features: [
      "Up to 10 websites",
      "Limited report generation",
      "Basic health score and insights",
    ],
    priceKey: "starter",
    cta: "Choose Starter",
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
