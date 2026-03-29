import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRequestUser, supabaseAdmin } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: Request) {
  try {
    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: billing, error } = await supabaseAdmin
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
