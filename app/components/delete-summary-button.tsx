"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export default function DeleteReportButton({
  reportId,
  reportMonth,
}: {
  reportId: string;
  reportMonth?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete report for ${reportMonth || "this month"}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete report");
        return;
      }

      // router.push("/clients");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to delete report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="mt-3 ml-1 rounded px-4 py-0 mt-0 text-gray-400 hover:text-red-700 disabled:opacity-50"
      title="Delete report"
    >
      <Trash2 size={12} />
    </button>
  );
}
