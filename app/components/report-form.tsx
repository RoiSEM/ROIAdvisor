"use client";

import { ReportDatePicker } from "@/components/calendar";
import ServiceCta from "@/components/service-cta";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AccountPlan = "free" | "starter" | "pro" | "agency";

type UploadedAnalytics = {
  traffic: number;
  pageViews: number;
  activeUsers: number;
  bounceRate: number;
  engagementRate: number;
  conversions: number;
  channelPerformance: Array<Record<string, string | number>>;
  landingPagePerformance: Array<Record<string, string | number>>;
  devicePerformance: Array<Record<string, string | number>>;
  keyEventPerformance: Array<Record<string, string | number>>;
};

const emptyUploadedAnalytics: UploadedAnalytics = {
  traffic: 0,
  pageViews: 0,
  activeUsers: 0,
  bounceRate: 0,
  engagementRate: 0,
  conversions: 0,
  channelPerformance: [],
  landingPagePerformance: [],
  devicePerformance: [],
  keyEventPerformance: [],
};

function planTone(plan: AccountPlan) {
  if (plan === "free") {
    return "text-slate-700";
  }

  if (plan === "starter") {
    return "text-amber-600";
  }

  return "text-green-600";
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"" && nextChar === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);

    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseMetricValue(value: string | undefined) {
  if (!value) return 0;

  const isPercent = value.includes("%");
  const cleaned = value.replace(/[$,%\s]/g, "");
  const number = Number(cleaned);

  if (!Number.isFinite(number)) return 0;
  return isPercent ? number / 100 : number;
}

function getFirstMetric(row: Record<string, string>, keys: string[]) {
  const entry = Object.entries(row).find(([key]) => {
    const normalized = normalizeKey(key);
    return keys.some((candidate) => normalized.includes(candidate));
  });

  return parseMetricValue(entry?.[1]);
}

function getFirstText(row: Record<string, string>, keys: string[]) {
  const entry = Object.entries(row).find(([key]) => {
    const normalized = normalizeKey(key);
    return keys.some((candidate) => normalized.includes(candidate));
  });

  return entry?.[1]?.trim() || "";
}

function metricToInput(value: number) {
  return value ? String(value) : "";
}

function percentToInput(value: number) {
  return value ? String((value * 100).toFixed(1)) : "";
}

function isBreakdownRow(
  value: Record<string, string | number> | null,
): value is Record<string, string | number> {
  return Boolean(value);
}

function detectUploadedAnalytics(rows: Array<Record<string, string>>) {
  const totals = rows.reduce<UploadedAnalytics>(
    (acc, row) => {
      acc.traffic += getFirstMetric(row, ["sessions", "users", "totalusers"]);
      acc.pageViews += getFirstMetric(row, ["views", "screenpageviews", "pageviews"]);
      acc.activeUsers += getFirstMetric(row, ["activeusers"]);
      acc.conversions += getFirstMetric(row, ["conversions", "keyevents"]);

      return acc;
    },
    { ...emptyUploadedAnalytics },
  );

  const firstRow = rows[0] || {};
  const bounceRate = getFirstMetric(firstRow, ["bouncerate"]);
  const engagementRate = getFirstMetric(firstRow, ["engagementrate"]);

  return {
    ...totals,
    bounceRate: bounceRate > 1 ? bounceRate / 100 : bounceRate,
    engagementRate: engagementRate > 1 ? engagementRate / 100 : engagementRate,
    channelPerformance: rows
      .map<Record<string, string | number> | null>((row) => {
        const channel = getFirstText(row, [
          "sessiondefaultchannelgroup",
          "defaultchannelgroup",
          "channel",
          "source",
          "medium",
        ]);

        if (!channel) return null;

        return {
          channel,
          sessions: getFirstMetric(row, ["sessions"]),
          conversions: getFirstMetric(row, ["conversions", "keyevents"]),
        };
      })
      .filter(isBreakdownRow)
      .slice(0, 8),
    landingPagePerformance: rows
      .map<Record<string, string | number> | null>((row) => {
        const landingPage = getFirstText(row, [
          "landingpage",
          "pagepath",
          "pagepathscreenclass",
          "page",
        ]);

        if (!landingPage) return null;

        return {
          landingPage,
          sessions: getFirstMetric(row, ["sessions"]),
          conversions: getFirstMetric(row, ["conversions", "keyevents"]),
        };
      })
      .filter(isBreakdownRow)
      .slice(0, 8),
    devicePerformance: rows
      .map<Record<string, string | number> | null>((row) => {
        const device = getFirstText(row, ["devicecategory", "device"]);

        if (!device) return null;

        return {
          device,
          sessions: getFirstMetric(row, ["sessions"]),
          conversions: getFirstMetric(row, ["conversions", "keyevents"]),
        };
      })
      .filter(isBreakdownRow)
      .slice(0, 8),
    keyEventPerformance: rows
      .map<Record<string, string | number> | null>((row) => {
        const eventName = getFirstText(row, [
          "eventname",
          "keyevent",
          "keyeventname",
          "conversionevent",
          "conversionname",
        ]);

        if (!eventName) return null;

        return {
          eventName,
          keyEvents: getFirstMetric(row, ["keyevents", "conversions"]),
        };
      })
      .filter(isBreakdownRow)
      .slice(0, 10),
  };
}

