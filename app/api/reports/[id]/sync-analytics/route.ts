import { getRequestUser, isAdminUser, supabaseAdmin } from "@/lib/supabase-server";
import { GoogleAnalyticsConfigError, getGA4Report } from "@/lib/analytics/ga4";

function getMissingColumnName(message: string | undefined) {
  if (!message) return null;

  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

async function updateReportAnalyticsWithSchemaFallback(reportId: string, payload: {
  traffic: number;
  page_views: number;
  active_users: number;
  bounce_rate: number;
  engagement_rate: number;
  conversions: number;
  analytics_synced_at: string;
}) {
  const updatePayload: Record<string, unknown> = { ...payload };
  const optionalColumns = new Set(["analytics_synced_at"]);

  while (true) {
    const { error } = await supabaseAdmin
      .from("reports")
      .update(updatePayload)
      .eq("id", reportId);

    if (!error) {
      return null;
    }

    const missingColumn = getMissingColumnName(error.message);

    if (!missingColumn || !optionalColumns.has(missingColumn)) {
      return error;
    }

    delete updatePayload[missingColumn];
    optionalColumns.delete(missingColumn);
  }
}

async function getReportForAnalytics(reportId: string) {
  let selectedColumns = "id, client_id, start_date, end_date";

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select(selectedColumns)
      .eq("id", reportId)
      .single();

    if (!error) {
      return { data, error: null };
    }

    const missingColumn = getMissingColumnName(error.message);

    if (
      missingColumn &&
      (missingColumn === "start_date" || missingColumn === "end_date")
    ) {
      selectedColumns = "id, client_id";
      continue;
    }

    return { data: null, error };
  }
}

type AnalyticsReportRecord = {
  id: string;
  client_id: string;
  start_date?: string | null;
  end_date?: string | null;
};

export async function POST(
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

    const { data: report, error: reportError } = await getReportForAnalytics(id);

    if (reportError || !report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const analyticsReport = report as unknown as AnalyticsReportRecord;

    let clientQuery = supabaseAdmin
      .from("clients")
      .select("id, ga4_property_id")
      .eq("id", analyticsReport.client_id);

    if (!isAdminUser(user)) {
      clientQuery = clientQuery.eq("user_id", user.id);
    }

    const { data: client, error: clientError } = await clientQuery.maybeSingle();

    if (clientError || !client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.ga4_property_id) {
      return Response.json(
        { error: "Missing GA4 property ID" },
        { status: 400 },
      );
    }

    const { traffic, pageViews, activeUsers, bounceRate, engagementRate, conversions } =
      await getGA4Report(client.ga4_property_id, {
        startDate: analyticsReport.start_date ?? null,
        endDate: analyticsReport.end_date ?? null,
      });

    const updateError = await updateReportAnalyticsWithSchemaFallback(id, {
      traffic,
      page_views: pageViews,
      active_users: activeUsers,
      bounce_rate: bounceRate,
      engagement_rate: engagementRate,
      conversions,
      analytics_synced_at: new Date().toISOString(),
    });

    if (updateError) {
      return Response.json(
        { error: "Failed to update report analytics" },
        { status: 500 },
      );
    }

    return Response.json({ success: true, traffic, pageViews, activeUsers, bounceRate, engagementRate, conversions });
  } catch (error) {
    console.error("Sync analytics error:", error);

    if (error instanceof GoogleAnalyticsConfigError) {
      return Response.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return Response.json(
      { error: "Failed to sync analytics" },
      { status: 500 },
    );
  }
}
