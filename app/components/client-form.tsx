"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ClientFormProps = {
  clientId?: string;
  initialName?: string;
  initialWebsite?: string;
  initialEmail?: string;
  initialPortalUserId?: string;
  initialGa4PropertyId?: string;
  initialPrimaryGoal?: string;
  initialMonthlyGoal?: number | null;
  initialAverageConversionValue?: number | null;
  initialConversionTypes?: string[] | null;
  initialConversionTrackingStatus?: string;
  initialMainCta?: string;
  initialFunnelDescription?: string;
  initialKnownIssues?: string;
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
  "SEO",
  "Google Ads",
  "Facebook Ads",
  "Social Media",
  "Email",
  "Referral",
  "Direct",
  "Other",
];



export default function ClientForm({
  clientId,
  initialName = "",
  initialWebsite = "",
  initialEmail = "",
  initialPortalUserId = "",
  initialGa4PropertyId = "",
  initialPrimaryGoal = "",
  initialMonthlyGoal = null,
  initialAverageConversionValue = null,
  initialConversionTypes = [],
  initialConversionTrackingStatus = "",
  initialMainCta = "",
  initialFunnelDescription = "",
  initialKnownIssues = "",
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
  const [conversionTrackingStatus, setConversionTrackingStatus] = useState(
    initialConversionTrackingStatus,
  );
  const [mainCta, setMainCta] = useState(initialMainCta);
  const [funnelDescription, setFunnelDescription] = useState(
    initialFunnelDescription,
  );
  const [knownIssues, setKnownIssues] = useState(initialKnownIssues);
  const [marketingChannels, setMarketingChannels] = useState<string[]>(
    initialMarketingChannels || [],
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
            conversion_tracking_status: conversionTrackingStatus || null,
            main_cta: mainCta || null,
            funnel_description: funnelDescription || null,
            known_issues: knownIssues || null,
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
        setPortalUserId("");
        setGa4PropertyId("");
        setPrimaryGoal("");
        setMonthlyGoal("");
        setAverageConversionValue("");
        setConversionTypes([]);
        setConversionTrackingStatus("");
        setMainCta("");
        setFunnelDescription("");
        setKnownIssues("");
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
    <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded border p-4">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Basic Info</h2>

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
        </div>
      </section>

      {isAdmin && isEditMode && (
        <section className="space-y-3 border-t pt-5">
          <div>
            <h2 className="text-lg font-semibold">Approval</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use approval to control when this website can start generating
              reports.
            </p>
          </div>

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
          <h2 className="text-lg font-semibold">Goals & Conversions</h2>
          <p className="mt-1 text-sm">
            Optional. The more context you add here, the smarter the reports
            get.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Primary Goal</label>
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

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Monthly Goal
            </label>
            <input
              type="number"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="25"
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

      <section className="space-y-3 border-t pt-5">
        <h2 className="text-lg font-semibold">Marketing Context</h2>

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
      </section>

      <section className="space-y-3 border-t pt-5">
        <h2 className="text-lg font-semibold">Funnel Insight</h2>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Main Call To Action
          </label>
          <input
            value={mainCta}
            onChange={(e) => setMainCta(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Get a Quote"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            What happens after someone visits the site?
          </label>
          <textarea
            value={funnelDescription}
            onChange={(e) => setFunnelDescription(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={4}
            placeholder="Example: User lands on service page, clicks CTA, fills out form, then receives a phone call."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            What do you think is not working?
          </label>
          <textarea
            value={knownIssues}
            onChange={(e) => setKnownIssues(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={3}
            placeholder="Example: Ads are running but no leads are coming in."
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
      </section>

      <button
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : isEditMode ? "Save Changes" : "Add Project"}
      </button>
    </form>
  );
}
