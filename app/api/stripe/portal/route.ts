import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST() {
  try {
    // 1. Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get billing record
    const { data: billing, error } = await supabase
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

    // 3. Create Stripe portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/clients`,
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
