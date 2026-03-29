import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";

export const ADMIN_EMAILS = ["george@roisem.com"];

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const supabase = supabaseAdmin;

export function isAdminUser(user: Pick<User, "email"> | null | undefined) {
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email));
}

export async function createSupabaseUserClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie writes are best-effort in read-only server contexts.
          }
        },
      },
    },
  );
}

export async function getRequestUser(req?: Request) {
  const authHeader = req?.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (accessToken) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);

    return { user, error };
  }

  const supabase = await createSupabaseUserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
}
