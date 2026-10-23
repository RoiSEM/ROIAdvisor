import { appData } from "@/lib/data-store";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";
import { getGA4Report } from "@/lib/analytics/ga4";
import { hasValidReportMetrics } from "@/lib/report-metrics";
import { withUsage } from "@/lib/usage";
import {
  readConnectionProof,
  writeConnectionProof,
} from "@/lib/connection-proof";

/** A bounded read proves access immediately, without creating/charging a report. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await getRequestUser(req);
  if (error || !user)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let query = appData
    .from("clients")
    .select("id, user_id, ga4_property_id, tracking_notes, approval_status")
    .eq("id", id);
  if (!isAdminUser(user)) query = query.eq("user_id", user.id);
  const { data: client, error: readError } = await query.maybeSingle();
  if (readError)
    return Response.json(
      { error: "Unable to read website settings." },
      { status: 503 },
    );
  if (!client)
    return Response.json({ error: "Website not found." }, { status: 404 });
  if (client.approval_status !== "approved")
    return Response.json(
      {
        error:
          "Analytics access needs approval before this check. Use the connection guide or ask George for help.",
      },
      { status: 403 },
    );
  const propertyId = client.ga4_property_id;
  if (typeof propertyId !== "string" || !/^\d{1,20}$/.test(propertyId))
    return Response.json(
      { error: "Save a valid numeric GA4 property ID first." },
      { status: 400 },
    );
  return withUsage(user.id, "sync", async () => {
    try {
      const end = new Date();
      end.setUTCDate(end.getUTCDate() - 1);
      const day = end.toISOString().slice(0, 10);
      const metrics = await getGA4Report(propertyId, {
        startDate: day,
        endDate: day,
      });
      if (!hasValidReportMetrics(metrics))
        return Response.json(
          {
            error:
              "Analytics returned invalid measurements. Connection was not confirmed.",
          },
          { status: 502 },
        );
      const proof = {
        source: "ga4" as const,
        propertyId,
        verifiedAt: new Date().toISOString(),
      };
      const { data: saved, error: saveError } = await appData
        .from("clients")
        .update({
          tracking_notes: writeConnectionProof(client.tracking_notes, proof),
        })
        .eq("id", id)
        .eq("ga4_property_id", propertyId)
        .select("tracking_notes")
        .maybeSingle();
      if (
        saveError ||
        !saved ||
        readConnectionProof(saved.tracking_notes)?.propertyId !== propertyId
      )
        return Response.json(
          {
            error:
              "Connection worked but evidence could not be saved. Reload and try again.",
          },
          { status: 503 },
        );
      return Response.json(
        { connected: true, source: "ga4", verified_at: proof.verifiedAt },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return Response.json(
        {
          error:
            "Unable to confirm Analytics access. Check the property and Viewer permission, then try again. No report was created.",
        },
        { status: 502 },
      );
    }
  });
}
