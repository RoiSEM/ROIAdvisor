import { Pool } from "pg";
let pool: Pool | undefined;
// Better Auth needs pg's native Date values. The application-data pool converts
// timestamps into strings for legacy API compatibility and must not be reused.
export function authPostgresPool(): Pool {
  if (!pool) {
    const keys = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;
    if (keys.some(key => !process.env[key])) throw new Error("PostgreSQL configuration is incomplete");
    if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST!) || process.env.DB_PORT !== "5432") throw new Error("Expected local PostgreSQL configuration");
    pool = new Pool({
      host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false,
      max: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
      statement_timeout: 15000, application_name: "convert-auth",
    });
    pool.on("error", () => console.error("Authentication database idle connection error"));
  }
  return pool;
}
