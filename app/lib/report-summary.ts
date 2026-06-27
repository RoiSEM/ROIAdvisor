export type SummaryReportData = {
  month: string | null;
  traffic: number | null;
  page_views?: number | null;
  active_users?: number | null;
  bounce_rate?: number | null;
  engagement_rate?: number | null;
  conversions: number | null;
  notes: string | null;
  channel_performance?: unknown[] | null;
  landing_page_performance?: unknown[] | null;
  device_performance?: unknown[] | null;
};

export type SummaryClientData = {
  name?: string | null;
  website?: string | null;
  primary_goal?: string | null;
  monthly_goal?: number | null;
  average_conversion_value?: number | null;
  conversion_types?: string[] | null;
  conversion_tracking_status?: string | null;
  main_cta?: string | null;
  funnel_description?: string | null;
  known_issues?: string | null;
  technical_issues?: string | null;
  design_concerns?: string | null;
  ad_channel_notes?: string | null;
  offer_message_concerns?: string | null;
  tracking_notes?: string | null;
  marketing_channels?: string[] | null;
  running_ads?: boolean | null;
  client_notes?: string | null;
};

export type ReportHealthScore = {
  label: "Healthy" | "Warning" | "Critical";
  score: number;
  reason: string;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  mode: "Fix" | "Scale" | "Maintain" | "Investigate";
  modeReason: string;
};

type ReportSignals = {
  traffic: number;
  conversions: number;
  conversionRate: number | null;
  goalGap: number | null;
  goalProgress: number | null;
  bounceRate: number | null;
  engagementRate: number | null;
  hasTrackingConcern: boolean;
  hasConversionTypes: boolean;
  hasFunnelContext: boolean;
  knownIssues: string;
};

function formatList(values: string[] | null | undefined, fallback = "None provided") {
  if (!values || values.length === 0) return fallback;
  return values.join(", ");
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "Not provided";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBreakdown(
  values: unknown[] | null | undefined,
  fallback = "Not available",
) {
  if (!values || values.length === 0) return fallback;

  return values
    .slice(0, 8)
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item)),
    )
    .map((item) =>
      Object.entries(item)
        .map(([key, value]) => `${key}: ${value ?? "N/A"}`)
        .join(", "),
    )
    .join("\n") || fallback;
}

function getReportSignals(
  report: SummaryReportData,
  client?: SummaryClientData | null,
): ReportSignals {
  const traffic = report.traffic ?? 0;
  const conversions = report.conversions ?? 0;
  const monthlyGoal = client?.monthly_goal ?? null;
  const conversionTrackingStatus = client?.conversion_tracking_status ?? null;

  return {
    traffic,
    conversions,
    conversionRate: traffic > 0 ? (conversions / traffic) * 100 : null,
    goalGap:
      monthlyGoal != null && conversions < monthlyGoal
        ? monthlyGoal - conversions
        : null,
    goalProgress:
      monthlyGoal != null && monthlyGoal > 0 ? conversions / monthlyGoal : null,
    bounceRate: report.bounce_rate ?? null,
    engagementRate: report.engagement_rate ?? null,
    hasTrackingConcern:
      conversionTrackingStatus === "No" || conversionTrackingStatus === "Not sure",
    hasConversionTypes: Boolean(client?.conversion_types?.length),
    hasFunnelContext: Boolean(client?.main_cta || client?.funnel_description),
    knownIssues: (client?.known_issues || "").toLowerCase(),
  };
}

function hasKnownConversionBlocker(knownIssues: string) {
  return [
    "broken",
    "form",
    "phone",
    "call",
    "checkout",
    "booking",
    "payment",
    "submit",
    "not working",
  ].some((signal) => knownIssues.includes(signal));
}

