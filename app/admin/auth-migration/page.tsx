import { redirect } from "next/navigation";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";
import MigrationForm from "./migration-form";
export const dynamic = "force-dynamic";
export default async function AuthMigrationPage() {
  const { user, error } = await getRequestUser();
  if (error || !user) redirect("/login");
  if (!isAdminUser(user)) redirect("/dashboard");
  return <main className="mx-auto max-w-2xl space-y-5 p-8">
    <h1 className="text-2xl font-bold">Prepare Google authentication migration</h1>
    <p>Admin-only, temporary SiteGround tool. Creates separate Better Auth tables and preserves imported user UUIDs. Does not switch login, modify client/report/billing records, or overwrite existing authentication tables.</p>
    <p>Choose the private, unmodified <code>google-identities.json</code> export. This file contains identity information, not Google passwords or provider tokens. Do not share it publicly.</p>
    <MigrationForm />
  </main>;
}
