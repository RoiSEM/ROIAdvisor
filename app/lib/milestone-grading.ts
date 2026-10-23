import {
  readConnectionProof,
  removeConnectionProof,
} from "@/lib/connection-proof";

export type Milestone = {
  id: string;
  title: string;
  description: string;
  points: number;
  maxPoints: number;
  complete: boolean;
  category: "readiness" | "results";
  evidence: string;
  guideSlug: string;
  actionLabel: string;
};
export type MilestoneAssessment = {
  version: string;
  score: number;
  readinessScore: number;
  resultsScore: number;
  connected: boolean;
  connectionKind: "ga4" | "upload" | "unverified";
  stage: string;
  explanation: string;
  milestones: Milestone[];
  warnings: string[];
};
export type MilestoneClient = {
  ga4_property_id?: string | null;
  primary_goal?: string | null;
  monthly_goal?: number | null;
  average_conversion_value?: number | null;
  conversion_types?: string[] | null;
  key_events?: string[] | null;
  conversion_tracking_status?: string | null;
  main_cta?: string | null;
  tracking_notes?: string | null;
};
export type MilestoneReport = {
  traffic?: number | null;
  conversions?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
};
export type ReadinessProfile = {
  trackingTest?: {
    date: string;
    outcome: "passed" | "failed";
    note?: string;
  } | null;
  inquiryProcess?: string | null;
  targetEventRate?: number | null;
  comparison?: {
    startDate: string;
    endDate: string;
    traffic: number;
    conversions: number;
  } | null;
  experiment?: {
    date: string;
    note: string;
    outcome: "improved" | "inconclusive" | "declined";
  } | null;
};
const START = "[convert-readiness-v1]",
  END = "[/convert-readiness-v1]";
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const positive = (v: unknown): v is number => count(v) && v > 0;
const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
function day(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const ms = Date.parse(value + "T00:00:00.000Z");
  return Number.isFinite(ms) &&
    new Date(ms).toISOString().slice(0, 10) === value
    ? ms
    : null;
}
function validPastDay(value: unknown) {
  const d = day(value);
  return d !== null && d <= Date.now();
}
function cleanProfile(value: unknown): ReadinessProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const p = value as Record<string, unknown>,
    result: ReadinessProfile = {};
  if (text(p.inquiryProcess) && p.inquiryProcess.length <= 500)
    result.inquiryProcess = p.inquiryProcess.trim();
  if (positive(p.targetEventRate) && p.targetEventRate <= 100)
    result.targetEventRate = p.targetEventRate;
  const t = p.trackingTest as Record<string, unknown> | undefined;
  if (
    t &&
    validPastDay(t.date) &&
    (t.outcome === "passed" || t.outcome === "failed") &&
    typeof t.note === "string" &&
    t.note.length <= 500
  )
    result.trackingTest = {
      date: t.date as string,
      outcome: t.outcome,
      note: t.note.trim(),
    };
  const c = p.comparison as Record<string, unknown> | undefined;
  if (
    c &&
    validPastDay(c.startDate) &&
    validPastDay(c.endDate) &&
    day(c.startDate)! <= day(c.endDate)! &&
    count(c.traffic) &&
    count(c.conversions)
  )
    result.comparison = {
      startDate: c.startDate as string,
      endDate: c.endDate as string,
      traffic: c.traffic,
      conversions: c.conversions,
    };
  const e = p.experiment as Record<string, unknown> | undefined;
  if (
    e &&
    validPastDay(e.date) &&
    text(e.note) &&
    e.note.length <= 500 &&
    (e.outcome === "improved" ||
      e.outcome === "inconclusive" ||
      e.outcome === "declined")
  )
    result.experiment = {
      date: e.date as string,
      note: e.note.trim(),
      outcome: e.outcome,
    };
  return result;
}
export function parseReadinessProfile(
  value: string | null | undefined,
): ReadinessProfile {
  if (typeof value !== "string" || value.length > 50000) return {};
  const matches = value
    .split(/\r?\n/)
    .filter((line) => line.startsWith(START) && line.endsWith(END));
  if (matches.length !== 1 || matches[0].length > 6000) return {};
  try {
    return cleanProfile(
      JSON.parse(matches[0].slice(START.length, -END.length)),
    );
  } catch {
    return {};
  }
}
export function removeReadinessProfile(
  value: string | null | undefined,
): string {
  return typeof value === "string"
    ? value
        .split(/\r?\n/)
        .filter((line) => !line.includes(START) && !line.includes(END))
        .join("\n")
        .trim()
    : "";
}
export function serializeReadinessProfile(
  existing: string | null | undefined,
  profile: ReadinessProfile,
): string {
  const ordinary = removeReadinessProfile(existing);
  // Append so a protected connection proof stays on the first line.
  return [ordinary, START + JSON.stringify(cleanProfile(profile)) + END]
    .filter(Boolean)
    .join("\n");
}
export function humanTrackingNotes(value: string | null | undefined): string {
  return removeReadinessProfile(removeConnectionProof(value));
}

