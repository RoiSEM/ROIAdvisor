import { ensurePostgresUser } from "./postgres-data";
import { cookies, headers } from "next/headers";
import { getAuthBackend, getBetterAuthSettings } from "./auth-config";
import { getBetterAuth } from "./better-auth";
import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";

export const ADMIN_EMAILS = ["george@roisem.com"];

function createAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
let admin: ReturnType<typeof createAdmin> | undefined;
// Do not require Supabase credentials or create its SDK in Better Auth mode.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdmin>, {
  get(_target, property) {
    admin ??= createAdmin();
    const value = Reflect.get(admin, property);
    return typeof value === "function" ? value.bind(admin) : value;
  },
});

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
  if (getAuthBackend() === "better-auth") {
    // Keep Next.js dynamic-rendering signals outside our error sanitization.
    const sessionHeaders = req?.headers ?? await headers();
    try {
      if (req && !["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.get("origin") !== getBetterAuthSettings().baseURL) {
        return { user: null, error: new Error("Untrusted request origin") };
      }
      const auth = await getBetterAuth();
      const session = await auth.api.getSession({ headers: sessionHeaders });
      if (!session?.user.emailVerified) return { user: null, error: null };
      const user = { id: session.user.id, email: session.user.email, created_at: session.user.createdAt.toISOString() };
      await ensurePostgresUser(user);
      return { user, error: null };
    } catch {
      // Authentication/database failures must never fall back to Supabase.
      return { user: null, error: new Error("Authentication unavailable") };
    }
  }

  const authHeader = req?.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (accessToken) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (user && !error) await ensurePostgresUser(user);
    return { user, error };
  }

  const supabase = await createSupabaseUserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user && !error) await ensurePostgresUser(user);
  return { user, error };
}
