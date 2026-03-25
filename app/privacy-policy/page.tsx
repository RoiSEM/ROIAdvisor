import type { Metadata } from "next";
import LegalPageShell from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Convert by WhachaWant",
  description:
    "Read how Convert by WhachaWant collects, uses, stores, and protects personal information.",
};

const sections = [
  {
    title: "Information We Collect",
    paragraphs: [
      "When you use Convert by WhachaWant, we may collect information such as your name, email address, account details, and business information you submit through the platform.",
      "If you sign in with Google, we receive the basic profile information needed to authenticate your account, such as your email address and name, subject to the permissions you grant through Google.",
      "We may also collect technical and usage information such as log data, browser type, device information, IP address, and how you interact with the application.",
    ],
  },
  {
    title: "How We Use Information",
    paragraphs: [
      "We use your information to provide and improve the Convert service, authenticate users, maintain accounts, generate reports, respond to support requests, and communicate important service updates.",
      "We may use website, reporting, and analytics-related information that you provide or connect to the platform in order to generate performance summaries, identify conversion issues, and present recommendations inside the product.",
      "We may also use information to protect the service, detect misuse, comply with legal obligations, and enforce our agreements.",
    ],
  },
  {
    title: "How We Share Information",
    paragraphs: [
      "We do not sell your personal information. We may share information with service providers and infrastructure partners that help us operate the application, such as hosting, authentication, database, analytics, and customer support providers.",
      "We may disclose information if required by law, to protect our rights or users, or in connection with a merger, acquisition, financing, or sale of business assets.",
    ],
  },
  {
    title: "Data Retention",
    paragraphs: [
      "We retain information for as long as necessary to provide the service, maintain business records, resolve disputes, enforce agreements, and satisfy legal obligations.",
      "If you would like your account or submitted data deleted, contact us using the details below and we will review and process the request in accordance with applicable law.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "We use reasonable administrative, technical, and organizational safeguards designed to protect information against unauthorized access, loss, misuse, or alteration. No system or transmission method is completely secure, so we cannot guarantee absolute security.",
    ],
  },
  {
    title: "Your Choices",
    paragraphs: [
      "You may choose not to provide certain information, but that may limit your ability to use parts of the service. You may also contact us to request access, correction, or deletion of your information, subject to applicable legal requirements and legitimate business needs.",
    ],
  },
  {
    title: "Children's Privacy",
    paragraphs: [
      "Convert is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided personal information to us, please contact us so we can investigate and take appropriate action.",
    ],
  },
  {
    title: "Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. If we make material changes, we may update the effective date on this page and take additional steps where required by law.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "If you have questions about this Privacy Policy or our privacy practices, contact us at george@roisem.com.",
    ],
  },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Convert by WhachaWant"
      title="Privacy Policy"
      intro="This Privacy Policy explains how Convert by WhachaWant collects, uses, stores, and shares information when you access or use our website, application, and related services."
      lastUpdated="March 24, 2026"
      sections={[...sections]}
    />
  );
}
