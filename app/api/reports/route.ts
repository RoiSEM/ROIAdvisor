import { NextRequest } from "next/server";
import { getBillingSnapshot, type BillingPlan } from "@/lib/billing";
import {
  getRequestUser,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";

const TRIAL_REPORT_LIMIT = 3;

function getMissingColumnName(message: string | undefined) {
  if (!message) return null;

  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

async function createReportWithSchemaFallback(payload: {
  client_id: string;
  month: string;
  traffic: number;
  conversions: number;
  top_pages: string[];
  notes: string;
  start_date: string;
  end_date: string;
}) {
  const insertPayload: Record<string, unknown> = { ...payload };
  const optionalColumns = new Set(["start_date", "end_date"]);

  while (true) {
    const { data, error } = await supabaseAdmin
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

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");

  if (!clientId) {
    return Response.json({ error: "client_id is required." }, { status: 400 });
  }

  const {
    user,
    error: userError,
  } = await getRequestUser(req);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let clientQuery = supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", clientId);

  if (!isAdminUser(user)) {
    clientQuery = clientQuery.eq("user_id", user.id);
  }

  const { data: client } = await clientQuery.maybeSingle();

  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
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
    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const clientId = body.client_id as string | undefined;
    let planTier: BillingPlan = "trial";
    const requestedNotes = typeof body.notes === "string" ? body.notes.trim() : "";

    const requestedStartDate = body.start_date as string | undefined;
    const requestedEndDate = body.end_date as string | undefined;

    if (!clientId) {
      return Response.json({ error: "client_id is required." }, { status: 400 });
    }

    let clientQuery = supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId);

    if (!isAdminUser(user)) {
      clientQuery = clientQuery.eq("user_id", user.id);
    }

    const { data: client } = await clientQuery.maybeSingle();

    if (!client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: billing } = await supabaseAdmin
      .from("billing_accounts")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const billingSnapshot = getBillingSnapshot(billing);

    planTier = billingSnapshot.effectivePlan;

    const allowedRange = resolveAllowedDateRange({
      hasCustomDateRangeAccess: billingSnapshot.canUseCustomDateRange,
      requestedStartDate,
      requestedEndDate,
    });

    if (!billingSnapshot.hasUnlimitedReports) {
      const { count, error: countError } = await supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      if (countError) {
        return Response.json({ error: countError.message }, { status: 500 });
      }

      const reportsUsed = count ?? 0;

      if (reportsUsed >= TRIAL_REPORT_LIMIT) {
        return Response.json(
          {
            error: `Trial accounts are limited to ${TRIAL_REPORT_LIMIT} reports per cycle. Upgrade to Pro to continue.`,
          },
          { status: 403 },
        );
      }
    }

    const traffic = Math.floor(Math.random() * 5000) + 500;
    const conversions = Math.floor(Math.random() * 100) + 5;
    const topPages = [
      "/",
      "/services",
      "/contact",
    ];

    const month = `${allowedRange.startDate} to ${allowedRange.endDate}`;
    const systemNote = billingSnapshot.canUseCustomDateRange
      ? "Custom date range applied successfully."
      : "Trial range applied automatically. Upgrade to Pro for custom dates.";
    const notes = [requestedNotes, systemNote].filter(Boolean).join("\n\n");

    const { data, error } = await createReportWithSchemaFallback({
      client_id: clientId,
      month,
      traffic,
      conversions,
      top_pages: topPages,
      notes,
      start_date: allowedRange.startDate,
      end_date: allowedRange.endDate,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { count: updatedCount } = await supabaseAdmin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    const reportsRemaining =
      !billingSnapshot.hasUnlimitedReports
        ? Math.max(TRIAL_REPORT_LIMIT - (updatedCount ?? 0), 0)
        : null;

    return Response.json(
      {
        message:
          billingSnapshot.canUseCustomDateRange
            ? `${planTier === "agency" ? "Agency" : "Pro"} report generated successfully.`
            : "Trial report generated successfully with the last 30 days applied.",
        report: data,
        reports_remaining: reportsRemaining,
        applied_range: allowedRange,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate report.";

    return Response.json({ error: message }, { status: 500 });
  }
}
