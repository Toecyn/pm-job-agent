/**
 * Every "*Json" column in the schema stores a JSON-encoded string (works
 * identically on SQLite and Postgres, see prisma/schema.prisma header note).
 * These helpers centralize the encode/decode so call sites never hand-roll
 * JSON.parse and risk swallowing a malformed value silently.
 */

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null)
}

export function fromJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return parsed === null || parsed === undefined ? fallback : (parsed as T)
  } catch {
    return fallback
  }
}

export function fromJsonArray<T = string>(raw: string | null | undefined): T[] {
  return fromJson<T[]>(raw, [])
}
