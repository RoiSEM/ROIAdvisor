import {
  getRequestUser,
  isAdminUser,
  supabaseAdmin,
} from "@/lib/supabase-server";
import { NextResponse } from "next/server";

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
