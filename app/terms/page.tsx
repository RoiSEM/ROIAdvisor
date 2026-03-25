import type { Metadata } from "next";
import LegalPageShell from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms and Conditions | Convert by WhachaWant",
  description:
    "Read the terms that govern the use of Convert by WhachaWant and related services.",
};

const sections = [
  {
    title: "Acceptance of Terms",
    paragraphs: [
      "These Terms and Conditions govern your access to and use of Convert by WhachaWant, including our website, application, and related services. By accessing or using the service, you agree to these Terms.",
      "If you are using the service on behalf of a business or other entity, you represent that you have authority to bind that entity to these Terms.",
    ],
  },
  {
    title: "Use of the Service",
    paragraphs: [
      "You may use the service only in compliance with applicable law and these Terms. You are responsible for the accuracy of the information you provide and for your activity on the account.",
      "You agree not to misuse the service, interfere with its operation, attempt unauthorized access, copy or reverse engineer the platform except as permitted by law, or use the service to violate the rights of others.",
    ],
  },
  {
    title: "Accounts and Access",
    paragraphs: [
      "You may be required to sign in with a supported authentication provider, including Google, to access certain features. You are responsible for maintaining the security of your login credentials and for all activity that occurs under your account.",
      "We may suspend or restrict access if we believe your account is being used unlawfully, fraudulently, or in violation of these Terms.",
    ],
  },
  {
    title: "Fees and Subscriptions",
    paragraphs: [
      "Certain features may be offered on a paid basis, including trial, subscription, or custom plans. If you purchase paid access, you agree to pay all applicable fees and taxes associated with your selected plan.",
      "Unless otherwise stated in a separate written agreement, fees are non-refundable except where required by law.",
    ],
  },
  {
    title: "Your Data",
    paragraphs: [
      "You retain ownership of the information and materials you submit to the service. You grant us a limited right to host, process, transmit, and use that data as necessary to operate, maintain, secure, and improve the service for you.",
      "You represent that you have the rights and permissions needed to provide any data you submit to the platform.",
    ],
  },
  {
    title: "Intellectual Property",
    paragraphs: [
      "The service, including its software, design, branding, text, graphics, and underlying technology, is owned by WhachaWant or its licensors and is protected by applicable intellectual property laws.",
      "Except for the limited right to use the service under these Terms, no rights are granted to you by implication or otherwise.",
    ],
  },
  {
    title: "Disclaimers",
    paragraphs: [
      "The service is provided on an as-is and as-available basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, title, and non-infringement.",
      "Reports, insights, recommendations, and AI-generated outputs are provided for informational purposes and should be reviewed using your own business judgment before you rely on them.",
    ],
  },
  {
    title: "Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, WhachaWant and its affiliates, officers, employees, and agents will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenues, data, goodwill, or business opportunities arising out of or related to the service.",
      "To the fullest extent permitted by law, our total liability for claims arising out of or related to the service will not exceed the amount you paid us for the service during the 12 months before the event giving rise to the claim.",
    ],
  },
  {
    title: "Termination",
    paragraphs: [
      "You may stop using the service at any time. We may suspend or terminate your access at any time if we believe you have violated these Terms, created risk for us or others, or if we discontinue the service.",
      "Any provisions that by their nature should survive termination will survive, including provisions relating to ownership, disclaimers, limitations of liability, and dispute-related terms.",
    ],
  },
  {
    title: "Changes to These Terms",
    paragraphs: [
      "We may update these Terms from time to time. When we do, we will update the effective date on this page. Your continued use of the service after the updated Terms take effect constitutes acceptance of the revised Terms.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "If you have questions about these Terms and Conditions, contact us at george@roisem.com.",
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Convert by WhachaWant"
      title="Terms and Conditions"
      intro="These Terms and Conditions describe the rules, responsibilities, and limits that apply when you use Convert by WhachaWant."
      lastUpdated="March 24, 2026"
      sections={[...sections]}
    />
  );
}
