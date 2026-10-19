import { postgresPool, getDataBackend } from "./postgres-data";
import { supabaseAdmin } from "./supabase-server";

class UsageUnavailableError extends Error {
  constructor() { super("Usage tracking is unavailable. Try again shortly."); }
}

export async function getReportAllowance(clientId: string): Promise<{ used: number; limit: number | null; remaining: number | null }> {
  try {
    let data: unknown;
    if (getDataBackend() === "postgres") {
      const result = await postgresPool().query("SELECT convert_staging.get_report_allowance($1) AS result", [clientId]);
      data = result.rows[0]?.result;
    } else {
      const result = await supabaseAdmin.rpc("get_report_allowance", { p_client_id: clientId });
      if (result.error) throw new UsageUnavailableError();
      data = result.data;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new UsageUnavailableError();
    const value = data as { used: number; limit: number | null; remaining: number | null };
    if (!Number.isSafeInteger(value.used) || value.used < 0 ||
      (value.limit !== null && (!Number.isSafeInteger(value.limit) || value.limit < 1)) ||
      value.remaining !== (value.limit === null ? null : Math.max(value.limit - value.used, 0))) {
      throw new UsageUnavailableError();
    }
    return value;
  } catch { throw new UsageUnavailableError(); }
}

export async function withUsage(
  actorId: string,
  operation: "report" | "ai" | "sync",
  work: () => Promise<Response>
): Promise<Response> {
  let leaseId: string | null = null;
  const nowMs = Date.now();

  try {
    const backend = getDataBackend();
    if (backend === "postgres") {
      const pool = postgresPool();
      // Try acquire guard lock / lease via DB function or table
      const res = await pool.query(
        `SELECT convert_staging.acquire_operational_guard($1, $2, $3) AS lease_id`,
        [actorId, operation, nowMs]
      );
      leaseId = res.rows[0]?.lease_id;
      if (leaseId === null) {
        return Response.json(
          { error: "Rate limit exceeded or concurrent operation in progress." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    } else {
      // supabase rpc
      const { data, error } = await supabaseAdmin.rpc("acquire_operational_guard", {
        p_actor_id: actorId,
        p_operation: operation,
        p_now_ms: nowMs,
      });
      if (error) throw new Error("Usage tracking unavailable");
      if (data === null) {
        return Response.json(
          { error: "Rate limit exceeded or concurrent operation in progress." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
      leaseId = data;
    }
    if (typeof leaseId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leaseId)) {
      throw new UsageUnavailableError();
    }
  } catch {
    return Response.json(
      { error: "Guard unavailable." },
      { status: 503 }
    );
  }

  try {
    return await work();
  } catch (error) {
    if (error instanceof UsageUnavailableError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  } finally {
    await releaseLease(actorId, leaseId).catch(() => {
      console.warn("Usage lease release failed; admission remains blocked until expiry.");
    });
  }
}

async function releaseLease(actorId: string, leaseId: string | null) {
  if (!leaseId) return;
  const backend = getDataBackend();
  if (backend === "postgres") {
    await postgresPool().query(
      `SELECT convert_staging.release_operational_guard($1, $2)`,
      [actorId, leaseId]
    );
  } else {
    const { error } = await supabaseAdmin.rpc("release_operational_guard", {
      p_actor_id: actorId,
      p_lease_id: leaseId,
    });
    if (error) throw new UsageUnavailableError();
  }
}
