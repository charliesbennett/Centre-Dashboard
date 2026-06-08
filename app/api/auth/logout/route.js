export const dynamic = "force-dynamic";
import { SESSION_COOKIE } from "@/lib/serverSession";

export async function POST() {
  return Response.json({ ok: true }, {
    headers: {
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    },
  });
}
