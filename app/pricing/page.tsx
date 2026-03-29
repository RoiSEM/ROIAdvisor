import { Suspense } from "react";
import PricingPageClient from "@/components/pricing-page-client";

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <PricingPageClient />
    </Suspense>
  );
}
