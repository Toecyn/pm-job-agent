import { describe, it, expect } from "vitest"
import { detectCaptcha, detectLoginWall, validateOnIntendedPage } from "@/lib/automation/detectors"
import { loadRunState, saveRunState } from "@/lib/automation/state"
import { createTestProfile, createTestJob } from "./factories"
import { prisma } from "@/lib/db/client"

/**
 * Minimal fake of the subset of Playwright's `Page` API the detectors use,
 * so CAPTCHA / login-wall / layout-mismatch detection can be unit tested
 * without a real browser (brief §46 "CAPTCHA detection", "website layout
 * failures", "authentication failures").
 */
function fakePage(opts: { visibleSelectors?: string[]; bodyText?: string; url?: string }) {
  const visible = new Set(opts.visibleSelectors ?? [])
  return {
    url: () => opts.url ?? "https://boards.greenhouse.io/acme/jobs/1",
    textContent: async () => opts.bodyText ?? "",
    locator: (selector: string) => ({
      first: () => ({
        isVisible: async () => visible.has(selector),
      }),
    }),
  } as unknown as import("playwright").Page
}

describe("CAPTCHA detection (brief §33, §49 — never bypassed, only detected)", () => {
  it("detects a reCAPTCHA iframe", async () => {
    const page = fakePage({ visibleSelectors: ['iframe[src*="recaptcha"]'] })
    expect(await detectCaptcha(page)).toBe(true)
  })

  it("detects an hCaptcha widget", async () => {
    const page = fakePage({ visibleSelectors: ['iframe[src*="hcaptcha"]'] })
    expect(await detectCaptcha(page)).toBe(true)
  })

  it("returns false on an ordinary application page with no CAPTCHA present", async () => {
    const page = fakePage({ visibleSelectors: [] })
    expect(await detectCaptcha(page)).toBe(false)
  })
})

describe("Login-wall / authentication-required detection (brief §33, §46)", () => {
  it("detects a login page by URL pattern", async () => {
    const page = fakePage({ url: "https://accounts.example.com/login?redirect=/jobs/1" })
    expect(await detectLoginWall(page, "boards.greenhouse.io")).toBe(true)
  })

  it("detects a login wall by a visible password field", async () => {
    const page = fakePage({ url: "https://boards.greenhouse.io/acme/jobs/1", visibleSelectors: ['input[type="password"]'] })
    expect(await detectLoginWall(page, "boards.greenhouse.io")).toBe(true)
  })

  it("does not flag a normal application page as a login wall", async () => {
    const page = fakePage({ url: "https://boards.greenhouse.io/acme/jobs/1" })
    expect(await detectLoginWall(page, "boards.greenhouse.io")).toBe(false)
  })
})

describe("Website layout / wrong-page detection (brief §33, §47)", () => {
  it("confirms the page matches the intended company and role before proceeding", async () => {
    const page = fakePage({ bodyText: "Apply now for Senior Product Manager at Acme Corp. We are hiring!" })
    const result = await validateOnIntendedPage(page, "Acme Corp", "Senior Product Manager")
    expect(result.ok).toBe(true)
  })

  it("refuses to proceed when the page content doesn't match the expected job (site redesign / wrong redirect)", async () => {
    const page = fakePage({ bodyText: "404 — this page could not be found." })
    const result = await validateOnIntendedPage(page, "Acme Corp", "Senior Product Manager")
    expect(result.ok).toBe(false)
  })
})

describe("Resumable automation state (brief §33 — resume, never blindly restart)", () => {
  it("persists and reloads automation progress on an application", async () => {
    const profile = await createTestProfile()
    const job = await createTestJob()
    const application = await prisma.application.create({ data: { jobId: job.id, profileId: profile.id } })

    const initial = await loadRunState(application.id)
    expect(initial.step).toBe("not_started")

    await saveRunState(application.id, { step: "fields_filled", updatedAt: new Date().toISOString(), filledFields: ["email", "resume_upload"] })

    const reloaded = await loadRunState(application.id)
    expect(reloaded.step).toBe("fields_filled")
    expect(reloaded.filledFields).toEqual(["email", "resume_upload"])
  })
})
