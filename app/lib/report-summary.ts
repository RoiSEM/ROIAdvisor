export type SummaryReportData = {
  month: string | null;
  traffic: number | null;
  page_views?: number | null;
  active_users?: number | null;
  bounce_rate?: number | null;
  engagement_rate?: number | null;
  conversions: number | null;
  notes: string | null;
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
  marketing_channels?: string[] | null;
  running_ads?: boolean | null;
  client_notes?: string | null;
};

export type ReportHealthScore = {
  label: "Healthy" | "Warning" | "Critical";
  score: number;
  reason: string;
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

export function getConversionDiagnosis(
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

  const diagnosis: string[] = [];

  if (conversionTrackingStatus === "No") {
    diagnosis.push(
      "Conversion tracking is marked as not set up, so reported conversion performance is likely incomplete until tracking is configured.",
    );
  } else if (conversionTrackingStatus === "Not sure") {
    diagnosis.push(
      "Conversion tracking status is uncertain, so treat conversion counts cautiously until the setup is verified in GA4 and on-site forms or calls.",
    );
  }

  if (traffic > 0 && conversions === 0) {
    diagnosis.push(
      "The site is receiving traffic but has no recorded conversions for this period, which points to either a tracking gap or friction in the CTA and lead flow.",
    );
  }

  if (monthlyGoal != null && conversions < monthlyGoal) {
    diagnosis.push(
      `The current conversion total is ${monthlyGoal - conversions} below the stated monthly goal, so the funnel is under target for this period.`,
    );
  }

  if (
    conversionTrackingStatus === "Yes" &&
    traffic >= 100 &&
    conversions <= 1 &&
    engagementRate != null &&
    engagementRate >= 0.55
  ) {
    diagnosis.push(
      "Visitors are engaging with the site but not turning into conversions, which suggests the offer, CTA clarity, or post-click funnel may be the main bottleneck.",
    );
  }

  if (bounceRate != null && bounceRate >= 0.65) {
    diagnosis.push(
      "Bounce rate is elevated, which can indicate landing-page mismatch, weak intent alignment, or a page experience issue before users reach the main CTA.",
    );
  }

  if (traffic > 0 && conversions > 0) {
    const conversionRate = (conversions / traffic) * 100;

    if (conversionRate < 1) {
      diagnosis.push(
        `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, which is low enough to justify reviewing landing pages, CTA visibility, and form friction.`,
      );
    } else if (conversionRate >= 5) {
      diagnosis.push(
        `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, which suggests the offer is resonating and the next step is likely scaling qualified traffic.`,
      );
    }
  }

  if (runningAds === true && conversions === 0) {
    diagnosis.push(
      "Paid traffic is currently running without measurable conversions, so ad intent, landing-page alignment, and tracking should be checked together.",
    );
  }

  if (marketingChannels.length === 0) {
    diagnosis.push(
      "Traffic sources were not specified, which makes it harder to isolate whether the conversion issue is channel quality, landing pages, or the site funnel itself.",
    );
  }

  if (conversionTypes.length === 0) {
    diagnosis.push(
      "No conversion types are defined yet, so the business should clarify what counts as success before performance is evaluated too confidently.",
    );
  }

  if (!hasFunnelContext && pageViews > 0) {
    diagnosis.push(
      "The funnel path after a site visit is not documented yet, so a conversion drop-off may be happening after the initial page view but before the final action.",
    );
  }

  if (diagnosis.length === 0) {
    diagnosis.push(
      "The current data does not show an obvious conversion breakdown, so the priority is to monitor trend movement and compare channel quality against goal completion over time.",
    );
  }

  return diagnosis.slice(0, 4);
}

export function getReportHealthScore(
  report: SummaryReportData,
  client?: SummaryClientData | null,
): ReportHealthScore {
  const traffic = report.traffic ?? 0;
  const conversions = report.conversions ?? 0;
  const bounceRate = report.bounce_rate ?? null;
  const engagementRate = report.engagement_rate ?? null;
  const conversionTrackingStatus = client?.conversion_tracking_status ?? null;
  const hasConversionTypes = Boolean(client?.conversion_types?.length);
  const hasFunnelContext = Boolean(client?.main_cta || client?.funnel_description);
  const knownIssues = (client?.known_issues || "").toLowerCase();
  const monthlyGoal = client?.monthly_goal ?? null;

  let score = 100;
  let reason = "Performance is stable with no obvious critical blocker.";

  if (traffic === 0) {
    score -= 45;
    reason = "No traffic was recorded, so there is no opportunity for conversions yet.";
  }

  if (traffic > 0 && conversions === 0) {
    score -= 35;
    reason = "Traffic is present but no conversions were recorded, indicating a conversion blocker.";
  }

  if (conversionTrackingStatus === "No") {
    score -= 20;
    if (traffic > 0 && conversions === 0) {
      reason = "Traffic is present but conversion tracking is not configured, limiting visibility into the funnel.";
    }
  } else if (conversionTrackingStatus === "Not sure") {
    score -= 10;
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

  if (knownIssues.includes("form")) {
    score -= 25;

    reason =
      "Primary blocker: form functionality issues are preventing users from submitting leads. This must be fixed before any traffic or optimization efforts will produce results.";

    return {
      label: "Critical",
      score: Math.max(0, Math.round(score)),
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

  if (traffic > 0 && conversions > 0) {
    const conversionRate = (conversions / traffic) * 100;

    if (conversionRate >= 5) {
      score += 10;
      reason = `Conversion performance is strong at about ${conversionRate.toFixed(1)}%, suggesting the foundation is working.`;
    } else if (conversionRate >= 2) {
      score += 5;
      reason = `Conversions are being generated at about ${conversionRate.toFixed(1)}%, but there is still room to improve efficiency.`;
    }
  }

  if (monthlyGoal != null && conversions < monthlyGoal) {
    score -= Math.min(10, monthlyGoal - conversions);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 80) {
    return { label: "Healthy", score, reason };
  }

  if (score >= 55) {
    return { label: "Warning", score, reason };
  }

  return { label: "Critical", score, reason };
}

export function buildPreviewSummary(
  report: SummaryReportData,
  client?: SummaryClientData | null,
) {
  const bounceRate = `${((report.bounce_rate ?? 0) * 100).toFixed(1)}%`;
  const engagementRate = `${((report.engagement_rate ?? 0) * 100).toFixed(1)}%`;
  const conversionDiagnosis = getConversionDiagnosis(report, client);
  const goalLine = client?.primary_goal
    ? ` The primary business goal is ${client.primary_goal.toLowerCase()}.`
    : "";

  return [
    "## Performance Summary",
    `This preview is based on the current report data for ${report.month || "this period"}. Traffic is ${report.traffic ?? 0}, page views are ${report.page_views ?? 0}, and active users are ${report.active_users ?? 0}.${goalLine}`,
    "",
    "## Key Insights",
    `- Traffic currently sits at ${report.traffic ?? 0} with ${report.page_views ?? 0} page views.`,
    `- Engagement rate is ${engagementRate} and bounce rate is ${bounceRate}.`,
    `- Conversions recorded so far: ${report.conversions ?? 0}.`,
    "",
    "## Conversion Diagnosis",
    ...conversionDiagnosis.map((item) => `- ${item}`),
    "",
    "## Opportunities",
    "- Review the top-performing landing pages and replicate their structure on weaker pages.",
    "- Compare acquisition sources against conversions to spot the most efficient channels.",
    "- Use the notes section to capture campaign context before generating the full AI summary.",
    "",
    "## Recommended Actions",
    "- Generate the AI summary to replace this preview with a tailored narrative.",
    "- Print or download the report to review the current layout and formatting.",
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
  const diagnosis = getConversionDiagnosis(report, client);
  const health = getReportHealthScore(report, client);

  return `
Generate a client-facing monthly digital marketing report in markdown only.

Primary objective:
Explain why conversions are happening, not happening, or underperforming based on the available data and business context.

Important rules:
- Return only the report content in markdown
- Do not include HTML, JSX, XML, or code
- Do not add any extra top-level sections
- Do not add a generic "Summary" section
- If information is missing, say it is not confirmed or not provided
- Do not present missing data as a proven fact
- Avoid absolute statements unless explicitly confirmed by inputs
- Keep the tone professional, concise, strategic, and client-friendly
- Focus on business outcomes, conversion bottlenecks, and practical next steps
- If conversions are 0, treat that as the central issue of the report
- If traffic is 0, focus on acquisition and tracking validation (do not analyze engagement or conversions)
- Separate confirmed issues from probable issues where appropriate
- Always align insights and actions to the client’s primary goal when available
- Identify the single most critical issue and lead with it
- Do not treat all issues equally; prioritize based on impact on conversions
- If a known issue is provided, treat it as a high-confidence root cause unless the data clearly contradicts it
- Avoid generic phrasing; tie every insight to the specific data or client context
- Clearly identify and state the single primary conversion blocker
- Use decisive language when a primary issue is evident
- Avoid hedging when a known issue or strong signal exists
- The report should guide decisions, not just describe possibilities
- When multiple issues exist, prioritize the issue that directly blocks conversions (e.g. broken forms, missing CTA, unclear funnel) over tracking or analytics limitations
- Tracking issues should only be considered the primary blocker if there is strong evidence that conversions are happening but not being recorded
- The report must clearly answer: “What is broken, why it matters, and what to fix first”
- Every section should reinforce the primary issue and not drift into unrelated analysis
- Avoid repeating similar points across sections
- Prefer clarity and decisiveness over completeness

Business context:
- Client name: ${client?.name || "Not provided"}
- Website: ${client?.website || "Not provided"}
- Primary goal: ${client?.primary_goal || "Not provided"}
- Monthly goal: ${client?.monthly_goal ?? "Not provided"}
- Average conversion value: ${formatCurrency(client?.average_conversion_value)}
- Conversion types: ${formatList(client?.conversion_types)}
- Conversion tracking status: ${client?.conversion_tracking_status || "Not provided"}
- Main CTA: ${client?.main_cta || "Not provided"}
- Funnel description: ${client?.funnel_description || "Not provided"}
- Known issues: ${client?.known_issues || "Not provided"}
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

Health score assessment (authoritative):
- Status: ${health.label}
- Score: ${health.score}/100
- Primary finding: ${health.reason}
- Treat this as the highest priority context when determining the primary issue

Conversion diagnosis signals (authoritative, pre-analyzed):
- Treat these as high-confidence inputs.
- Do not contradict them.
- You may expand on them, but do not override them.
${diagnosis.map((item) => `- ${item}`).join("\n")}

Use exactly these top-level sections and no others:

## Performance Summary
Write 2-4 complete sentences summarizing the month’s overall performance using the actual data.
Include a direct statement about conversion performance relative to traffic and (if provided) the monthly goal.
Do not leave this section blank.
Do not write "No details provided."
- Include a clear statement identifying the primary issue affecting performance
- The final sentence must clearly state the primary issue in one direct sentence

## Key Insights
Provide 3-5 data-driven insights based on the metrics and business context.
Each insight should explain what the metric implies for the business, not just restate numbers.
- Do not include generic observations; each insight must directly support or explain the primary issue

## Conversion Diagnosis
Start by clearly stating the single primary conversion blocker.

- Prioritize issues that directly prevent conversions (e.g. broken forms, missing CTA, unclear funnel)
- Do NOT default to tracking issues as the primary cause unless strongly supported
- If a known issue is provided (such as form issues), treat it as the primary blocker unless contradicted by data
- Support the primary issue with data and/or client context
- Then list 1–2 secondary contributing issues only
- Distinguish between confirmed issues and probable issues
- Avoid overloading this section with too many possibilities

## Opportunities
Provide 2-4 realistic opportunities to improve performance based on the data.
- Each opportunity must directly relate to resolving the primary conversion blocker
- Avoid broad or unrelated growth ideas
- Focus on leverage points that can unlock conversions quickly

## Recommended Actions
Provide 3-5 specific next steps.
- The first action must address the primary conversion blocker
- Clearly prioritize actions in order of impact
- Focus on actions that directly improve conversions before optimization tasks
- Avoid generic advice; each action should be tied to a diagnosed issue
- Prioritize tracking, CTA clarity, funnel improvements, landing-page relevance, and conversion performance over generic advice

Tie recommendations back to the client's stated goal whenever possible.
- Each action should feel like a clear directive, not a suggestion
`.trim();
}
