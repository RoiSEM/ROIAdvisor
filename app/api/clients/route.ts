import { appData } from "@/lib/data-store";
import { removeConnectionProof } from "@/lib/connection-proof";
import { getBillingSnapshot } from "@/lib/billing";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";

function getMissingColumnName(message: string | undefined) {
  if (!message) return null;

  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

async function insertClientWithSchemaFallback(
  payload: Record<string, unknown>,
) {
  const insertPayload = { ...payload };
  const optionalColumns = new Set([
    "logo_url",
    "technical_issues",
    "design_concerns",
    "ad_channel_notes",
    "offer_message_concerns",
    "tracking_notes",
    "key_events",
  ]);

  while (true) {
    const { data, error } = await appData
      .from("clients")
      .insert([insertPayload])
      .select()
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = getMissingColumnName(error.message);

    if (!missingColumn || !optionalColumns.has(missingColumn)) {
      return { data: null, error };
    }

    delete insertPayload[missingColumn];
    optionalColumns.delete(missingColumn);
  }
}

export async function GET(req: Request) {
  const { user, error: userError } = await getRequestUser(req);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = appData
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
  const { user, error: userError } = await getRequestUser(req);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = isAdminUser(user);

  try {
    const {
      name,
      website,
      email,
      logo_url,
      user_id,
      ga4_property_id,
      primary_goal,
      monthly_goal,
      average_conversion_value,
      conversion_types,
      key_events,
      conversion_tracking_status,
      main_cta,
      funnel_description,
      known_issues,
      technical_issues,
      design_concerns,
      ad_channel_notes,
      offer_message_concerns,
      tracking_notes,
      marketing_channels,
      running_ads,
      client_notes,
    } = await req.json();

    if (!isAdmin) {
      const { data: billing, error: billingError } = await appData
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
        const { count, error: countError } = await appData
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (countError) {
          return Response.json({ error: countError.message }, { status: 500 });
        }

        if ((count ?? 0) >= websiteLimit) {
          const limitMessage =
            websiteLimit === 1
              ? (billingSnapshot.isBusiness
                  ? "Business accounts can create up to 1 website. Upgrade to Agency to add more."
                  : billingSnapshot.isStarter
                  ? "Starter accounts can create up to 1 website."
                  : "Signed-in accounts without an active paid plan can create 1 website. Choose Agency to add more.")
              : `Agency accounts can create up to ${websiteLimit} websites.`;

          return Response.json({ error: limitMessage }, { status: 403 });
        }
      }
    }

    const { data, error } = await insertClientWithSchemaFallback({
      name,
      website,
      email,
      logo_url,
      user_id: isAdmin ? user_id : user.id,
      ga4_property_id,
      primary_goal,
      monthly_goal,
      average_conversion_value,
      conversion_types,
      key_events,
      conversion_tracking_status,
      main_cta,
      funnel_description,
      known_issues,
      technical_issues,
      design_concerns,
      ad_channel_notes,
      offer_message_concerns,
      tracking_notes: removeConnectionProof(tracking_notes),
      marketing_channels,
      running_ads,
      client_notes,
      approval_status: "pending",
      approval_notes: null,
      approved_at: null,
      approved_by_user_id: null,
    });

    if (error) {
      if (
        error.code === "SITE_LIMIT" ||
        (error.code === "P0001" && error.message === "SITE_QUOTA_EXCEEDED")
      ) {
        return Response.json(
          { error: "This account has reached its website limit for its plan." },
          { status: 403 },
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Create client error:", error);
    return Response.json({ error: "Failed to create client" }, { status: 500 });
  }
}
