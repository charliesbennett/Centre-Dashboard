import { getSupabaseServer } from "@/lib/supabaseServer";

// Body: { toDelete: [id], toUpsert: [{id, centre_id, exc_date, destination, coaches, notes}] }
export async function POST(req) {
  const db = getSupabaseServer();
  const { toDelete, toUpsert } = await req.json();

  for (const id of (toDelete || [])) {
    await db.from("excursions").delete().eq("id", id);
  }

  if ((toUpsert || []).length > 0) {
    const { error } = await db.from("excursions")
      .upsert(toUpsert, { onConflict: "centre_id,exc_date" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
