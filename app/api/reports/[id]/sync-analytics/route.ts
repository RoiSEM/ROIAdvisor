import { supabase } from "@/lib/supabase-server";
import { getGA4Report } from "@/lib/analytics/ga4";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, client_id")
      .eq("id", id)
      .single();

    if (reportError || !report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, ga4_property_id")
      .eq("id", report.client_id)
      .single();

    if (clientError || !client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.ga4_property_id) {
      return Response.json(
        { error: "Missing GA4 property ID" },
        { status: 400 },
      );
    }

    const { traffic, pageViews, activeUsers, bounceRate, engagementRate, conversions } = await getGA4Report(client.ga4_property_id);

    const { error: updateError } = await supabase
      .from("reports")
      .update({
        traffic,
        page_views: pageViews,
        active_users: activeUsers,
        bounce_rate: bounceRate,
        engagement_rate: engagementRate,
        conversions,
        analytics_synced_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return Response.json(
        { error: "Failed to update report analytics" },
        { status: 500 },
      );
    }

    return Response.json({ success: true, traffic, pageViews, activeUsers, bounceRate, engagementRate, conversions });
  } catch (error) {
    console.error("Sync analytics error:", error);
    return Response.json(
      { error: "Failed to sync analytics" },
      { status: 500 },
    );
  }
}
