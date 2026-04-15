import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(req) {
  const db = getSupabaseServer();
  const { searchParams } = new URL(req.url);
  const centreId = searchParams.get("centreId");
  if (!centreId) return Response.json({ error: "centreId required" }, { status: 400 });
  const { data, error } = await db
    .from("programme_archives")
    .select("id, programme_name, archived_at, metadata")
    .eq("centre_id", centreId)
    .order("archived_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}

// Body: { centreId, programmeName, meta, snapshot, groupIds }
export async function POST(req) {
  const db = getSupabaseServer();
  const { centreId, programmeName, meta, snapshot, groupIds } = await req.json();

  const { error: archErr } = await db.from("programme_archives").insert({
    centre_id: centreId, programme_name: programmeName, metadata: meta, data: snapshot,
  });
  if (archErr) return Response.json({ error: archErr.message }, { status: 500 });

  if ((groupIds || []).length > 0) {
    await db.from("students").delete().in("group_id", groupIds);
  }
  await Promise.all([
    db.from("groups").delete().eq("centre_id", centreId),
    db.from("staff").delete().eq("centre_id", centreId),
    db.from("rota_cells").delete().eq("centre_id", centreId),
    db.from("programme_cells").delete().eq("centre_id", centreId),
    db.from("excursion_days").delete().eq("centre_id", centreId),
    db.from("excursions").delete().eq("centre_id", centreId),
    db.from("transfers").delete().eq("centre_id", centreId),
    db.from("programme_settings").delete().eq("centre_id", centreId),
    db.from("rooming_assignments").delete().eq("centre_id", centreId),
    db.from("rooming_rooms").delete().eq("centre_id", centreId),
    db.from("rooming_houses").delete().eq("centre_id", centreId),
  ]);

  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const db = getSupabaseServer();
  const { archiveId } = await req.json();
  const { error } = await db.from("programme_archives").delete().eq("id", archiveId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
