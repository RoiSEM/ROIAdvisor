"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export default function ImportForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function checkStatus() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/database-import", { cache: "no-store" });
      setResult(JSON.stringify(await response.json(), null, 2));
    } catch {
      setResult("Could not read status. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setResult("Importing. Keep this page open until the result appears.");
    try {
      const response = await fetch("/api/admin/database-import", { method: "POST", body: data });
      setResult(JSON.stringify(await response.json(), null, 2));
    } catch {
      setResult("The response was interrupted. Use Check import status before attempting another upload.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" disabled={busy} onClick={checkStatus} className="rounded border px-4 py-2 disabled:opacity-50">Check import status</button>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">Prepared SQL file
          <input type="file" name="file" accept=".sql" required disabled={busy} className="mt-2 block w-full rounded border p-3" />
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="confirm" value="import" required disabled={busy} className="mt-1" />
          <span>Import these test records into SiteGround&apos;s isolated staging schema.</span>
        </label>
        <button type="submit" disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{busy ? "Working…" : "Import test data"}</button>
      </form>
      {result && <pre aria-live="polite" className="overflow-x-auto whitespace-pre-wrap rounded border p-4 text-sm">{result}</pre>}
    </div>
  );
}
