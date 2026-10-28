"use client";

import { ReportDatePicker } from "@/components/calendar";
import ServiceCta from "@/components/service-cta";
import { parseAnalyticsCsv, MAX_CSV_BYTES, type UploadedAnalytics } from "@/lib/analytics-csv";
import { hasValidReportMetrics } from "@/lib/report-metrics";
import { planDisplayName } from "@/lib/pricing";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type AccountPlan = "free" | "starter" | "pro" | "agency";

const emptyUploadedAnalytics: UploadedAnalytics = {
  traffic: null,
  pageViews: null,
  activeUsers: null,
  bounceRate: null,
  engagementRate: null,
  conversions: null,
  channelPerformance: [],
  landingPagePerformance: [],
  devicePerformance: [],
  keyEventPerformance: [],
};

function planTone(plan: AccountPlan) {
  if (plan === "free") {
    return "text-slate-700 dark:text-slate-300";
  }

  if (plan === "starter") {
    return "text-amber-600 dark:text-amber-300";
  }

  return "text-green-600 dark:text-green-300";
}

function metricToInput(value: number | null) {
  return value !== null && Number.isFinite(value) ? String(value) : "";
}

function percentToInput(value: number | null) {
  return value !== null && Number.isFinite(value) ? String((value * 100).toFixed(1)) : "";
}

function formatPlanLabel(plan: AccountPlan) {
  return planDisplayName(plan);
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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadProblem, setUploadProblem] = useState("");
  // Synchronous guard also covers submissions before React's next render.
  const uploadGuard = useRef({ version: 0, pending: false, invalid: false, editErrors: new Set<string>() });

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

  function chooseAnalyticsSync() {
    uploadGuard.current.version++;
    uploadGuard.current.pending = false;
    uploadGuard.current.invalid = false;
    uploadGuard.current.editErrors.clear();
    setUploadPending(false);
    setUploadProblem("");
    setErrorMessage("");
    setUseUploadedAnalytics(false);
    setUploadedAnalytics(emptyUploadedAnalytics);
    setUploadedFileName("");
  }

  async function handleAnalyticsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    const version = ++uploadGuard.current.version;
    uploadGuard.current.pending = Boolean(file);
    uploadGuard.current.invalid = false;
    uploadGuard.current.editErrors.clear();
    setUseUploadedAnalytics(false);
    setUploadedAnalytics(emptyUploadedAnalytics);
    setUploadedFileName("");
    setUploadProblem("");
    setErrorMessage("");
    setUploadPending(Boolean(file));
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a CSV file containing Sessions and Conversions (or Key Events).");
      if (file.size > MAX_CSV_BYTES) throw new Error("CSV size limit exceeded: maximum 5MB.");
      const text = await file.text();
      if (version !== uploadGuard.current.version) return;
      const parsed = parseAnalyticsCsv(text);
      if (!hasValidReportMetrics(parsed)) throw new Error("CSV is missing valid Sessions and Conversions.");
      setUploadedAnalytics(parsed);
      setUploadedFileName(file.name);
      setUseUploadedAnalytics(true);
    } catch (error: unknown) {
      if (version !== uploadGuard.current.version) return;
      const message = error instanceof Error ? error.message : "Unable to read this CSV. Try exporting it again.";
      uploadGuard.current.invalid = true;
      setUploadProblem(message);
      setErrorMessage(message);
    } finally {
      if (version === uploadGuard.current.version) {
        uploadGuard.current.pending = false;
        setUploadPending(false);
        input.value = ""; // Allows selecting the same corrected file again.
      }
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
    uploadGuard.current.editErrors.delete(key);
    if (value.trim() === "") {
      setUploadedAnalytics((current) => ({ ...current, [key]: null }));
      return;
    }
    const parsed = Number(value);
    const invalid = !Number.isFinite(parsed) || parsed < 0 || (isPercent && parsed > 100);
    if (invalid) {
      uploadGuard.current.editErrors.add(key);
      setErrorMessage("Counts must be non-negative numbers and percentages must be between 0 and 100.");
    }
    setUploadedAnalytics((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? (isPercent ? parsed / 100 : parsed) : null,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploadGuard.current.pending || uploadGuard.current.invalid || uploadGuard.current.editErrors.size) {
      setErrorMessage(uploadGuard.current.pending
        ? "Wait for the CSV to finish loading."
        : "Correct the uploaded file or its measurements, or explicitly choose GA4 sync instead.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setStatus("Creating report...");
    let reportWasSaved = false;

    try {
      if (useUploadedAnalytics && !hasValidReportMetrics(uploadedAnalytics)) {
        setErrorMessage("Uploaded analytics lacks required valid Sessions and Conversions.");
        setLoading(false);
        setStatus("");
        return;
      }

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

      reportWasSaved = true;
      const reportId = reportData?.report?.id;

      if (!reportId) {
        setErrorMessage("Report created but no report ID was returned.");
        return;
      }

      setStatus("Generating AI summary...");

      const aiRes = await fetch("/api/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId }),
      });

      const aiData = await aiRes.json();

      if (!aiRes.ok) {
        setErrorMessage(`Report saved. ${aiData.error || "The AI summary could not be generated."} Retry the AI summary on the saved report instead of generating another report.`);
        return;
      }

      setSuccessMessage(reportData.message || "Report generated successfully.");
    } catch {
      setErrorMessage(reportWasSaved
        ? "Report saved. Retry the AI summary on the saved report instead of generating another report."
        : "Something went wrong. Check your reports before trying again.");
    } finally {
      if (reportWasSaved) {
        setNotes("");
        setUseUploadedAnalytics(false);
        setUploadedAnalytics(emptyUploadedAnalytics);
        setUploadedFileName("");
        router.refresh();
      }
      setLoading(false);
      setStatus("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded border p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Generate report</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Load analytics or validate your CSV, then generate insights from the saved report.
          </p>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                Upload analytics CSV
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Upload a comma-separated CSV instead of connecting Analytics. Include <code>Sessions</code> and <code>Conversions</code> (or <code>Key Events</code>). Views, Active Users, Bounce Rate, and Engagement Rate are optional.
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Use one summary row or a complete table grouped by Channel, Landing Page, or Device—not a mix. Limits: 5 MB and 10,000 rows. Rates must use a percent sign (40%) or a decimal (0.4). Unsupported exports are rejected rather than guessed.
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Export the same dates selected above; dates are not detected from the CSV. Missing optional values stay blank. Active users are left unknown when they cannot be totaled reliably.
              </p>
            </div>
            <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleAnalyticsUpload}
                className="sr-only"
              />
            </label>
          </div>

          {uploadPending && <p role="status" className="mt-3 text-sm">Reading CSV…</p>}
          {uploadProblem && (
            <div className="mt-3 text-sm">
              <p>{uploadProblem}</p>
              <button type="button" onClick={chooseAnalyticsSync} className="mt-2 rounded border px-3 py-2">Use GA4 sync instead</button>
            </div>
          )}
          {uploadedFileName && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    Using uploaded analytics
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {uploadedFileName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={chooseAnalyticsSync}
                  className="w-fit rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Use GA4 sync instead
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Traffic (Sessions)
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
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
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

              <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                Review these detected metrics before generating. Channel,
                landing page, and device rows are included automatically when
                the CSV contains matching columns. Blank means unknown.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Blog content added, homepage updated, new ads launched..."
            rows={4}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Optional context for this reporting period, such as site changes, campaigns, or offers.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
            {successMessage}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            suppressHydrationWarning
            disabled={loading || uploadPending}
            className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950"
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
