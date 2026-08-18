import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db/client"
import { answerApplicationQuestions } from "@/lib/questions/engine"
import { classifyQuestion } from "@/lib/questions/classify"
import { createTestProfile, createTestEvidence, createTestJob } from "./factories"

describe("Sensitive question classification (brief §17)", () => {
  it("classifies work authorization / sponsorship / salary / disability / veteran / clearance questions as sensitive", () => {
    expect(classifyQuestion("Are you legally authorized to work in the US?").isSensitive).toBe(true)
    expect(classifyQuestion("Will you require visa sponsorship?").isSensitive).toBe(true)
    expect(classifyQuestion("What is your salary expectation?").isSensitive).toBe(true)
    expect(classifyQuestion("Do you have a disability?").isSensitive).toBe(true)
    expect(classifyQuestion("Are you a veteran?").isSensitive).toBe(true)
    expect(classifyQuestion("Do you hold an active security clearance?").isSensitive).toBe(true)
  })

  it("does not classify an ordinary product question as sensitive", () => {
    expect(classifyQuestion("Tell us about a product you launched.").isSensitive).toBe(false)
  })
})

describe("Application Question Engine (brief §14)", () => {
  async function setupApplication() {
    const profile = await createTestProfile()
    await createTestEvidence(profile.id, { title: "Launched real-time payments feature", description: "Owned delivery of a payments feature.", tagsJson: JSON.stringify(["delivery", "fintech"]) })
    await createTestEvidence(profile.id, {
      title: "Shipped GenAI assistant",
      description: "Built an LLM-powered assistant.",
      tagsJson: JSON.stringify(["ai", "genai"]),
    })
    const job = await createTestJob()
    const application = await prisma.application.create({ data: { jobId: job.id, profileId: profile.id } })
    return { profile, job, application }
  }

  it("never auto-generates an answer to a sensitive question without a predefined answer on file", async () => {
    const { application } = await setupApplication()
    const results = await answerApplicationQuestions(application.id, [{ question: "What is your salary expectation?" }])
    expect(results[0].isSensitive).toBe(true)
    expect(results[0].answer).toBeNull()
    expect(results[0].requiresApproval).toBe(true)
  })

  it("uses a predefined answer for a sensitive question when one is on file", async () => {
    const { application } = await setupApplication()
    await prisma.predefinedAnswer.create({
      data: { category: "salary_expectation", question: "What is your salary expectation?", answer: "My target range is $90k-$130k." },
    })
    const results = await answerApplicationQuestions(application.id, [{ question: "What is your salary expectation?" }])
    expect(results[0].answer).toBe("My target range is $90k-$130k.")
    expect(results[0].wasUserProvided).toBe(true)
    expect(results[0].requiresApproval).toBe(false)
  })

  it("generates a non-null, evidence-based answer for a non-sensitive question", async () => {
    const { application } = await setupApplication()
    const results = await answerApplicationQuestions(application.id, [{ question: "Tell us about a product you launched." }])
    expect(results[0].answer).not.toBeNull()
    expect(results[0].isSensitive).toBe(false)
    expect(results[0].sourceEvidenceIds.length).toBeGreaterThan(0)
  })

  it("respects a character limit on generated answers", async () => {
    const { application } = await setupApplication()
    const results = await answerApplicationQuestions(application.id, [{ question: "Tell us about a product you launched.", charLimit: 40 }])
    expect(results[0].answer!.length).toBeLessThanOrEqual(40)
  })

  it("avoids giving two different questions the identical evidence-derived answer when multiple evidence rows exist", async () => {
    const { application } = await setupApplication()
    const results = await answerApplicationQuestions(application.id, [
      { question: "Tell us about a product you launched." },
      { question: "Describe your experience with AI." },
    ])
    expect(results[0].answer).not.toBe(results[1].answer)
  })

  it("persists answers to the database, linked to the application", async () => {
    const { application } = await setupApplication()
    await answerApplicationQuestions(application.id, [{ question: "Tell us about a product you launched." }])
    const saved = await prisma.applicationAnswer.findMany({ where: { applicationId: application.id } })
    expect(saved.length).toBe(1)
  })
})
