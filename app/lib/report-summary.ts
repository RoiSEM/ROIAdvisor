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
  key_event_performance?: unknown[] | null;
};

export type SummaryClientData = {
  name?: string | null;
  website?: string | null;
  primary_goal?: string | null;
  monthly_goal?: number | null;
  average_conversion_value?: number | null;
  conversion_types?: string[] | null;
  key_events?: string[] | null;
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
  reportCard: ReportCardComponent[];
  setupScore: number;
  performanceAdjustment: number;
};

export type ReportCardComponent = {
  label: string;
  points: number;
  maxPoints: number;
  status: "Complete" | "Partial" | "Missing" | "Bonus" | "Penalty";
  reason: string;
};

export type BenchmarkInsight = {
  model:
    | "Local Service"
    | "Ecommerce"
    | "SaaS"
    | "Booking"
    | "Email Signup"
    | "Lead Generation"
    | "Unknown";
  confidence: "High" | "Medium" | "Low";
  poor: number;
  average: number;
  good: number;
  excellent: number;
  currentConversionRate: number | null;
  position: "Below Range" | "Within Range" | "Above Range" | "Not Enough Data";
  reason: string;
  setupPrompt: string;
};

type GoalReality = {
  requiredConversionRate: number | null;
  expectedAtAverage: number | null;
  expectedAtGood: number | null;
  expectedAtExcellent: number | null;
  isLikelyUnrealistic: boolean;
  reason: string | null;
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

function getKeyEventCount(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return 0;

  const record = item as Record<string, unknown>;
  const value = record.keyEvents ?? record.key_events ?? record.conversions;

  return typeof value === "number" ? value : Number(value || 0);
}

function hasAnalyticsKeyEvents(report: SummaryReportData) {
  return Boolean(
    report.key_event_performance?.some((item) => getKeyEventCount(item) > 0),
  );
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
  const conversionSurfaces = [
    "form",
    "phone",
    "call",
    "checkout",
    "booking",
    "payment",
    "submit",
    "lead",
    "cta",
    "button",
  ];
  const failureSignals = [
    "broken",
    "blocked",
    "blocking",
    "down",
    "error",
    "failing",
    "failed",
    "not submitting",
    "not working",
    "doesn't work",
    "does not work",
    "can't",
    "cannot",
  ];
  const directBlockerPhrases = [
    "broken form",
    "form not working",
    "phone not working",
    "calls not working",
    "checkout not working",
    "booking not working",
    "payment not working",
    "submit not working",
    "not submitting",
  ];

  if (directBlockerPhrases.some((phrase) => knownIssues.includes(phrase))) {
    return true;
  }

  const hasFailureSignal = failureSignals.some((signal) =>
    knownIssues.includes(signal),
  );
  const hasConversionSurface = conversionSurfaces.some((surface) =>
    knownIssues.includes(surface),
  );

  return hasFailureSignal && hasConversionSurface;
}

function hasUsefulText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function getGrade(score: number): ReportHealthScore["grade"] {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  return "F";
}

function getReportLabel(score: number): ReportHealthScore["label"] {
  if (score >= 80) return "Healthy";
  if (score >= 55) return "Warning";
  return "Critical";
}

function getContextText(client?: SummaryClientData | null) {
  return [
    client?.name,
    client?.website,
    client?.primary_goal,
    client?.main_cta,
    client?.funnel_description,
    client?.known_issues,
    client?.technical_issues,
    client?.design_concerns,
    client?.ad_channel_notes,
    client?.offer_message_concerns,
    client?.tracking_notes,
    client?.client_notes,
    ...(client?.conversion_types ?? []),
    ...(client?.key_events ?? []),
    ...(client?.marketing_channels ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getBenchmarkPreset(model: BenchmarkInsight["model"]) {
  const presets: Record<
    BenchmarkInsight["model"],
    Pick<BenchmarkInsight, "poor" | "average" | "good" | "excellent">
  > = {
    "Local Service": { poor: 4, average: 8, good: 12, excellent: 18 },
    Ecommerce: { poor: 1.5, average: 2.5, good: 4, excellent: 6 },
    SaaS: { poor: 3, average: 7, good: 12, excellent: 18 },
    Booking: { poor: 4, average: 7, good: 10, excellent: 14 },
    "Email Signup": { poor: 2, average: 6, good: 10, excellent: 18 },
    "Lead Generation": { poor: 2, average: 5, good: 8, excellent: 12 },
    Unknown: { poor: 2, average: 5, good: 8, excellent: 12 },
  };

  return presets[model];
}

export function getBenchmarkInsight(
  report: SummaryReportData,
  client?: SummaryClientData | null,
): BenchmarkInsight {
  const context = getContextText(client);
  const conversionTypes = (client?.conversion_types ?? []).join(" ").toLowerCase();
  const primaryGoal = (client?.primary_goal ?? "").toLowerCase();
  const conversionRate =
    (report.traffic ?? 0) > 0 ? ((report.conversions ?? 0) / (report.traffic ?? 1)) * 100 : null;

  let model: BenchmarkInsight["model"] = "Lead Generation";
  let confidence: BenchmarkInsight["confidence"] = "Medium";
  let reason = "Benchmark inferred from the available conversion and business context.";

  if (
    hasAnyKeyword(context, [
      "roof",
      "hvac",
      "plumb",
      "law",
      "attorney",
      "auto glass",
      "windshield",
      "repair",
      "contractor",
      "service area",
      "local",
    ]) ||
    conversionTypes.includes("form") ||
    conversionTypes.includes("phone")
  ) {
    model = "Local Service";
    confidence = "High";
    reason = "Local service benchmark inferred from service, form, phone, or industry language.";
  } else if (
    hasAnyKeyword(context, [
      "ecommerce",
      "e-commerce",
      "shop",
      "cart",
      "checkout",
      "purchase",
      "product",
      "order",
    ]) ||
    conversionTypes.includes("purchase") ||
    primaryGoal.includes("sales")
  ) {
    model = "Ecommerce";
    confidence = "Medium";
    reason = "Ecommerce benchmark inferred from purchase, shopping, or sales language.";
  } else if (
    hasAnyKeyword(context, ["saas", "software", "demo", "trial", "subscription", "mrr"])
  ) {
    model = "SaaS";
    confidence = "Medium";
    reason = "SaaS benchmark inferred from software, trial, demo, or subscription language.";
  } else if (
    hasAnyKeyword(context, ["booking", "appointment", "schedule", "reservation"]) ||
    conversionTypes.includes("booking") ||
    primaryGoal.includes("bookings")
  ) {
    model = "Booking";
    confidence = "Medium";
    reason = "Booking benchmark inferred from appointment or scheduling language.";
  } else if (
    hasAnyKeyword(context, ["email signup", "newsletter", "subscriber", "download"]) ||
    conversionTypes.includes("email")
  ) {
    model = "Email Signup";
    confidence = "Medium";
    reason = "Email signup benchmark inferred from subscriber or newsletter language.";
  }

  if (
    !hasUsefulText(client?.funnel_description) &&
    !client?.conversion_types?.length &&
    !client?.key_events?.length
  ) {
    confidence = "Low";
    reason =
      "Benchmark confidence is low because conversion type and funnel context are incomplete.";
  }

  const preset = getBenchmarkPreset(model);
  const position: BenchmarkInsight["position"] =
    conversionRate == null
      ? "Not Enough Data"
      : conversionRate < preset.poor
        ? "Below Range"
        : conversionRate > preset.excellent
          ? "Above Range"
          : "Within Range";

  return {
    model,
    confidence,
    ...preset,
    currentConversionRate: conversionRate,
    position,
    reason,
    setupPrompt:
      confidence === "Low"
        ? "Add business category, conversion type, funnel action, and tracking confidence to unlock more accurate benchmark guidance."
        : "Add average customer value, close rate, and lead quality context to unlock a stronger growth forecast later.",
  };
}

function formatBenchmarkInsight(benchmark: BenchmarkInsight) {
  const current =
    benchmark.currentConversionRate == null
      ? "N/A"
      : `${benchmark.currentConversionRate.toFixed(1)}%`;

  return [
    `- Inferred model: ${benchmark.model} (${benchmark.confidence} confidence)`,
    `- Benchmark range: poor ${benchmark.poor}%, average ${benchmark.average}%, good ${benchmark.good}%, excellent ${benchmark.excellent}%+`,
    `- Current conversion rate: ${current}`,
    `- Benchmark position: ${benchmark.position}`,
    `- Benchmark rationale: ${benchmark.reason}`,
    `- Setup guidance: ${benchmark.setupPrompt}`,
  ].join("\n");
}

function formatGoalReality(goalReality: GoalReality) {
  if (goalReality.requiredConversionRate == null) {
    return "- Goal realism: not available because traffic or monthly conversion goal is missing.";
  }

  return [
    `- Required conversion rate to hit stated monthly conversion goal: ${goalReality.requiredConversionRate.toFixed(1)}%`,
    `- Expected conversions at average benchmark: ${goalReality.expectedAtAverage}`,
    `- Expected conversions at good benchmark: ${goalReality.expectedAtGood}`,
    `- Expected conversions at excellent benchmark: ${goalReality.expectedAtExcellent}`,
    `- Goal appears unrealistic against current traffic and benchmark: ${goalReality.isLikelyUnrealistic ? "Yes" : "No"}`,
    goalReality.reason ? `- Goal reality note: ${goalReality.reason}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function getGoalReality(
  report: SummaryReportData,
  client: SummaryClientData | null | undefined,
  benchmark: BenchmarkInsight,
): GoalReality {
  const traffic = report.traffic ?? 0;
  const monthlyGoal = client?.monthly_goal ?? null;

  if (!monthlyGoal || traffic <= 0) {
    return {
      requiredConversionRate: null,
      expectedAtAverage: null,
      expectedAtGood: null,
      expectedAtExcellent: null,
      isLikelyUnrealistic: false,
      reason: null,
    };
  }

  const requiredConversionRate = (monthlyGoal / traffic) * 100;
  const expectedAtAverage = Math.round((traffic * benchmark.average) / 100);
  const expectedAtGood = Math.round((traffic * benchmark.good) / 100);
  const expectedAtExcellent = Math.round((traffic * benchmark.excellent) / 100);
  const hasBenchmark = benchmark.confidence !== "Low";
  const isLikelyUnrealistic =
    hasBenchmark && requiredConversionRate > benchmark.excellent;

  return {
    requiredConversionRate,
    expectedAtAverage,
    expectedAtGood,
    expectedAtExcellent,
    isLikelyUnrealistic,
    reason: isLikelyUnrealistic
      ? `The stated monthly conversion goal would require about a ${requiredConversionRate.toFixed(1)}% conversion rate from current traffic, which is above the inferred ${benchmark.model} excellent benchmark of ${benchmark.excellent}%.`
      : null,
  };
}

function getReportCardComponents(
  report: SummaryReportData,
  client?: SummaryClientData | null,
) {
  const hasWebsite = hasUsefulText(client?.website);
  const hasTracking = client?.conversion_tracking_status === "Yes";
  const hasConversionTypes = Boolean(client?.conversion_types?.length);
  const hasManualKeyEvents = Boolean(client?.key_events?.length);
  const hasTrackedKeyEvents = hasAnalyticsKeyEvents(report);
  const keyEventPoints = hasTrackedKeyEvents ? 5 : hasManualKeyEvents ? 2 : 0;
  const hasConversionSetup = hasTracking || hasConversionTypes;
  const monthlyGoal = client?.monthly_goal ?? null;
  const conversions = report.conversions ?? 0;
  const conversionGoalProgress =
    monthlyGoal != null && monthlyGoal > 0 ? conversions / monthlyGoal : null;
  const conversionPoints = !hasConversionSetup
    ? 0
    : conversionGoalProgress == null
      ? 5
      : conversionGoalProgress >= 1
        ? 5
        : conversionGoalProgress >= 0.75
          ? 4
          : conversionGoalProgress >= 0.5
            ? 3
            : conversions > 0
              ? 2
              : 1;
  const conversionStatus: ReportCardComponent["status"] = !hasConversionSetup
    ? "Missing"
    : conversionPoints === 5
      ? "Complete"
      : "Partial";
  const hasValueProp =
    hasUsefulText(client?.offer_message_concerns) ||
    hasUsefulText(client?.funnel_description);
  const hasTraffic = (report.traffic ?? 0) >= 100;
  const hasBusinessContext =
    hasUsefulText(client?.main_cta) ||
    hasUsefulText(client?.funnel_description) ||
    Boolean(client?.marketing_channels?.length) ||
    hasUsefulText(client?.client_notes);

  const components: ReportCardComponent[] = [
    {
      label: "Website Foundation",
      points: hasWebsite ? 60 : 0,
      maxPoints: 60,
      status: hasWebsite ? "Complete" : "Missing",
      reason: hasWebsite
        ? "Website is documented."
        : "Website foundation is missing.",
    },
    {
      label: "Analytics",
      points: hasTracking ? 5 : 0,
      maxPoints: 5,
      status: hasTracking ? "Complete" : "Missing",
      reason: hasTracking
        ? "Analytics and conversion tracking are marked as configured."
        : "Analytics or conversion tracking is not confirmed.",
    },
    {
      label: "Conversions",
      points: conversionPoints,
      maxPoints: 5,
      status: conversionStatus,
      reason: !hasConversionSetup
        ? "Conversion setup is not confirmed yet."
        : conversionGoalProgress == null
          ? hasConversionTypes
            ? "Conversion types are defined."
            : "Conversion setup is confirmed in analytics."
          : conversionGoalProgress >= 1
            ? `The report met the monthly conversion goal with ${conversions} of ${monthlyGoal} conversions.`
            : `Conversion setup is confirmed, but the report reached ${conversions} of ${monthlyGoal} monthly conversions.`,
    },
    {
      label: "Key Events",
      points: keyEventPoints,
      maxPoints: 5,
      status: hasTrackedKeyEvents
        ? "Complete"
        : hasManualKeyEvents
          ? "Partial"
          : "Missing",
      reason: hasTrackedKeyEvents
        ? "GA4 key events are coming through with event-level data."
        : hasManualKeyEvents
          ? "Key events are documented manually, but GA4 event-level data is not coming through yet."
          : "No GA4 key events are available for this report.",
    },
    {
      label: "Value Proposition",
      points: hasValueProp ? 5 : 0,
      maxPoints: 5,
      status: hasValueProp ? "Complete" : "Missing",
      reason: hasValueProp
        ? "Offer, positioning, or funnel context is documented."
        : "Offer and value proposition context is missing.",
    },
    {
      label: "Traffic",
      points: hasTraffic ? 5 : 0,
      maxPoints: 5,
      status: hasTraffic ? "Complete" : "Missing",
      reason: hasTraffic
        ? "Traffic volume is high enough to start judging performance."
        : "Traffic is too low to judge conversion performance confidently.",
    },
    {
      label: "Business Context",
      points: hasBusinessContext ? 5 : 0,
      maxPoints: 5,
      status: hasBusinessContext ? "Complete" : "Missing",
      reason: hasBusinessContext
        ? "Business, funnel, channel, or customer-action context is documented."
        : "Business profile context is too thin for a confident diagnosis.",
    },
  ];

  return components;
}

function getPerformanceAdjustment(
  report: SummaryReportData,
  client?: SummaryClientData | null,
) {
  const signals = getReportSignals(report, client);
  const benchmark = getBenchmarkInsight(report, client);
  const goalReality = getGoalReality(report, client, benchmark);
  const components: ReportCardComponent[] = [];
  let adjustment = 0;

  if (signals.conversionRate != null) {
    if (
      benchmark.confidence !== "Low" &&
      benchmark.position === "Above Range"
    ) {
      adjustment += 5;
      components.push({
        label: "Benchmark Performance",
        points: 5,
        maxPoints: 5,
        status: "Bonus",
        reason: `Conversion rate is above the inferred ${benchmark.model} benchmark range.`,
      });
    } else if (
      benchmark.confidence !== "Low" &&
      benchmark.position === "Within Range"
    ) {
      adjustment += 3;
      components.push({
        label: "Benchmark Performance",
        points: 3,
        maxPoints: 5,
        status: "Bonus",
        reason: `Conversion rate is within the inferred ${benchmark.model} benchmark range.`,
      });
    } else if (
      benchmark.confidence !== "Low" &&
      benchmark.position === "Below Range" &&
      signals.traffic >= 100
    ) {
      adjustment -= 5;
      components.push({
        label: "Benchmark Performance",
        points: -5,
        maxPoints: 5,
        status: "Penalty",
        reason: `Conversion rate is below the inferred ${benchmark.model} benchmark range.`,
      });
    } else if (signals.conversionRate >= 5) {
      adjustment += 3;
      components.push({
        label: "Conversion Performance",
        points: 3,
        maxPoints: 5,
        status: "Bonus",
        reason: `Conversion rate is strong at about ${signals.conversionRate.toFixed(1)}%, but benchmark confidence is limited.`,
      });
    } else if (signals.conversionRate < 1 && signals.traffic >= 100) {
      adjustment -= 3;
      components.push({
        label: "Conversion Performance",
        points: -3,
        maxPoints: 5,
        status: "Penalty",
        reason: `Conversion rate is low at about ${signals.conversionRate.toFixed(1)}%, even before applying an industry-specific benchmark.`,
      });
    }
  }

  if (signals.goalProgress != null) {
    if (signals.goalProgress >= 1) {
      adjustment += 3;
      components.push({
        label: "Goal Progress",
        points: 3,
        maxPoints: 3,
        status: "Bonus",
        reason: "The monthly conversion goal is met or exceeded.",
      });
    } else if (signals.goalProgress < 0.5 && !goalReality.isLikelyUnrealistic) {
      adjustment -= 3;
      components.push({
        label: "Goal Progress",
        points: -3,
        maxPoints: 3,
        status: "Penalty",
        reason: "The report is less than halfway to the monthly conversion goal.",
      });
    } else if (goalReality.isLikelyUnrealistic) {
      components.push({
        label: "Goal Realism",
        points: 0,
        maxPoints: 3,
        status: "Partial",
        reason:
          goalReality.reason ??
          "The stated monthly conversion goal appears high compared with current traffic and inferred benchmark norms.",
      });
    }
  }

  if (signals.bounceRate != null && signals.bounceRate >= 0.65) {
    adjustment -= 2;
    components.push({
      label: "Engagement Quality",
      points: -2,
      maxPoints: 2,
      status: "Penalty",
      reason: "Bounce rate is elevated enough to create page-experience concern.",
    });
  } else if (signals.engagementRate != null && signals.engagementRate >= 0.55) {
    adjustment += 2;
    components.push({
      label: "Engagement Quality",
      points: 2,
      maxPoints: 2,
      status: "Bonus",
      reason: "Engagement rate suggests visitors are interacting with the site.",
    });
  }

  if (signals.hasTrackingConcern) {
    adjustment -= 5;
    components.push({
      label: "Data Confidence",
      points: -5,
      maxPoints: 5,
      status: "Penalty",
      reason: "Tracking is not fully confirmed, reducing confidence in performance.",
    });
  }

  return {
    adjustment: Math.max(-10, Math.min(10, adjustment)),
    components,
  };
}

function formatReportCard(components: ReportCardComponent[]) {
  return components
    .map(
      (component) =>
        `- ${component.label}: ${component.points}/${component.maxPoints} (${component.status}) - ${component.reason}`,
    )
    .join("\n");
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
  const benchmark = getBenchmarkInsight(report, client);
  const goalReality = getGoalReality(report, client, benchmark);

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
    if (goalReality.isLikelyUnrealistic && goalReality.reason) {
      signals.push(
        `${goalReality.reason} The report should treat the gap as a planning problem, not just a conversion failure.`,
      );
    } else {
      signals.push(
        `The current conversion total is ${monthlyGoal - conversions} below the stated monthly conversion goal, so the report should explain whether the gap is caused by traffic volume, conversion efficiency, tracking confidence, or known friction.`,
      );
    }
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

    if (benchmark.confidence !== "Low" && benchmark.position === "Below Range") {
      signals.push(
        `Current conversion rate is about ${conversionRate.toFixed(1)}%, which is below the inferred ${benchmark.model} benchmark range of ${benchmark.poor}% to ${benchmark.excellent}%+.`,
      );
    } else if (
      benchmark.confidence !== "Low" &&
      benchmark.position === "Within Range"
    ) {
      signals.push(
        `Current conversion rate is about ${conversionRate.toFixed(1)}%, which falls within the inferred ${benchmark.model} benchmark range.`,
      );
    } else if (
      benchmark.confidence !== "Low" &&
      benchmark.position === "Above Range"
    ) {
      signals.push(
        `Current conversion rate is about ${conversionRate.toFixed(1)}%, which is above the inferred ${benchmark.model} benchmark range and suggests the funnel may be efficient.`,
      );
    } else if (conversionRate < 1) {
      signals.push(
        `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, which is low enough to justify reviewing landing pages, CTA visibility, and form friction.`,
      );
    } else if (conversionRate >= 5) {
      signals.push(
        `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, which suggests the funnel is working and the next step is likely protecting quality while scaling qualified traffic.`,
      );
    }
  }

  if (benchmark.confidence === "Low") {
    signals.push(
      `Benchmark confidence is low. ${benchmark.setupPrompt}`,
    );
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
    hasTrackingConcern,
    hasConversionTypes,
    hasFunnelContext,
    knownIssues,
  } = getReportSignals(report, client);
  const knownConversionBlocker = hasKnownConversionBlocker(knownIssues);
  const benchmark = getBenchmarkInsight(report, client);
  const goalReality = getGoalReality(report, client, benchmark);
  const setupComponents = getReportCardComponents(report, client);
  const performance = getPerformanceAdjustment(report, client);
  const hasMeasurementFoundation =
    hasUsefulText(client?.website) && client?.conversion_tracking_status === "Yes";
  const setupScore = setupComponents.reduce(
    (total, component) => total + component.points,
    0,
  );
  const performanceAdjustment = performance.adjustment;
  let score = Math.max(
    0,
    Math.min(100, Math.round(setupScore + performanceAdjustment)),
  );
  const reportCard = [...setupComponents, ...performance.components];
  let reason = "The report card foundation is mostly complete and performance has no obvious critical blocker.";
  let mode: ReportHealthScore["mode"] = "Maintain";
  let modeReason =
    "The site is showing stable performance, so the priority is to protect what is working and monitor for changes.";

  if (setupScore < 75) {
    mode = "Investigate";
    modeReason =
      "The report card is missing important setup or context, so the priority is to complete the foundation before judging performance too aggressively.";
    reason = `The report card foundation is incomplete at ${setupScore}/90 before performance adjustment.`;
  }

  if (traffic === 0) {
    score = Math.min(score, 60);
    reason = "No traffic was recorded, so there is no opportunity for conversions yet.";
    mode = "Investigate";
    modeReason =
      "No traffic was recorded, so the report should focus on acquisition visibility and analytics setup before judging the funnel.";
  } else if (traffic > 0 && conversions === 0 && hasConversionTypes) {
    score = Math.min(score, 69);
    reason = "Traffic is present but no conversions were recorded, indicating a conversion blocker.";
    mode = "Fix";
    modeReason =
      "Visitors are reaching the site but not converting, so the report should focus on finding and fixing the conversion issue.";
  }

  if (hasTrackingConcern) {
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
    if (traffic > 0 && conversions === 0) {
      reason = "Conversion goals are not clearly defined, making performance hard to measure and improve.";
    }
  }

  if (knownConversionBlocker) {
    score = Math.min(score, 54);

    reason =
      "A known conversion-blocking issue is documented, so it should be fixed before scaling traffic or making surface-level optimizations.";
    mode = "Fix";
    modeReason =
      "A known technical or funnel issue is likely blocking conversions, so the report should prioritize repair work.";
  }

  if (conversionRate != null) {
    if (benchmark.confidence !== "Low" && benchmark.position === "Above Range") {
      reason = `Conversion performance is strong at about ${conversionRate.toFixed(1)}%, above the inferred ${benchmark.model} benchmark range.`;
    } else if (
      benchmark.confidence !== "Low" &&
      benchmark.position === "Within Range"
    ) {
      reason = `Conversion performance is about ${conversionRate.toFixed(1)}%, which is within the inferred ${benchmark.model} benchmark range.`;
    } else if (
      benchmark.confidence !== "Low" &&
      benchmark.position === "Below Range" &&
      traffic >= 100
    ) {
      score = Math.min(score, 74);
      reason = `Conversion performance is about ${conversionRate.toFixed(1)}%, below the inferred ${benchmark.model} benchmark range.`;
      mode = "Fix";
      modeReason =
        "Traffic is available but conversion efficiency is below the inferred benchmark, so the report should focus on improving the site, offer, CTA, or funnel.";
    } else if (conversionRate >= 5) {
      reason = `Conversion performance is strong at about ${conversionRate.toFixed(1)}%, though more context would make benchmark confidence stronger.`;
    } else if (conversionRate >= 2) {
      reason = `Conversions are being generated at about ${conversionRate.toFixed(1)}%, but there is still room to improve efficiency.`;
    } else if (traffic >= 100) {
      score = Math.min(score, 74);
      reason = `Estimated conversion rate is about ${conversionRate.toFixed(1)}%, so the report should focus on improving conversion quality before scaling traffic.`;
      mode = "Fix";
      modeReason =
        "Traffic is available but conversion efficiency is weak, so the report should focus on improving the site, offer, CTA, or funnel.";
    }
  }

  if (goalGap != null) {
    if (conversionRate != null && conversionRate >= 5 && mode === "Maintain") {
      mode = "Scale";
      modeReason =
        goalReality.isLikelyUnrealistic
          ? "The site is converting visitors effectively, but the stated monthly conversion goal likely requires more traffic or a stronger offer than the current volume can support."
          : "The site is converting visitors effectively, but total conversion volume is still below the monthly conversion goal.";
      reason = goalReality.isLikelyUnrealistic && goalReality.reason
        ? `Conversion performance is strong at about ${conversionRate.toFixed(1)}%. ${goalReality.reason}`
        : `Conversion performance is strong at about ${conversionRate.toFixed(1)}%, but the report is ${goalGap} conversions short of the monthly conversion goal.`;
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

  if (goalGap != null && goalProgress != null && !goalReality.isLikelyUnrealistic) {
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

  if (!hasFunnelContext && score > 84) {
    score = 84;
    if (mode === "Maintain") {
      mode = "Investigate";
      modeReason =
        "The report has enough performance data, but funnel context is incomplete and should be confirmed before major recommendations.";
    }
  }

  if (hasMeasurementFoundation && !knownConversionBlocker && score < 70) {
    score = 70;
    if (mode === "Investigate") {
      modeReason =
        "The site has the basic measurement foundation in place, so the next step is filling in business context and using the data to find the best lever.";
    }
    if (reason.includes("foundation is incomplete")) {
      reason =
        "The website and conversion tracking foundation are in place, but business context and performance details still need work.";
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = getGrade(score);
  const label = getReportLabel(score);

  return {
    label,
    score,
    grade,
    mode,
    modeReason,
    reason,
    reportCard,
    setupScore,
    performanceAdjustment,
  };
}

export function buildPreviewSummary(
  report: SummaryReportData,
  client?: SummaryClientData | null,
) {
  const engagementRate = `${((report.engagement_rate ?? 0) * 100).toFixed(1)}%`;
  const performanceSignals = getPerformanceSignals(report, client);
  const health = getReportHealthScore(report, client);
  const benchmark = getBenchmarkInsight(report, client);
  const goalLine = client?.primary_goal
    ? ` The primary business goal is ${client.primary_goal.toLowerCase()}.`
    : "";

  return [
    "## Summary Insights & Performance Summary",
    `Here is the quick read for ${report.month || "this period"}: ${report.traffic ?? 0} visitors, ${report.page_views ?? 0} page views, ${report.active_users ?? 0} active users, and ${report.conversions ?? 0} conversions.${goalLine}`,
    `Current call: ${health.mode} mode, grade ${health.grade}. Setup is ${health.setupScore}/90 with a ${health.performanceAdjustment >= 0 ? "+" : ""}${health.performanceAdjustment} performance adjustment. ${health.reason}`,
    `Benchmark read: this looks like a ${benchmark.model} funnel with ${benchmark.confidence.toLowerCase()} confidence. Current position: ${benchmark.position}.`,
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
    "- Generate the full AI summary to turn the data into a clear conversion action plan.",
    "- Compare traffic sources and landing pages against conversions so the report can show what is actually worth scaling.",
    "- Add campaign, offer, technical, or design notes before generating the final summary if you want sharper recommendations.",
    "",
    "## Threats: Watch Out For",
    "- Missing tracking, unclear funnel context, technical issues, or poor channel fit can reduce confidence in the report.",
    "- Scaling traffic before confirming conversion quality can increase spend without improving leads or revenue.",
    "",
    "## Recommendations",
    "- Generate the AI summary to replace this preview with a tailored SWOT-style report.",
    "- Fix what blocks conversions before pushing for more traffic.",
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
  const benchmark = getBenchmarkInsight(report, client);
  const goalReality = getGoalReality(report, client, benchmark);

  return `
Generate a client-facing monthly conversion performance report in markdown only.

Primary objective:
Explain what is helping or hurting conversion performance across traffic quality, page experience, technical reliability, offer and messaging fit, channel performance, and tracking confidence. Use common-sense business language that tells the client what matters, why it matters, and what to do next.

Important rules:
- Return only the report content in markdown
- Do not include HTML, JSX, XML, or code
- Do not add any extra top-level sections
- Do not add a generic "Summary" section
- Use the exact SWOT-style section headings provided below
- If information is missing, say it is not confirmed or not provided
- Do not present missing data as a proven fact
- Avoid absolute statements unless explicitly confirmed by inputs
- Keep the tone direct, practical, confident, and client-friendly
- Sound like a plain-spoken business operator, not an academic analyst
- Do not imitate or mention any public figure by name
- Avoid corporate buzzwords, consultant filler, and overly technical phrasing
- Avoid phrases like "stands at," "indicates that," "showcasing," "yielding quality leads," and "it is vital"
- Prefer short sentences and simple words
- Use straight talk: say the business implication of each point instead of just naming the metric
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
- Do not say SEO work is succeeding just because organic search has conversions; say organic search is producing conversions unless SEO work is explicitly confirmed
- If a recommendation is based on SEO, ads, design, or technical work, explicitly connect it to a conversion outcome or data-confidence outcome
- Do not recommend A/B testing, SEO work, ad expansion, redesigns, or technical audits unless the data or client context supports why that action matters now
- Use inferred benchmark context when confidence is Medium or High, but clearly say when benchmark confidence is Low and ask for better business/funnel context
- Treat bounce rate under 55% as acceptable, 55-65% as a watch item, and 65%+ as a stronger page-experience concern
- If the stated monthly conversion goal requires a conversion rate above the excellent benchmark for current traffic, explain that the target is probably a planning/traffic gap, not proof the funnel is failing
- Give credit for recorded conversions. A site with real conversions should not be described as broken unless a confirmed blocker or very weak conversion rate supports that

Business context:
- Client name: ${client?.name || "Not provided"}
- Website: ${client?.website || "Not provided"}
- Primary goal: ${client?.primary_goal || "Not provided"}
- Monthly conversion goal: ${client?.monthly_goal ?? "Not provided"}
- Average conversion value: ${formatCurrency(client?.average_conversion_value)}
- Conversion types: ${formatList(client?.conversion_types)}
- Key events to monitor: ${formatList(client?.key_events)}
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

Key event performance:
${formatBreakdown(report.key_event_performance)}

Health score assessment (authoritative):
- Status: ${health.label}
- Score: ${health.score}/100
- Grade: ${health.grade}
- Setup score: ${health.setupScore}/90
- Performance adjustment: ${
    health.performanceAdjustment >= 0
      ? `+${health.performanceAdjustment}`
      : health.performanceAdjustment
  }/10
- Performance mode: ${health.mode}
- Mode guidance: ${health.modeReason}
- Primary finding: ${health.reason}
- Treat this as the highest priority context when determining the report's strategic direction
- If the mode is Scale or Maintain, do not describe the funnel as broken unless a confirmed issue supports that
- The grade should influence urgency: A/A+ means protect and carefully scale; B/C means improve clear constraints; D/F means fix or investigate before scaling

Report card components (authoritative):
${formatReportCard(health.reportCard)}

Inferred benchmark context (authoritative):
${formatBenchmarkInsight(benchmark)}

Goal realism context (authoritative):
${formatGoalReality(goalReality)}

Performance signals (authoritative, pre-analyzed):
- Treat these as high-confidence inputs.
- Do not contradict them.
- You may expand on them, but do not override them.
${performanceSignals.map((item) => `- ${item}`).join("\n")}

Use exactly these top-level sections and no others:

## Summary Insights & Performance Summary
Write 3-5 complete sentences summarizing the month’s overall performance using the actual data.
Include the performance mode, grade, conversion performance relative to traffic, and goal progress when a monthly conversion goal is provided.
Do not leave this section blank.
Do not write "No details provided."
- Condense the current metric and performance signal logic here
- Lead with the plain business takeaway, then support it with the numbers
- If the mode is Scale or Maintain, clearly say the funnel is working unless confirmed issues say otherwise
- End with one sentence that states the practical strategic direction for the month in plain English

## Strengths: What's Working
Provide 2-4 bullets on the strongest signals helping conversion performance.
- Include only strengths supported by metrics or client context
- Good examples include strong conversion rate, healthy engagement, goal progress, clear CTA/funnel context, useful channel fit, or reliable tracking
- Each bullet should explain why the strength matters for conversions or revenue in a direct, useful way

## Weaknesses: What's Not Working
Provide 2-4 bullets on the clearest limits or friction points.
- Include only issues supported by metrics, known issues, or missing/uncertain data
- Do not invent design, ad, SEO, or technical problems without evidence
- If performance is strong and no major weakness is confirmed, state the constraint honestly instead of forcing a blocker
- Each bullet should explain how the weakness limits conversions, lead quality, revenue, or confidence in the data
- Be plain about the cost of the weakness without being alarmist

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
- Write each recommendation as a clear directive, not a soft suggestion

Tie recommendations back to the client's stated goal whenever possible.
- Each action should feel like a clear directive, not a suggestion
`.trim();
}
