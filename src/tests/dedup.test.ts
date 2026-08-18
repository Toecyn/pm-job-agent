import { describe, it, expect } from "vitest"
import { computeDedupFingerprint, findDuplicateJob, textSimilarity, normalizeCompanyName } from "@/lib/dedup/dedup"
import { createTestJob } from "./factories"

describe("Job deduplication (brief §18)", () => {
  it("normalizes company names by stripping legal suffixes and punctuation", () => {
    expect(normalizeCompanyName("Northwind Financial, Inc.")).toBe(normalizeCompanyName("Northwind Financial"))
    expect(normalizeCompanyName("Acme Corp.")).toBe(normalizeCompanyName("Acme Corp"))
    expect(normalizeCompanyName("Northwind Financial, Inc.")).not.toBe(normalizeCompanyName("Southwind Financial, Inc."))
  })

  it("computes the same fingerprint for the same company/title-family/location regardless of exact title wording", () => {
    const a = computeDedupFingerprint({ companyName: "Northwind Financial", titleFamily: "ai_product_manager", remoteStatus: "remote" })
    const b = computeDedupFingerprint({ companyName: "Northwind Financial, Inc.", titleFamily: "ai_product_manager", remoteStatus: "remote" })
    expect(a).toBe(b)
  })

  it("detects a duplicate posting by exact fingerprint match", async () => {
    const original = await createTestJob({
      companyName: "Northwind Financial",
      dedupFingerprint: computeDedupFingerprint({ companyName: "Northwind Financial", titleFamily: "ai_product_manager", remoteStatus: "remote" }),
    })

    const duplicateId = await findDuplicateJob({
      companyName: "Northwind Financial, Inc.",
      titleFamily: "ai_product_manager",
      remoteStatus: "remote",
      description: "A completely different description text for the duplicate posting.",
      applicationUrl: "https://different-source.example.com/apply",
      originalUrl: "https://different-source.example.com/job",
    })

    expect(duplicateId).toBe(original.id)
  })

  it("detects a duplicate by application URL even if fingerprint differs", async () => {
    const original = await createTestJob({ applicationUrl: "https://boards.greenhouse.io/acme/jobs/1", originalUrl: "https://boards.greenhouse.io/acme/jobs/1" })

    const duplicateId = await findDuplicateJob({
      companyName: "Totally Different Name",
      titleFamily: "product_manager",
      remoteStatus: "onsite",
      description: "Different text",
      applicationUrl: "https://boards.greenhouse.io/acme/jobs/1",
      originalUrl: "https://boards.greenhouse.io/acme/jobs/1",
    })

    expect(duplicateId).toBe(original.id)
  })

  it("does not flag genuinely different postings at different companies as duplicates", async () => {
    await createTestJob({ companyName: "Northwind Financial" })

    const duplicateId = await findDuplicateJob({
      companyName: "Southwind Logistics",
      titleFamily: "ai_product_manager",
      remoteStatus: "remote",
      description: "An unrelated job at a different company entirely, doing logistics optimization.",
      applicationUrl: "https://southwind.example.com/apply",
      originalUrl: "https://southwind.example.com/job",
    })

    expect(duplicateId).toBeNull()
  })

  it("textSimilarity returns 1 for identical text and 0 for disjoint text", () => {
    expect(textSimilarity("hello world foo", "hello world foo")).toBe(1)
    expect(textSimilarity("abc def ghi", "xyz uvw rst")).toBe(0)
  })
})
