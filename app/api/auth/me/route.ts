import { createClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    email: user?.email || null,
    id: user?.id || null,
    isAdmin: user?.email === "george@roisem.com",
  });
}
