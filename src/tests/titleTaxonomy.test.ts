import { describe, it, expect } from "vitest"
import { classifyTitle, matchesTargetSeniority } from "@/lib/normalize/titleTaxonomy"
import { DEFAULT_TITLE_SYNONYMS } from "@/lib/config/settings"

describe("Job title semantic matching (brief §37)", () => {
  it("treats common senior PM title variants as the same family", () => {
    const variants = ["Senior Product Manager", "Sr Product Manager", "Sr. Product Manager", "Senior PM"]
    for (const title of variants) {
      const result = classifyTitle(title, DEFAULT_TITLE_SYNONYMS)
      expect(result.isRelevant).toBe(true)
      expect(result.family).toBe("senior_product_manager")
    }
  })

  it("classifies Product Owner, Product Lead, and Technical PM into distinct correct families", () => {
    expect(classifyTitle("Product Owner").family).toBe("product_owner")
    expect(classifyTitle("Product Lead").family).toBe("product_lead")
    expect(classifyTitle("Technical Product Manager").family).toBe("technical_product_manager")
    expect(classifyTitle("AI Product Manager").family).toBe("ai_product_manager")
    expect(classifyTitle("Data Product Manager").family).toBe("data_product_manager")
  })

  it("does NOT include unrelated roles merely because they contain the word 'Product'", () => {
    expect(classifyTitle("Product Marketing Manager").isRelevant).toBe(false)
    expect(classifyTitle("Product Designer").isRelevant).toBe(false)
    expect(classifyTitle("Production Manager").isRelevant).toBe(false)
  })

  it("detects seniority signals independently of family", () => {
    expect(classifyTitle("Group Product Manager").seniority).toBe("group")
    expect(classifyTitle("Principal Product Manager").seniority).toBe("principal")
    expect(classifyTitle("Lead Product Manager").seniority).toBe("lead")
    expect(classifyTitle("Associate Product Manager").seniority).toBe("junior")
  })

  it("matchesTargetSeniority welcomes adjacent-or-above levels for a 'senior' target", () => {
    expect(matchesTargetSeniority("senior", ["senior"])).toBe(true)
    expect(matchesTargetSeniority("principal", ["senior"])).toBe(true)
    expect(matchesTargetSeniority("junior", ["senior"])).toBe(false)
  })

  it("never silently excludes a job with unknown seniority — lets fit scoring handle it instead", () => {
    expect(matchesTargetSeniority("unknown", ["senior"])).toBe(true)
  })
})
