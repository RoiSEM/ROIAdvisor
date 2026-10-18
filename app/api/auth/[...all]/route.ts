import { getAuthBackend } from "@/lib/auth-config";
import { getBetterAuth } from "@/lib/better-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (getAuthBackend() !== "better-auth") return Response.json({ error: "Not found" }, { status: 404, headers });
    const auth = await getBetterAuth();
    return await auth.handler(request);
  } catch {
    return Response.json({ error: "Authentication unavailable" }, { status: 503, headers });
  }
}
export const GET = handle;
export const POST = handle;
