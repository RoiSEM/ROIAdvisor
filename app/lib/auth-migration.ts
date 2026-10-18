import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export const APPROVED_GOOGLE_IMPORT_SHA256 = "7e71a464dedee97c504b6cc2396e5adfdfd6331afe5aa18d489e2b8db4b956d8";
export type GoogleIdentity = {
  user_id: string; provider: "google"; provider_account_id: string;
  email: string; email_verified: true; name: string | null;
  image: string | null; created_at: string;
};
export function parseGoogleIdentities(raw: string, approvedHash: string): GoogleIdentity[] {
  if (createHash("sha256").update(raw).digest("hex") !== approvedHash) throw new Error("Not the approved identity export");
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw new Error("Invalid identity export");
  const users = new Set<string>();
  const subjects = new Set<string>();
  const emails = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || row.provider !== "google" || row.email_verified !== true ||
        typeof row.user_id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.user_id) ||
        typeof row.provider_account_id !== "string" || !/^\d+$/.test(row.provider_account_id) ||
        typeof row.email !== "string" || !row.email.includes("@") ||
        typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))) throw new Error("Invalid identity mapping");
    const email = row.email.toLowerCase();
    if (users.has(row.user_id) || subjects.has(row.provider_account_id) || emails.has(email)) throw new Error("Duplicate identity mapping");
    users.add(row.user_id); subjects.add(row.provider_account_id); emails.add(email);
  }
  return rows as GoogleIdentity[];
}

// The caller must hold a transaction and the migration advisory lock.
// Link by exported provider subject + original UUID, never email alone.
export async function runAuthMigration(client: Pick<PoolClient, "query">, identities: GoogleIdentity[], schemaSql: string, identityHash: string) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(71920461)");
    const existing = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename LIKE 'convert_auth_%'");
    if (existing.rows.length) throw new Error("Authentication tables already exist; nothing overwritten");
    await client.query(schemaSql);
    await seedGoogleAccounts(client, identities);
    await client.query("CREATE TABLE public.convert_auth_migration (version integer PRIMARY KEY, identity_count integer NOT NULL, identity_sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
    await client.query("INSERT INTO public.convert_auth_migration (version, identity_count, identity_sha256) VALUES (1,$1,$2)", [identities.length, identityHash]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

export async function seedGoogleAccounts(client: Pick<PoolClient, "query">, identities: GoogleIdentity[]) {
  for (const identity of identities) {
    const registry = await client.query("SELECT id, email FROM convert_staging.users WHERE id = $1", [identity.user_id]);
    if (registry.rows.length !== 1 || registry.rows[0].email?.toLowerCase() !== identity.email.toLowerCase()) throw new Error("Imported identity registry mismatch");
    await client.query(
      `INSERT INTO public.convert_auth_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt") VALUES ($1,$2,$3,true,$4,$5,now())`,
      [identity.user_id, identity.name || identity.email, identity.email, identity.image, identity.created_at],
    );
    await client.query(
      `INSERT INTO public.convert_auth_account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES ($1,$2,'google',$3,$4,now())`,
      [randomUUID(), identity.provider_account_id, identity.user_id, identity.created_at],
    );
  }
}
