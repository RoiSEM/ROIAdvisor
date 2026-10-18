import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthBackend } from "@/lib/auth-config";

export async function GET(request: Request) {
  if (getAuthBackend() === "better-auth") return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new NextResponse(null, {
      status: 307,
      headers: { Location: "/login" },
    });
  }

  const cookieStore = await cookies();
  // A relative Location keeps the browser on its public origin. Behind a
  // reverse proxy, request.url can contain an internal localhost address.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: "/dashboard" },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error);
    return new NextResponse(null, {
      status: 307,
      headers: { Location: "/login?error=auth_callback" },
    });
  }

  return response;
}
