export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";

const SESSION_COOKIE = "uklc_session";

function getSessionUserId(request) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const token = match[1];
  const lastPipe = token.lastIndexOf("|");
  if (lastPipe < 0) return null;
  const payload = token.slice(0, lastPipe);
  const parts = payload.split("|");
  return parts.length === 2 ? parts[0] : null;
}

async function isSuperAdmin(request) {
  const superEmail = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase();
  if (!superEmail) return false;
  const userId = getSessionUserId(request);
  if (!userId) return false;
  const db = getSupabaseServer();
  const { data } = await db.rpc("list_dashboard_users");
  const user = (data || []).find((u) => u.id === userId);
  return (user?.email || "").toLowerCase() === superEmail;
}

export async function GET(req) {
  if (!await isSuperAdmin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getSupabaseServer();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("login_log")
    .select("id, user_id, identifier, success, ip_address, logged_at")
    .gte("logged_at", since)
    .order("logged_at", { ascending: false })
    .limit(500);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}
