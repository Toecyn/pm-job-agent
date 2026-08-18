import crypto from "node:crypto"

/** Simple scrypt-based password hashing — no extra dependency needed (brief §32: protect the dashboard with auth). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex")
  const a = Buffer.from(candidate, "hex")
  const b = Buffer.from(hash, "hex")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