function formatPlanLabel(plan: AccountPlan) {
  if (plan === "free") {
    return "Free";
  }

  if (plan === "starter") {
    return "Starter";
  }

  return plan.toUpperCase();
}

export default function ReportForm({ clientId }: { clientId: string }) {
  const router = useRouter();

  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, []);

  const [billingPlan, setBillingPlan] = useState<AccountPlan>("free");
  const [canUseCustomDateRange, setCanUseCustomDateRange] = useState(false);
  const [dateRange, setDateRange] = useState(defaultRange);
  const [notes, setNotes] = useState("");
  const [useUploadedAnalytics, setUseUploadedAnalytics] = useState(false);
  const [uploadedAnalytics, setUploadedAnalytics] = useState<UploadedAnalytics>(
    emptyUploadedAnalytics,
  );
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    async function loadBilling() {
      try {
        const res = await fetch("/api/billing");
        const data = (await res.json()) as {
          plan?: AccountPlan;
          can_use_custom_date_range?: boolean;
        };

        if (!res.ok) {
          return;
        }

        if (data.plan) {
          setBillingPlan(data.plan);
        }

        setCanUseCustomDateRange(Boolean(data.can_use_custom_date_range));
      } catch (error) {
        console.error("Failed to load billing for report form", error);
      }
    }

    loadBilling();
  }, []);

  async function handleAnalyticsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Please upload a CSV file.");
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        setErrorMessage("No usable rows were found in that CSV.");
        return;
      }

      setUploadedAnalytics(detectUploadedAnalytics(rows));
      setUploadedFileName(file.name);
      setUseUploadedAnalytics(true);
      setErrorMessage("");
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to read the uploaded CSV.");
    }
  }

  function updateUploadedMetric(
    key: keyof Pick<
      UploadedAnalytics,
      | "traffic"
      | "pageViews"
      | "activeUsers"
      | "bounceRate"
      | "engagementRate"
      | "conversions"
    >,
    value: string,
    isPercent = false,
  ) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0;

    setUploadedAnalytics((current) => ({
      ...current,
      [key]: isPercent ? safeValue / 100 : safeValue,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setStatus("Creating report...");

    try {
      const reportRes = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          notes,
          analytics_source: useUploadedAnalytics ? "upload" : "ga4",
          uploaded_analytics: useUploadedAnalytics ? uploadedAnalytics : null,
        }),
      });

      const reportData = await reportRes.json();

      if (!reportRes.ok) {
        setErrorMessage(reportData.error || "Failed to create report");
        return;
      }

      const reportId = reportData?.report?.id;

      if (!reportId) {
        setErrorMessage("Report created but no report ID was returned.");
        return;
      }

      let reportMetrics = {
        traffic: uploadedAnalytics.traffic,
        pageViews: uploadedAnalytics.pageViews,
        activeUsers: uploadedAnalytics.activeUsers,
        bounceRate: uploadedAnalytics.bounceRate,
        engagementRate: uploadedAnalytics.engagementRate,
        conversions: uploadedAnalytics.conversions,
        channelPerformance: uploadedAnalytics.channelPerformance,
        landingPagePerformance: uploadedAnalytics.landingPagePerformance,
        devicePerformance: uploadedAnalytics.devicePerformance,
        keyEventPerformance: uploadedAnalytics.keyEventPerformance,
      };

      if (!useUploadedAnalytics) {
        setStatus("Syncing analytics...");

        const syncRes = await fetch(`/api/reports/${reportId}/sync-analytics`, {
          method: "POST",
        });

        const syncData = await syncRes.json();

        if (!syncRes.ok) {
          setErrorMessage(syncData.error || "Failed to sync analytics");
          return;
        }

        reportMetrics = syncData;
      }

      setStatus("Generating AI summary...");

      const aiRes = await fetch("/api/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId,
          month: reportData?.report?.month ?? null,
          traffic: reportMetrics.traffic,
          pageViews: reportMetrics.pageViews,
          activeUsers: reportMetrics.activeUsers,
          bounceRate: reportMetrics.bounceRate,
          engagementRate: reportMetrics.engagementRate,
          conversions: reportMetrics.conversions,
          channelPerformance: reportMetrics.channelPerformance,
          landingPagePerformance: reportMetrics.landingPagePerformance,
          devicePerformance: reportMetrics.devicePerformance,
          keyEventPerformance: reportMetrics.keyEventPerformance,
          notes,
        }),
      });

      const aiData = await aiRes.json();

      if (!aiRes.ok) {
        setErrorMessage(aiData.error || "Failed to generate AI summary");
        return;
      }

      setNotes("");
      setUseUploadedAnalytics(false);
      setUploadedAnalytics(emptyUploadedAnalytics);
      setUploadedFileName("");
      setStatus("");
      setSuccessMessage(reportData.message || "Report generated successfully.");
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded border p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Generate report</h2>
          <p className="mt-1 text-sm text-slate-600">
            Build a fresh report for this client, then sync analytics and AI insights automatically.
          </p>
        </div>
        <div className="text-sm text-slate-600">
          Current Plan:{" "}
          <span
            className={`font-semibold ${planTone(billingPlan)}`}
          >
            {formatPlanLabel(billingPlan)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <ReportDatePicker
          isPro={canUseCustomDateRange}
          value={dateRange}
          onChange={setDateRange}
          onUpgradeClick={() => router.push("/pricing")}
        />

        {isHydrated && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  Upload analytics CSV
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Optional. Upload a GA4-style CSV to generate this report from
                  imported metrics instead of syncing GA4.
                </p>
              </div>
              <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                Choose CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleAnalyticsUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {uploadedFileName && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Using uploaded analytics
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {uploadedFileName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUseUploadedAnalytics(false);
                      setUploadedAnalytics(emptyUploadedAnalytics);
                      setUploadedFileName("");
                    }}
                    className="w-fit rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50"
                  >
                    Use GA4 sync instead
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Traffic
                    </label>
                    <input
                      type="number"
                      value={metricToInput(uploadedAnalytics.traffic)}
                      onChange={(e) =>
                        updateUploadedMetric("traffic", e.target.value)
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Page Views
                    </label>
                    <input
                      type="number"
                      value={metricToInput(uploadedAnalytics.pageViews)}
                      onChange={(e) =>
                        updateUploadedMetric("pageViews", e.target.value)
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Active Users
                    </label>
                    <input
                      type="number"
                      value={metricToInput(uploadedAnalytics.activeUsers)}
                      onChange={(e) =>
                        updateUploadedMetric("activeUsers", e.target.value)
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Bounce Rate %
                    </label>
                    <input
                      type="number"
                      value={percentToInput(uploadedAnalytics.bounceRate)}
                      onChange={(e) =>
                        updateUploadedMetric("bounceRate", e.target.value, true)
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Engagement Rate %
                    </label>
                    <input
                      type="number"
                      value={percentToInput(uploadedAnalytics.engagementRate)}
                      onChange={(e) =>
                        updateUploadedMetric(
                          "engagementRate",
                          e.target.value,
                          true,
                        )
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Conversions
                    </label>
                    <input
                      type="number"
                      value={metricToInput(uploadedAnalytics.conversions)}
                      onChange={(e) =>
                        updateUploadedMetric("conversions", e.target.value)
                      }
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs leading-6 text-slate-500">
                  Review these detected metrics before generating. Channel,
                  landing page, and device rows are included automatically when
                  the CSV contains matching columns.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Blog content added, homepage updated, new ads launched..."
            rows={4}
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional context for this reporting period, such as site changes, campaigns, or offers.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {successMessage}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            suppressHydrationWarning
            disabled={loading}
            className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Working..." : "Generate Report"}
          </button>

          {loading && <p className="text-sm">{status}</p>}
        </div>

        <ServiceCta variant="trackingConfidence" />
      </div>
    </form>
  );
}
