import crypto from "node:crypto"

/**
 * AES-256-GCM encryption for sensitive candidate fields at rest (work
 * authorization details, compensation expectations) — brief §32.
 *
 * ENCRYPTION_KEY must be a 32-byte value, hex-encoded (64 hex chars).
 * Generate one with: openssl rand -hex 32
 *
 * If ENCRYPTION_KEY is not set, we fail closed in production but allow a
 * clearly-labeled ephemeral dev key so local `npm run dev` still works out
 * of the box (per-process only — restarting invalidates previously
 * encrypted values, which is fine for local development).
 */

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (hex && hex.length === 64) {
    return Buffer.from(hex, "hex")
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY is missing or invalid (expected 64 hex chars / 32 bytes). " +
        "Set it in your production environment before storing candidate data."
    )
  }
  // Deterministic-but-unofficial dev fallback so `npm run dev` works without setup.
  // Never used when a real key is configured.
  return crypto.createHash("sha256").update("pm-job-agent-dev-key-do-not-use-in-prod").digest()
}

const ALGO = "aes-256-gcm"

export function encryptField(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".")
}

export function decryptField(payload: string): string {
  const key = getKey()
  const [ivB64, tagB64, encB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !encB64) throw new Error("Malformed encrypted field payload")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const enc = Buffer.from(encB64, "base64")
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString("utf8")
}

export function encryptJson<T>(value: T): string {
  return encryptField(JSON.stringify(value))
}

export function decryptJson<T>(payload: string | null | undefined, fallback: T): T {
  if (!payload) return fallback
  try {
    return JSON.parse(decryptField(payload)) as T
  } catch {
    return fallback
  }
}
