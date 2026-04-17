import { getSupabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

// Generate a deterministic UUID from a group code so re-imports update the same row.
function codeToId(code) {
  const hash = crypto.createHash("sha256").update(`group-import-${code}`).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
}

export async function POST(req) {
  const db = getSupabaseServer();
  const { groups } = await req.json();

  if (!Array.isArray(groups) || groups.length === 0) {
    return Response.json({ error: "No groups provided." }, { status: 400 });
  }

  const rows = groups.map((g) => ({
    id:              codeToId(g.code),
    centre_id:       g.centreId,
    agent:           g.agent || "",
    group_name:      g.group || "",
    nationality:     "",
    students_count:  g.stu || 0,
    gls_count:       g.gl  || 0,
    arrival_date:    g.arr  || null,
    departure_date:  g.dep  || null,
    first_meal:      "Dinner",
    last_meal:       "Packed Lunch",
    programme:       "Multi-Activity",
    lesson_slot:     "AM",
    centre_name:     g.centreName || "",
    arr_airport:     "",
    arr_flight:      "",
    arr_time:        "",
    dep_airport:     "",
    dep_flight:      "",
    dep_time:        "",
    archived:        false,
  }));

  const { error } = await db.from("groups").upsert(rows, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Sync: for every centre included in this import, remove any groups that were
  // NOT in the file (i.e. groups deleted or moved out of this centre since last import).
  // Only affects centres that appear in this import — other centres are untouched.
  const importedIds    = rows.map((r) => r.id);
  const affectedCentres = [...new Set(rows.map((r) => r.centre_id))];

  let removed = 0;
  for (const centreId of affectedCentres) {
    const centreImportedIds = rows.filter((r) => r.centre_id === centreId).map((r) => r.id);
    const { data: stale } = await db
      .from("groups")
      .select("id")
      .eq("centre_id", centreId)
      .not("id", "in", `(${centreImportedIds.join(",")})`);

    for (const g of stale || []) {
      await db.from("students").delete().eq("group_id", g.id);
      await db.from("programme_cells").delete().eq("group_id", g.id);
      await db.from("transfers").delete().eq("group_id", g.id);
      await db.from("groups").delete().eq("id", g.id);
      removed++;
    }
  }

  return Response.json({ ok: true, imported: rows.length, removed });
}
