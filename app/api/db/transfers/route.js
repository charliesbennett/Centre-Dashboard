export const dynamic = "force-dynamic";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  const db = getSupabaseServer();
  const { row } = await req.json();
  const { error } = await db.from("transfers").upsert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const db = getSupabaseServer();
  const { transferId } = await req.json();
  const { error } = await db.from("transfers").delete().eq("id", transferId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
