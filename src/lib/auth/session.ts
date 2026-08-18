import crypto from "node:crypto"
import { cookies } from "next/headers"

export const SESSION_COOKIE = "pmja_session"
const SESSION_TTL_MS = 30 * 24 * 3600_000 // 30 days

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET must be set in production.")
    return "dev-only-insecure-secret-do-not-use-in-production"
  }
  return s
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex")
}

export function createSessionToken(email: string): string {
  const payload = `${email}:${Date.now() + SESSION_TTL_MS}`
  const encoded = Buffer.from(payload).toString("base64url")
  return `${encoded}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null
  const [encoded, signature] = token.split(".")
  if (!encoded || !signature) return null
  const payload = Buffer.from(encoded, "base64url").toString("utf8")
  const expected = sign(payload)
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  const [email, expiryStr] = payload.split(":")
  if (!email || Number(expiryStr) < Date.now()) return null
  return email
}

/** Server Component / Server Action helper — Next.js 16 cookies() is async. */
export async function getCurrentUserEmail(): Promise<string | null> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

export async function setSessionCookie(email: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
