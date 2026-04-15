import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const db = getSupabaseServer();
  const { data, error } = await db.from("centres").select("*").order("name");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
