"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckConnectionButton({
  clientId,
}: {
  clientId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function check() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/connection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const result = await response.json();
      if (!response.ok || result.connected !== true) {
        setMessage(result.error || "Connection could not be confirmed.");
        return;
      }
      setMessage(
        "Your Analytics connection is confirmed. No report allowance was used.",
      );
      router.refresh();
    } catch {
      setMessage("Connection could not be checked. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={check}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Checking access…" : "Check my Analytics connection"}
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        A read-only access check. It does not create a report or confirm
        conversion tracking.
      </p>
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
    </div>
  );
}
