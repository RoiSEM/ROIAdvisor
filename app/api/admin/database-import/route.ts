import { createHash } from "node:crypto";
import { Client } from "pg";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Temporary, staging-only tool. The approved data file is never stored in git.
const IMPORT_SHA256 = "e08b5b49dc79ecdca6734c6340c31c8132d22054c1727a10a3fb5a4393c674d4";
const STAGING_ORIGIN = "https://georgea140.sg-host.com";
const EXPECTED = { users: 8, clients: 12, reports: 56, billing_accounts: 4 };
const HEADERS = { "Cache-Control": "no-store" };
const MAX_UPLOAD = 512 * 1024;

async function authorize(req: Request) {
  const { user, error } = await getRequestUser(req);
  if (error || !user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: HEADERS });
  if (!isAdminUser(user)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403, headers: HEADERS });
}

function configuredClient() {
  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;
  if (required.some((key) => !process.env[key])) return null;
  if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST!)) return null;
  if (process.env.DB_NAME !== "dbyrsugxc16oj2" || process.env.DB_PORT !== "5432") return null;
  return new Client({
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false,
    connectionTimeoutMillis: 5000,
    query_timeout: 65000,
    statement_timeout: 60000,
    lock_timeout: 5000,
    application_name: "convert-staging-import",
  });
}

async function readStatus(client: Client) {
  const schema = await client.query("SELECT to_regnamespace('convert_staging') IS NOT NULL AS imported");
  if (!schema.rows[0].imported) return { imported: false, counts: null, matches_expected: false };
  const result = await client.query(
    "SELECT (SELECT count(*)::int FROM convert_staging.users) AS users, (SELECT count(*)::int FROM convert_staging.clients) AS clients, (SELECT count(*)::int FROM convert_staging.reports) AS reports, (SELECT count(*)::int FROM convert_staging.billing_accounts) AS billing_accounts",
  );
  const counts = result.rows[0];
  const matches = Object.entries(EXPECTED).every(([table, count]) => counts[table] === count);
  return { imported: true, counts, matches_expected: matches };
}

function safeFailure(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "42P06") return Response.json({ ok: false, error: "The staging schema already exists. Check status; nothing was overwritten." }, { status: 409, headers: HEADERS });
  const allowed = new Set(["ECONNREFUSED", "ETIMEDOUT", "28P01", "28000", "42501", "23503", "23505", "57014", "55P03"]);
  return Response.json({ ok: false, error: "Import or verification failed. Check status before retrying.", code: allowed.has(code) ? code : "IMPORT_FAILED" }, { status: 503, headers: HEADERS });
}

export async function GET(req: Request) {
  const denied = await authorize(req);
  if (denied) return denied;
  const client = configuredClient();
  if (!client) return Response.json({ ok: false, error: "Expected local SiteGround database configuration is missing" }, { status: 503, headers: HEADERS });
  try {
    await client.connect();
    return Response.json({ ok: true, ...await readStatus(client) }, { headers: HEADERS });
  } catch (error) {
    return safeFailure(error);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function POST(req: Request) {
  const denied = await authorize(req);
  if (denied) return denied;
  // Do not trust request.url's internal proxy origin or arbitrary forwarded hosts.
  if (req.headers.get("origin") !== STAGING_ORIGIN) return Response.json({ ok: false, error: "Use the SiteGround import page" }, { status: 403, headers: HEADERS });
  const length = req.headers.get("content-length");
  if (length && Number(length) > MAX_UPLOAD) return Response.json({ ok: false, error: "Upload too large" }, { status: 413, headers: HEADERS });
  let sql: string;
  try {
    // Bound the entire multipart body, including requests with no Content-Length.
    if (!req.body) throw new Error("Missing body");
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD) {
        await reader.cancel();
        return Response.json({ ok: false, error: "Upload too large" }, { status: 413, headers: HEADERS });
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
    if (form.get("confirm") !== "import") throw new Error("Confirmation required");
    const file = form.get("file");
    if (!file || typeof file === "string") throw new Error("File required");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== IMPORT_SHA256) {
      return Response.json({ ok: false, error: "This is not the approved Convert import file. Select convert-staging-import.sql without editing it." }, { status: 400, headers: HEADERS });
    }
    sql = bytes.toString("utf8");
  } catch {
    return Response.json({ ok: false, error: "Upload the approved SQL file and confirm the import" }, { status: 400, headers: HEADERS });
  }
  const client = configuredClient();
  if (!client) return Response.json({ ok: false, error: "Expected local SiteGround database configuration is missing" }, { status: 503, headers: HEADERS });
  try {
    await client.connect();
    // Exact file hash is pinned above. File contains one transaction, no DROP,
    // creates only convert_staging, and refuses an existing staging schema.
    await client.query(sql);
    const status = await readStatus(client);
    return Response.json({ ok: status.matches_expected, ...status }, { status: status.matches_expected ? 200 : 503, headers: HEADERS });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return safeFailure(error);
  } finally {
    await client.end().catch(() => {});
  }
}
