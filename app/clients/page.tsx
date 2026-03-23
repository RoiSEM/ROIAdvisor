import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .from("clients") // keep DB the same for now
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold">Convert</h1>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user.email}</span>

          <form action="/auth/signout" method="post">
            <button className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white p-6">
          <nav className="space-y-3 text-sm">
            <p className="text-xs uppercase text-slate-400">Navigation</p>

            <a className="block font-semibold">Projects</a>
            <a className="block text-slate-600 hover:text-black">Reports</a>
            <a className="block text-slate-600 hover:text-black">Settings</a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-6xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Projects</h2>

            <button className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90">
              + Add Project
            </button>
          </div>

          {/* Projects List */}
          <div className="mt-6 space-y-4">
            {!projects?.length && (
              <div className="rounded-xl border bg-white p-10 text-center">
                <h3 className="text-lg font-semibold">No projects yet</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Add your first website to start generating reports.
                </p>
              </div>
            )}

            {projects?.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    <p className="text-sm text-slate-500">{project.url}</p>
                  </div>

                  <button className="text-slate-400 hover:text-black">
                    ⚙️
                  </button>
                </div>

                {/* Metrics (placeholder for now) */}
                <div className="mt-4 flex gap-6 text-sm">
                  <div>
                    <p className="text-slate-400">Traffic</p>
                    <p className="font-semibold">—</p>
                  </div>

                  <div>
                    <p className="text-slate-400">Conversions</p>
                    <p className="font-semibold">—</p>
                  </div>

                  <div>
                    <p className="text-slate-400">Health</p>
                    <p className="font-semibold text-slate-500">Pending</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
