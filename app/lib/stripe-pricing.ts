import Stripe from "stripe";

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
  });
}

export const CHECKOUT_PRICE_MAP = {
  pro: process.env.STRIPE_PRICE_BUSINESS,
  agency: process.env.STRIPE_PRICE_AGENCY,
};

export function getPlanFromPriceId(
  priceId: string | null | undefined,
): "starter" | "pro" | "agency" | null {
  if (!priceId) return null;

  if (
    priceId === process.env.STRIPE_PRICE_BUSINESS ||
    priceId === process.env.STRIPE_PRICE_PRO
  ) {
    return "pro";
  }
  if (priceId === process.env.STRIPE_PRICE_AGENCY) {
    return "agency";
  }
  if (
    priceId === process.env.STRIPE_PRICE_STARTER ||
    priceId === process.env.STRIPE_PRICE_TRIAL
  ) {
    return "starter";
  }

  return null;
}

export async function validateCheckoutPrice(
  stripe: Stripe,
  priceId: string,
  expectedPlan: "pro" | "agency",
) {
  const price = await stripe.prices.retrieve(priceId);

  if (!price || price.active !== true) {
    throw new Error("Price is inactive or not found");
  }

  if (price.currency?.toLowerCase() !== "usd") {
    throw new Error("Price currency must be USD");
  }

  if (price.billing_scheme && price.billing_scheme !== "per_unit") {
    throw new Error(
      "Price billing scheme must be per_unit (tiered/custom pricing not allowed)",
    );
  }

  if (price.transform_quantity) {
    throw new Error("Price quantity transformation is not allowed");
  }

  const expectedAmount = expectedPlan === "pro" ? 1900 : 7900;
  if (price.unit_amount !== expectedAmount) {
    throw new Error(
      `Invalid unit amount for ${expectedPlan} plan. Expected ${expectedAmount}, got ${price.unit_amount}`,
    );
  }

  const recurring = price.recurring;
  if (
    !recurring ||
    recurring.interval !== "month" ||
    recurring.interval_count !== 1
  ) {
    throw new Error(
      "Price must be a monthly recurring subscription (interval_count: 1)",
    );
  }

  if (recurring.usage_type && recurring.usage_type !== "licensed") {
    throw new Error(
      "Price usage type must be licensed (metered pricing not allowed)",
    );
  }

  return price;
}
