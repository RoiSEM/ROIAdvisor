import { getBillingSnapshot } from "@/lib/billing";
import {
  getRequestUser,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";

export async function GET(req: Request) {
  const {
    user,
    error: userError,
  } = await getRequestUser(req);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabaseAdmin
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdminUser(user)) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(req: Request) {
  const {
    user,
    error: userError,
  } = await getRequestUser(req);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = isAdminUser(user);

  try {
    const {
      name,
      website,
      email,
      user_id,
      ga4_property_id,
      primary_goal,
      monthly_goal,
      average_conversion_value,
      conversion_types,
      conversion_tracking_status,
      main_cta,
      funnel_description,
      known_issues,
      marketing_channels,
      running_ads,
      client_notes,
    } = await req.json();

    if (!isAdmin) {
      const { data: billing, error: billingError } = await supabaseAdmin
        .from("billing_accounts")
        .select("plan, status, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (billingError) {
        return Response.json({ error: billingError.message }, { status: 500 });
      }

      const billingSnapshot = getBillingSnapshot(billing);
      const websiteLimit = billingSnapshot.websiteOwnershipLimit;

      if (websiteLimit !== null) {
        const { count, error: countError } = await supabaseAdmin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (countError) {
          return Response.json({ error: countError.message }, { status: 500 });
        }

        if ((count ?? 0) >= websiteLimit) {
          const limitMessage =
            websiteLimit === 1
              ? "Signed-in accounts without an active paid plan can create 1 website. Choose Starter or upgrade to add more."
              : `Starter accounts can create up to ${websiteLimit} websites. Upgrade to Pro to add more.`;

          return Response.json({ error: limitMessage }, { status: 403 });
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert([
        {
          name,
          website,
          email,
          user_id: isAdmin ? user_id : user.id,
          ga4_property_id,
          primary_goal,
          monthly_goal,
          average_conversion_value,
          conversion_types,
          conversion_tracking_status,
          main_cta,
          funnel_description,
          known_issues,
          marketing_channels,
          running_ads,
          client_notes,
          approval_status: "pending",
          approval_notes: null,
          approved_at: null,
          approved_by_user_id: null,
        },
      ])
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Create client error:", error);
    return Response.json({ error: "Failed to create client" }, { status: 500 });
  }
}