export function getPerformanceSignals(
  report: SummaryReportData,
  client?: SummaryClientData | null,
) {
  const traffic = report.traffic ?? 0;
  const conversions = report.conversions ?? 0;
  const pageViews = report.page_views ?? 0;
  const bounceRate = report.bounce_rate ?? null;
  const engagementRate = report.engagement_rate ?? null;
  const monthlyGoal = client?.monthly_goal ?? null;
  const conversionTrackingStatus = client?.conversion_tracking_status ?? null;
  const conversionTypes = client?.conversion_types ?? [];
  const marketingChannels = client?.marketing_channels ?? [];
  const runningAds = client?.running_ads ?? null;
  const hasFunnelContext = Boolean(client?.main_cta || client?.funnel_description);

  const signals: string[] = [];

  if (conversionTrackingStatus === "No") {
    signals.push(
      "Conversion tracking is marked as not set up, so reported conversion performance should be treated as incomplete until tracking is configured.",
    );
  } else if (conversionTrackingStatus === "Not sure") {
    signals.push(
      "Conversion tracking status is uncertain, so treat conversion counts cautiously until the setup is verified in GA4 and on-site forms or calls.",
    );
  }

  if (traffic > 0 && conversions === 0) {
    signals.push(
      "The site is receiving traffic but has no recorded conversions for this period, so the report should focus on conversion friction, CTA clarity, lead flow, and tracking confidence.",
    );
  }

  if (monthlyGoal != null && conversions < monthlyGoal) {
    signals.push(
      `The current conversion total is ${monthlyGoal - conversions} below the stated monthly goal, so the report should explain whether the gap is caused by traffic volume, conversion efficiency, tracking confidence, or known friction.`,
    );
  }

  if (
    conversionTrackingStatus === "Yes" &&
    traffic >= 100 &&
    conversions <= 1 &&
    engagementRate != null &&
    engagementRate >= 0.55
  ) {
    signals.push(
      "Visitors are engaging with the site but not turning into conversions, which suggests the offer, CTA clarity, or post-click funnel may be the main bottleneck.",
    );
  }

  if (bounceRate != null && bounceRate >= 0.65) {
    signals.push(
      "Bounce rate is elevated, which can indicate landing-page mismatch, weak intent alignment, or a page experience issue before users reach the main CTA.",
    );
  }

  if (traffic > 0 && conversions > 0) {
    const conversionRate = (conversions / traffic) * 100;

    if (conversionRate < 1) {
      signals.push(
        `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, which is low enough to justify reviewing landing pages, CTA visibility, and form friction.`,
      );
    } else if (conversionRate >= 5) {
      signals.push(
        `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, which suggests the funnel is working and the next step is likely protecting quality while scaling qualified traffic.`,
      );
    }
  }

  if (runningAds === true && conversions === 0) {
    signals.push(
      "Paid traffic is currently running without measurable conversions, so ad intent, landing-page alignment, and tracking should be checked together.",
    );
  }

  if (marketingChannels.length === 0) {
    signals.push(
      "Traffic sources were not specified, which makes it harder to separate channel quality, page experience, and funnel performance.",
    );
  }

  if (conversionTypes.length === 0) {
    signals.push(
      "No conversion types are defined yet, so the business should clarify what counts as success before performance is evaluated too confidently.",
    );
  }

  if (!hasFunnelContext && pageViews > 0) {
    signals.push(
      "The funnel path after a site visit is not documented yet, so recommendations should avoid assuming where drop-off is happening.",
    );
  }

  if (signals.length === 0) {
    signals.push(
      "The current data does not show an obvious conversion issue, so the priority is to monitor trend movement and compare channel quality against goal completion over time.",
    );
  }

  return signals.slice(0, 4);
}

