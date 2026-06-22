export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { createSessionToken, sessionCookieHeader } from "@/lib/serverSession";

function getIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || null;
}

async function writeLog(db, { userId, identifier, success, ip, ua }) {
  await db.from("login_log").insert({
    user_id: userId || null,
    identifier,
    success,
    ip_address: ip,
    user_agent: ua,
  });
}

export async function POST(req) {
  const db = getSupabaseServer();
  const body = await req.json();
  const { identifier, password_hash } = body;
  const ip = getIp(req);
  const ua = req.headers.get("user-agent") || null;

  const { data, error } = await db.rpc("authenticate_dashboard_user", {
    p_identifier: identifier.toLowerCase(),
    p_password_hash: password_hash,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) {
    await writeLog(db, { userId: null, identifier: identifier.toLowerCase(), success: false, ip, ua });
    return Response.json({ error: "Invalid username/email or password." }, { status: 401 });
  }
  await writeLog(db, { userId: data.id, identifier: identifier.toLowerCase(), success: true, ip, ua });
  const token = createSessionToken(data.id);
  const isSuperAdmin = (data.email || "").toLowerCase() === (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase();
  return Response.json({ ...data, isSuperAdmin }, {
    headers: { "Set-Cookie": sessionCookieHeader(token) },
  });
}
