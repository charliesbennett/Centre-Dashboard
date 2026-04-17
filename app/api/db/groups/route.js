export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const db = getSupabaseServer();
  const { group, centreId } = await req.json();

  const row = {
    id: group.id, centre_id: centreId,
    agent: group.agent, group_name: group.group,
    nationality: group.nat, students_count: group.stu || 0, gls_count: group.gl || 0,
    arrival_date: group.arr || null, departure_date: group.dep || null,
    first_meal: group.firstMeal, last_meal: group.lastMeal,
    programme: group.prog, lesson_slot: group.lessonSlot || "AM",
    centre_name: group.centre || "",
    arr_airport: group.arrAirport || "", arr_flight: group.arrFlight || "",
    arr_time: group.arrTime || "", dep_airport: group.depAirport || "",
    dep_flight: group.depFlight || "", dep_time: group.depTime || "",
    archived: group.archived || false,
  };

  const { error } = await db.from("groups").upsert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (group.students || group.leaders) {
    const allPeople = [
      ...(group.students || []).map((s) => studentToDb(s, group.id, "student")),
      ...(group.leaders || []).map((s) => studentToDb(s, group.id, "gl")),
    ];
    if (allPeople.length > 0) {
      const { error: sErr } = await db.from("students").upsert(allPeople, { onConflict: "id" });
      if (sErr) return Response.json({ error: sErr.message }, { status: 500 });
      const keepIds = allPeople.map((s) => s.id);
      await db.from("students").delete().eq("group_id", group.id).not("id", "in", `(${keepIds.join(",")})`);
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const db = getSupabaseServer();
  const { groupId } = await req.json();
  await db.from("students").delete().eq("group_id", groupId);
  await db.from("programme_cells").delete().eq("group_id", groupId);
  await db.from("transfers").delete().eq("group_id", groupId);
  const { error } = await db.from("groups").delete().eq("id", groupId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

function studentToDb(s, groupId, type) {
  return {
    id: s.id, group_id: groupId, type,
    first_name: s.firstName || "", surname: s.surname || "",
    dob: s.dob || null, age: s.age || null, sex: s.sex || "",
    nationality: s.nationality || "", accommodation: s.accommodation || "",
    arrival_date: s.arrDate || null, departure_date: s.depDate || null,
    specialism1: s.specialism1 || "", medical: s.medical || "",
    swimming: s.swimming || "", mobile: s.mobile || "",
  };
}
