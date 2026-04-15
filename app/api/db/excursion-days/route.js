import { getSupabaseServer } from "@/lib/supabaseServer";

// Body: { centreId, toDelete: [date], toUpsert: [{centre_id, exc_date, exc_type}] }
export async function POST(req) {
  const db = getSupabaseServer();
  const { centreId, toDelete, toUpsert } = await req.json();

  for (const date of (toDelete || [])) {
    await db.from("excursion_days").delete().eq("centre_id", centreId).eq("exc_date", date);
  }

  if ((toUpsert || []).length > 0) {
    const { error } = await db.from("excursion_days")
      .upsert(toUpsert, { onConflict: "centre_id,exc_date" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
