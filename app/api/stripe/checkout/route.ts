import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const PRICE_MAP = {
  trial: process.env.STRIPE_PRICE_TRIAL!,
  pro: process.env.STRIPE_PRICE_PRO!,
};

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
    const { plan } = await req.json();

    const priceId = PRICE_MAP[plan as keyof typeof PRICE_MAP];

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid plan or missing price ID" },
        { status: 400 },
      );
    }
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      },
      customer_email: user.email ?? undefined,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/clients?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?checkout=cancelled`,
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
