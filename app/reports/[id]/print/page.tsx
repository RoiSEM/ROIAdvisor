import { marked } from "marked";
import { supabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PrintPageButton from "@/components/print-page-button";
import { buildPreviewSummary, getReportHealthScore } from "@/lib/report-summary";

function formatReportMonth(value: string | null) {
  if (!value) return "No month set";

  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1);

  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatMetadataReportMonth(value: string | null) {
  if (!value) return null;

  const [year, month] = value.split("-");

  if (!year || !month) return value;

  const date = new Date(Number(year), Number(month) - 1);

  return date.toLocaleString("en-US", {
    month: "long",
    year: "2-digit",
  });
}

function formatNumber(value: number | null) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function splitSummarySections(markdown: string | null) {
  if (!markdown) return [];

  const sections: Array<{ title: string; content: string }> = [];
  const lines = markdown.split("\n");
  let inCodeFence = false;
  let currentTitle = "";
  let currentLines: string[] = [];

  const pushSection = () => {
    const content = currentLines.join("\n").trim();

    if (!currentTitle && !content) return;

    sections.push({
      title: currentTitle || "Summary",
      content,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence && /^##\s+/.test(line)) {
      pushSection();
      currentTitle = line.replace(/^##\s+/, "").trim() || "Summary";
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  pushSection();

  return sections.filter(
    (section) => section.title.trim() || section.content.trim(),
  );
}

function sectionIcon(title: string) {
  const key = title.toLowerCase();

  if (key.includes("performance summary")) return "📊";
  if (key.includes("key insights")) return "💡";
  if (key.includes("conversion diagnosis")) return "🩺";
  if (key.includes("opportunities")) return "🚀";
  if (key.includes("recommended actions")) return "✅";

  return "•";
}

function extractBulletItems(content: string) {
  const lines = content.split("\n");
  const bullets: string[] = [];
  const remainder: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      remainder.push(line);
      continue;
    }

    if (!inCodeFence && /^[-*]\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*]\s+/, "").trim());
      continue;
    }

    remainder.push(line);
  }

  return {
    bullets,
    remainder: remainder.join("\n").trim(),
  };
}

function supportsBulletPanel(title: string) {
  const key = title.toLowerCase();

  return (
    key.includes("key insights") ||
    key.includes("conversion diagnosis") ||
    key.includes("opportunities") ||
    key.includes("recommended actions")
  );
}

function bulletPanelStyles(title: string) {
  const key = title.toLowerCase();

  if (key.includes("recommended actions")) {
    return {
      badge: "Action",
      badgeClass:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      bulletClass:
        "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white",
      dotClass: "bg-emerald-500",
    };
  }

  if (key.includes("opportunities")) {
    return {
      badge: "Opportunity",
      badgeClass:
        "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
      bulletClass:
        "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white",
      dotClass: "bg-sky-500",
    };
  }

  if (key.includes("conversion diagnosis")) {
    return {
      badge: "Diagnosis",
      badgeClass:
        "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
      bulletClass:
        "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white",
      dotClass: "bg-rose-500",
    };
  }

  return {
    badge: "Insight",
    badgeClass:
      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    bulletClass:
      "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white",
    dotClass: "bg-amber-500",
  };
}

