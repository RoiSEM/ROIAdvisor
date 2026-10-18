import {
  getRequestUser,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { getAuthBackend } from "@/lib/auth-config";
import { postgresPool } from "@/lib/postgres-data";

export async function GET() {
  const {
    user,
    error: userError,
  } = await getRequestUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (getAuthBackend() === "better-auth") {
    try {
      const { rows } = await postgresPool().query("SELECT id, email FROM convert_staging.users ORDER BY email");
      return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "User directory unavailable" }, { status: 503 });
    }
  }
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
  }));

  return NextResponse.json(users);
}
