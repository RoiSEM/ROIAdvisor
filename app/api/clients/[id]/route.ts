import {
  getRequestUser,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";

function getMissingColumnName(message: string | undefined) {
  if (!message) return null;

  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

async function updateClientWithSchemaFallback(
  id: string,
  payload: Record<string, unknown>,
) {
  const updatePayload = { ...payload };
  const optionalColumns = new Set([
    "logo_url",
    "technical_issues",
    "design_concerns",
    "ad_channel_notes",
    "offer_message_concerns",
    "tracking_notes",
  ]);

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("clients")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = getMissingColumnName(error.message);

    if (!missingColumn || !optionalColumns.has(missingColumn)) {
      return { data: null, error };
    }

    delete updatePayload[missingColumn];
    optionalColumns.delete(missingColumn);
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
      .eq("id", id);

    if (!isAdminUser(user)) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return Response.json({ error: error?.message || "Client not found" }, { status: 404 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Get client error:", error);
    return Response.json({ error: "Failed to get client" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isAdminUser(user);

    let existingQuery = supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", id);

    if (!isAdmin) {
      existingQuery = existingQuery.eq("user_id", user.id);
    }

    const { data: existingClient, error: existingClientError } =
      await existingQuery.maybeSingle();

    if (existingClientError || !existingClient) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    const {
      name,
      website,
      email,
      logo_url,
      user_id,
      approval_status,
      approval_notes,
      ga4_property_id,
      primary_goal,
      monthly_goal,
      average_conversion_value,
      conversion_types,
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

    const nextApprovalStatus =
      typeof approval_status === "string" ? approval_status : undefined;
    const isApproved = nextApprovalStatus === "approved";

    const { data, error } = await updateClientWithSchemaFallback(id, {
      name,
      website,
      email,
      logo_url,
      ...(isAdmin ? { user_id } : {}),
      ...(isAdmin
        ? {
            approval_status: nextApprovalStatus,
            approval_notes:
              typeof approval_notes === "string" ? approval_notes : null,
            approved_at: isApproved ? new Date().toISOString() : null,
            approved_by_user_id: isApproved ? user.id : null,
          }
        : {}),
      ga4_property_id,
      primary_goal,
      monthly_goal,
      average_conversion_value,
      conversion_types,
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
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Update client error:", error);
    return Response.json({ error: "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query = supabaseAdmin.from("clients").delete().eq("id", id);

    if (!isAdminUser(user)) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Delete client error:", error);
    return Response.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
