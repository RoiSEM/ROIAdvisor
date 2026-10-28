import { appData } from "@/lib/data-store";
import { NextResponse } from "next/server";
import {
  getStripeClient,
  CHECKOUT_PRICE_MAP,
  validateCheckoutPrice,
} from "@/lib/stripe-pricing";

function resolveAppUrl(pathname: unknown, fallbackPath: string) {
  const path =
    typeof pathname === "string" &&
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    !pathname.includes("://")
      ? pathname
      : fallbackPath;

  return `${process.env.NEXT_PUBLIC_SITE_URL}${path}`;
}

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SITE_URL" },
      { status: 500 },
    );
  }

  let requestBody: Record<string, unknown> | null;
  try {
    requestBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  // Lazy import / auth check
  const { getRequestUser } = await import("@/lib/supabase-server");
  const {
    user,
    error: userError,
  } = await getRequestUser(req);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { plan, success_path, cancel_path } = requestBody || {};

    if (plan !== "pro" && plan !== "agency") {
      return NextResponse.json(
        { error: "Invalid plan or starter plan is no longer available" },
        { status: 400 },
      );
    }

    const priceId = CHECKOUT_PRICE_MAP[plan as keyof typeof CHECKOUT_PRICE_MAP];

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing price ID for plan" },
        { status: 400 },
      );
    }

    const { data: billing, error: billingError } = await appData
      .from("billing_accounts")
      .select("plan, status, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (billingError) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 },
      );
    }

    const subscriptionStatus = (billing?.status || "").toLowerCase();
    const hasActiveStatus = ["active", "trialing", "past_due"].includes(
      subscriptionStatus,
    );
    const isSubscriptionActive =
      Boolean(billing?.stripe_subscription_id) && hasActiveStatus;

    if (isSubscriptionActive) {
      return NextResponse.json(
        {
          error:
            "You already have an active subscription. Use the billing portal to manage or change your plan.",
        },
        { status: 409 },
      );
    }

    const stripe = getStripeClient();

    await validateCheckoutPrice(stripe, priceId, plan as "pro" | "agency");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        selected_plan: plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          selected_plan: plan,
        },
      },
      customer: billing?.stripe_customer_id ?? undefined,
      customer_email: billing?.stripe_customer_id ? undefined : user.email ?? undefined,
      success_url: resolveAppUrl(success_path, "/pricing?checkout=success"),
      cancel_url: resolveAppUrl(cancel_path, "/pricing?checkout=cancelled"),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    const isClientInput =
      error instanceof SyntaxError ||
      (error instanceof Error &&
        (error.message.includes("JSON") || error.message.includes("body")));
    const status = isClientInput ? 400 : 503;
    const message = isClientInput
      ? "Invalid request body"
      : "Failed to create checkout session";

    return NextResponse.json({ error: message }, { status });
  }
}
