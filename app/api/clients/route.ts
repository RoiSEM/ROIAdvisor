import { supabase } from "@/lib/supabase-server";

export async function GET() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(req: Request) {
  try {
    const {
      name,
      website,
      email,
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

    const { data, error } = await supabase
      .from("clients")
      .insert([
        {
          name,
          website,
          email,
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
