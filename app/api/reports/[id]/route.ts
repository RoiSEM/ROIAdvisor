import { getRequestUser, isAdminUser, supabaseAdmin } from "@/lib/supabase-server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const {
      user,
      error: userError,
    } = await getRequestUser(req);

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: report, error: reportError } = await supabaseAdmin
      .from("reports")
      .select("id, client_id")
      .eq("id", id)
      .maybeSingle();

    if (reportError || !report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    let clientQuery = supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", report.client_id);

    if (!isAdminUser(user)) {
      clientQuery = clientQuery.eq("user_id", user.id);
    }

    const { data: client } = await clientQuery.maybeSingle();

    if (!client) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from("reports").delete().eq("id", id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete report error:", error);
    return Response.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
