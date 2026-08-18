import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db/client"
import { createOrGetApplication } from "@/lib/tracker/applications"
import { createTestProfile, createTestJob } from "./factories"

describe("Duplicate application prevention (brief §18)", () => {
  it("creates a new application the first time", async () => {
    const profile = await createTestProfile()
    const job = await createTestJob()
    const { application, alreadyExisted } = await createOrGetApplication(job.id, profile.id)
    expect(alreadyExisted).toBe(false)
    expect(application.jobId).toBe(job.id)
  })

  it("returns the existing application instead of creating a second one for the same job+profile", async () => {
    const profile = await createTestProfile()
    const job = await createTestJob()
    const first = await createOrGetApplication(job.id, profile.id)
    const second = await createOrGetApplication(job.id, profile.id)

    expect(second.alreadyExisted).toBe(true)
    expect(second.application.id).toBe(first.application.id)

    const count = await prisma.application.count({ where: { jobId: job.id, profileId: profile.id } })
    expect(count).toBe(1)
  })

  it("allows the same profile to apply to two genuinely different jobs", async () => {
    const profile = await createTestProfile()
    const jobA = await createTestJob()
    const jobB = await createTestJob()
    await createOrGetApplication(jobA.id, profile.id)
    await createOrGetApplication(jobB.id, profile.id)

    const count = await prisma.application.count({ where: { profileId: profile.id } })
    expect(count).toBe(2)
  })
})