export function getMilestoneAssessment(
  report: MilestoneReport | null,
  client: MilestoneClient | null,
): MilestoneAssessment {
  const profile = parseReadinessProfile(client?.tracking_notes);
  const property = client?.ga4_property_id?.trim();
  const cp = readConnectionProof(client?.tracking_notes),
    rp = readConnectionProof(report?.notes);
  const validMetrics = count(report?.traffic) && count(report?.conversions);
  const ga4 = Boolean(
    property &&
    /^\d{1,20}$/.test(property) &&
    ((cp?.source === "ga4" && cp.propertyId === property) ||
      (validMetrics && rp?.source === "ga4" && rp.propertyId === property)),
  );
  const uploaded = Boolean(!ga4 && validMetrics && rp?.source === "upload");
  const connected = ga4 || uploaded;
  const warnings: string[] = [];
  if (!connected)
    warnings.push(
      "Connection is not yet confirmed. This is a starting point, not a judgment that the website is failing.",
    );
  if (uploaded)
    warnings.push(
      "Uploaded measurements are user-supplied; this does not establish a live Analytics connection or independently verified outcomes.",
    );
  const tracking = client?.conversion_tracking_status === "Yes";
  const namedEvents =
    Array.isArray(client?.key_events) && client.key_events.some(text);
  const action = Boolean(
    client?.conversion_types?.some(text) || text(client?.main_cta),
  );
  const goal = positive(client?.monthly_goal) && text(client?.primary_goal);
  const value = positive(client?.average_conversion_value);
  const configured = tracking && namedEvents;
  const tested = Boolean(
    profile.trackingTest?.outcome === "passed" &&
    text(profile.trackingTest.note),
  );
  const followup = text(profile.inquiryProcess);
  const readinessScore = connected
    ? 40 +
      5 *
        [action, goal, value, configured, tested, followup].filter(Boolean)
          .length
    : 0;
  const traffic = validMetrics ? report!.traffic! : 0,
    conversions = validMetrics ? report!.conversions! : 0;
  const start = day(report?.start_date),
    end = day(report?.end_date);
  const validPeriod =
    start !== null && end !== null && start <= end && end <= Date.now();
  const checkBeforeEnd = Boolean(
    validPeriod &&
    profile.trackingTest &&
    day(profile.trackingTest.date)! <= end!,
  );
  // Launch policy, NOT statistical significance or an industry benchmark.
  const eligible =
    readinessScore === 70 &&
    validMetrics &&
    validPeriod &&
    checkBeforeEnd &&
    traffic >= 100 &&
    conversions >= 5;
  if (connected)
    warnings.push(
      "Results points require completed readiness, a dated report, at least 100 sessions and 5 recorded events. This launch policy is not a guarantee of statistical confidence.",
    );
  const current = validPeriod ? new Date(start!) : null;
  const monthEnd = current
    ? Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)
    : null;
  const wholeMonth = Boolean(
    current && current.getUTCDate() === 1 && end === monthEnd,
  );
  const activity = eligible ? 5 : 0;
  const goalPoints =
    eligible && wholeMonth && goal
      ? Math.min(8, Math.floor((8 * conversions) / client!.monthly_goal!))
      : 0;
  const ratio =
    eligible &&
    conversions <= traffic &&
    positive(profile.targetEventRate) &&
    (conversions / traffic) * 100 >= profile.targetEventRate
      ? 8
      : 0;
  const comp = profile.comparison;
  const compStart = day(comp?.startDate),
    compEnd = day(comp?.endDate);
  const comparable = Boolean(
    eligible &&
    comp &&
    compStart !== null &&
    compEnd !== null &&
    compEnd < start! &&
    compEnd - compStart === end! - start! &&
    comp.traffic >= 100 &&
    comp.conversions >= 5 &&
    comp.conversions <= comp.traffic &&
    conversions <= traffic &&
    conversions / traffic > comp.conversions / comp.traffic,
  );
  const comparison = comparable ? 4 : 0;
  const exp = profile.experiment,
    expDay = day(exp?.date);
  const experiment =
    comparable &&
    exp?.outcome === "improved" &&
    text(exp.note) &&
    expDay !== null &&
    expDay >= start! &&
    expDay <= end!
      ? 4
      : 0;
  const resultsScore = activity + goalPoints + ratio + comparison + experiment;
  const score = readinessScore + resultsScore;
  const milestones: Milestone[] = [];
  function add(
    id: string,
    title: string,
    description: string,
    maxPoints: number,
    earned: number,
    category: "readiness" | "results",
    evidence: string,
    guideSlug: string,
  ) {
    const points = connected ? earned : 0;
    milestones.push({
      id,
      title,
      description,
      maxPoints,
      points,
      category,
      complete: points === maxPoints,
      evidence,
      guideSlug,
      actionLabel: "Show me how",
    });
  }
  add(
    "connect-analytics",
    "Connect your website data",
    "Confirm Analytics access or import a supported report to begin.",
    40,
    connected ? 40 : 0,
    "readiness",
    ga4
      ? `Server confirmed access to property ${property}.`
      : uploaded
        ? "Supported uploaded measurements; not a live connection."
        : "No successful connection check or supported import is recorded.",
    "connect-analytics",
  );
  add(
    "action-defined",
    "Choose your customer action",
    "Define the completed action you want a visitor to take.",
    5,
    action ? 5 : 0,
    "readiness",
    action
      ? "Owner-defined action; website functionality is not established by this answer."
      : "Choose a meaningful action, such as a completed quote request.",
    "define-action",
  );
  add(
    "monthly-goal",
    "Set your monthly goal",
    "Choose a useful monthly target and state the business goal.",
    5,
    goal ? 5 : 0,
    "readiness",
    goal
      ? "Owner-defined goal; feasibility is not independently established."
      : "Goal is not defined yet. You can finish onboarding without guessing.",
    "set-goal",
  );
  add(
    "conversion-value",
    "Understand conversion value",
    "Record a reasonable value for the defined action, labeling estimates.",
    5,
    value ? 5 : 0,
    "readiness",
    value
      ? "Owner-supplied conversion value, not measured revenue or acquisition cost."
      : "Value is unknown; do not substitute the price of a booked job for an inquiry.",
    "conversion-value",
  );
  add(
    "configure-events",
    "Configure your key events",
    "Name the events and confirm the intended recording is configured.",
    5,
    configured ? 5 : 0,
    "readiness",
    configured
      ? "Owner-reported configuration with named events, not a verified accuracy claim."
      : "Named events and owner-confirmed setup are still needed.",
    "configure-events",
  );
  add(
    "tracking-check",
    "Test the complete journey",
    "Check submission, business receipt and Analytics recording; document the result.",
    5,
    tested ? 5 : 0,
    "readiness",
    tested
      ? `Owner-reported controlled check passed on ${profile.trackingTest!.date}.`
      : "A successful documented check is not established; a failed test needs attention.",
    "test-tracking",
  );
  add(
    "followup-process",
    "Keep an inquiry record",
    "Describe how you record, respond to and review inquiries.",
    5,
    followup ? 5 : 0,
    "readiness",
    followup
      ? "Owner-described process, not an independent audit; a sample can establish readiness before real inquiries arrive."
      : "A simple list or inbox-based process is enough to start.",
    "record-inquiries",
  );
  add(
    "observed-activity",
    "Establish a results baseline",
    "Collect recorded activity after checking your measurement.",
    5,
    activity,
    "results",
    activity
      ? "Saved metrics meet the launch sample policy; events are not automatically unique customers."
      : "Await dependable activity and the launch sample gate; zero events does not prove zero inquiries.",
    "establish-baseline",
  );
  add(
    "goal-progress",
    "Make progress toward your goal",
    "Compare actual recorded events with your goal for a complete calendar month.",
    8,
    goalPoints,
    "results",
    wholeMonth
      ? `${goalPoints}/8 points from recorded goal progress; this is not confirmed customer growth.`
      : "Report dates do not cover a complete calendar month; monthly comparison is not graded.",
    "review-goal",
  );
  add(
    "event-ratio",
    "Evaluate your event ratio",
    "Compare recorded events per session with your own stated target.",
    8,
    ratio,
    "results",
    ratio
      ? "The recorded event ratio meets the owner's target, not an industry standard or unique-lead probability."
      : "A positive owner target, dependable sample and compatible event/session counts are needed.",
    "evaluate-event-rate",
  );
  add(
    "comparison-benchmark",
    "Learn from a comparable period",
    "Compare earlier nonoverlapping periods of equal length.",
    4,
    comparison,
    "results",
    comparison
      ? "Recorded event ratio improved against the owner-supplied comparison; causes are not established."
      : "A valid earlier equal-length comparison with actual improvement is not established.",
    "compare-periods",
  );
  add(
    "experiment-outcome",
    "Document an improvement",
    "Record a dated change and its outcome alongside comparable measurements.",
    4,
    experiment,
    "results",
    experiment
      ? "Owner-reported improvement and a supporting period comparison; this does not prove causation or statistical significance."
      : "An experiment alone earns no points; document the outcome and supporting comparison.",
    "run-experiment",
  );
  const stage = !connected
    ? "Not started"
    : readinessScore < 70
      ? "Building foundations"
      : resultsScore === 0
        ? "Ready to grow"
        : score < 90
          ? "Building results"
          : "Improving strong results";
  return {
    version: "launch-v1",
    score,
    readinessScore,
    resultsScore,
    connected,
    connectionKind: ga4 ? "ga4" : uploaded ? "upload" : "unverified",
    stage,
    milestones,
    warnings,
    explanation: `${uploaded ? "Uploaded, user-supplied measurements. " : ""}Readiness ${readinessScore}/70; results ${resultsScore}/29. Connection is the largest milestone; readiness alone does not establish business performance. Scoring rules launch-v1 replace the earlier model, not the underlying business results.`,
  };
}
export function getNextMilestones(
  a: MilestoneAssessment,
  offset = 0,
  limit = 3,
): Milestone[] {
  const pending = a.milestones.filter((m) => !m.complete);
  if (!pending.length || limit <= 0) return [];
  const rest = pending.slice(1);
  const start = rest.length
    ? Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0)) %
      rest.length
    : 0;
  return [pending[0], ...rest.slice(start), ...rest.slice(0, start)].slice(
    0,
    Math.max(0, Math.floor(limit)),
  );
}
export function getCelebrationEvents(
  a: MilestoneAssessment,
  seenIds: string[],
) {
  return a.milestones
    .filter((m) => m.complete && !seenIds.includes(m.id))
    .map((m) => ({
      id: m.id,
      title: m.title,
      points: m.points,
      category: m.category,
    }));
}
