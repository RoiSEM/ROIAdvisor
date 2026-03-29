"use client";

import { useState } from "react";

type ManageBillingButtonProps = {
  label?: string;
  className?: string;
};

export default function ManageBillingButton({
  label = "Manage Billing",
  className,
}: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to open billing portal");
      }

      if (!data?.url) {
        throw new Error("Billing portal URL missing");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Billing portal error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to open billing right now. Please try again.",
      );
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={openPortal}
      disabled={loading}
      className={
        className ||
        "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {loading ? "Opening..." : label}
    </button>
  );
}
