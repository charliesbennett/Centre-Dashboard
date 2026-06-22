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

export async function GET() {
  const db = getSupabaseServer();
  const { data, error } = await db.rpc("list_dashboard_users");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(Array.isArray(data) ? data : []);
}

export async function POST(req) {
  if (!await isSuperAdmin(req)) {
    return Response.json({ error: "Only the super admin can create users." }, { status: 403 });
  }
  const db = getSupabaseServer();
  const body = await req.json();
  const { data, error } = await db.rpc("create_dashboard_user", {
    p_full_name: body.full_name,
    p_email: body.email || null,
    p_username: body.username || null,
    p_password_hash: body.password_hash,
    p_role: body.role,
    p_centre_id: body.centre_id || null,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function PATCH(req) {
  const body = await req.json();
  if (body.password_hash && !await isSuperAdmin(req)) {
    return Response.json({ error: "Only the super admin can change passwords." }, { status: 403 });
  }
  const db = getSupabaseServer();
  const { error } = await db.rpc("update_dashboard_user", {
    p_id: body.id,
    p_full_name: body.full_name,
    p_role: body.role,
    p_centre_id: body.centre_id || null,
    p_username: body.username || null,
    p_password_hash: body.password_hash || null,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const db = getSupabaseServer();
  const { id } = await req.json();
  const { error } = await db.rpc("delete_dashboard_user", { p_id: id });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
