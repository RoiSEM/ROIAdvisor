import { getBillingSnapshot } from "@/lib/billing";
import { getRequestUser, supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const {
    user,
    error: userError,
  } = await getRequestUser();

  if (userError || !user) {
    return Response.json({
      plan: "free",
      raw_plan: null,
      status: "inactive",
      can_use_custom_date_range: false,
      has_unlimited_reports: false,
      can_manage_billing: false,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("billing_accounts")
    .select("plan, status, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const billing = getBillingSnapshot(data);

  return Response.json({
    plan: billing.effectivePlan,
    raw_plan: billing.rawPlan,
    status: billing.status,
    can_use_custom_date_range: billing.canUseCustomDateRange,
    has_unlimited_reports: billing.hasUnlimitedReports,
    can_manage_billing: billing.canManageBilling,
  });
}
