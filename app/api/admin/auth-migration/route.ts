import { getMigrations } from "better-auth/db/migration";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";
import { getAuthBackend, getBetterAuthSettings } from "@/lib/auth-config";
import { authPostgresPool } from "@/lib/auth-postgres";
import { createBetterAuthOptions } from "@/lib/better-auth-options";
import { APPROVED_GOOGLE_IMPORT_SHA256, parseGoogleIdentities, runAuthMigration } from "@/lib/auth-migration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORIGIN = "https://georgea140.sg-host.com";
const HEADERS = { "Cache-Control": "no-store" };
const MAX_BYTES = 32 * 1024;
function reply(value: object, status = 200) { return Response.json(value, { status, headers: HEADERS }); }
async function authorize(req: Request) {
  const { user, error } = await getRequestUser(req);
  if (error || !user) return reply({ ok: false, error: "Unauthorized" }, 401);
  if (!isAdminUser(user)) return reply({ ok: false, error: "Forbidden" }, 403);
}
function configuration() {
  const settings = getBetterAuthSettings();
  if (settings.baseURL !== ORIGIN || process.env.DB_NAME !== "dbyrsugxc16oj2") throw new Error("Expected staging configuration");
  return settings;
}
async function status() {
  const pool = authPostgresPool();
  const exists = await pool.query("SELECT to_regclass('public.convert_auth_migration') IS NOT NULL AS ready");
  if (!exists.rows[0].ready) return { ready: false };
  const result = await pool.query(`SELECT m.identity_count AS imported_identities, m.identity_sha256,
    (SELECT count(*)::int FROM public.convert_auth_user) AS users,
    (SELECT count(*)::int FROM public.convert_auth_account WHERE "providerId" = 'google') AS google_accounts
    FROM public.convert_auth_migration m WHERE version=1`);
  const row = result.rows[0];
  return { ready: row?.identity_sha256 === APPROVED_GOOGLE_IMPORT_SHA256 && row.users >= row.imported_identities && row.google_accounts >= row.imported_identities,
    imported_identities: row?.imported_identities ?? 0, users: row?.users ?? 0, google_accounts: row?.google_accounts ?? 0 };
}
export async function GET(req: Request) {
  const denied = await authorize(req); if (denied) return denied;
  try {
    configuration();
    return reply({ ok: true, authentication_backend: getAuthBackend(), ...await status() });
  } catch {
    return reply({ ok: false, error: "Auth migration status unavailable. Check the database and Better Auth configuration." }, 503);
  }
}
export async function POST(req: Request) {
  const denied = await authorize(req); if (denied) return denied;
  if (getAuthBackend() !== "supabase") return reply({ ok: false, error: "Import is disabled after authentication cutover" }, 409);
  if (req.headers.get("origin") !== ORIGIN) return reply({ ok: false, error: "Use the staging migration page" }, 403);
  if (Number(req.headers.get("content-length")) > MAX_BYTES) return reply({ ok: false, error: "Upload too large" }, 413);
  let identities;
  try {
    if (!req.body) throw new Error("No file");
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); return reply({ ok: false, error: "Upload too large" }, 413); }
      chunks.push(value);
    }
    identities = parseGoogleIdentities(Buffer.concat(chunks).toString("utf8"), APPROVED_GOOGLE_IMPORT_SHA256);
    if (identities.length !== 8) throw new Error("Unexpected identity count");
  } catch {
    return reply({ ok: false, error: "Upload the approved, unmodified google-identities.json export" }, 400);
  }
  try {
    const settings = configuration();
    const pool = authPostgresPool();
    if ((await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename LIKE 'convert_auth_%'")).rows.length) {
      return reply({ ok: false, error: "Authentication tables already exist. Check status; nothing overwritten." }, 409);
    }
    const plan = await getMigrations(createBetterAuthOptions(pool, settings));
    if (plan.toBeAdded.length || plan.unsafeChanges.length || plan.schemaProblems.length) throw new Error("Unexpected migration plan");
    const sql = await plan.compileMigrations();
    const client = await pool.connect();
    try { await runAuthMigration(client, identities, sql, APPROVED_GOOGLE_IMPORT_SHA256); }
    finally { client.release(); }
    const verified = await status();
    return reply({ ok: verified.ready, ...verified }, verified.ready ? 200 : 503);
  } catch {
    return reply({ ok: false, error: "Authentication migration failed. Check status before retrying; no credentials or records were exposed." }, 503);
  }
}
