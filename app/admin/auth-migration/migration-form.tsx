"use client";
import { useState } from "react";
export default function MigrationForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(importFile: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/auth-migration", importFile ? { method: "POST", headers: { "Content-Type": "application/json" }, body: file } : { cache: "no-store" });
      setResult(JSON.stringify(await response.json(), null, 2));
    } catch { setResult("Request failed. Check status before retrying."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <input type="file" accept=".json,application/json" onChange={e => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
    <div className="flex gap-3">
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={busy || !file} onClick={() => run(true)}>Create auth tables and import identities</button>
      <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={() => run(false)}>Check status</button>
    </div>
    <pre className="overflow-auto whitespace-pre-wrap rounded border p-4" aria-live="polite">{result}</pre>
  </section>;
}
