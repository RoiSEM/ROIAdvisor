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
