export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

// Deterministic UUID from name + centreId + arrDate so re-imports update the same row
function staffToId(name, centreId, arr) {
  const key = `staff-import-${name.trim().toLowerCase()}-${centreId}-${arr || ""}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
}

export async function POST(req) {
  const db = getSupabaseServer();
  const { staff } = await req.json();

  if (!Array.isArray(staff) || staff.length === 0) {
    return Response.json({ error: "No staff provided." }, { status: 400 });
  }

  const rows = staff.map((s) => ({
    id:               staffToId(s.name, s.centreId, s.arr),
    centre_id:        s.centreId,
    name:             s.name.trim(),
    role:             s.role || "TAL",
    accommodation:    s.acc || "Residential",
    arrival_date:     s.arr || null,
    departure_date:   s.dep || null,
    time_off:         "",
    email:            "",
    phone:            "",
    dbs_number:       "",
    dbs_expiry:       null,
    contract_type:    "",
    notes:            s.notes || "",
  }));

  // Upsert new/updated rows first
  const { error } = await db.from("staff").upsert(rows, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Remove stale rows per centre: staff no longer in the spreadsheet for each imported centre.
  const affectedCentres = [...new Set(rows.map((r) => r.centre_id))];
  const syncErrors = [];
  for (const centreId of affectedCentres) {
    const centreImportedIds = rows.filter((r) => r.centre_id === centreId).map((r) => r.id);
    if (centreImportedIds.length === 0) continue;
    const { error: delError } = await db.from("staff")
      .delete()
      .eq("centre_id", centreId)
      .not("id", "in", `(${centreImportedIds.join(",")})`);
    if (delError) syncErrors.push(delError.message);
  }

  return Response.json({ ok: true, imported: rows.length, syncErrors: syncErrors.length ? syncErrors : undefined });
}
