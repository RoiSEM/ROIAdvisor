"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCw } from "lucide-react";

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
  className?: string;
  iconOnly?: boolean;
};

export default function GenerateSummaryButton({
  reportId,
  month,
  traffic,
  pageViews,
  activeUsers,
  bounceRate,
  engagementRate,
  conversions,
  notes,
  className = "",
  iconOnly = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
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
      alert(data.error || "Failed to generate summary");
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      aria-label={loading ? "Generating summary" : "Generate AI summary"}
      title={loading ? "Generating summary" : "Generate AI summary"}
      className={
        iconOnly
          ? `inline-flex items-center justify-center disabled:opacity-50 ${className}`.trim()
          : `rounded bg-black px-4 py-2 text-white disabled:opacity-50 ${className}`.trim()
      }
    >
      {iconOnly ? (
        <RotateCw
          size={18}
          className={loading ? "animate-spin" : undefined}
          aria-hidden="true"
        />
      ) : loading ? (
        "Generating..."
      ) : (
        "Generate AI Summary"
      )}
    </button>
  );
}
