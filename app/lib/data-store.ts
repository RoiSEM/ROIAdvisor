import { supabaseAdmin } from "./supabase-server";
import { getDataBackend, postgresData } from "./postgres-data";
import type { TableName } from "./postgres-data";

// Explicit rollout flag: SiteGround selects PostgreSQL; Vercel remains on the
// original backend until deliberately changed. PostgreSQL errors never fall
// through to Supabase, preventing split writes and accidental data disclosure.
export const appData = {
  from<K extends TableName>(table: K) {
    if (getDataBackend() === "postgres") return postgresData.from(table);
    return supabaseAdmin.from(table);
  },
};
