import { supabase } from "@/lib/supabase-server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

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
      .update({
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
      })
      .eq("id", id)
      .select()
      .single();

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

    const { data, error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Delete client error:", error);
    return Response.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
