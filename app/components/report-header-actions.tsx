"use client";

import GenerateSummaryButton from "@/components/generate-summary-button";
import DownloadPDFButton from "@/components/download-pdf-button";
import { Printer } from "lucide-react";

type Props = {
  hasAiSummary: boolean;
  reportId: string;
  month: string | null;
  traffic: number | null;
  pageViews: number | null;
  activeUsers: number | null;
  bounceRate: number | null;
  engagementRate: number | null;
  conversions: number | null;
  notes: string | null;
  clientName: string;
};

export default function ReportHeaderActions({
  hasAiSummary,
  reportId,
  month,
  traffic,
  pageViews,
  activeUsers,
  bounceRate,
  engagementRate,
  conversions,
  notes,
  clientName,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 md:gap-2">
      {!hasAiSummary && (
        <GenerateSummaryButton
          reportId={reportId}
          month={month}
          traffic={traffic}
          pageViews={pageViews}
          activeUsers={activeUsers}
          bounceRate={bounceRate}
          engagementRate={engagementRate}
          conversions={conversions}
          notes={notes}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 transition hover:bg-slate-50 md:h-10 md:w-10"
          iconOnly
        />
      )}
      <DownloadPDFButton
        reportId={reportId}
        month={month}
        clientName={clientName}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 transition hover:bg-slate-50 md:h-10 md:w-10"
        iconOnly
      />
      <a
        href={`/reports/${reportId}/print`}
        aria-label="Print view"
        title="Print view"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 transition hover:bg-slate-50 md:h-10 md:w-10"
      >
        <Printer size={18} aria-hidden="true" />
      </a>
    </div>
  );
}
