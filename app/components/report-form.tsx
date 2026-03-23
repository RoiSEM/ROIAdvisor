"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReportForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Saving report...");

    try {
      const reportRes = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          month,
          top_pages: [],
          notes,
        }),
      });

      const reportData = await reportRes.json();

      if (!reportRes.ok) {
        alert(reportData.error || "Failed to create report");
        return;
      }

      // const reportId = reportData.id;
      const reportId = reportData[0]?.id;

      setStatus("Syncing analytics...");

      const syncRes = await fetch(`/api/reports/${reportId}/sync-analytics`, {
        method: "POST",
      });

      const syncData = await syncRes.json();

      if (!syncRes.ok) {
        alert(syncData.error || "Failed to sync analytics");
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
          month,
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
        alert(aiData.error || "Failed to generate AI summary");
        return;
      }

      setMonth("");
      setNotes("");
      setStatus("");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded border p-6">
      <h2 className="text-2xl font-semibold">Add Report</h2>

      <div className="mt-4 grid gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
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
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            suppressHydrationWarning
            disabled={loading}
            className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Working..." : "Add Report"}
          </button>

          {loading && <p className="text-sm">{status}</p>}
        </div>
      </div>
    </form>
  );
}
