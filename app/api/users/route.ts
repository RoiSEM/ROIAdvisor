import { supabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
  }));

  return NextResponse.json(users);
}