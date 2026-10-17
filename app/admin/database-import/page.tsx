import { redirect } from "next/navigation";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";
import ImportForm from "./import-form";

export const dynamic = "force-dynamic";

export default async function DatabaseImportPage() {
  const { user, error } = await getRequestUser();
  if (error || !user) redirect("/login");
  if (!isAdminUser(user)) {
    return <main className="p-8">Admin access required.</main>;
  }
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-bold">Import Convert test data</h1>
      <p>This creates the isolated <code>convert_staging</code> schema in your SiteGround database. It does not change Supabase or switch the app to the imported records.</p>
      <p>Expected: 8 users, 12 clients, 56 reports, and 4 billing accounts. Only the exact prepared import file is accepted. Existing staging data will not be overwritten.</p>
      <ImportForm />
    </main>
  );
}
