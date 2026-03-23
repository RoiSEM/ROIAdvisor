import { supabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    email: user?.email || null,
    id: user?.id || null,
    isAdmin: user?.email === "george@roisem.com",
  });
}
