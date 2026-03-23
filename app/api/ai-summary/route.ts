import OpenAI from "openai";
import { supabase } from "@/lib/supabase-server";
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
    const body = await req.json();
    const {
      reportId,
      month,
      traffic,
      pageViews,
      activeUsers,
      bounceRate,
      engagementRate,
      conversions,
      notes,
    } = body;

    if (!reportId) {
      return Response.json({ error: "reportId is required" }, { status: 400 });
    }

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, client_id")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", report.client_id)
      .maybeSingle();

    if (clientError) {
      return Response.json(
        { error: "Failed to load client context" },
        { status: 500 },
      );
    }

    const reportData: SummaryReportData = {
      month: month ?? null,
      traffic: traffic ?? null,
      page_views: pageViews ?? null,
      active_users: activeUsers ?? null,
      bounce_rate: bounceRate ?? null,
      engagement_rate: engagementRate ?? null,
      conversions: conversions ?? null,
      notes: notes ?? null,
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
            "You are a senior digital marketing strategist, conversion analyst, and agency owner with over 20 years of experience scaling and selling multiple agencies. Your advice is direct, honest, and focused on what actually drives revenue. You do not sugarcoat issues or hide behind vague language. You prioritize strong foundational fixes over surface-level optimizations, and you communicate like a trusted advisor who wants the client to succeed long-term. You speak clearly, confidently, and professionally, with enough bluntness to cut through ambiguity and drive action.\n\nGuidelines:\n- Always prioritize conversion performance over raw traffic metrics\n- If conversions are 0, treat this as a critical issue and diagnose likely causes\n- Distinguish between confirmed issues and missing or uncertain data\n- If tracking, CTA, or funnel details are missing, say they are not confirmed and do not assume\n- Do not simply describe metrics; explain what they mean for the business\n- Clearly identify the single primary conversion blocker when one is evident\n- Prioritize issues that directly block conversions over analytics limitations\n- Provide actionable, prioritized recommendations\n- Keep tone professional, clear, strategic, and client-friendly\n- Avoid generic or vague statements\n\nYour output should read like a seasoned agency owner and strategic consultant, not a data reporter.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    if (!summary) {
      return Response.json(
        { error: "Failed to generate summary" },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
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
