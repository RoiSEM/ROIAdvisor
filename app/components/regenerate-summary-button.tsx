"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  reportId: string;
  month: string | null;
  traffic: number | null;
  pageViews: number | null;
  activeUsers: number | null;
  bounceRate: number | null;
  engagementRate: number | null;
  conversions: number | null;
  notes: string | null;
};

export default function RegenerateSummaryButton({
  reportId,
  month,
  traffic,
  pageViews,
  activeUsers,
  bounceRate,
  engagementRate,
  conversions,
  notes,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    setLoading(true);

    const res = await fetch("/api/ai-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportId,
        month,
        traffic,
        pageViews,
        activeUsers,
        bounceRate,
        engagementRate,
        conversions,
        notes,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to regenerate summary");
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleRegenerate}
      disabled={loading}
      className="mt-3 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
    >
      {loading ? "Regenerating..." : "Regenerate Summary"}
    </button>
  );
}
