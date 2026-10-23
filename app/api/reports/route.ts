import { appData } from "@/lib/data-store";
import { NextRequest } from "next/server";
import { getBillingSnapshot, type AccountPlan } from "@/lib/billing";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";
import { getGA4Report } from "@/lib/analytics/ga4";
import { hasValidReportMetrics } from "@/lib/report-metrics";
import { writeConnectionProof } from "@/lib/connection-proof";

import { getReportAllowance, withUsage } from "@/lib/usage";

function getMissingColumnName(message: string | undefined) {
  if (!message) return null;

  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

async function createReportWithSchemaFallback(payload: {
  client_id: string;
  month: string;
  traffic: number;
  page_views?: number;
  active_users?: number;
  bounce_rate?: number;
  engagement_rate?: number;
  conversions: number;
  channel_performance?: unknown;
  landing_page_performance?: unknown;
  device_performance?: unknown;
  key_event_performance?: unknown;
  top_pages: string[];
  notes: string;
  start_date: string;
  end_date: string;
}) {
  const insertPayload: Record<string, unknown> = { ...payload };
  const optionalColumns = new Set([
    "start_date",
    "end_date",
    "page_views",
    "active_users",
    "bounce_rate",
    "engagement_rate",
    "channel_performance",
    "landing_page_performance",
    "device_performance",
    "key_event_performance",
  ]);

  while (true) {
    const { data, error } = await appData
      .from("reports")
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

function formatDateForInput(date: Date) {
  return date.toISOString().split("T")[0];
}

function getTrialDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    startDate: formatDateForInput(start),
    endDate: formatDateForInput(end),
  };
}

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function resolveAllowedDateRange({
  hasCustomDateRangeAccess,
  requestedStartDate,
  requestedEndDate,
}: {
  hasCustomDateRangeAccess: boolean;
  requestedStartDate?: string;
  requestedEndDate?: string;
}) {
  if (!hasCustomDateRangeAccess) {
    return getTrialDateRange();
  }

  if (!requestedStartDate || !requestedEndDate) {
    throw new Error("Start date and end date are required for Pro reports.");
  }

  if (!isValidDate(requestedStartDate) || !isValidDate(requestedEndDate)) {
    throw new Error("Invalid date range provided.");
  }

  if (new Date(requestedStartDate) > new Date(requestedEndDate)) {
    throw new Error("Start date cannot be after end date.");
  }

  return {
    startDate: requestedStartDate,
    endDate: requestedEndDate,
  };
}

function isClientApproved(status: string | null | undefined) {
  return (status ?? "pending").toLowerCase() === "approved";
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");

  if (!clientId) {
    return Response.json({ error: "client_id is required." }, { status: 400 });
  }

  const { user, error: userError } = await getRequestUser(req);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let clientQuery = appData.from("clients").select("id").eq("id", clientId);

  if (!isAdminUser(user)) {
    clientQuery = clientQuery.eq("user_id", user.id);
  }

  const { data: client } = await clientQuery.maybeSingle();

  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  const { data, error } = await appData
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(req: Request) {
  try {
    const { user, error: userError } = await getRequestUser(req);

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const clientId = body.client_id as string | undefined;
    let planTier: AccountPlan = "free";
    const requestedNotes =
      typeof body.notes === "string" ? body.notes.trim() : "";
    const uploadedAnalytics =
      body.analytics_source === "upload" ? body.uploaded_analytics : null;
    if (
      body.analytics_source === "upload" &&
      !hasValidReportMetrics(uploadedAnalytics)
    ) {
      return Response.json(
        {
          error:
            "Upload must include valid non-negative traffic and conversion measurements. Rates must be between 0 and 1.",
        },
        { status: 400 },
      );
    }

    const requestedStartDate = body.start_date as string | undefined;
    const requestedEndDate = body.end_date as string | undefined;

    if (!clientId) {
      return Response.json(
        { error: "client_id is required." },
        { status: 400 },
      );
    }

    let clientQuery = appData
      .from("clients")
      .select("id, user_id, approval_status, ga4_property_id")
      .eq("id", clientId);

    if (!isAdminUser(user)) {
      clientQuery = clientQuery.eq("user_id", user.id);
    }

    const { data: client } = await clientQuery.maybeSingle();

    if (!client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    if (!isClientApproved(client.approval_status)) {
      return Response.json(
        {
          error:
            "This website is still pending approval. Reports unlock after analytics access is confirmed and an admin approves the site.",
        },
        { status: 403 },
      );
    }

    return await withUsage(user.id, "report", async () => {
      const { data: billing, error: billingError } = await appData
        .from("billing_accounts")
        .select("plan, status")
        .eq("user_id", client.user_id ?? user.id)
        .maybeSingle();

      if (billingError) {
        return Response.json(
          { error: "Unable to verify account access. Try again shortly." },
          { status: 503 },
        );
      }

      const billingSnapshot = getBillingSnapshot(billing);

      planTier = billingSnapshot.effectivePlan;

      const allowedRange = resolveAllowedDateRange({
        hasCustomDateRangeAccess: billingSnapshot.canUseCustomDateRange,
        requestedStartDate,
        requestedEndDate,
      });

      // This precheck avoids provider work when already at quota. The database
      // trigger performs the final atomic check and records usage with the insert.
      const allowance = await getReportAllowance(clientId);
      if (allowance.remaining === 0) {
        return Response.json(
          {
            error: `This website has used its ${allowance.limit} reports for this calendar month. Upgrade to Pro for unlimited reports.`,
          },
          { status: 403 },
        );
      }

      // Acquire real data before inserting: a failed sync must not leave a
      // customer-visible report with placeholder metrics or consume a report slot.
      let analytics = uploadedAnalytics;
      if (!analytics) {
        if (!client.ga4_property_id) {
          return Response.json(
            { error: "Connect Google Analytics before running this report." },
            { status: 400 },
          );
        }
        try {
          analytics = await getGA4Report(client.ga4_property_id, allowedRange);
        } catch {
          return Response.json(
            {
              error:
                "Unable to load Google Analytics. No report was saved. Check access and try again.",
            },
            { status: 502 },
          );
        }
      }
      if (!hasValidReportMetrics(analytics)) {
        return Response.json(
          {
            error:
              "Analytics returned incomplete or invalid measurements. No report was saved.",
          },
          { status: 502 },
        );
      }
      const traffic = analytics.traffic;
      const conversions = analytics.conversions;
      const pageViews =
        typeof analytics.pageViews === "number"
          ? analytics.pageViews
          : undefined;
      const activeUsers =
        typeof analytics.activeUsers === "number"
          ? analytics.activeUsers
          : undefined;
      const bounceRate =
        typeof analytics.bounceRate === "number"
          ? analytics.bounceRate
          : undefined;
      const engagementRate =
        typeof analytics.engagementRate === "number"
          ? analytics.engagementRate
          : undefined;
      const channelPerformance = Array.isArray(analytics.channelPerformance)
        ? analytics.channelPerformance
        : undefined;
      const landingPagePerformance = Array.isArray(
        analytics.landingPagePerformance,
      )
        ? analytics.landingPagePerformance
        : undefined;
      const devicePerformance = Array.isArray(analytics.devicePerformance)
        ? analytics.devicePerformance
        : undefined;
      const keyEventPerformance = Array.isArray(analytics.keyEventPerformance)
        ? analytics.keyEventPerformance
        : undefined;
      const topPages = Array.isArray(landingPagePerformance)
        ? landingPagePerformance
            .map((item) =>
              item && typeof item === "object" && "landingPage" in item
                ? String(item.landingPage)
                : null,
            )
            .filter((item): item is string => Boolean(item))
            .slice(0, 5)
        : [];

      const month = `${allowedRange.startDate} to ${allowedRange.endDate}`;
      const systemNote = billingSnapshot.canUseCustomDateRange
        ? "Custom date range applied successfully."
        : planTier === "starter"
          ? "Starter range applied automatically. Upgrade to Pro for custom dates."
          : "Free range applied automatically. Choose Starter or upgrade for custom dates.";
      const uploadNote = uploadedAnalytics
        ? "Analytics metrics were imported from an uploaded CSV."
        : "";
      const notes = writeConnectionProof(
        [requestedNotes, uploadNote, systemNote].filter(Boolean).join("\n\n"),
        {
          source: uploadedAnalytics ? "upload" : "ga4",
          propertyId: uploadedAnalytics ? null : client.ga4_property_id,
          verifiedAt: new Date().toISOString(),
        },
      );

      const { data, error } = await createReportWithSchemaFallback({
        client_id: clientId,
        month,
        traffic,
        page_views: pageViews,
        active_users: activeUsers,
        bounce_rate: bounceRate,
        engagement_rate: engagementRate,
        conversions,
        channel_performance: channelPerformance,
        landing_page_performance: landingPagePerformance,
        device_performance: devicePerformance,
        key_event_performance: keyEventPerformance,
        top_pages: topPages,
        notes,
        start_date: allowedRange.startDate,
        end_date: allowedRange.endDate,
      });

      if (error) {
        if (
          error.code === "REPORT_LIMIT" ||
          (error.code === "P0001" && error.message === "REPORT_QUOTA_EXCEEDED")
        ) {
          return Response.json(
            {
              error:
                "This website has reached its report limit for this calendar month.",
            },
            { status: 403 },
          );
        }
        return Response.json(
          { error: "Unable to save report. Try again shortly." },
          { status: 500 },
        );
      }

      // A failed post-commit meter read must not turn a saved report into a failed
      // request that encourages duplicate creation. Unknown is not unlimited.
      const updatedAllowance = await getReportAllowance(clientId).catch(
        () => null,
      );

      return Response.json(
        {
          message: billingSnapshot.canUseCustomDateRange
            ? `${planTier === "agency" ? "Agency" : "Pro"} report generated successfully.`
            : planTier === "starter"
              ? "Starter report generated successfully with the last 30 days applied."
              : "Free report generated successfully with the last 30 days applied.",
          report: data,
          reports_remaining: updatedAllowance?.remaining ?? null,
          usage_remaining_known: updatedAllowance !== null,
          applied_range: allowedRange,
          analytics_source: uploadedAnalytics ? "upload" : "ga4",
        },
        { status: 201 },
      );
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate report.";

    return Response.json({ error: message }, { status: 500 });
  }
}
