import crypto from "crypto";

export const SESSION_COOKIE = "uklc_session";
const SEVEN_DAYS = 7 * 24 * 60 * 60;

export function createSessionToken(userId) {
  const exp = Math.floor(Date.now() / 1000) + SEVEN_DAYS;
  const payload = `${userId}|${exp}`;
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(payload)
    .digest("hex");
  return `${payload}|${sig}`;
}

export function sessionCookieHeader(token) {
  const isProduction = process.env.NODE_ENV === "production";
  const flags = `HttpOnly; Path=/; SameSite=Lax; Max-Age=${SEVEN_DAYS}${isProduction ? "; Secure" : ""}`;
  return `${SESSION_COOKIE}=${token}; ${flags}`;
}
