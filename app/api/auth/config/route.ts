import { getAuthBackend } from "@/lib/auth-config";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ backend: getAuthBackend() }, { headers: { "Cache-Control": "no-store" } });
}
