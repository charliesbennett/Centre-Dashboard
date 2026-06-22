export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

function studentId(firstName, surname, groupId) {
  const key = `student-import-${firstName.toLowerCase().trim()}-${surname.toLowerCase().trim()}-${groupId}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
}

export async function POST(req) {
  const db = getSupabaseServer();
  const { groups } = await req.json();

  if (!Array.isArray(groups) || groups.length === 0) {
    return Response.json({ error: "No groups provided." }, { status: 400 });
  }

  // Fetch all groups from DB for name matching
  const { data: dbGroups, error: lookupError } = await db
    .from("groups")
    .select("id, group_name")
    .eq("archived", false);

  if (lookupError) return Response.json({ error: lookupError.message }, { status: 500 });

  const groupMap = {};
  for (const g of dbGroups || []) {
    groupMap[g.group_name.toLowerCase().trim()] = g.id;
  }

  const rows = [];
  const unmatched = [];
  const affectedGroupIds = new Set();
  const groupNatMap = {};

  for (const g of groups) {
    const groupId = groupMap[g.groupName.toLowerCase().trim()];
    if (!groupId) {
      unmatched.push(g.groupName);
      continue;
    }
    affectedGroupIds.add(groupId);
    if (g.nat) groupNatMap[groupId] = g.nat;
    const people = [
      ...(g.students || []).map((s) => ({ ...s, type: "student" })),
      ...(g.leaders  || []).map((s) => ({ ...s, type: "gl" })),
    ];
    for (const s of people) {
      const firstName = String(s.firstName || "").trim();
      const surname   = String(s.surname   || "").trim();
      if (!firstName && !surname) continue;
      rows.push({
        id:             studentId(firstName, surname, groupId),
        group_id:       groupId,
        type:           s.type || "student",
        first_name:     firstName,
        surname:        surname,
        dob:            s.dob  || null,
        age:            s.age  ? (parseInt(s.age) || null) : null,
        sex:            String(s.sex          || "").trim(),
        nationality:    String(s.nationality  || "").trim(),
        accommodation:  String(s.accommodation || "").trim(),
        arrival_date:   s.arrDate || null,
        departure_date: s.depDate || null,
        specialism1:    String(s.specialism1  || "").trim(),
        medical:        String(s.medical      || "").trim(),
        swimming:       String(s.swimming     || "").trim(),
        mobile:         String(s.mobile       || "").trim(),
      });
    }
  }

  if (rows.length === 0) {
    return Response.json({
      ok: false,
      error: "No groups matched. Run the Groups bulk import first so group names exist in the database.",
      unmatched,
    }, { status: 422 });
  }

  const deduped = [...new Map(rows.map((r) => [r.id, r])).values()];
  const { error: upsertError } = await db.from("students").upsert(deduped, { onConflict: "id" });
  if (upsertError) return Response.json({ error: upsertError.message }, { status: 500 });

  // Update nationality on group records where we have it from the student data
  for (const [groupId, nat] of Object.entries(groupNatMap)) {
    if (nat) await db.from("groups").update({ nationality: nat }).eq("id", groupId);
  }

  // Delete stale students per group (students removed from the Excel since last import)
  let removed = 0;
  for (const groupId of affectedGroupIds) {
    const importedIds = rows.filter((r) => r.group_id === groupId).map((r) => r.id);
    if (importedIds.length === 0) continue;
    const { data: stale } = await db
      .from("students")
      .select("id")
      .eq("group_id", groupId)
      .not("id", "in", `(${importedIds.join(",")})`);
    for (const s of stale || []) {
      await db.from("students").delete().eq("id", s.id);
      removed++;
    }
  }

  return Response.json({
    ok: true,
    imported: rows.length,
    removed,
    matched: affectedGroupIds.size,
    unmatched: unmatched.length ? unmatched : undefined,
  });
}
