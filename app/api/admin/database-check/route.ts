import { Client } from "pg";
import { getRequestUser, isAdminUser } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Temporary migration diagnostic. Does not change the app's storage backend.
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const { user, error } = await getRequestUser(req);
  if (error || !user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers });
  }
  if (!isAdminUser(user)) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403, headers });
  }

  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    return Response.json({ ok: false, error: "Missing configuration", missing }, { status: 503, headers });
  }

  const host = process.env.DB_HOST!;
  const port = Number(process.env.DB_PORT);
  // SSL is disabled only for this explicitly loopback-only diagnostic.
  if (!["localhost", "127.0.0.1", "::1"].includes(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Response.json({ ok: false, error: "This diagnostic requires a loopback host and valid port" }, { status: 503, headers });
  }

  const client = new Client({
    host,
    port,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    statement_timeout: 5000,
    options: "-c default_transaction_read_only=on",
    application_name: "convert-migration-check",
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT current_database() AS database, current_setting('server_version') AS server_version, current_setting('transaction_read_only') AS read_only",
    );
    return Response.json({
      ok: true,
      ...rows[0],
      application_data_backend: process.env.DATA_BACKEND ?? "supabase",
      application_schema: process.env.DATA_BACKEND === "postgres" ? "convert_staging" : null,
      authentication_backend: "supabase",
    }, { headers });
  } catch (failure) {
    const code = failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
    const knownCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "28P01", "28000", "3D000", "42501", "53300"]);
    // Never return/log the raw exception: drivers may include connection details.
    return Response.json({ ok: false, error: "Database connection check failed", code: knownCodes.has(code) ? code : "CONNECTION_FAILED" }, { status: 503, headers });
  } finally {
    await client.end().catch(() => {});
  }
}
