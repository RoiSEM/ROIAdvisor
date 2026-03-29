import ClientForm from "@/components/client-form";
import {
  createSupabaseUserClient,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";
import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";
import { redirect } from "next/navigation";

async function getClient(id: string) {
  const supabase = await createSupabaseUserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  let query = supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", id);

  if (!isAdminUser(user)) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new Error("Failed to load client");
  }

  return { client: data, isAdmin: isAdminUser(user) };
}

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client, isAdmin } = await getClient(id);

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link
          href={`/dashboard/${client.id}`}
          className="inline-block text-sm underline"
        >
          ← {isAdmin ? "Back to Client" : "Back to Website"}
        </Link>
        <SignOutButton />
      </div>
      <h1 className="text-3xl font-bold">
        {isAdmin ? "Edit Client" : "Edit Website"}
      </h1>

      <ClientForm
        clientId={client.id}
        initialName={client.name || ""}
        initialWebsite={client.website || ""}
        initialEmail={client.email || ""}
        initialPortalUserId={client.user_id || ""}
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
        initialApprovalStatus={client.approval_status || "pending"}
        initialApprovalNotes={client.approval_notes || ""}
        isAdmin={isAdmin}
      />
    </main>
  );
}
