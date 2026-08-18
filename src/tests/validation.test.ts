import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db/client"
import { validateApplication } from "@/lib/validation/validator"
import { tailorCvForJob } from "@/lib/cv/tailor"
import { answerApplicationQuestions } from "@/lib/questions/engine"
import { createTestProfile, createTestEvidence, createTestJob } from "./factories"

describe("Application validator (brief §34)", () => {
  it("fails validation when no CV has been tailored yet", async () => {
    const profile = await createTestProfile()
    const job = await createTestJob()
    const application = await prisma.application.create({ data: { jobId: job.id, profileId: profile.id } })

    const result = await validateApplication(application.id)
    expect(result.passed).toBe(false)
    expect(result.checks.find((c) => c.name === "cv_present")?.passed).toBe(false)
  })

  it("passes validation once CV, answers, and no unresolved sensitive questions are in place", async () => {
    const profile = await createTestProfile()
    await createTestEvidence(profile.id)
    const job = await createTestJob()
    const application = await prisma.application.create({ data: { jobId: job.id, profileId: profile.id } })

    const { tailoredCv } = await tailorCvForJob({ jobId: job.id, profileId: profile.id })
    await prisma.application.update({ where: { id: application.id }, data: { tailoredCvId: tailoredCv.id } })
    await answerApplicationQuestions(application.id, [{ question: "Tell us about a product you launched." }])

    const result = await validateApplication(application.id)
    expect(result.passed).toBe(true)
    expect(result.checks.every((c) => c.passed)).toBe(true)
  })

  it("fails validation when a sensitive question has no predefined answer and requires human input", async () => {
    const profile = await createTestProfile()
    await createTestEvidence(profile.id)
    const job = await createTestJob()
    const application = await prisma.application.create({ data: { jobId: job.id, profileId: profile.id } })
    const { tailoredCv } = await tailorCvForJob({ jobId: job.id, profileId: profile.id })
    await prisma.application.update({ where: { id: application.id }, data: { tailoredCvId: tailoredCv.id } })

    await answerApplicationQuestions(application.id, [{ question: "What is your salary expectation?" }]) // no predefined answer seeded

    const result = await validateApplication(application.id)
    expect(result.passed).toBe(false)
    expect(result.checks.find((c) => c.name === "sensitive_questions_resolved")?.passed).toBe(false)
  })

  it("detects a CV/cover-letter belonging to a different job than the application (mismatch guard)", async () => {
    const profile = await createTestProfile()
    await createTestEvidence(profile.id)
    const jobA = await createTestJob()
    const jobB = await createTestJob()
    const application = await prisma.application.create({ data: { jobId: jobA.id, profileId: profile.id } })

    const { tailoredCv: cvForJobB } = await tailorCvForJob({ jobId: jobB.id, profileId: profile.id })
    await prisma.application.update({ where: { id: application.id }, data: { tailoredCvId: cvForJobB.id } })

    const result = await validateApplication(application.id)
    expect(result.checks.find((c) => c.name === "cv_belongs_to_job")?.passed).toBe(false)
  })
})
