export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const db = getSupabaseServer();
  const { staff, centreId } = await req.json();
  const row = {
    id: staff.id, centre_id: centreId,
    name: staff.name, role: staff.role,
    accommodation: staff.acc || "Residential",
    arrival_date: staff.arr || null, departure_date: staff.dep || null,
    time_off: staff.to || "", email: staff.email || "", phone: staff.phone || "",
    dbs_number: staff.dbs || "", dbs_expiry: staff.dbsExpiry || null,
    contract_type: staff.contract || "", notes: staff.notes || "",
  };
  const { error } = await db.from("staff").upsert(row, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const db = getSupabaseServer();
  const { staffId } = await req.json();
  await db.from("rota_cells").delete().eq("staff_id", staffId);
  const { error } = await db.from("staff").delete().eq("id", staffId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
