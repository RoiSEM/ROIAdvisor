import { ArrowRight, Mail } from "lucide-react";

const CONTACT_EMAIL = "george@roisem.com";

const ctaCopy = {
  analyticsSetup: {
    eyebrow: "Need help?",
    title: "Need help setting up analytics?",
    description:
      "I can help connect GA4, confirm conversion tracking, and get reports pulling the right data.",
    action: "Get analytics setup help",
    subject: "Analytics setup help",
  },
  reportFix: {
    eyebrow: "Conversion help",
    title: "Want help fixing the issues in this report?",
    description:
      "Turn the report into a focused action plan for forms, calls, landing pages, tracking, or funnel friction.",
    action: "Ask for conversion help",
    subject: "Conversion help from report",
  },
  contactPage: {
    eyebrow: "Page improvement",
    title: "Get redesign help for your contact page.",
    description:
      "Improve CTA clarity, trust signals, form flow, and mobile layout so more visitors become leads.",
    action: "Get contact page help",
    subject: "Contact page redesign help",
  },
  trackingConfidence: {
    eyebrow: "Tracking confidence",
    title: "Not sure if conversions are tracking correctly?",
    description:
      "I can review events, forms, calls, and GA4 setup so the report reflects real performance.",
    action: "Check my tracking",
    subject: "Conversion tracking review",
  },
  default: {
    eyebrow: "Need a hand?",
    title: "Want help improving conversion performance?",
    description:
      "Get help turning analytics, page experience, and report findings into practical fixes.",
    action: "Email for help",
    subject: "Conversion performance help",
  },
};

type ServiceCtaVariant = keyof typeof ctaCopy;

type ServiceCtaProps = {
  variant?: ServiceCtaVariant;
  clientName?: string | null;
  compact?: boolean;
  className?: string;
};

function mailtoHref(subject: string, clientName?: string | null) {
  const fullSubject = clientName ? `${subject} - ${clientName}` : subject;

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(fullSubject)}`;
}

export default function ServiceCta({
  variant = "default",
  clientName,
  compact = false,
  className = "",
}: ServiceCtaProps) {
  const copy = ctaCopy[variant];

  if (compact) {
    return (
      <a
        href={mailtoHref(copy.subject, clientName)}
        className={`inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 ${className}`.trim()}
      >
        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
        {copy.action}
      </a>
    );
  }

  return (
    <aside
      className={`rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm ${className}`.trim()}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {copy.eyebrow}
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            {copy.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {copy.description}
          </p>
        </div>
        <a
          href={mailtoHref(copy.subject, clientName)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {copy.action}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
