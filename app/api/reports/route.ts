import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");

  if (!clientId) {
    return Response.json({ error: "client_id is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();

  const { client_id, month, traffic, conversions, top_pages, notes } = body;

  if (!client_id) {
    return Response.json({ error: "client_id is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reports")
    .insert([
      {
        client_id,
        month,
        traffic,
        conversions,
        top_pages,
        notes,
      },
    ])
    .select();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
