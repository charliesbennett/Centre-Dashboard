import { getSupabaseServer } from "@/lib/supabaseServer";

// Body: { centreId, toDelete: [id], toUpsert: [{...}] }
export async function POST(req) {
  const db = getSupabaseServer();
  const { toDelete, toUpsert } = await req.json();

  for (const id of (toDelete || [])) {
    await db.from("rooming_assignments").delete().eq("id", id);
  }

  if ((toUpsert || []).length > 0) {
    const { error } = await db.from("rooming_assignments")
      .upsert(toUpsert, { onConflict: "centre_id,room_id,slot_index" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
