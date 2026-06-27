"use client";

export default function PrintPageButton() {
  const handlePrint = () => {
    requestAnimationFrame(() => {
      window.print();
    });
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="rounded border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
    >
      Print / Save PDF
    </button>
  );
}
