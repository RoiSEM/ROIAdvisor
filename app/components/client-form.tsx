"use client";

import ServiceCta from "@/components/service-cta";
import Link from "next/link";
import {
  parseReadinessProfile,
  serializeReadinessProfile,
  humanTrackingNotes,
  type ReadinessProfile,
} from "@/lib/milestone-grading";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type ClientFormProps = {
  clientId?: string;
  initialName?: string;
  initialWebsite?: string;
  initialEmail?: string;
  initialLogoUrl?: string;
  initialPortalUserId?: string;
  initialGa4PropertyId?: string;
  initialPrimaryGoal?: string;
  initialMonthlyGoal?: number | null;
  initialAverageConversionValue?: number | null;
  initialConversionTypes?: string[] | null;
  initialKeyEvents?: string[] | null;
  initialConversionTrackingStatus?: string;
  initialMainCta?: string;
  initialFunnelDescription?: string;
  initialKnownIssues?: string;
  initialTechnicalIssues?: string;
  initialDesignConcerns?: string;
  initialAdChannelNotes?: string;
  initialOfferMessageConcerns?: string;
  initialTrackingNotes?: string;
  initialMarketingChannels?: string[] | null;
  initialRunningAds?: boolean | null;
  initialClientNotes?: string;
  initialApprovalStatus?: string;
  initialApprovalNotes?: string;
  isAdmin?: boolean;
};

const CONVERSION_OPTIONS = [
  "Form Submission",
  "Phone Call",
  "Purchase",
  "Booking",
  "Chat",
  "Other",
];

const CHANNEL_OPTIONS = [
  "Google (SEO)",
  "Google Ads",
  "Facebook/Instagram Ads",
  "Social Media",
  "Email",
  "Referral",
  "Direct",
  "Not sure",
];

const TRAFFIC_QUALITY_OPTIONS = [
  "They are actively looking for my service",
  "Some are, some aren't",
  "Most are just browsing",
  "Not sure",
];

const ACTION_LOCATION_OPTIONS = [
  "Homepage",
  "Service page",
  "Dedicated landing page",
  "Not sure",
];

const VISITOR_BEHAVIOR_OPTIONS = [
  "Fill out a form",
  "Call",
  "Leave without taking action",
  "Not sure",
];

const ACTION_FREQUENCY_OPTIONS = [
  "Yes, often",
  "Sometimes",
  "Rarely",
  "Not sure",
];

const STANDOUT_OPTIONS = [
  "Price",
  "Speed",
  "Quality",
  "Reputation",
  "Convenience",
  "Not sure",
];

const FRICTION_OPTIONS = [
  "Price is too high",
  "Slow response time",
  "Limited availability",
  "Weak online presence",
  "Not sure",
];

const GROWTH_SOURCE_OPTIONS = [
  "More traffic",
  "Better conversion",
  "Ads",
  "SEO",
  "Not sure",
];

const CONCERN_OPTIONS = [
  "Competitors",
  "Cost of ads",
  "Not enough leads",
  "Website performance",
  "Not sure",
];

