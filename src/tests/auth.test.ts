import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { createSessionToken, verifySessionToken } from "@/lib/auth/session"

describe("Dashboard authentication (brief §32)", () => {
  it("verifies a correct password against its hash", () => {
    const hash = hashPassword("correct-horse-battery-staple")
    expect(verifyPassword("correct-horse-battery-staple", hash)).toBe(true)
  })

  it("rejects an incorrect password", () => {
    const hash = hashPassword("correct-horse-battery-staple")
    expect(verifyPassword("wrong-password", hash)).toBe(false)
  })

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword("anything", "not-a-valid-hash")).toBe(false)
  })

  it("issues a session token that verifies back to the same email", () => {
    const token = createSessionToken("user@example.com")
    expect(verifySessionToken(token)).toBe("user@example.com")
  })

  it("rejects a tampered session token", () => {
    const token = createSessionToken("user@example.com")
    const tampered = token.slice(0, -2) + "xx"
    expect(verifySessionToken(tampered)).toBeNull()
  })

  it("rejects a missing/undefined token", () => {
    expect(verifySessionToken(undefined)).toBeNull()
  })
})
