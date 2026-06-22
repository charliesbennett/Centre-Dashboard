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

export async function POST(req) {
  if (!await isSuperAdmin(req)) {
    return Response.json({ error: "Only the super admin can import users." }, { status: 403 });
  }

  const db = getSupabaseServer();
  const { users } = await req.json();

  if (!Array.isArray(users) || users.length === 0) {
    return Response.json({ error: "No users provided." }, { status: 400 });
  }

  const created = [], skipped = [], errors = [];

  for (const u of users) {
    if (!u.full_name || !u.username || !u.password_hash) {
      skipped.push(u.username || u.full_name || "?");
      continue;
    }
    const { error } = await db.rpc("create_dashboard_user", {
      p_full_name:     u.full_name,
      p_email:         u.email    || null,
      p_username:      u.username.toLowerCase(),
      p_password_hash: u.password_hash,
      p_role:          u.role     || "centre_manager",
      p_centre_id:     u.centre_id || null,
    });
    if (error) errors.push(`${u.username}: ${error.message}`);
    else created.push(u.username);
  }

  return Response.json({ ok: true, created: created.length, skipped: skipped.length, errors: errors.length ? errors : undefined });
}
