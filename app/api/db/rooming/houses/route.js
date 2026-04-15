import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const db = getSupabaseServer();
  const { house, centreId } = await req.json();
  const row = { id: house.id, centre_id: centreId, name: house.name, sort_order: house.sortOrder || 0 };
  const { error } = await db.from("rooming_houses").upsert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const db = getSupabaseServer();
  const { houseId } = await req.json();
  const { error } = await db.from("rooming_houses").delete().eq("id", houseId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
