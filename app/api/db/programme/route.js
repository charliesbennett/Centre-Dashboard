export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";

// Body: { centreId, toDelete: [{groupId, date, slot}], toUpsert: [{centre_id, group_id, cell_date, slot, value}] }
export async function POST(req) {
  const db = getSupabaseServer();
  const { centreId, toDelete, toUpsert } = await req.json();

  for (const { groupId, date, slot } of (toDelete || [])) {
    await db.from("programme_cells").delete()
      .eq("centre_id", centreId).eq("group_id", groupId)
      .eq("cell_date", date).eq("slot", slot);
  }

  for (let i = 0; i < (toUpsert || []).length; i += 500) {
    const { error } = await db.from("programme_cells")
      .upsert(toUpsert.slice(i, i + 500), { onConflict: "centre_id,group_id,cell_date,slot" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
