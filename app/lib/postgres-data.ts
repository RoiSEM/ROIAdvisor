import { Pool, types } from "pg";
import type { QueryResultRow } from "pg";
import type { SummaryClientData, SummaryReportData } from "./report-summary";

export type ClientRecord = SummaryClientData & {
  id: string; name: string; created_at: string | null; email: string | null;
  user_id: string | null; ga4_property_id: string | null; logo_url: string | null;
  approval_status: string; approval_notes: string | null;
  approved_at: string | null; approved_by_user_id: string | null;
};
export type ReportRecord = SummaryReportData & {
  id: string; client_id: string | null; user_id: string | null;
  created_at: string | null; analytics_synced_at: string | null;
  ai_summary: string | null; top_pages: string[] | null;
  page_views: number | null; active_users: number | null;
  bounce_rate: number | null; engagement_rate: number | null;
  start_date: string | null; end_date: string | null; clients: ClientRecord | null;
};
export type BillingRecord = {
  id: string; user_id: string | null; stripe_customer_id: string | null;
  stripe_subscription_id: string | null; stripe_price_id: string | null;
  plan: string | null; status: string | null; created_at: string | null; updated_at: string | null;
};
type Tables = { clients: ClientRecord; reports: ReportRecord; billing_accounts: BillingRecord };
export type TableName = keyof Tables;
type Failure = { message: string; code: string };
type Result<T> = { data: T | null; error: Failure | null; count: number | null };
type Filter = { column: string; operator: "=" | ">="; value: unknown };
type Executor = { query(sql: string, values?: unknown[]): Promise<{ rows: QueryResultRow[]; rowCount?: number | null }> };

const SCHEMA = "convert_staging";
const COLUMNS: Record<TableName, readonly string[]> = {
  clients: ["id", "name", "website", "created_at", "ga4_property_id", "email", "primary_goal", "monthly_goal", "average_conversion_value", "conversion_types", "conversion_tracking_status", "main_cta", "funnel_description", "known_issues", "marketing_channels", "running_ads", "client_notes", "user_id", "approval_status", "approval_notes", "approved_at", "approved_by_user_id", "logo_url", "key_events", "technical_issues", "design_concerns", "ad_channel_notes", "offer_message_concerns", "tracking_notes"],
  reports: ["id", "client_id", "month", "traffic", "conversions", "top_pages", "notes", "ai_summary", "created_at", "analytics_synced_at", "page_views", "active_users", "bounce_rate", "engagement_rate", "user_id", "start_date", "end_date", "key_event_performance", "channel_performance", "landing_page_performance", "device_performance"],
  billing_accounts: ["id", "user_id", "stripe_customer_id", "stripe_subscription_id", "stripe_price_id", "plan", "status", "created_at", "updated_at"],
};
const JSON_COLUMNS = new Set(["top_pages", "key_event_performance", "channel_performance", "landing_page_performance", "device_performance"]);
let pool: Pool | undefined;

export function getDataBackend(): "supabase" | "postgres" {
  const backend = process.env.DATA_BACKEND ?? "supabase";
  if (backend !== "supabase" && backend !== "postgres") throw new Error("Unsupported DATA_BACKEND");
  return backend;
}

export function postgresPool(): Pool {
  if (!pool) {
    const keys = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;
    if (keys.some((key) => !process.env[key])) throw new Error("PostgreSQL configuration is incomplete");
    if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST!) || process.env.DB_PORT !== "5432") {
      throw new Error("Expected local PostgreSQL configuration");
    }
    pool = new Pool({
      host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false,
      max: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
      statement_timeout: 15000, application_name: "convert-app",
      types: { getTypeParser(oid, format) {
        if (format === "text" && oid === 1082) return (value: string) => value;
        if (format === "text" && [1114, 1184].includes(oid)) return (value: string) => value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
        if (format === "text" && oid === 1700) return Number;
        return types.getTypeParser(oid, format);
      } },
    });
    pool.on("error", () => console.error("PostgreSQL idle connection error"));
  }
  return pool;
}

