export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";

// Body: { toDelete: [id], toUpsert: [{id, centre_id, exc_date, group_ids, attraction,
//   day_part, transport_method, manual_student_count, manual_leader_count, staff_count,
//   booking_ref, email_contact, booking_link, coaches, notes}] }
// A date can now hold several bookings, so upsert conflicts on `id`, not the date.
export async function POST(req) {
  const db = getSupabaseServer();
  const { toDelete, toUpsert } = await req.json();

  for (const id of (toDelete || [])) {
    await db.from("excursions").delete().eq("id", id);
  }

  if ((toUpsert || []).length > 0) {
    const { error } = await db.from("excursions")
      .upsert(toUpsert, { onConflict: "id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