function getGuidedValue(source: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^- ${escapedLabel}: (.+)$`, "m"));

  return match?.[1]?.trim() || "";
}

function getInitialSelectValue(
  source: string,
  label: string,
  options: string[],
  fallback = "",
) {
  const guidedValue = getGuidedValue(source, label);
  const value = guidedValue || fallback;

  return options.includes(value) ? value : "";
}

function buildGuidedContext(entries: Array<[string, string]>) {
  return entries
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n");
}

function normalizeMarketingChannels(values: string[] | null | undefined) {
  return (values || []).map((value) => {
    if (value === "SEO") return "Google (SEO)";
    if (value === "Facebook Ads") return "Facebook/Instagram Ads";

    return value;
  });
}

function AccordionSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded border border-white/70 bg-transparent">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm opacity-70 group-open:hidden">Open</span>
        <span className="hidden text-sm opacity-70 group-open:inline">
          Close
        </span>
      </summary>
      <div className="space-y-3 border-t border-white/30 px-4 py-4">
        {children}
      </div>
    </details>
  );
}

export default function ClientForm({
  clientId,
  initialName = "",
  initialWebsite = "",
  initialEmail = "",
  initialLogoUrl = "",
  initialPortalUserId = "",
  initialGa4PropertyId = "",
  initialPrimaryGoal = "",
  initialMonthlyGoal = null,
  initialAverageConversionValue = null,
  initialConversionTypes = [],
  initialKeyEvents = [],
  initialConversionTrackingStatus = "",
  initialMainCta = "",
  initialFunnelDescription = "",
  initialKnownIssues = "",
  initialTechnicalIssues = "",
  initialDesignConcerns = "",
  initialAdChannelNotes = "",
  initialOfferMessageConcerns = "",
  initialTrackingNotes = "",
  initialMarketingChannels = [],
  initialRunningAds = null,
  initialClientNotes = "",
  initialApprovalStatus = "pending",
  initialApprovalNotes = "",
  isAdmin = false,
}: ClientFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(clientId);

  const [name, setName] = useState(initialName);
  const [website, setWebsite] = useState(initialWebsite);
  const [email, setEmail] = useState(initialEmail);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [portalUserId, setPortalUserId] = useState(initialPortalUserId);
  const [ga4PropertyId, setGa4PropertyId] = useState(initialGa4PropertyId);
  const [primaryGoal, setPrimaryGoal] = useState(initialPrimaryGoal);
  const [monthlyGoal, setMonthlyGoal] = useState(
    initialMonthlyGoal?.toString() || "",
  );
  const [averageConversionValue, setAverageConversionValue] = useState(
    initialAverageConversionValue?.toString() || "",
  );
  const [conversionTypes, setConversionTypes] = useState<string[]>(
    initialConversionTypes || [],
  );
  const [keyEvents, setKeyEvents] = useState(
    (initialKeyEvents || []).join("\n"),
  );
  const [conversionTrackingStatus, setConversionTrackingStatus] = useState(
    initialConversionTrackingStatus,
  );
  const [trafficQuality, setTrafficQuality] = useState(
    getInitialSelectValue(
      initialFunnelDescription,
      "Visitor intent",
      TRAFFIC_QUALITY_OPTIONS,
    ),
  );
  const [actionLocation, setActionLocation] = useState(
    getInitialSelectValue(
      initialFunnelDescription,
      "Action location",
      ACTION_LOCATION_OPTIONS,
      initialMainCta,
    ),
  );
  const [visitorBehavior, setVisitorBehavior] = useState(
    getInitialSelectValue(
      initialFunnelDescription,
      "Visitor behavior",
      VISITOR_BEHAVIOR_OPTIONS,
    ),
  );
  const [actionFrequency, setActionFrequency] = useState(
    getInitialSelectValue(
      initialFunnelDescription,
      "Action frequency",
      ACTION_FREQUENCY_OPTIONS,
    ),
  );
  const [standoutFactor, setStandoutFactor] = useState(
    getInitialSelectValue(
      initialFunnelDescription,
      "Standout factor",
      STANDOUT_OPTIONS,
    ),
  );
  const [conversionFriction, setConversionFriction] = useState(
    getInitialSelectValue(
      initialKnownIssues,
      "Conversion friction",
      FRICTION_OPTIONS,
    ),
  );
  const [growthSource, setGrowthSource] = useState(
    getInitialSelectValue(
      initialFunnelDescription,
      "Expected growth source",
      GROWTH_SOURCE_OPTIONS,
    ),
  );
  const [topConcern, setTopConcern] = useState(
    getInitialSelectValue(
      initialFunnelDescription,
      "Top concern",
      CONCERN_OPTIONS,
    ),
  );
  const [internalIssue, setInternalIssue] = useState(
    getGuidedValue(initialKnownIssues, "What seems broken") ||
      (!initialKnownIssues.startsWith("- ") ? initialKnownIssues : ""),
  );
  const [technicalIssues, setTechnicalIssues] = useState(
    initialTechnicalIssues,
  );
  const [designConcerns, setDesignConcerns] = useState(initialDesignConcerns);
  const [adChannelNotes, setAdChannelNotes] = useState(initialAdChannelNotes);
  const [offerMessageConcerns, setOfferMessageConcerns] = useState(
    initialOfferMessageConcerns,
  );
  const [trackingNotes, setTrackingNotes] = useState(
    humanTrackingNotes(initialTrackingNotes),
  );
  const [evidence, setEvidence] = useState(() => {
    const p = parseReadinessProfile(initialTrackingNotes);
    return {
      testDate: p.trackingTest?.date || "",
      testOutcome: p.trackingTest?.outcome || "",
      testNote: p.trackingTest?.note || "",
      inquiryProcess: p.inquiryProcess || "",
      targetEventRate: p.targetEventRate?.toString() || "",
      comparisonStart: p.comparison?.startDate || "",
      comparisonEnd: p.comparison?.endDate || "",
      comparisonTraffic: p.comparison?.traffic.toString() || "",
      comparisonConversions: p.comparison?.conversions.toString() || "",
      experimentDate: p.experiment?.date || "",
      experimentOutcome: p.experiment?.outcome || "",
      experimentNote: p.experiment?.note || "",
    };
  });
  const [marketingChannels, setMarketingChannels] = useState<string[]>(
    normalizeMarketingChannels(initialMarketingChannels),
  );
  const [runningAds, setRunningAds] = useState<string>(
    initialRunningAds === null ? "" : initialRunningAds ? "yes" : "no",
  );
  const [clientNotes, setClientNotes] = useState(initialClientNotes);
  const [approvalStatus, setApprovalStatus] = useState(initialApprovalStatus);
  const [approvalNotes, setApprovalNotes] = useState(initialApprovalNotes);
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch(console.error);
  }, [isAdmin]);

  function toggleArrayValue(
    value: string,
    current: string[],
    setter: (next: string[]) => void,
  ) {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
      return;
    }

    setter([...current, value]);
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      alert("Please choose a PNG or JPG logo.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoUrl(reader.result);
      }
    };

    reader.onerror = () => {
      alert("Failed to read logo file.");
    };

    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numeric = [
      monthlyGoal,
      averageConversionValue,
      evidence.targetEventRate,
      evidence.comparisonTraffic,
      evidence.comparisonConversions,
    ];
    if (
      numeric.some(
        (v) => v.trim() && (!Number.isFinite(Number(v)) || Number(v) < 0),
      ) ||
      (evidence.targetEventRate.trim() &&
        (Number(evidence.targetEventRate) <= 0 ||
          Number(evidence.targetEventRate) > 100))
    ) {
      alert(
        "Use valid non-negative numbers; an event-ratio target must be greater than zero and at most 100. Leave unknown values blank.",
      );
      return;
    }
    const dates = [
      evidence.testDate,
      evidence.comparisonStart,
      evidence.comparisonEnd,
      evidence.experimentDate,
    ];
    if (
      dates.some(
        (v) =>
          v &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
            !Number.isFinite(Date.parse(v)) ||
            new Date(v).toISOString().slice(0, 10) !== v ||
            Date.parse(v) > Date.now()),
      )
    ) {
      alert("Use valid dates that are not in the future.");
      return;
    }
    if (
      (evidence.testDate || evidence.testOutcome || evidence.testNote) &&
      (!evidence.testDate || !evidence.testOutcome || !evidence.testNote.trim())
    ) {
      alert(
        "Document the test date, outcome and what you checked, or leave the test unanswered.",
      );
      return;
    }
    const hasComparison = Boolean(
      evidence.comparisonStart ||
      evidence.comparisonEnd ||
      evidence.comparisonTraffic ||
      evidence.comparisonConversions,
    );
    if (
      hasComparison &&
      (!evidence.comparisonStart ||
        !evidence.comparisonEnd ||
        !evidence.comparisonTraffic.trim() ||
        !evidence.comparisonConversions.trim() ||
        evidence.comparisonStart > evidence.comparisonEnd)
    ) {
      alert(
        "Complete the comparison dates and counts, or leave the comparison unanswered.",
      );
      return;
    }
    if (
      (evidence.experimentDate ||
        evidence.experimentOutcome ||
        evidence.experimentNote) &&
      (!evidence.experimentDate ||
        !evidence.experimentOutcome ||
        !evidence.experimentNote.trim())
    ) {
      alert(
        "Complete the change date, outcome and notes, or leave the change unanswered.",
      );
      return;
    }
    const profile: ReadinessProfile = {
      trackingTest: evidence.testDate
        ? {
            date: evidence.testDate,
            outcome: evidence.testOutcome as "passed" | "failed",
            note: evidence.testNote,
          }
        : null,
      inquiryProcess: evidence.inquiryProcess || null,
      targetEventRate: evidence.targetEventRate.trim()
        ? Number(evidence.targetEventRate)
        : null,
      comparison: hasComparison
        ? {
            startDate: evidence.comparisonStart,
            endDate: evidence.comparisonEnd,
            traffic: Number(evidence.comparisonTraffic),
            conversions: Number(evidence.comparisonConversions),
          }
        : null,
      experiment: evidence.experimentDate
        ? {
            date: evidence.experimentDate,
            note: evidence.experimentNote,
            outcome: evidence.experimentOutcome as
              "improved" | "inconclusive" | "declined",
          }
        : null,
    };
    setLoading(true);

    try {
      const res = await fetch(
        isEditMode ? `/api/clients/${clientId}` : "/api/clients",
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            website,
            email,
            logo_url: logoUrl || null,
            user_id: portalUserId || null,
            approval_status: approvalStatus,
            approval_notes: approvalNotes || null,
            ga4_property_id: ga4PropertyId,
            primary_goal: primaryGoal || null,
            monthly_goal: monthlyGoal ? Number(monthlyGoal) : null,
            average_conversion_value: averageConversionValue
              ? Number(averageConversionValue)
              : null,
            conversion_types: conversionTypes,
            key_events: keyEvents
              .split(/[\n,]/)
              .map((value) => value.trim())
              .filter(Boolean),
            conversion_tracking_status: conversionTrackingStatus || null,
            main_cta: actionLocation || null,
            funnel_description:
              buildGuidedContext([
                ["Visitor intent", trafficQuality],
                ["Action location", actionLocation],
                ["Visitor behavior", visitorBehavior],
                ["Action frequency", actionFrequency],
                ["Standout factor", standoutFactor],
                ["Expected growth source", growthSource],
                ["Top concern", topConcern],
              ]) || null,
            known_issues:
              buildGuidedContext([
                ["Conversion friction", conversionFriction],
                ["What seems broken", internalIssue],
              ]) || null,
            technical_issues: technicalIssues || null,
            design_concerns: designConcerns || null,
            ad_channel_notes: adChannelNotes || null,
            offer_message_concerns: offerMessageConcerns || null,
            tracking_notes: serializeReadinessProfile(trackingNotes, profile),
            marketing_channels: marketingChannels,
            running_ads: runningAds === "" ? null : runningAds === "yes",
            client_notes: clientNotes || null,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to save client");
        return;
      }

      if (!isEditMode) {
        setName("");
        setWebsite("");
        setEmail("");
        setLogoUrl("");
        setPortalUserId("");
        setGa4PropertyId("");
        setPrimaryGoal("");
        setMonthlyGoal("");
        setAverageConversionValue("");
        setConversionTypes([]);
        setConversionTrackingStatus("");
        setTrafficQuality("");
        setActionLocation("");
        setVisitorBehavior("");
        setActionFrequency("");
        setStandoutFactor("");
        setConversionFriction("");
        setGrowthSource("");
        setTopConcern("");
        setInternalIssue("");
        setTechnicalIssues("");
        setDesignConcerns("");
        setAdChannelNotes("");
        setOfferMessageConcerns("");
        setTrackingNotes("");
        setEvidence(
          (prev) =>
            Object.fromEntries(
              Object.keys(prev).map((key) => [key, ""]),
            ) as typeof prev,
        );
        setMarketingChannels([]);
        setRunningAds("");
        setClientNotes("");
        setApprovalStatus("pending");
        setApprovalNotes("");
      }

      if (isEditMode && clientId) {
        router.push(`/dashboard/${clientId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save client");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded border p-4">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Basic Info</h2>

        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Business Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Acme Co"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Website</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="contact@example.com"
            />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Report Logo URL
            </label>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="https://example.com/logo.png or upload below"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoFileChange}
                className="text-sm"
              />
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium transition hover:bg-slate-50"
                >
                  Remove logo
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Optional. Upload a PNG/JPG or paste a public image URL.
            </p>
          </div>

          <div className="flex min-h-24 items-center justify-center rounded border border-slate-200 bg-slate-50 p-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${name || "Client"} logo preview`}
                className="max-h-20 max-w-full object-contain"
              />
            ) : (
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Logo Preview
              </span>
            )}
          </div>
        </div>

        <div className={`grid gap-3 ${isAdmin ? "md:grid-cols-2" : ""}`}>
          {isAdmin && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Assigned User
              </label>
              <select
                value={portalUserId}
                onChange={(e) => setPortalUserId(e.target.value)}
                className="w-full rounded border px-3 py-2"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Optional. Assign this website to an existing user account.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              GA4 Property ID
            </label>
            <input
              value={ga4PropertyId}
              onChange={(e) => setGa4PropertyId(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="123456789"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use the numeric GA4 Property ID, not the Measurement ID.
            </p>
            <p className="mt-2 text-xs">
              In GA4 property access management, add{" "}
              <code>
                ga4-service@roi-analytics-490813.iam.gserviceaccount.com
              </code>{" "}
              with Viewer access. Save the property ID, ask George to approve
              access, then use the connection check on your website page.{" "}
              <Link href="/guides/connect-analytics" className="underline">
                Connection tutorial
              </Link>
            </p>
          </div>
        </div>

        <ServiceCta
          variant="analyticsSetup"
          clientName={name}
          className="mt-2"
        />
      </section>

      <details className="rounded-xl border border-slate-300 p-4">
        <summary className="cursor-pointer font-semibold">
          Readiness checks and optional results context
        </summary>
        <p className="mt-3 text-sm">
          These checks are owner-reported. Unknown answers are welcome. A simple
          list or test example can establish a follow-up process before real
          inquiries arrive. Do not include customer details or credentials.
        </p>
        <Link
          href="/guides/test-tracking"
          className="mt-2 inline-block text-sm underline"
        >
          Show me how to test tracking
        </Link>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="readiness-testDate"
              className="mb-1 block text-sm font-medium"
            >
              Test date
            </label>
            <input
              id="readiness-testDate"
              type="date"
              value={evidence.testDate}
              onChange={(e) =>
                setEvidence((prev) => ({ ...prev, testDate: e.target.value }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-testOutcome"
              className="mb-1 block text-sm font-medium"
            >
              Test outcome
            </label>
            <select
              id="readiness-testOutcome"
              value={evidence.testOutcome}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  testOutcome: e.target.value,
                }))
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Not answered</option>
              <option value="passed">
                Passed — submission, receipt and recording checked
              </option>
              <option value="failed">Failed — needs attention</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="readiness-testNote"
              className="mb-1 block text-sm font-medium"
            >
              What did you check?
            </label>
            <input
              id="readiness-testNote"
              type="text"
              value={evidence.testNote}
              onChange={(e) =>
                setEvidence((prev) => ({ ...prev, testNote: e.target.value }))
              }
              maxLength={500}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-inquiryProcess"
              className="mb-1 block text-sm font-medium"
            >
              How do you record and review inquiries?
            </label>
            <input
              id="readiness-inquiryProcess"
              type="text"
              value={evidence.inquiryProcess}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  inquiryProcess: e.target.value,
                }))
              }
              maxLength={500}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-targetEventRate"
              className="mb-1 block text-sm font-medium"
            >
              Your target event ratio (%) — optional, not an industry benchmark
            </label>
            <input
              id="readiness-targetEventRate"
              type="number"
              value={evidence.targetEventRate}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  targetEventRate: e.target.value,
                }))
              }
              min="0"
              step="any"
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-comparisonStart"
              className="mb-1 block text-sm font-medium"
            >
              Earlier comparison start date
            </label>
            <input
              id="readiness-comparisonStart"
              type="date"
              value={evidence.comparisonStart}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  comparisonStart: e.target.value,
                }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-comparisonEnd"
              className="mb-1 block text-sm font-medium"
            >
              Earlier comparison end date
            </label>
            <input
              id="readiness-comparisonEnd"
              type="date"
              value={evidence.comparisonEnd}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  comparisonEnd: e.target.value,
                }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-comparisonTraffic"
              className="mb-1 block text-sm font-medium"
            >
              Earlier comparison sessions
            </label>
            <input
              id="readiness-comparisonTraffic"
              type="number"
              value={evidence.comparisonTraffic}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  comparisonTraffic: e.target.value,
                }))
              }
              min="0"
              step="any"
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-comparisonConversions"
              className="mb-1 block text-sm font-medium"
            >
              Earlier comparison recorded events
            </label>
            <input
              id="readiness-comparisonConversions"
              type="number"
              value={evidence.comparisonConversions}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  comparisonConversions: e.target.value,
                }))
              }
              min="0"
              step="any"
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-experimentDate"
              className="mb-1 block text-sm font-medium"
            >
              Change or experiment date
            </label>
            <input
              id="readiness-experimentDate"
              type="date"
              value={evidence.experimentDate}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  experimentDate: e.target.value,
                }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="readiness-experimentOutcome"
              className="mb-1 block text-sm font-medium"
            >
              Change outcome
            </label>
            <select
              id="readiness-experimentOutcome"
              value={evidence.experimentOutcome}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  experimentOutcome: e.target.value,
                }))
              }
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Not answered</option>
              <option value="improved">Improved</option>
              <option value="inconclusive">Inconclusive</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="readiness-experimentNote"
              className="mb-1 block text-sm font-medium"
            >
              What changed and what did you learn?
            </label>
            <input
              id="readiness-experimentNote"
              type="text"
              value={evidence.experimentNote}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  experimentNote: e.target.value,
                }))
              }
              maxLength={500}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Comparisons need earlier, nonoverlapping periods of equal length.
          Documenting a change does not prove causation or a statistically
          significant A/B test. Points depend on the scoring checks, not simply
          filling these fields.
        </p>
      </details>

      {isAdmin && isEditMode && (
        <section className="space-y-3 border-t pt-5">
          <div>
            <h2 className="text-lg font-semibold">
              Analytics Access & Approval
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Reports unlock after the client adds the service account to GA4
              and an admin confirms access.
            </p>
          </div>

          <div className="rounded border border-white/70 bg-transparent p-4 text-sm">
            <p className="font-semibold">
              Ask the client to add this email to their GA4 property:
            </p>
            <code className="mt-2 block overflow-x-auto rounded border border-white/30 bg-black px-3 py-2 text-xs text-white">
              ga4-service@roi-analytics-490813.iam.gserviceaccount.com
            </code>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>Open Google Analytics Admin.</li>
              <li>Go to Property access management.</li>
              <li>Add the service account email with Viewer access.</li>
              <li>Confirm the numeric GA4 Property ID is saved above.</li>
            </ol>
          </div>

          <ServiceCta
            variant="trackingConfidence"
            clientName={name}
            className="border-amber-200 bg-amber-50"
          />

          <div>
            <label className="mb-1 block text-sm font-medium">
              Approval Status
            </label>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Approval Notes
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full rounded border px-3 py-2"
              rows={4}
              placeholder="Track analytics invite progress, acceptance, or any onboarding notes."
            />
          </div>
        </section>
      )}

      <section className="space-y-3 border-t pt-5">
        <div>
          <h2 className="text-lg font-semibold">Conversion Goals & Tracking</h2>
          <p className="mt-1 text-sm">
            Optional. The more context you add here, the smarter the reports
            get.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Primary Goal
            </label>
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select a goal</option>
              <option value="Leads">Leads</option>
              <option value="Sales">Sales</option>
              <option value="Calls">Calls</option>
              <option value="Bookings">Bookings</option>
              <option value="Awareness">Awareness</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Monthly Conversion Goal
            </label>
            <input
              type="number"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="25 conversions"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Value Per Conversion
            </label>
            <input
              type="number"
              value={averageConversionValue}
              onChange={(e) => setAverageConversionValue(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="250"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            What counts as a conversion?
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            {CONVERSION_OPTIONS.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={conversionTypes.includes(option)}
                  onChange={() =>
                    toggleArrayValue(
                      option,
                      conversionTypes,
                      setConversionTypes,
                    )
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            GA4 Key Events
          </label>
          <textarea
            value={keyEvents}
            onChange={(e) => setKeyEvents(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={3}
            placeholder="generate_lead, purchase, phone_call"
          />
          <p className="mt-1 text-xs text-slate-500">
            Add the key events that should act as purchase or lead indicators.
            Use one per line or separate them with commas.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Are conversions currently tracked?
          </label>
          <select
            value={conversionTrackingStatus}
            onChange={(e) => setConversionTrackingStatus(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Select status</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Not sure">Not sure</option>
          </select>
        </div>
      </section>

      <AccordionSection title="Marketing Context">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Where does traffic come from?
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            {CHANNEL_OPTIONS.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={marketingChannels.includes(option)}
                  onChange={() =>
                    toggleArrayValue(
                      option,
                      marketingChannels,
                      setMarketingChannels,
                    )
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Are ads currently running?
            </label>
            <select
              value={runningAds}
              onChange={(e) => setRunningAds(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              How would you describe your visitors?
            </label>
            <select
              value={trafficQuality}
              onChange={(e) => setTrafficQuality(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {TRAFFIC_QUALITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="Funnel Behavior">
        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Where do customers usually take action?
            </label>
            <select
              value={actionLocation}
              onChange={(e) => setActionLocation(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {ACTION_LOCATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              What do visitors usually do?
            </label>
            <select
              value={visitorBehavior}
              onChange={(e) => setVisitorBehavior(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {VISITOR_BEHAVIOR_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Do people take action on your site?
            </label>
            <select
              value={actionFrequency}
              onChange={(e) => setActionFrequency(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {ACTION_FREQUENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="Offer & Positioning">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              What makes your business stand out?
            </label>
            <select
              value={standoutFactor}
              onChange={(e) => setStandoutFactor(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {STANDOUT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              What might stop someone from choosing you?
            </label>
            <select
              value={conversionFriction}
              onChange={(e) => setConversionFriction(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {FRICTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="Growth Insight">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Where do you think growth should come from?
            </label>
            <select
              value={growthSource}
              onChange={(e) => setGrowthSource(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {GROWTH_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              What concerns you most right now?
            </label>
            <select
              value={topConcern}
              onChange={(e) => setTopConcern(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select one</option>
              {CONCERN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            What do you think is not working?
          </label>
          <textarea
            value={internalIssue}
            onChange={(e) => setInternalIssue(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={3}
            placeholder="Example: Ads are running but no leads are coming in."
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Known technical issues
            </label>
            <textarea
              value={technicalIssues}
              onChange={(e) => setTechnicalIssues(e.target.value)}
              className="w-full rounded border px-3 py-2"
              rows={3}
              placeholder="Broken forms, phone links, checkout, booking flow, tracking, mobile bugs..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Design or layout concerns
            </label>
            <textarea
              value={designConcerns}
              onChange={(e) => setDesignConcerns(e.target.value)}
              className="w-full rounded border px-3 py-2"
              rows={3}
              placeholder="CTA visibility, confusing layout, weak landing page, trust signals, mobile layout..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Ad or channel notes
            </label>
            <textarea
              value={adChannelNotes}
              onChange={(e) => setAdChannelNotes(e.target.value)}
              className="w-full rounded border px-3 py-2"
              rows={3}
              placeholder="Campaign changes, poor lead quality, channels to scale, budget concerns..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Offer or messaging concerns
            </label>
            <textarea
              value={offerMessageConcerns}
              onChange={(e) => setOfferMessageConcerns(e.target.value)}
              className="w-full rounded border px-3 py-2"
              rows={3}
              placeholder="Unclear value prop, pricing objections, offer mismatch, weak proof..."
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Tracking confidence or known tracking issues
          </label>
          <textarea
            value={trackingNotes}
            onChange={(e) => setTrackingNotes(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={3}
            placeholder="Events missing, duplicate conversions, forms/calls not tracked, setup recently changed..."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Anything else we should know?
          </label>
          <textarea
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={3}
            placeholder="Optional extra context"
          />
        </div>
      </AccordionSection>

      <button
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : isEditMode ? "Save Changes" : "Add Project"}
      </button>
    </form>
  );
}
