import { appData } from "@/lib/data-store";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase-server";
import { getStripeClient } from "@/lib/stripe-pricing";

export async function POST(req: Request) {
  try {
    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: billing, error } = await appData
      .from("billing_accounts")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (error || !billing?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 404 },
      );
    }

    const stripe = getStripeClient();

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
