export function getBetterAuthSettings() {
  if (process.env.DATA_BACKEND !== "postgres") throw new Error("Better Auth requires DATA_BACKEND=postgres");
  const baseURL = process.env.BETTER_AUTH_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!baseURL || !secret || secret.length < 32 || !clientId || !clientSecret) throw new Error("Better Auth configuration is incomplete");
  const url = new URL(baseURL);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("BETTER_AUTH_URL must be a public HTTPS origin");
  return { baseURL: url.origin, secret, clientId, clientSecret };
}

export function getAuthBackend(): "supabase" | "better-auth" {
  const backend = process.env.AUTH_BACKEND ?? "supabase";
  if (backend !== "supabase" && backend !== "better-auth") throw new Error("Unsupported AUTH_BACKEND");
  return backend;
}
