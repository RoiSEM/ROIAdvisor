"use client";

import { useState } from "react";
import { File } from "lucide-react";

type Props = {
  reportId: string;
  month: string | null;
  clientName: string;
  className?: string;
  iconOnly?: boolean;
};


export default function DownloadPDFButton({
  reportId,
  month,
  clientName,
  className = "",
  iconOnly = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);

    try {
      const res = await fetch(`/api/reports/${reportId}/pdf`);

      if (!res.ok) {
        alert("Failed to download PDF");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Report-${clientName}-${month || "unknown"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF download error:", error);
      alert("Failed to download PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`rounded px-4 py-2 disabled:opacity-50 ${className}`.trim()}
      aria-label={loading ? "Downloading PDF" : "Download PDF"}
      title={loading ? "Downloading PDF" : "Download PDF"}
    >
      {iconOnly ? (
        <span className="inline-flex h-5 w-5 items-center justify-center">
          <File size={18} strokeWidth={2.25} aria-hidden="true" />
        </span>
      ) : loading ? (
        "Downloading..."
      ) : (
        "Download PDF"
      )}
    </button>
  );
}
