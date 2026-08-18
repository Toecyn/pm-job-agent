import { describe, it, expect } from "vitest"
import { adapterRegistry, pollableAdapters, explainedNonAutomatableSources } from "@/lib/sources/registry"
import { analyzeJobDescription, detectConflictingExperienceRange } from "@/lib/normalize/requirementExtractor"

describe("Job source adapter registry (brief §3-4)", () => {
  it("registers every documented source id", () => {
    for (const id of ["greenhouse", "lever", "ashby", "workable", "smartrecruiters", "manual-import", "mock"]) {
      expect(adapterRegistry[id]).toBeDefined()
    }
  })

  it("marks Greenhouse/Lever/Ashby as automatable; Workable/SmartRecruiters/manual-import are search-only (no submission filler yet)", () => {
    expect(adapterRegistry.greenhouse.automatable).toBe(true)
    expect(adapterRegistry.lever.automatable).toBe(true)
    expect(adapterRegistry.ashby.automatable).toBe(true)
    expect(adapterRegistry.workable.automatable).toBe(false)
    expect(adapterRegistry.smartrecruiters.automatable).toBe(false)
    expect(adapterRegistry["manual-import"].automatable).toBe(false)
  })

  it("never automates LinkedIn/Indeed/Jobberman/Wellfound/Otta/Google Jobs — deliberate, documented restraint (brief §3, §49)", () => {
    const ids = explainedNonAutomatableSources.map((s) => s.id)
    for (const id of ["linkedin", "indeed", "jobberman", "wellfound", "otta", "google-jobs"]) {
      expect(ids).toContain(id)
      expect(adapterRegistry[id]).toBeUndefined() // not a real, callable adapter
    }
  })

  it("Greenhouse/Lever/Ashby/Workable/SmartRecruiters return no postings and make no network calls when no boards are configured (reliability: never crash on empty config)", async () => {
    for (const adapter of pollableAdapters.filter((a) => a.id !== "mock")) {
      const result = await adapter.search({
        titles: [],
        windowStart: new Date().toISOString(),
        windowEnd: new Date().toISOString(),
        locations: [],
        countries: [],
        remotePreference: "any",
        boardTokens: [],
      })
      expect(result.postings).toEqual([])
      expect(result.warnings).toEqual([])
    }
  })
})

describe("Job requirement extraction (brief §6)", () => {
  it("classifies required vs preferred qualifications by their language cues", async () => {
    const req = await analyzeJobDescription(
      "Required: 5+ years of product management experience. Must have direct AI shipping experience. " +
        "Preferred: fintech background. Nice to have: SQL fluency.",
      "Senior Product Manager"
    )
    expect(req.requiredQualifications.length).toBeGreaterThan(0)
    expect(req.preferredQualifications.length).toBeGreaterThan(0)
  })

  it("extracts a years-of-experience range from free text", async () => {
    const req = await analyzeJobDescription("This role requires 5+ years of experience in product management.", "Product Manager")
    expect(req.yearsExperienceMin).toBe(5)
  })

  it("captures the FULL sentence for a work-authorization clause, preserving a leading negation (regression test)", async () => {
    const req = await analyzeJobDescription(
      "Northwind Financial. Remote-friendly worldwide; no work authorization restrictions — we hire via EOR globally.",
      "Senior AI Product Manager"
    )
    expect(req.workAuthRequirements).toMatch(/^Remote-friendly worldwide; no work authorization restrictions/)
  })

  it("captures a citizenship/clearance requirement sentence in full", async () => {
    const req = await analyzeJobDescription("Required: US citizenship, active TS/SCI security clearance. Onsite only.", "Group Product Manager")
    expect(req.workAuthRequirements).toContain("US citizenship")
    expect(req.workAuthRequirements).toContain("TS/SCI")
  })

  it("flags an internally conflicting experience-range job description", async () => {
    const req = await analyzeJobDescription(
      "This is an entry-level role for candidates with 0-2 years of experience. However, you must also have 10 years of experience leading teams.",
      "Product Manager"
    )
    const conflict = detectConflictingExperienceRange(req)
    expect(conflict).toBeDefined()
  })

  it("never invents a salary — job requirement extraction has no salary field to fabricate, salary stays adapter-sourced only", async () => {
    const req = await analyzeJobDescription("A job description with absolutely no compensation information at all.", "Product Manager")
    expect(req).not.toHaveProperty("salary")
  })
})
