
import ClientForm from "@/components/client-form";
import SignOutButton from "@/components/sign-out-button";
import Link from "next/link";
import { Settings, ChevronDown } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getClients() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase getClients error:", error);
    throw new Error("Failed to load clients");
  }

  return data ?? [];
}

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <main className="mx-auto max-w-4xl w-full p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Clients</h1>
        <SignOutButton />
      </div>

      <details className="group relative mt-6 rounded-xl border border-slate-200 shadow-sm transition hover:shadow-md">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:content-none">
          <span>Add / edit client</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 transition group-open:rotate-180">
            <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" />
          </span>
        </summary>

        <div className="border-t border-slate-100 px-4 py-4">
          <ClientForm />
        </div>
      </details>

      <div className="mt-8 space-y-3">
        {clients.length === 0 && (
          <p className="text-gray-500">No clients yet. Add your first one 👆</p>
        )}

        {clients.map(
          (client: { id: string; name: string; website: string | null }) => (
            <div key={client.id} className="relative rounded border p-4 transition">
              <Link href={`/clients/${client.id}`} className="block">
                <h2 className="font-semibold">{client.name}</h2>
                <p className="text-sm">{client.website || "No website"}</p>
              </Link>

              <Link
                href={`/clients/${client.id}/edit`}
                aria-label={`Edit ${client.name}`}
                className="absolute right-3 top-3 transition hover:text-slate-900"
              >
                <Settings size={18} aria-hidden="true" />
              </Link>
            </div>
          ),
        )}
      </div>
    </main>
  );
}
