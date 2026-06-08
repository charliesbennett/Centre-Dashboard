export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { createSessionToken, sessionCookieHeader } from "@/lib/serverSession";

export async function POST(req) {
  const db = getSupabaseServer();
  const { identifier, password_hash } = await req.json();
  const { data, error } = await db.rpc("authenticate_dashboard_user", {
    p_identifier: identifier.toLowerCase(),
    p_password_hash: password_hash,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Invalid username/email or password." }, { status: 401 });
  const token = createSessionToken(data.id);
  return Response.json(data, {
    headers: { "Set-Cookie": sessionCookieHeader(token) },
  });
}
