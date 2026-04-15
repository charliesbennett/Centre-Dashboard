import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const db = getSupabaseServer();
  const { room, centreId } = await req.json();
  const row = {
    id: room.id, centre_id: centreId, house_id: room.houseId,
    floor_label: room.floorLabel || "", room_name: room.roomName,
    capacity: room.capacity || 2, sort_order: room.sortOrder || 0,
  };
  const { error } = await db.from("rooming_rooms").upsert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const db = getSupabaseServer();
  const { roomId } = await req.json();
  const { error } = await db.from("rooming_rooms").delete().eq("id", roomId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
