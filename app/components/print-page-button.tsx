"use client";

export default function PrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50  ${className}`.trim()"
    >
      Print / Save PDF
    </button>
  );
}
