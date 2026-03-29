import { getRequestUser, isAdminUser } from "@/lib/supabase-server";

export async function GET() {
  const {
    user,
    error,
  } = await getRequestUser();

  if (error || !user) {
    return Response.json({
      email: null,
      id: null,
      isAdmin: false,
    });
  }

  return Response.json({
    email: user?.email || null,
    id: user?.id || null,
    isAdmin: isAdminUser(user),
  });
}