export function getReportHealthScore(
  report: SummaryReportData,
  client?: SummaryClientData | null,
): ReportHealthScore {
  const {
    traffic,
    conversions,
    conversionRate,
    goalGap,
    goalProgress,
    bounceRate,
    engagementRate,
    hasTrackingConcern,
    hasConversionTypes,
    hasFunnelContext,
    knownIssues,
  } = getReportSignals(report, client);
  const knownConversionBlocker = hasKnownConversionBlocker(knownIssues);

  let score = 100;
  let reason = "Performance is stable with no obvious critical blocker.";
  let mode: ReportHealthScore["mode"] = "Maintain";
  let modeReason =
    "The site is showing stable performance, so the priority is to protect what is working and monitor for changes.";

  if (traffic === 0) {
    score -= 45;
    reason = "No traffic was recorded, so there is no opportunity for conversions yet.";
    mode = "Investigate";
    modeReason =
      "No traffic was recorded, so the report should focus on acquisition visibility and analytics setup before judging the funnel.";
  }

  if (traffic > 0 && conversions === 0) {
    score -= 35;
    reason = "Traffic is present but no conversions were recorded, indicating a conversion blocker.";
    mode = "Fix";
    modeReason =
      "Visitors are reaching the site but not converting, so the report should focus on finding and fixing the conversion issue.";
  }

  if (hasTrackingConcern) {
    score -= 20;
    if (traffic > 0 && conversions === 0) {
      reason = "Traffic is present but conversion tracking is not configured, limiting visibility into the funnel.";
    }

    if (mode !== "Fix") {
      mode = "Investigate";
      modeReason =
        "Conversion tracking is not fully confirmed, so the report should separate proven performance from data-confidence questions.";
    }
  }

  if (!hasConversionTypes) {
    score -= 10;
    if (traffic > 0 && conversions === 0) {
      reason = "Conversion goals are not clearly defined, making performance hard to measure and improve.";
    }
  }

  if (!hasFunnelContext) {
    score -= 10;
  }

  if (knownConversionBlocker) {
    score -= 25;

    reason =
      "A known conversion-blocking issue is documented, so it should be fixed before scaling traffic or making surface-level optimizations.";

    return {
      label: "Critical",
      score: Math.max(0, Math.round(score)),
      grade: "F",
      mode: "Fix",
      modeReason:
        "A known technical or funnel issue is likely blocking conversions, so the report should prioritize repair work.",
      reason,
    };
  }

  if (bounceRate != null) {
    if (bounceRate >= 0.65) {
      score -= 10;
    } else if (bounceRate >= 0.55) {
      score -= 5;
    }
  }

  if (engagementRate != null && engagementRate < 0.35) {
    score -= 10;
  }

  if (conversionRate != null) {
    if (conversionRate >= 5) {
      score += 10;
      reason = `Conversion performance is strong at about ${conversionRate.toFixed(1)}%, suggesting the foundation is working.`;
    } else if (conversionRate >= 2) {
      score += 5;
      reason = `Conversions are being generated at about ${conversionRate.toFixed(1)}%, but there is still room to improve efficiency.`;
    } else if (traffic >= 100) {
      score -= 15;
      reason = `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, so the report should focus on improving conversion quality before scaling traffic.`;
      mode = "Fix";
      modeReason =
        "Traffic is available but conversion efficiency is weak, so the report should focus on improving the site, offer, CTA, or funnel.";
    }
  }

  if (goalGap != null) {
    score -= Math.min(10, goalGap);

    if (conversionRate != null && conversionRate >= 5 && mode === "Maintain") {
      mode = "Scale";
      modeReason =
        "The site is converting visitors effectively, but total conversion volume is still below the monthly goal.";
      reason = `Conversion performance is strong at about ${conversionRate.toFixed(1)}%, but the report is ${goalGap} conversions short of the monthly goal.`;
    }
  } else if (
    goalProgress != null &&
    goalProgress >= 1 &&
    mode === "Maintain" &&
    conversionRate != null &&
    conversionRate >= 5
  ) {
    modeReason =
      "The monthly conversion goal is met and conversion efficiency is strong, so the report should focus on protecting and carefully scaling what is working.";
  }

  if (goalGap != null && goalProgress != null) {
    const goalProgressScoreCap =
      goalProgress >= 0.9
        ? 89
        : goalProgress >= 0.75
          ? 84
          : goalProgress >= 0.5
            ? 74
            : 64;

    score = Math.min(score, goalProgressScoreCap);
  }

  if (hasTrackingConcern) {
    score = Math.min(score, 79);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade: ReportHealthScore["grade"] =
    score >= 95
      ? "A+"
      : score >= 90
        ? "A"
        : score >= 80
          ? "B"
          : score >= 70
            ? "C"
            : score >= 55
              ? "D"
              : "F";

  if (score >= 80) {
    return { label: "Healthy", score, grade, mode, modeReason, reason };
  }

  if (score >= 55) {
    return { label: "Warning", score, grade, mode, modeReason, reason };
  }

  return { label: "Critical", score, grade, mode, modeReason, reason };
}

export function buildPreviewSummary(
  report: SummaryReportData,
  client?: SummaryClientData | null,
) {
  const engagementRate = `${((report.engagement_rate ?? 0) * 100).toFixed(1)}%`;
  const performanceSignals = getPerformanceSignals(report, client);
  const health = getReportHealthScore(report, client);
  const goalLine = client?.primary_goal
    ? ` The primary business goal is ${client.primary_goal.toLowerCase()}.`
    : "";

  return [
    "## Summary Insights & Performance Summary",
    `This preview is based on the current report data for ${report.month || "this period"}. Traffic is ${report.traffic ?? 0}, page views are ${report.page_views ?? 0}, active users are ${report.active_users ?? 0}, and conversions are ${report.conversions ?? 0}.${goalLine}`,
    `Current assessment: ${health.mode} mode, grade ${health.grade}. ${health.reason}`,
    "",
    "## Strengths: What's Working",
    `- Engagement rate is ${engagementRate}.`,
    `- Conversions recorded so far: ${report.conversions ?? 0}.`,
    "- The report grade and mode will identify whether this is a fix, scale, maintain, or investigate period.",
    "",
    "## Weaknesses: What's Not Working",
    ...performanceSignals.map((item) => `- ${item}`),
    "",
    "## Opportunities: Where to Improve",
    "- Use the full AI summary to identify conversion-focused improvements across traffic quality, page experience, technical reliability, offer fit, and channel performance.",
    "- Compare acquisition sources and landing pages against conversion outcomes to identify the best growth levers.",
    "- Use report notes to add campaign, offer, technical, or design context before generating the final summary.",
    "",
    "## Threats: Watch Out For",
    "- Missing tracking, unclear funnel context, technical issues, or poor channel fit can reduce confidence in the report.",
    "- Scaling traffic before confirming conversion quality can increase spend without improving leads or revenue.",
    "",
    "## Recommendations",
    "- Generate the AI summary to replace this preview with a tailored SWOT-style analysis.",
    "- Prioritize fixes that protect or improve conversions before broad traffic growth.",
    report.notes
      ? `- Incorporate this note into the final summary: ${report.notes}`
      : "- Add campaign notes for more specific recommendations in the final summary.",
  ].join("\n");
}

export function buildSummaryPrompt(args: {
  report: SummaryReportData;
  client?: SummaryClientData | null;
}) {
  const { report, client } = args;
  const performanceSignals = getPerformanceSignals(report, client);
  const health = getReportHealthScore(report, client);

  return `
Generate a client-facing monthly conversion performance report in markdown only.

Primary objective:
Explain what is helping or hurting conversion performance across traffic quality, page experience, technical reliability, offer and messaging fit, channel performance, and tracking confidence.

Important rules:
- Return only the report content in markdown
- Do not include HTML, JSX, XML, or code
- Do not add any extra top-level sections
- Do not add a generic "Summary" section
- Use the exact SWOT-style section headings provided below
- If information is missing, say it is not confirmed or not provided
- Do not present missing data as a proven fact
- Avoid absolute statements unless explicitly confirmed by inputs
- Keep the tone professional, concise, strategic, and client-friendly
- Focus on business outcomes, conversion performance, lead quality, revenue impact, and practical next steps
- If conversions are 0, treat that as the central issue of the report
- If traffic is 0, focus on acquisition and tracking validation (do not analyze engagement or conversions)
- Separate confirmed issues from probable issues where appropriate
- Always align insights and actions to the client’s primary goal when available
- Identify the report's strategic direction from the performance mode and grade
- Do not treat all issues equally; prioritize based on impact on conversions
- If a known issue is provided, treat it as a high-confidence root cause unless the data clearly contradicts it
- Avoid generic phrasing; tie every insight to the specific data or client context
- Clearly identify a primary conversion issue only when one is evident
- Use decisive language when a primary issue, strength, or scaling opportunity is evident
- Avoid hedging when a known issue or strong signal exists
- The report should guide decisions, not just describe possibilities
- When multiple issues exist, prioritize the issue that directly blocks conversions (e.g. broken forms, missing CTA, unclear funnel) over tracking or analytics limitations
- Tracking issues should only be considered the primary blocker if there is strong evidence that conversions are happening but not being recorded
- The report must clearly answer: what is working, what is limiting conversions, what could improve results, what risks to watch, and what to do next
- Every section should reinforce the mode and grade without drifting into unrelated analysis
- Avoid repeating similar points across sections
- Prefer clarity and decisiveness over completeness
- Do not evaluate SEO, ads, design, or technical issues for their own sake; evaluate them only by how they affect conversions, lead quality, revenue, or confidence in the data
- If a recommendation is based on SEO, ads, design, or technical work, explicitly connect it to a conversion outcome or data-confidence outcome
- Do not recommend A/B testing, SEO work, ad expansion, redesigns, or technical audits unless the data or client context supports why that action matters now

Business context:
- Client name: ${client?.name || "Not provided"}
- Website: ${client?.website || "Not provided"}
- Primary goal: ${client?.primary_goal || "Not provided"}
- Monthly goal: ${client?.monthly_goal ?? "Not provided"}
- Average conversion value: ${formatCurrency(client?.average_conversion_value)}
- Conversion types: ${formatList(client?.conversion_types)}
- Conversion tracking status: ${client?.conversion_tracking_status || "Not provided"}
- Customer action location: ${client?.main_cta || "Not provided"}
- Guided funnel and positioning signals: ${client?.funnel_description || "Not provided"}
- Conversion friction and internal issue notes: ${client?.known_issues || "Not provided"}
- Known technical issues: ${client?.technical_issues || "Not provided"}
- Design or layout concerns: ${client?.design_concerns || "Not provided"}
- Ad and channel notes: ${client?.ad_channel_notes || "Not provided"}
- Offer or messaging concerns: ${client?.offer_message_concerns || "Not provided"}
- Tracking confidence notes: ${client?.tracking_notes || "Not provided"}
- Marketing channels: ${formatList(client?.marketing_channels)}
- Running ads: ${
    client?.running_ads == null ? "Not provided" : client.running_ads ? "Yes" : "No"
  }
- Client notes: ${client?.client_notes || "Not provided"}

Monthly performance data:
- Month: ${report.month || "Not provided"}
- Traffic: ${report.traffic ?? 0}
- Page Views: ${report.page_views ?? 0}
- Active Users: ${report.active_users ?? 0}
- Bounce Rate: ${
    report.bounce_rate != null ? `${(report.bounce_rate * 100).toFixed(1)}%` : "N/A"
  }
- Engagement Rate: ${
    report.engagement_rate != null ? `${(report.engagement_rate * 100).toFixed(1)}%` : "N/A"
  }
- Conversions: ${report.conversions ?? 0}
- Notes: ${report.notes || "No additional notes"}

Channel/source performance:
${formatBreakdown(report.channel_performance)}

Landing page performance:
${formatBreakdown(report.landing_page_performance)}

Device performance:
${formatBreakdown(report.device_performance)}

Health score assessment (authoritative):
- Status: ${health.label}
- Score: ${health.score}/100
- Grade: ${health.grade}
- Performance mode: ${health.mode}
- Mode guidance: ${health.modeReason}
- Primary finding: ${health.reason}
- Treat this as the highest priority context when determining the report's strategic direction
- If the mode is Scale or Maintain, do not describe the funnel as broken unless a confirmed issue supports that
- The grade should influence urgency: A/A+ means protect and carefully scale; B/C means improve clear constraints; D/F means fix or investigate before scaling

Performance signals (authoritative, pre-analyzed):
- Treat these as high-confidence inputs.
- Do not contradict them.
- You may expand on them, but do not override them.
${performanceSignals.map((item) => `- ${item}`).join("\n")}

Use exactly these top-level sections and no others:

## Summary Insights & Performance Summary
Write 3-5 complete sentences summarizing the month’s overall performance using the actual data.
Include the performance mode, grade, conversion performance relative to traffic, and goal progress when a monthly goal is provided.
Do not leave this section blank.
Do not write "No details provided."
- Condense the current metric and performance signal logic here
- If the mode is Scale or Maintain, clearly say the funnel is working unless confirmed issues say otherwise
- End with one sentence that states the practical strategic direction for the month

## Strengths: What's Working
Provide 2-4 bullets on the strongest signals helping conversion performance.
- Include only strengths supported by metrics or client context
- Good examples include strong conversion rate, healthy engagement, goal progress, clear CTA/funnel context, useful channel fit, or reliable tracking
- Each bullet should explain why the strength matters for conversions or revenue

## Weaknesses: What's Not Working
Provide 2-4 bullets on the clearest limits or friction points.
- Include only issues supported by metrics, known issues, or missing/uncertain data
- Do not invent design, ad, SEO, or technical problems without evidence
- If performance is strong and no major weakness is confirmed, state the constraint honestly instead of forcing a blocker
- Each bullet should explain how the weakness limits conversions, lead quality, revenue, or confidence in the data

## Opportunities: Where to Improve
Provide 2-4 bullets on realistic opportunities to improve conversions, lead quality, revenue, or data confidence.
- Opportunities should connect to the mode and grade
- If the mode is Scale, focus on qualified traffic, preserving conversion quality, and expanding what is working
- If the mode is Fix, focus on conversion blockers, CTA/funnel friction, page experience, tracking, or technical issues
- If the mode is Maintain, focus on protecting and carefully improving what is working
- If the mode is Investigate, focus on validation steps and missing information

## Threats: Watch Out For
Provide 2-4 bullets on risks that could hurt leads, revenue, conversion quality, or confidence in the data.
- Threats can include tracking uncertainty, technical issues, poor traffic quality, channel over-reliance, weak funnel context, scaling too broadly, or unresolved known issues
- Avoid alarmist language; be direct and practical

## Recommendations
Provide 3-5 specific next steps, prioritized in order of impact.
- The first action must match the report mode
- Clearly prioritize actions in order of impact
- Focus on actions that directly improve conversions before optimization tasks
- Avoid generic advice; each action should be tied to a strength, weakness, opportunity, or threat from this report
- Each recommendation must include a clear reason tied to the grade/mode or a specific metric/context signal
- Prioritize technical reliability, CTA clarity, funnel improvements, landing-page relevance, tracking confidence, traffic quality, and conversion performance over generic advice

Tie recommendations back to the client's stated goal whenever possible.
- Each action should feel like a clear directive, not a suggestion
`.trim();
}
