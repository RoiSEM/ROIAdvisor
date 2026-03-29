import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getBillingSnapshot } from "@/lib/billing";
import { getRequestUser, supabaseAdmin } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

const PRICE_MAP = {
  trial: process.env.STRIPE_PRICE_TRIAL!,
  pro: process.env.STRIPE_PRICE_PRO!,
};

function resolveAppUrl(pathname: string | undefined, fallbackPath: string) {
  const path =
    pathname && pathname.startsWith("/") ? pathname : fallbackPath;

  return `${process.env.NEXT_PUBLIC_SITE_URL}${path}`;
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SITE_URL" },
      { status: 500 },
    );
  }

  try {
    const { plan, success_path, cancel_path } = await req.json();

    const priceId = PRICE_MAP[plan as keyof typeof PRICE_MAP];

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid plan or missing price ID" },
        { status: 400 },
      );
    }
    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: billing, error: billingError } = await supabaseAdmin
      .from("billing_accounts")
      .select("plan, status, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (billingError) {
      return NextResponse.json({ error: billingError.message }, { status: 500 });
    }

    const billingSnapshot = getBillingSnapshot(billing);

    if (billingSnapshot.canManageBilling && billingSnapshot.effectivePlan === plan) {
      return NextResponse.json(
        { error: `You already have the ${plan} plan.` },
        { status: 409 },
      );
    }

    if (billingSnapshot.canManageBilling && billingSnapshot.effectivePlan !== "trial" && plan === "trial") {
      return NextResponse.json(
        { error: "Use the billing portal to change or cancel an existing paid plan." },
        { status: 409 },
      );
    }

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

    const message =
      error instanceof Error ? error.message : "Failed to create checkout session";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
