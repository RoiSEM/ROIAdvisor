export type MilestoneGuide = {
  slug: string;
  title: string;
  prerequisites: string[];
  steps: string[];
  successCheck: string;
  limits: string[];
};
const guide = (
  slug: string,
  title: string,
  prerequisites: string[],
  steps: string[],
  successCheck: string,
  limits: string[],
): MilestoneGuide => ({
  slug,
  title,
  prerequisites,
  steps,
  successCheck,
  limits,
});
const guides: MilestoneGuide[] = [
  guide(
    "connect-analytics",
    "Connect your website data",
    [
      "Access to the correct website's GA4 property, or a supported CSV export. No traffic history is required.",
    ],
    [
      "Open your website's setup in Convert and save the numeric GA4 Property ID. This is not the G- Measurement ID.",
      "In GA4 Admin, open Property access management. Ask an administrator to add ga4-service@roi-analytics-490813.iam.gserviceaccount.com with Viewer access. Never share your Google password.",
      "Ask George to approve Analytics access. Return to your website page and choose Check my Analytics connection. A successful read confirms access even when the counts are zero.",
      "Alternatively, use the report form's supported CSV upload. Check the parsed measurements and reporting dates before generating the report. This uses report allowance; the standalone connection check does not.",
    ],
    "The connection check reports success and the progress panel recognizes the connection. An uploaded report is labeled user-supplied, not a live connection.",
    [
      "Signing into Convert is separate from granting Analytics access.",
      "A successful connection does not prove that conversion tracking is correct. A denied check should not prompt you to change passwords or submit secrets.",
    ],
  ),
  guide(
    "define-action",
    "Choose a useful customer action",
    ["A service or product you want more customers for."],
    [
      "Choose one primary completed action: a submitted quote request, a completed booking, a purchase or another meaningful action.",
      "Write what makes that action useful. Keep a button click, an inquiry and a booked job separate.",
      "In website setup, select the conversion type and record the intended action. Save your changes.",
    ],
    "You can explain what should be counted and what should not. Your saved definition earns readiness credit, not proof that the website works.",
    ["Do not automatically equate every event with a qualified lead."],
  ),
  guide(
    "set-goal",
    "Set your first useful goal",
    [
      "A defined customer action. Existing counts are helpful but not required.",
    ],
    [
      "Choose your primary goal in website setup.",
      "If you can support a monthly target, record it and note the assumptions and capacity behind it. Keep inquiry targets separate from booked-customer targets.",
      "If you are not sure, leave the number blank, collect a baseline and choose a review date in your notes. Do not invent a number just for points.",
    ],
    "The owner can explain the goal and when to review it. A numerical goal earns definition credit, not a claim that the target is feasible.",
    [
      "The launch rubric reserves this milestone's points until a monthly target is defined; onboarding can still finish without it.",
      "Only a matching full calendar month is graded against the monthly target.",
    ],
  ),
  guide(
    "conversion-value",
    "Understand what a conversion is worth",
    ["A clear distinction between an inquiry and a completed sale."],
    [
      "For a purchase, start with a representative transaction value. For an inquiry, use your own sales history if available to estimate its value; do not use the full job price automatically.",
      "Record the assumptions in your notes and label an estimate as an estimate. Leave unknown values blank.",
      "Save Value Per Conversion in website setup. Keep acquisition cost and what you can afford to pay in your business notes; those are different from conversion value.",
    ],
    "The recorded value describes the chosen action and its assumptions, rather than pretending all inquiries become sales.",
    [
      "This is owner-supplied context, not measured revenue, profitability or a guaranteed return.",
    ],
  ),
  guide(
    "configure-events",
    "Configure the events that matter",
    ["A defined action and access to your existing tracking setup."],
    [
      "Check whether your intended action already produces a suitable GA4 event before creating another one.",
      "Configure the event to represent success, not merely opening a form or clicking Submit. Mark the intended event as a key event using your current GA4 controls.",
      "In Convert website setup, list the exact event names under GA4 Key Events and answer the tracking-configuration question. Save your setup.",
      "Continue to the controlled tracking check before trusting the counts.",
    ],
    "Your saved setup names the intended events and labels configuration as owner-reported. A later test verifies the journey.",
    [
      "Implementation differs by form, booking and checkout provider. If you cannot establish the trigger, ask for task-specific help rather than guessing.",
    ],
  ),
  guide(
    "test-tracking",
    "Test the complete customer journey",
    [
      "A defined action, access to the business's incoming requests and the relevant Analytics view.",
    ],
    [
      "Use a synthetic test request with no real customer details. Note the test time and the event you expect.",
      "Complete the action on the website. Confirm success on the site, then confirm that the business received the request.",
      "Inspect the intended event in your available Analytics testing or reporting view. Check whether failed attempts or repeated clicks are also counted; investigate unexpected duplicates.",
      "In Readiness checks, record the date, outcome and what you checked. If any part fails, record Failed and the specific gap; do not mark Passed just to increase the score.",
    ],
    "The documented result distinguishes website completion, business receipt and Analytics recording. Convert labels this owner-reported evidence.",
    [
      "Reporting delays, consent choices and blockers can affect observation. An absent event alone does not identify the cause.",
      "A test is not an independent audit of every customer's journey.",
    ],
  ),
  guide(
    "record-inquiries",
    "Keep a simple inquiry record",
    [
      "A list, spreadsheet or consistent inbox-based process; a paid CRM is not required.",
    ],
    [
      "Choose where to record an inquiry, response and known outcome. Do not put personal customer details into Convert.",
      "Try the process with a synthetic or anonymized example. You do not need real inquiries to establish the process.",
      "Choose when to review the record and who responds. Describe the process in Convert's Readiness checks and save it.",
    ],
    "You can follow a sample inquiry from arrival through response and review. Actual business results remain a separate question.",
    [
      "A described process is owner-reported until checked. It does not prove successful follow-up or sales.",
    ],
  ),
  guide(
    "establish-baseline",
    "Build a dependable baseline",
    ["A checked customer action and a saved report with known dates."],
    [
      "Keep the action definition stable while collecting data. Distinguish Analytics events from unique inquiries.",
      "Generate or sync a report for an intentional date range. Review known outages and recording changes before interpreting the counts.",
      "Review the next-step panel. The launch results gate requires completed readiness, a dated report, at least 100 sessions and 5 recorded events; these are product scoring rules, not industry standards.",
    ],
    "You know the reporting period, what is counted and the limits on interpreting the sample.",
    [
      "Do not buy low-quality traffic or manufacture events to earn points.",
      "Meeting the launch gate does not establish statistical significance or lead quality.",
    ],
  ),
  guide(
    "review-goal",
    "Review progress toward your goal",
    [
      "A stated monthly goal, checked measurement and a report covering a complete calendar month.",
    ],
    [
      "Confirm the report starts on the first day and ends on the last day of the same completed month.",
      "Compare the recorded events with your saved monthly target. Keep the date range visible; a rolling or partial period is not graded as a full month.",
      "If the target is not met, investigate the evidence for traffic, recording and inquiry quality. Do not assume the website needs a redesign or lower the target automatically.",
    ],
    "Goal progress is based on matching dates and the intended outcome definition, with remaining uncertainty stated.",
    [
      "Custom date access depends on the existing plan. This feature does not change plan entitlements.",
      "A recorded event target is not automatically a customer or revenue target.",
    ],
  ),
  guide(
    "evaluate-event-rate",
    "Evaluate your event ratio",
    ["Defined events, tested tracking and a suitable reporting sample."],
    [
      "Check that event totals and sessions refer to the same period. Events can repeat; they are not necessarily unique people.",
      "If you have a defensible event-per-session target, record it in Readiness checks and explain your assumptions in notes. This is your target, not an industry benchmark.",
      "Compare the recorded ratio with that target. If event counts exceed sessions, resolve the counting definition before using this launch efficiency milestone.",
    ],
    "You can explain the numerator, denominator and target without presenting the ratio as a probability of becoming a customer.",
    [
      "Industry benchmark comparisons are deferred. A low target should not be used simply to inflate the score.",
    ],
  ),
  guide(
    "compare-periods",
    "Learn from comparable periods",
    [
      "An earlier period with the same event definition and reporting coverage.",
    ],
    [
      "Choose earlier, nonoverlapping periods with the same number of days. Keep sessions and event definitions consistent.",
      "Review tracking changes, campaigns and seasonal differences before comparing the event ratios.",
      "Record the earlier dates, sessions and events in Readiness checks. Leave unknown counts blank, rather than substituting zero.",
    ],
    "The earlier period is comparable and any recorded improvement is distinguishable from missing data or a changed measurement definition.",
    [
      "The earlier figures are owner-supplied. An improved ratio does not establish cause or overall business success.",
    ],
  ),
  guide(
    "run-experiment",
    "Document a useful improvement",
    [
      "A specific question and enough dependable evidence to evaluate a change.",
    ],
    [
      "State the problem, the change and what result would help you decide. For a low-volume site, a controlled usability check may be more useful than an underpowered A/B test.",
      "Record the change date, what you did and the outcome. Use Inconclusive when the evidence does not support a conclusion.",
      "Save a valid period comparison where available. The launch improvement milestone requires a documented improved outcome and a supporting recorded improvement; running a test alone earns no points.",
    ],
    "The record shows what changed, the observed outcome and what you learned. It does not claim causation or significance without the required analysis.",
    [
      "Do not declare a test winner from tiny samples or simply because a score increased.",
    ],
  ),
];
export const MILESTONE_GUIDES: Record<string, MilestoneGuide> =
  Object.fromEntries(guides.map((g) => [g.slug, g]));
export function getMilestoneGuide(slug: string) {
  return Object.hasOwn(MILESTONE_GUIDES, slug)
    ? MILESTONE_GUIDES[slug]
    : undefined;
}
export function milestoneHelpHref(title: string, clientName?: string | null) {
  return `mailto:george@roisem.com?subject=${encodeURIComponent(`Convert help: ${title}${clientName ? " — " + clientName : ""}`)}`;
}
