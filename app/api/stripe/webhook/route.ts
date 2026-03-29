import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

function getPlanFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;

  if (
    priceId === process.env.STRIPE_PRICE_STARTER ||
    priceId === process.env.STRIPE_PRICE_TRIAL
  ) {
    return "starter";
  }
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return "agency";

  return null;
}

async function upsertBillingAccount(params: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  plan: string | null;
  status: string;
}) {
  const payload = {
    user_id: params.userId,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    stripe_price_id: params.stripePriceId,
    plan: params.plan,
    status: params.status,
    updated_at: new Date().toISOString(),
  };

  const { data: existingByUserId, error: lookupByUserIdError } = await supabaseAdmin
    .from("billing_accounts")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (lookupByUserIdError) {
    throw new Error(
      `Failed to look up billing account by user_id: ${lookupByUserIdError.message}`,
    );
  }

  const existingRecordId = existingByUserId?.id;

  if (existingRecordId) {
    const { error: updateError } = await supabaseAdmin
      .from("billing_accounts")
      .update(payload)
      .eq("id", existingRecordId);

    if (updateError) {
      throw new Error(`Failed to update billing account: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await supabaseAdmin
    .from("billing_accounts")
    .insert(payload);

  if (insertError) {
    throw new Error(`Failed to insert billing account: ${insertError.message}`);
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 },
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing STRIPE_WEBHOOK_SECRET" },
        { status: 500 },
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe signature" },
        { status: 400 },
      );
    }

    const body = await req.text();

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    console.log("Processing Stripe webhook event:", event.id, event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId =
          typeof session.client_reference_id === "string"
            ? session.client_reference_id
            : typeof session.metadata?.user_id === "string"
              ? session.metadata.user_id
              : null;

        if (!userId) {
          console.warn(
            "Stripe checkout.session.completed received without a linked user id",
          );
          break;
        }

        console.log("Stripe checkout.session.completed linked to user:", userId);

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id || null;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id || null;
          const plan =
            getPlanFromPriceId(priceId) ??
            (typeof session.metadata?.selected_plan === "string"
              ? session.metadata.selected_plan
              : null);

          await upsertBillingAccount({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            plan,
            status: subscription.status,
          });
        } else {
          await upsertBillingAccount({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: null,
            stripePriceId: null,
            plan: null,
            status: "completed",
          });
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        const priceId = subscription.items.data[0]?.price?.id || null;
        const plan = getPlanFromPriceId(priceId);

        const { data: billing, error } = await supabaseAdmin
          .from("billing_accounts")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (error) {
          throw new Error(
            `Failed to load billing account for customer ${customerId}: ${error.message}`,
          );
        }

        if (!billing?.user_id) {
          console.warn(
            `No billing account found for Stripe customer ${customerId} during ${event.type}`,
          );
          break;
        }

        await upsertBillingAccount({
          userId: billing.user_id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          plan,
          status: subscription.status,
        });

        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id || null;

        if (!customerId) {
          break;
        }

        const { data: billing, error } = await supabaseAdmin
          .from("billing_accounts")
          .select("user_id, stripe_subscription_id, stripe_price_id, plan")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (error) {
          throw new Error(
            `Failed to load billing account for invoice customer ${customerId}: ${error.message}`,
          );
        }

        if (!billing?.user_id) {
          console.warn(
            `No billing account found for Stripe customer ${customerId} during ${event.type}`,
          );
          break;
        }

        await upsertBillingAccount({
          userId: billing.user_id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: billing.stripe_subscription_id,
          stripePriceId: billing.stripe_price_id,
          plan: billing.plan,
          status: event.type === "invoice.paid" ? "active" : "past_due",
        });

        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    const message =
      error instanceof Error ? error.message : "Webhook handler failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
