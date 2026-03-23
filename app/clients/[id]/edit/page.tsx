import ClientForm from "@/components/client-form";
import { supabase } from "@/lib/supabase-server";
import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";

async function getClient(id: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Failed to load client");
  }

  return data;
}

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link
          href={`/clients/${client.id}`}
          className="inline-block text-sm underline"
        >
          ← Back to Client
        </Link>
        <SignOutButton />
      </div>
      <h1 className="text-3xl font-bold">Edit Client</h1>

      <ClientForm
        clientId={client.id}
        initialName={client.name || ""}
        initialWebsite={client.website || ""}
        initialEmail={client.email || ""}
        initialGa4PropertyId={client.ga4_property_id || ""}
        initialPrimaryGoal={client.primary_goal || ""}
        initialMonthlyGoal={client.monthly_goal}
        initialAverageConversionValue={client.average_conversion_value}
        initialConversionTypes={client.conversion_types || []}
        initialConversionTrackingStatus={client.conversion_tracking_status || ""}
        initialMainCta={client.main_cta || ""}
        initialFunnelDescription={client.funnel_description || ""}
        initialKnownIssues={client.known_issues || ""}
        initialMarketingChannels={client.marketing_channels || []}
        initialRunningAds={client.running_ads}
        initialClientNotes={client.client_notes || ""}
      />
    </main>
  );
}
