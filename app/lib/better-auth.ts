import { betterAuth } from "better-auth";
import { authPostgresPool } from "./auth-postgres";
import { getBetterAuthSettings } from "./auth-config";
import { createBetterAuthOptions } from "./better-auth-options";

let instance: ReturnType<typeof betterAuth> | undefined;
export async function getBetterAuth() {
  if (!instance) {
    const settings = getBetterAuthSettings();
    const database = authPostgresPool();
    // Deliberately require explicit identity migration before accepting logins.
    const ready = await database.query("SELECT version FROM public.convert_auth_migration WHERE version = 1");
    if (ready.rowCount !== 1) throw new Error("Authentication migration is not ready");
    instance = betterAuth(createBetterAuthOptions(database, settings));
  }
  return instance;
}
