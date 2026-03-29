"use client";

import { ReportDatePicker } from "@/components/calendar";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AccountPlan = "free" | "starter" | "pro" | "agency";

function planTone(plan: AccountPlan) {
  if (plan === "free") {
    return "text-slate-700";
  }

  if (plan === "starter") {
    return "text-amber-600";
  }

  return "text-green-600";
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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

      setStatus("Syncing analytics...");

      const syncRes = await fetch(`/api/reports/${reportId}/sync-analytics`, {
        method: "POST",
      });

      const syncData = await syncRes.json();

      if (!syncRes.ok) {
        setErrorMessage(syncData.error || "Failed to sync analytics");
        return;
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
          traffic: syncData.traffic,
          pageViews: syncData.pageViews,
          activeUsers: syncData.activeUsers,
          bounceRate: syncData.bounceRate,
          engagementRate: syncData.engagementRate,
          conversions: syncData.conversions,
          notes,
        }),
      });

      const aiData = await aiRes.json();

      if (!aiRes.ok) {
        setErrorMessage(aiData.error || "Failed to generate AI summary");
        return;
      }

      setNotes("");
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
      </div>
    </form>
  );
}
