export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(_req, { params }) {
  const { id } = await params;
  const db = getSupabaseServer();

  const [
    { data: groups },
    { data: staff },
    { data: rotaCells },
    { data: programmeCells },
    { data: excursionDays },
    { data: excursions },
    { data: transfers },
    { data: settings },
    { data: roomingHouses },
    { data: roomingRooms },
    { data: roomingAssignments },
  ] = await Promise.all([
    db.from("groups").select("*").eq("centre_id", id).order("created_at"),
    db.from("staff").select("*").eq("centre_id", id).order("created_at"),
    db.from("rota_cells").select("*").eq("centre_id", id),
    db.from("programme_cells").select("*").eq("centre_id", id),
    db.from("excursion_days").select("*").eq("centre_id", id),
    db.from("excursions").select("*").eq("centre_id", id).order("exc_date"),
    db.from("transfers").select("*").eq("centre_id", id).order("transfer_date"),
    db.from("programme_settings").select("*").eq("centre_id", id),
    db.from("rooming_houses").select("*").eq("centre_id", id).order("sort_order"),
    db.from("rooming_rooms").select("*").eq("centre_id", id).order("sort_order"),
    db.from("rooming_assignments").select("*").eq("centre_id", id).order("slot_index"),
  ]);

  const groupIds = (groups || []).map((g) => g.id);
  let students = [];
  if (groupIds.length > 0) {
    const { data } = await db.from("students").select("*").in("group_id", groupIds).order("created_at");
    students = data || [];
  }

  return Response.json({
    groups: groups || [],
    students,
    staff: staff || [],
    rotaCells: rotaCells || [],
    programmeCells: programmeCells || [],
    excursionDays: excursionDays || [],
    excursions: excursions || [],
    transfers: transfers || [],
    settings: settings || [],
    roomingHouses: roomingHouses || [],
    roomingRooms: roomingRooms || [],
    roomingAssignments: roomingAssignments || [],
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
