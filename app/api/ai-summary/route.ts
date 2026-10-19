import { appData } from "@/lib/data-store";
import OpenAI from "openai";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";
import { hasValidReportMetrics } from "@/lib/report-metrics";
import {
  buildSummaryPrompt,
  type SummaryClientData,
  type SummaryReportData,
} from "@/lib/report-summary";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    // Only the identifier is accepted from the browser. Analysis inputs are
    // loaded from the saved report after its owner is verified below.
    const { reportId } = body;

    if (!reportId) {
      return Response.json({ error: "reportId is required" }, { status: 400 });
    }

    const { data: report, error: reportError } = await appData
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    let clientQuery = appData
      .from("clients")
      .select("*")
      .eq("id", report.client_id);

    if (!isAdminUser(user)) {
      clientQuery = clientQuery.eq("user_id", user.id);
    }

    const { data: client, error: clientError } = await clientQuery.maybeSingle();

    if (clientError || !client) {
      return Response.json(
        { error: "Failed to load client context" },
        { status: 404 },
      );
    }

    if (
      typeof report.month !== "string" || !report.month.trim() ||
      !hasValidReportMetrics({
        traffic: report.traffic,
        conversions: report.conversions,
        pageViews: report.page_views,
        activeUsers: report.active_users,
        bounceRate: report.bounce_rate,
        engagementRate: report.engagement_rate,
      })
    ) {
      return Response.json(
        { error: "This report has incomplete or invalid analytics. Sync analytics or create a valid uploaded report before generating a summary." },
        { status: 409 },
      );
    }

    const reportData: SummaryReportData = {
      month: report.month ?? null,
      traffic: report.traffic ?? null,
      page_views: report.page_views ?? null,
      active_users: report.active_users ?? null,
      bounce_rate: report.bounce_rate ?? null,
      engagement_rate: report.engagement_rate ?? null,
      conversions: report.conversions ?? null,
      channel_performance: Array.isArray(report.channel_performance) ? report.channel_performance : null,
      landing_page_performance: Array.isArray(report.landing_page_performance) ? report.landing_page_performance : null,
      device_performance: Array.isArray(report.device_performance) ? report.device_performance : null,
      key_event_performance: Array.isArray(report.key_event_performance) ? report.key_event_performance : null,
      notes: report.notes ?? null,
    };

    const prompt = buildSummaryPrompt({
      report: reportData,
      client: client as SummaryClientData | null,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a senior agency owner and conversion strategist with a plain-spoken, common-sense business voice. You sound like someone who has built companies, spent real ad dollars, fixed messy funnels, and cares about what turns into leads and revenue. You are direct, practical, and honest without being rude. Do not imitate or mention any public figure by name.\n\nGuidelines:\n- Prioritize conversion performance, lead quality, revenue impact, and data confidence over raw traffic metrics\n- Treat SEO, ads, design, and technical issues only as conversion factors; do not evaluate them for their own sake\n- If conversions are 0, say so plainly and diagnose the most likely business problem\n- If conversion performance is strong, say the funnel is working and focus on how to protect or scale it\n- Distinguish confirmed issues from missing or uncertain data\n- If tracking, CTA, funnel, technical, design, or channel details are missing, say they are not confirmed and do not assume\n- Do not simply describe metrics; translate them into plain business meaning\n- Identify a primary conversion issue only when one is evident\n- Prioritize issues that directly affect conversions over surface-level observations\n- Make recommendations specific, prioritized, and tied to the report mode, grade, and SWOT evidence\n- Keep the tone straight-talking, confident, client-friendly, and easy to understand\n- Avoid academic language, marketing fluff, corporate buzzwords, and vague statements\n- Prefer short sentences. Use simple words. Say what matters and why it matters.\n\nYour output should read like a practical operator giving the client the truth, not like an analytics report.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1400,
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    if (!summary) {
      return Response.json(
        { error: "Failed to generate summary" },
        { status: 500 },
      );
    }

    const { error: updateError } = await appData
      .from("reports")
      .update({
        ai_summary: summary,
      })
      .eq("id", reportId);

    if (updateError) {
      return Response.json(
        { error: "Failed to save AI summary" },
        { status: 500 },
      );
    }

    return Response.json({ summary });
  } catch (error) {
    console.error("AI summary generation error:", error);
    return Response.json(
      { error: "Failed to generate AI summary" },
      { status: 500 },
    );
  }
}