async function getReport(id: string) {
  const { data, error } = await supabase
    .from("reports")
    .select(
      `
      *,
      clients (*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Supabase error loading report:", error);
    throw new Error(`Failed to load report: ${error.message}`);
  }

  if (!data) {
    throw new Error("Report not found");
  }

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const report = await getReport(id);
    const client = Array.isArray(report.clients)
      ? report.clients[0]
      : report.clients;
    const reportMonth = formatMetadataReportMonth(report.month);

    if (client?.name) {
      return {
        title: reportMonth
          ? `${client.name} Print Report - ${reportMonth}`
          : `${client.name} Print Report`,
        description: reportMonth
          ? `Printable monthly SEO report for ${client.name} for ${reportMonth}.`
          : `Printable monthly SEO report for ${client.name}.`,
      };
    }

    return {
      title: "Print Report",
    };
  } catch {
    return {
      title: "Print Report",
    };
  }
}

export default async function PrintReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let report;
  try {
    report = await getReport(id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      notFound();
    }
    throw error;
  }
  const client = Array.isArray(report.clients)
    ? report.clients[0]
    : report.clients;
  const summaryMarkdown = report.ai_summary || buildPreviewSummary(report, client);
  const summarySections = splitSummarySections(summaryMarkdown);
  const hasAiSummary = Boolean(report.ai_summary);

  const healthScore = getReportHealthScore(report, client);

  const healthStyles =
    healthScore.label === "Healthy"
      ? {
          badge:
            "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
          panel:
            "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white",
          dot: "bg-emerald-500",
        }
      : healthScore.label === "Warning"
        ? {
            badge:
              "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
            panel:
              "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white",
            dot: "bg-amber-500",
          }
        : {
            badge:
              "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
            panel:
              "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white",
            dot: "bg-rose-500",
          };

  const kpis = [
    { label: "Traffic", value: formatNumber(report.traffic) },
    { label: "Page Views", value: formatNumber(report.page_views) },
    { label: "Active Users", value: formatNumber(report.active_users) },
    { label: "Bounce Rate", value: formatPercent(report.bounce_rate) },
    { label: "Engagement Rate", value: formatPercent(report.engagement_rate) },
    { label: "Conversions", value: formatNumber(report.conversions) },
  ];

  return (
    <main className="print-shell mx-auto max-w-4xl  px-6 py-8 md:px-10 md:py-10">
      <div className="no-print mb-6 flex items-center justify-between border-b pb-4">
        <a
          href={`/dashboard/${client?.id ?? ""}`}
          className="text-sm underline underline-offset-4"
        >
          ← Back to Dashboard
        </a>

        <PrintPageButton />
      </div>

      <section className="print-section border-t-4 border-slate-900 pt-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em]">
              Monthly Performance Report
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {client?.name || "Website Report"}
            </h1>
            <p className="mt-3 text-lg ">
              {formatReportMonth(report.month)}
            </p>

            {(client?.website || client?.email) && (
              <div className="mt-4 space-y-1 text-sm">
                {client?.website && <p>{client.website}</p>}
                {client?.email && <p>{client.email}</p>}
              </div>
            )}
          </div>

          <div className="flex h-16 w-40 items-center justify-center border border-slate-300 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            Logo
          </div>
        </div>
      </section>

      <section className="print-section mt-10">
        <h2 className="text-xl font-semibold">
          Performance Overview
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          {kpis.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-200  p-4"
            >
              <p className="text-xs font-medium uppercase tracking-[0.14em]">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <div
          className={`mt-5 rounded-xl border p-5 shadow-sm ${healthStyles.panel}`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Report Health
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${healthStyles.badge}`}
                >
                  {healthScore.label}
                </span>
                <p className="text-2xl font-bold tracking-tight text-slate-950">
                  {healthScore.score}/100
                </p>
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${healthStyles.dot}`}
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-slate-700">
                  {healthScore.reason}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="print-section mt-10">
        <h2 className="text-xl font-semibold">Notes</h2>
        <div className="mt-4 rounded-lg border border-slate-200 p-5">
          <p className="whitespace-pre-line text-sm leading-relaxed ">
            {report.notes || "No notes provided."}
          </p>
        </div>
      </section>

      <section className="print-section mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Summary & Insights
          </h2>
          {!hasAiSummary && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              Preview
            </span>
          )}
        </div>

        <div className="mt-4 space-y-5">
          {summarySections.length > 0 ? (
            summarySections.map((section, index) => (
              (() => {
                const { bullets, remainder } = extractBulletItems(
                  section.content || "",
                );
                const showBulletPanel =
                  supportsBulletPanel(section.title) && bullets.length > 0;
                const panelStyles = bulletPanelStyles(section.title);

                return (
                  <div
                    key={`${section.title}-${index}`}
                    className="rounded-lg border border-slate-200  p-6 shadow-sm"
                  >
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <span className="text-lg" aria-hidden="true">
                        {sectionIcon(section.title)}
                      </span>
                      <h3 className="text-lg font-semibold ">
                        {section.title}
                      </h3>
                    </div>

                    {showBulletPanel && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {bullets.map((bullet, bulletIndex) => (
                          <div
                            key={`${section.title}-bullet-${bulletIndex}`}
                            className={`rounded-xl border p-4 shadow-sm ${panelStyles.bulletClass}`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${panelStyles.dotClass}`}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${panelStyles.badgeClass}`}
                                >
                                  {panelStyles.badge}
                                </span>
                                <p className="mt-3 text-sm leading-6 ">
                                  {bullet}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {remainder && (
                      <div
                        className="prose prose-slate mt-4 max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:leading-relaxed prose-ul:my-3 prose-strong:text-slate-900"
                        dangerouslySetInnerHTML={{ __html: marked(remainder) }}
                      />
                    )}

                    {!showBulletPanel && !remainder && (
                      <div className="mt-4 text-sm leading-relaxed">
                        No details provided.
                      </div>
                    )}
                  </div>
                );
              })()
            ))
          ) : (
            <div className="rounded-lg border border-slate-200  p-6 shadow-sm">
              <div
                className="prose prose-slate max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:leading-relaxed prose-ul:my-3 prose-strong:text-slate-900"
                dangerouslySetInnerHTML={{ __html: marked(summaryMarkdown) }}
              />
            </div>
          )}
        </div>
      </section>

      <footer className="print-section mt-12 border-t border-slate-200 pt-4 text-xs">
        <div className="flex items-center justify-between">
          <span>Confidential</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </footer>
    </main>
  );
}
