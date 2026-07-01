import ReportForm from "@/components/report-form";
import type { Metadata } from "next";
import Link from "next/link";
import {
  createSupabaseUserClient,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";
import { marked } from "marked";
import { ChevronDown } from "lucide-react";
import RegenerateSummaryButton from "@/components/regenerate-summary-button";
import DeleteReportButton from "@/components/delete-summary-button";
import SyncAnalyticsButton from "@/components/sync-analytics-button";
import ReportHeaderActions from "@/components/report-header-actions";
import ServiceCta from "@/components/service-cta";
import { buildPreviewSummary } from "@/lib/report-summary";
import SignOutButton from "@/components/sign-out-button";
import { redirect } from "next/navigation";

async function getClient(id: string) {
  const supabase = await createSupabaseUserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  let query = supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", id);

  if (!isAdminUser(user)) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error("Supabase getClient error:", error);
    throw new Error("Failed to load client");
  }

  return {
    client: data,
    isAdminView: isAdminUser(user),
  };
}

async function getClientMetadata(id: string) {
  const { data } = await supabaseAdmin
    .from("clients")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const client = await getClientMetadata(id);

    if (!client) {
      throw new Error("Client not found");
    }

    return {
      title: `${client.name} Reports`,
      description: `Monthly reports for ${client.name}.`,
    };
  } catch {
    return {
      title: "Reports",
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
    const content = cleanSectionContent(currentLines.join("\n"));

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
      currentTitle =
        normalizeSectionTitle(line.replace(/^##\s+/, "").trim()) || "Summary";
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  pushSection();

  return sections.filter((section) => section.content.trim());
}

function normalizeSectionTitle(title: string) {
  const key = title.toLowerCase();

  if (key.includes("performance summary")) {
    return "Summary Insights & Performance Summary";
  }

  if (key.includes("key insights")) {
    return "Strengths: What's Working";
  }

  if (key.includes("conversion diagnosis")) {
    return "Weaknesses: What's Not Working";
  }

  if (key === "opportunities" || key.includes("where to improve")) {
    return "Opportunities: Where to Improve";
  }

  if (key.includes("threats") || key.includes("watch out")) {
    return "Threats: Watch Out For";
  }

  if (key.includes("recommended actions") || key.includes("recommendations")) {
    return "Recommendations";
  }

  return title;
}

function cleanSectionContent(content: string) {
  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();

      return ![
        /^secondary contributing issues include:\s*$/i,
        /^primary contributing issues include:\s*$/i,
        /^additional considerations include:\s*$/i,
        /^supporting issues include:\s*$/i,
      ].some((pattern) => pattern.test(trimmed));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionIcon(title: string) {
  const key = title.toLowerCase();

  if (key.includes("summary insights")) return "📊";
  if (key.includes("strengths")) return "✅";
  if (key.includes("weaknesses")) return "⚠️";
  if (key.includes("opportunities")) return "🚀";
  if (key.includes("threats")) return "🛡️";
  if (key.includes("recommendations")) return "➡️";

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

    if (!inCodeFence && /^(?:[-*]|\d+\.)\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^(?:[-*]|\d+\.)\s+/, "").trim());
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
    key.includes("strengths") ||
    key.includes("weaknesses") ||
    key.includes("opportunities") ||
    key.includes("threats") ||
    key.includes("recommendations")
  );
}

function bulletPanelStyles(title: string) {
  const key = title.toLowerCase();

  if (key.includes("recommendations")) {
    return {
      badge: "Action",
      badgeClass:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800 print:bg-emerald-50 print:text-emerald-700 print:ring-emerald-200",
      bulletClass:
        "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white text-slate-800 dark:border-emerald-800 dark:from-emerald-950/40 dark:via-slate-950 dark:to-slate-950 dark:text-emerald-50 print:border-emerald-200 print:from-emerald-50 print:via-white print:to-white print:text-slate-800",
      dotClass: "bg-emerald-500",
    };
  }

  if (key.includes("opportunities")) {
    return {
      badge: "Opportunity",
      badgeClass:
        "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800 print:bg-sky-50 print:text-sky-700 print:ring-sky-200",
      bulletClass:
        "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white text-slate-800 dark:border-sky-800 dark:from-sky-950/40 dark:via-slate-950 dark:to-slate-950 dark:text-sky-50 print:border-sky-200 print:from-sky-50 print:via-white print:to-white print:text-slate-800",
      dotClass: "bg-sky-500",
    };
  }

  if (key.includes("weaknesses")) {
    return {
      badge: "Weakness",
      badgeClass:
        "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800 print:bg-rose-50 print:text-rose-700 print:ring-rose-200",
      bulletClass:
        "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white text-slate-800 dark:border-rose-800 dark:from-rose-950/40 dark:via-slate-950 dark:to-slate-950 dark:text-rose-50 print:border-rose-200 print:from-rose-50 print:via-white print:to-white print:text-slate-800",
      dotClass: "bg-rose-500",
    };
  }

  if (key.includes("threats")) {
    return {
      badge: "Threat",
      badgeClass:
        "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-800 print:bg-orange-50 print:text-orange-700 print:ring-orange-200",
      bulletClass:
        "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white text-slate-800 dark:border-orange-800 dark:from-orange-950/40 dark:via-slate-950 dark:to-slate-950 dark:text-orange-50 print:border-orange-200 print:from-orange-50 print:via-white print:to-white print:text-slate-800",
      dotClass: "bg-orange-500",
    };
  }

  if (key.includes("strengths")) {
    return {
      badge: "Strength",
      badgeClass:
        "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800 print:bg-teal-50 print:text-teal-700 print:ring-teal-200",
      bulletClass:
        "border-teal-200 bg-gradient-to-br from-teal-50 via-white to-white text-slate-800 dark:border-teal-800 dark:from-teal-950/40 dark:via-slate-950 dark:to-slate-950 dark:text-teal-50 print:border-teal-200 print:from-teal-50 print:via-white print:to-white print:text-slate-800",
      dotClass: "bg-teal-500",
    };
  }

  return {
    badge: "Insight",
    badgeClass:
      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800 print:bg-amber-50 print:text-amber-700 print:ring-amber-200",
    bulletClass:
      "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white text-slate-800 dark:border-amber-800 dark:from-amber-950/40 dark:via-slate-950 dark:to-slate-950 dark:text-amber-50 print:border-amber-200 print:from-amber-50 print:via-white print:to-white print:text-slate-800",
    dotClass: "bg-amber-500",
  };
}

async function getReports(id: string) {
  const { data, error } = await supabaseAdmin
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
  const { client, isAdminView } = await getClient(id);
  const reports = await getReports(id);
  const approvalStatus = (client.approval_status || "pending").toLowerCase();
  const isApproved = approvalStatus === "approved";
  const backLabel = isAdminView ? "Back to Clients" : "Back to Dashboard";

  return (
    <main className="mx-auto max-w-4xl p-8 w-full">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="text-sm underline">
          {backLabel}
        </Link>
        <SignOutButton />
      </div>

      <div className="mt-4 rounded border p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{client.name}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              isApproved
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            {isApproved ? "Approved" : "Pending approval"}
          </span>
        </div>
        <p className="mt-2">{client.website || "No website"}</p>
        {!isApproved && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Reports are locked until approval.</p>
            <p className="mt-2 leading-7">
              This website is still pending approval. Reports unlock after
              analytics access is confirmed and an admin approves the site.
            </p>
            {client.approval_notes && (
              <p className="mt-2 leading-7 text-amber-900">
                Admin notes: {client.approval_notes}
              </p>
            )}
          </div>
        )}
      </div>

      {isApproved ? (
        <ReportForm clientId={id} />
      ) : (
        <div className="mt-8 rounded border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-semibold">Generate report</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Report generation becomes available once this website has been
            approved.
          </p>
          <ServiceCta
            variant="analyticsSetup"
            clientName={client.name}
            className="mt-4"
          />
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Reports</h2>

        <div className="mt-4 space-y-4">
          {reports.length === 0 ? (
            <div className="space-y-4">
              <p className="text-gray-500">No reports yet.</p>
              <ServiceCta
                variant="analyticsSetup"
                clientName={client.name}
              />
            </div>
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
                channel_performance?: unknown[] | null;
                landing_page_performance?: unknown[] | null;
                device_performance?: unknown[] | null;
                key_event_performance?: unknown[] | null;
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
                            channelPerformance={report.channel_performance}
                            landingPagePerformance={report.landing_page_performance}
                            devicePerformance={report.device_performance}
                            keyEventPerformance={report.key_event_performance}
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
                                    className="rounded-lg border border-slate-200 bg-white p-5 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 print:border-slate-200 print:bg-white print:text-slate-900"
                                  >
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 print:border-slate-100">
                                      <span className="text-lg" aria-hidden="true">
                                        {sectionIcon(section.title)}
                                      </span>
                                      <h5 className="text-base font-semibold text-slate-950 dark:text-slate-50 print:text-slate-950">
                                        {section.title}
                                      </h5>
                                    </div>

                                    {showBulletPanel && (
                                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        {bullets.map((bullet, bulletIndex) => (
                                          <div
                                            key={`${section.title}-bullet-${bulletIndex}`}
                                            className={`rounded-xl border bg-white p-4 text-slate-800 shadow-sm dark:bg-slate-950 dark:text-slate-100 print:bg-white print:text-slate-800 ${panelStyles.bulletClass}`}
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
                                                <p className="mt-3 text-sm leading-6 text-slate-800 dark:text-slate-100 print:text-slate-800">
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
                                        className="prose prose-slate mt-4 max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:leading-relaxed prose-ul:my-3 prose-strong:text-slate-900 dark:prose-invert dark:prose-headings:text-slate-50 dark:prose-strong:text-slate-50 print:prose-slate print:prose-headings:text-slate-900 print:prose-strong:text-slate-900"
                                        dangerouslySetInnerHTML={{
                                          __html: marked(remainder),
                                        }}
                                      />
                                    )}

                                    {!showBulletPanel && !remainder && (
                                      <div className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300 print:text-slate-600">
                                        No details provided.
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div
                                className="prose prose-slate mt-2 max-w-none prose-headings:text-slate-900 prose-strong:text-slate-900 dark:prose-invert dark:prose-headings:text-slate-50 dark:prose-strong:text-slate-50 print:prose-slate print:prose-headings:text-slate-900 print:prose-strong:text-slate-900"
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
                                channelPerformance={report.channel_performance}
                                landingPagePerformance={report.landing_page_performance}
                                devicePerformance={report.device_performance}
                                keyEventPerformance={report.key_event_performance}
                              />
                              </>
                            )}
                          </div>
                          <ServiceCta
                            variant="reportFix"
                            clientName={client.name}
                            className="mt-5"
                          />
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
