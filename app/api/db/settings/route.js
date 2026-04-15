import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const db = getSupabaseServer();
  const { centreId, key, value } = await req.json();
  const { error } = await db.from("programme_settings").upsert(
    { centre_id: centreId, setting_key: key, setting_value: value },
    { onConflict: "centre_id,setting_key" }
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
