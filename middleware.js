import { NextResponse } from "next/server";

const SESSION_COOKIE = "uklc_session";

async function validateToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;
  try {
    const lastPipe = token.lastIndexOf("|");
    if (lastPipe < 0) return false;
    const payload = token.slice(0, lastPipe);
    const sig = token.slice(lastPipe + 1);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = new Uint8Array(sig.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
    if (!valid) return false;

    const parts = payload.split("|");
    return parts.length === 2 && Date.now() / 1000 <= parseInt(parts[1]);
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Auth endpoints and the unauthenticated centres list are open
  if (pathname.startsWith("/api/auth") || pathname === "/api/db/centres") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!await validateToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