// Keep legacy UUIDs so Supabase sessions still own the imported records.
// This also provisions new, already-verified Supabase users without email linking.
export async function ensurePostgresUser(user: { id: string; email?: string; created_at: string }) {
  if (getDataBackend() !== "postgres") return;
  await postgresPool().query(
    `INSERT INTO ${SCHEMA}.users (id, email, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [user.id, user.email ?? null, user.created_at],
  );
}

function safeError(error: unknown): Failure {
  const quotaFailure = error as { code?: string; message?: string };
  if (quotaFailure?.code === "P0001" && quotaFailure.message === "REPORT_QUOTA_EXCEEDED") {
    return { code: "REPORT_LIMIT", message: "Report limit reached for this calendar month." };
  }
  const failure = error as { code?: string; message?: string };
  const column = failure.code === "42703" ? failure.message?.match(/column (?:\w+\.)?"?(\w+)"?(?: of relation "\w+")? does not exist/)?.[1] : null;
  if (column && Object.values(COLUMNS).some((columns) => columns.includes(column))) {
    return { code: "42703", message: `Could not find the '${column}' column` };
  }
  const codes = new Set(["23502", "23503", "23505", "23514", "22P02", "42501", "57014", "ECONNREFUSED"]);
  return { code: failure.code && codes.has(failure.code) ? failure.code : "DATABASE_ERROR", message: "Database operation failed" };
}

// Small parameterized adapter for the operations used by Convert's three tables.
// It is not a general PostgREST/Supabase implementation. Auth stays separate.
export class PostgresQuery<T extends QueryResultRow> implements PromiseLike<Result<T[]>> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private projection = "*";
  private filters: Filter[] = [];
  private ordering?: { column: string; ascending: boolean };
  private payload: Record<string, unknown>[] = [];
  private returning = false;
  private countOnly = false;
  private countRequested = false;
  private promise?: Promise<Result<T[]>>;
  constructor(private table: TableName, private executor: () => Executor = postgresPool) {
    if (!Object.hasOwn(COLUMNS, table)) throw new Error("Unsupported database table");
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.projection = columns;
    this.returning = this.action !== "select";
    this.countRequested = options?.count === "exact";
    this.countOnly = options?.head === true;
    return this;
  }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.action = "insert"; this.payload = Array.isArray(payload) ? payload : [payload]; return this; }
  update(payload: Record<string, unknown>) { this.action = "update"; this.payload = [payload]; return this; }
  delete() { this.action = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, operator: "=", value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ column, operator: ">=", value }); return this; }
  order(column: string, options: { ascending?: boolean } = {}) { this.ordering = { column, ascending: options.ascending !== false }; return this; }

  private identifier(column: string) {
    if (!COLUMNS[this.table].includes(column)) throw new Error("Unsupported database column");
    return `"${column}"`;
  }
  private projectionSql() {
    if (this.projection.trim() === "*") return "r.*";
    if (this.table === "reports" && /^\s*\*\s*,\s*clients\s*\(\s*\*\s*\)\s*$/.test(this.projection)) return "r.*, to_jsonb(c) AS clients";
    return this.projection.split(",").map((column) => `r.${this.identifier(column.trim())}`).join(", ");
  }
  private async execute(): Promise<Result<T[]>> {
    const values: unknown[] = [];
    const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
    const table = `${SCHEMA}."${this.table}"`;
    try {
      let sql: string;
      const joined = this.action === "select" && this.table === "reports" && /clients\s*\(/.test(this.projection);
      const projection = this.projectionSql();
      if (this.action === "select") {
        sql = `SELECT ${this.countOnly ? "count(*)::int AS exact_count" : projection} FROM ${table} r`;
        if (joined) sql += ` LEFT JOIN ${SCHEMA}.clients c ON c.id = r.client_id`;
      } else if (this.action === "insert") {
        if (!this.payload.length) throw new Error("Empty insert");
        const columns = [...new Set(this.payload.flatMap((row) => Object.keys(row).filter((column) => row[column] !== undefined)))];
        for (const column of columns) this.identifier(column);
        if (!columns.length && this.payload.length === 1) sql = `INSERT INTO ${table} AS r DEFAULT VALUES`;
        else {
          if (!columns.length) throw new Error("Empty insert");
          const rows = this.payload.map((row) => "(" + columns.map((column) => row[column] === undefined ? "DEFAULT" : bind(JSON_COLUMNS.has(column) && row[column] !== null ? JSON.stringify(row[column]) : row[column])).join(", ") + ")");
          sql = `INSERT INTO ${table} AS r (${columns.map((column) => this.identifier(column)).join(", ")}) VALUES ${rows.join(", ")}`;
        }
      } else if (this.action === "update") {
        if (!this.filters.length) throw new Error("Unfiltered update denied");
        const fields = Object.entries(this.payload[0]).filter(([, value]) => value !== undefined);
        if (!fields.length) throw new Error("Empty update");
        sql = `UPDATE ${table} AS r SET ${fields.map(([column, value]) => `${this.identifier(column)} = ${bind(JSON_COLUMNS.has(column) && value !== null ? JSON.stringify(value) : value)}`).join(", ")}`;
      } else {
        if (!this.filters.length) throw new Error("Unfiltered delete denied");
        sql = `DELETE FROM ${table} AS r`;
      }
      if (this.filters.length) {
        sql += " WHERE " + this.filters.map(({ column, operator, value }) => {
          const name = `r.${this.identifier(column)}`;
          // Preserve PostgREST equality semantics: eq(null) never means IS NULL.
          return `${name} ${operator} ${bind(value)}`;
        }).join(" AND ");
      }
      if (this.action === "select" && this.ordering && !this.countOnly) sql += ` ORDER BY r.${this.identifier(this.ordering.column)} ${this.ordering.ascending ? "ASC" : "DESC"}`;
      if (this.action !== "select" && this.returning) sql += ` RETURNING ${projection}`;
      const result = await this.executor().query(sql, values);
      if (this.countOnly) return { data: null, error: null, count: Number(result.rows[0]?.exact_count ?? 0) };
      const rows = result.rows as T[];
      return { data: this.action === "select" || this.returning ? rows : null, error: null, count: this.countRequested ? rows.length : null };
    } catch (error) {
      return { data: null, error: safeError(error), count: null };
    }
  }
  then<TResult1 = Result<T[]>, TResult2 = never>(onfulfilled?: ((value: Result<T[]>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    this.promise ??= this.execute();
    return this.promise.then(onfulfilled, onrejected);
  }
  async single(): Promise<Result<T>> {
    const result = await this;
    if (result.error) return { ...result, data: null };
    if (result.data?.length !== 1) return { data: null, count: null, error: { code: "PGRST116", message: "Expected one database row" } };
    return { ...result, data: result.data[0] };
  }
  async maybeSingle(): Promise<Result<T>> {
    const result = await this;
    if (result.error) return { ...result, data: null };
    if (!result.data?.length) return { ...result, data: null };
    if (result.data.length > 1) return { data: null, count: null, error: { code: "PGRST116", message: "Expected at most one database row" } };
    return { ...result, data: result.data[0] };
  }
}

export const postgresData = {
  from<K extends TableName>(table: K) { return new PostgresQuery<Tables[K]>(table); },
};
