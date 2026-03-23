"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncAnalyticsButton({
  reportId,
}: {
  reportId: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);

    try {
      const res = await fetch(`/api/reports/${reportId}/sync-analytics`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to sync analytics");
        return;
      }

      router.refresh(); // refresh data on page
    } catch (error) {
      console.error(error);
      alert("Failed to sync analytics");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={loading}
      className="mt-3 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
    >
      {loading ? "Syncing..." : "Sync Analytics"}
    </button>
  );
}
