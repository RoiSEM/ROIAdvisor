import ReportForm from "@/components/report-form";
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase-server";
import { marked } from "marked";
import { ChevronDown } from "lucide-react";
import RegenerateSummaryButton from "@/components/regenerate-summary-button";
import DeleteReportButton from "@/components/delete-summary-button";
import SyncAnalyticsButton from "@/components/sync-analytics-button";
import ReportHeaderActions from "@/components/report-header-actions";
import { buildPreviewSummary } from "@/lib/report-summary";
import SignOutButton from "@/components/sign-out-button";

async function getClient(id: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Supabase getClient error:", error);
    throw new Error("Failed to load client");
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
    const client = await getClient(id);

    return {
      title: `${client.name} Reports`,
      description: `Monthly SEO reports for ${client.name}.`,
    };
  } catch {
    return {
      title: "Client Reports",
    };
  }
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

async function getReports(id: string) {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase getReports error:", error);
    throw new Error("Failed to load reports");
  }

  return data;
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  const reports = await getReports(id);

  return (
    <main className="mx-auto max-w-4xl p-8 w-full">
      <div className="flex items-center justify-between gap-4">
        <Link href="/clients" className="text-sm underline">
          Back to Websites
        </Link>
        <SignOutButton />
      </div>

      <div className="mt-4 rounded border p-6">
        <h1 className="text-3xl font-bold">{client.name}</h1>
        <p className="mt-2">{client.website || "No website"}</p>
      </div>

      <ReportForm clientId={id} />

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Reports</h2>

        <div className="mt-4 space-y-4">
          {reports.length === 0 ? (
            <p className="text-gray-500">No reports yet.</p>
          ) : (
            reports.map(
              (report: {
                id: string;
                month: string | null;
                traffic: number | null;
                page_views: number | null;
                active_users: number | null;
                bounce_rate: number | null;
                engagement_rate: number | null;
                conversions: number | null;
                notes: string | null;
                ai_summary: string | null;
              }) => (
                <details
                  key={report.id}
                  className="group relative rounded-xl border border-slate-200 shadow-sm open:shadow-md"
                >
                  {(() => {
                    const summaryMarkdown =
                      report.ai_summary || buildPreviewSummary(report, client);
                    const summarySections = splitSummarySections(summaryMarkdown);
                    const hasAiSummary = Boolean(report.ai_summary);

                    return (
                      <>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 pr-44 marker:content-none md:px-6 md:py-5 md:pr-56">
                          <div className="min-w-0 flex-1 pr-2 md:pr-4">
                            <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
                              Conversion Report: {report.month || "No month set"}
                            </h3>

                            {report.notes && (
                              <p className="mt-2 line-clamp-1 text-sm md:line-clamp-2">
                                {report.notes}
                              </p>
                            )}
                          </div>
                        </summary>

                        <div className="absolute right-5 top-4 z-10 flex items-center gap-2 md:right-6 md:top-5">
                          <ReportHeaderActions
                            hasAiSummary={hasAiSummary}
                            reportId={report.id}
                            month={report.month}
                            traffic={report.traffic}
                            pageViews={report.page_views}
                            activeUsers={report.active_users}
                            bounceRate={report.bounce_rate}
                            engagementRate={report.engagement_rate}
                            conversions={report.conversions}
                            notes={report.notes}
                            clientName={client.name}
                          />
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 transition group-open:rotate-180 md:h-10 md:w-10">
                            <ChevronDown
                              size={20}
                              strokeWidth={2.25}
                              aria-hidden="true"
                            />
                          </span>
                        </div>

                        <div className="border-t border-slate-100 px-5 py-5">
                          <div className="mb-4 flex justify-end">
                            <DeleteReportButton
                              reportId={report.id}
                              reportMonth={report.month}
                            />
                          </div>

                          <div className="rounded border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h1 className="font-semibold">
                              {hasAiSummary ? "Conversion Report Summary" : "Summary & Insights"}
                            </h1>
                           
                          </div>
                          <div className="mt-4 space-y-5">
                            <div className="mt-3 space-y-1 text-sm">
                              <p>
                                Traffic: {report.traffic ?? 0} | Page Views:{" "}
                                {report.page_views ?? 0}
                              </p>
                              <p>
                                Active Users: {report.active_users ?? 0} |
                                {" "}Conversions: {report.conversions ?? 0}
                              </p>
                              <p>
                                Bounce Rate:{" "}
                                {((report.bounce_rate ?? 0) * 100).toFixed(1)}% |
                                {" "}Engagement Rate:{" "}
                                {((report.engagement_rate ?? 0) * 100).toFixed(1)}%
                              </p>
                            </div>
                            {summarySections.length > 0 ? (
                              summarySections.map((section, index) => {
                                const { bullets, remainder } = extractBulletItems(
                                  section.content || "",
                                );
                                const showBulletPanel =
                                  supportsBulletPanel(section.title) &&
                                  bullets.length > 0;
                                const panelStyles = bulletPanelStyles(
                                  section.title,
                                );

                                return (
                                  <div
                                    key={`${section.title}-${index}`}
                                    className="rounded-lg border border-slate-200 p-5 shadow-sm"
                                  >
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                      <span className="text-lg" aria-hidden="true">
                                        {sectionIcon(section.title)}
                                      </span>
                                      <h5 className="text-base font-semibold ``">
                                        {section.title}
                                      </h5>
                                    </div>

                                    {showBulletPanel && (
                                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
                                                <p className="mt-3 text-sm leading-6">
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
                                        className="prose prose-slate mt-4 max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-headings:`` prose-p:leading-relaxed prose-li:leading-relaxed prose-ul:my-3 prose-strong:``"
                                        dangerouslySetInnerHTML={{
                                          __html: marked(remainder),
                                        }}
                                      />
                                    )}

                                    {!showBulletPanel && !remainder && (
                                      <div className="mt-4 text-sm leading-relaxed">
                                        No details provided.
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div
                                className="prose prose-slate mt-2 max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: marked(summaryMarkdown),
                                }}
                              />
                            )}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {hasAiSummary && (
                              <>
                              <SyncAnalyticsButton reportId={report.id} />
                              <RegenerateSummaryButton
                                reportId={report.id}
                                month={report.month}
                                traffic={report.traffic}
                                pageViews={report.page_views}
                                activeUsers={report.active_users}
                                bounceRate={report.bounce_rate}
                                engagementRate={report.engagement_rate}
                                conversions={report.conversions}
                                notes={report.notes}
                              />
                              </>
                            )}
                          </div>
                        </div>
                        </div>
                      </>
                    );
                  })()}
                </details>
              ),
            )
          )}
        </div>
      </section>
    </main>
  );
}
