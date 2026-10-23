import HomeLanding from "@/components/home/home-landing";
import { appData } from "@/lib/data-store";
import { getBillingSnapshot } from "@/lib/billing";
import { getRequestUser } from "@/lib/supabase-server";

export default async function HomePage() {
  const {
    user,
    error: userError,
  } = await getRequestUser();
  const signedInUser = !userError ? user : null;

  const { data: billing } = signedInUser
    ? await appData
        .from("billing_accounts")
        .select("plan, status, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", signedInUser.id)
        .maybeSingle()
    : { data: null };

  const billingSnapshot = getBillingSnapshot(billing);
  const isSignedIn = Boolean(signedInUser);

  return (
    <HomeLanding
      isSignedIn={isSignedIn}
      canManageBilling={isSignedIn && billingSnapshot.canManageBilling}
      year={new Date().getFullYear()}
    />
  );
}
