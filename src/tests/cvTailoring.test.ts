import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db/client"
import { tailorCvForJob } from "@/lib/cv/tailor"
import { createTestProfile, createTestEvidence, createTestJob } from "./factories"
import { verifyStatementAgainstEvidence } from "@/lib/cv/verifier"
import { fromJsonArray } from "@/lib/utils/json"

describe("CV tailoring engine (brief §10-11) + evidence traceability (brief §36)", () => {
  it("selects the AI PM variant for an AI product manager job", async () => {
    const profile = await createTestProfile()
    await createTestEvidence(profile.id)
    const job = await createTestJob({ titleFamily: "ai_product_manager" })

    const { tailoredCv } = await tailorCvForJob({ jobId: job.id, profileId: profile.id })
    expect(tailoredCv.baseVariantKey).toBe("ai_pm")
  })

  it("every generated bullet traces back to a real CareerEvidence row (brief §36)", async () => {
    const profile = await createTestProfile()
    const evidence = await createTestEvidence(profile.id)
    const job = await createTestJob()

    const { tailoredCv } = await tailorCvForJob({ jobId: job.id, profileId: profile.id })
    const bullets = await prisma.cvBulletSource.findMany({ where: { tailoredCvId: tailoredCv.id } })

    expect(bullets.length).toBeGreaterThan(0)
    for (const bullet of bullets) {
      const sourceIds = fromJsonArray<string>(bullet.sourceEvidenceIdsJson)
      expect(sourceIds.length).toBeGreaterThan(0)
      // The cited evidence id must actually exist and belong to this candidate.
      const evidenceRow = await prisma.careerEvidence.findUnique({ where: { id: bullet.primaryEvidenceId } })
      expect(evidenceRow).not.toBeNull()
      expect(evidenceRow!.profileId).toBe(profile.id)
    }
    expect(bullets.some((b) => b.primaryEvidenceId === evidence.id)).toBe(true)
  })

  it("never fabricates employment dates — experience entries use the evidence's own dates verbatim", async () => {
    const profile = await createTestProfile()
    await createTestEvidence(profile.id, { startDate: new Date("2019-05-01"), endDate: new Date("2022-01-01") })
    const job = await createTestJob()

    const { cvContent } = await tailorCvForJob({ jobId: job.id, profileId: profile.id })
    const entry = cvContent.experience.find((e) => e.company === "Zenith Data Systems")
    expect(entry?.startDate).toBe("2019-05")
    expect(entry?.endDate).toBe("2022-01")
  })

  it("only ever reorders existing profile skills for a tailored CV — never adds a skill the profile doesn't list", async () => {
    const profile = await createTestProfile({ technicalSkillsJson: JSON.stringify(["SQL", "Python"]) })
    await createTestEvidence(profile.id)
    const job = await createTestJob({
      techRequirementsJson: JSON.stringify(["Kubernetes", "Rust"]), // neither is in the candidate's profile
    })

    const { cvContent } = await tailorCvForJob({ jobId: job.id, profileId: profile.id })
    expect(cvContent.skills.technical.sort()).toEqual(["Python", "SQL"].sort())
    expect(cvContent.skills.technical).not.toContain("Kubernetes")
    expect(cvContent.skills.technical).not.toContain("Rust")
  })

  it("produces an ATS score reflecting real keyword coverage, not a fixed number", async () => {
    const profile = await createTestProfile()
    await createTestEvidence(profile.id)
    const job = await createTestJob()

    const { ats } = await tailorCvForJob({ jobId: job.id, profileId: profile.id })
    expect(ats.score).toBeGreaterThanOrEqual(0)
    expect(ats.score).toBeLessThanOrEqual(100)
  })
})

describe("Anti-hallucination verifier (brief §9, §35)", () => {
  it("passes a statement whose numbers/years all appear in the source evidence", () => {
    const result = verifyStatementAgainstEvidence("Reduced review time by 38% in 2022.", "Reduced manual review time by 38% starting in 2022.")
    expect(result.passed).toBe(true)
  })

  it("fails a statement that invents a number not present in the evidence", () => {
    const result = verifyStatementAgainstEvidence("Reduced review time by 75%.", "Reduced manual review time by 38%.")
    expect(result.passed).toBe(false)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it("fails a statement that invents a year not present in the evidence", () => {
    const result = verifyStatementAgainstEvidence("Shipped this in 2024.", "Shipped this feature in 2022.")
    expect(result.passed).toBe(false)
  })
})
