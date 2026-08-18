import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db/client"
import { transitionApplication, IllegalTransitionError } from "@/lib/tracker/stateMachine"
import { createOrGetApplication } from "@/lib/tracker/applications"
import { createTestProfile, createTestJob } from "./factories"

async function setupApplication() {
  const profile = await createTestProfile()
  const job = await createTestJob()
  const { application } = await createOrGetApplication(job.id, profile.id)
  return application
}

describe("Application state machine (brief §19)", () => {
  it("starts in DISCOVERED", async () => {
    const app = await setupApplication()
    expect(app.status).toBe("DISCOVERED")
  })

  it("allows the documented forward path", async () => {
    const app = await setupApplication()
    await transitionApplication(app.id, "ANALYZED")
    await transitionApplication(app.id, "SCORED")
    await transitionApplication(app.id, "SHORTLISTED")
    const updated = await prisma.application.findUniqueOrThrow({ where: { id: app.id } })
    expect(updated.status).toBe("SHORTLISTED")
  })

  it("rejects an illegal skip-ahead transition (e.g. DISCOVERED -> APPLIED)", async () => {
    const app = await setupApplication()
    await expect(transitionApplication(app.id, "APPLIED")).rejects.toThrow(IllegalTransitionError)
  })

  it("blocks APPLICATION_PREPARED -> AWAITING_APPROVAL when validation has not passed", async () => {
    const app = await setupApplication()
    await transitionApplication(app.id, "ANALYZED")
    await transitionApplication(app.id, "SCORED")
    await transitionApplication(app.id, "SHORTLISTED")
    await transitionApplication(app.id, "CV_TAILORED")
    await transitionApplication(app.id, "APPLICATION_PREPARED")
    // validationPassed defaults to false
    await expect(transitionApplication(app.id, "AWAITING_APPROVAL")).rejects.toThrow(IllegalTransitionError)
  })

  it("allows AWAITING_APPROVAL -> APPLIED only once approvalStatus is 'approved'", async () => {
    const app = await setupApplication()
    await transitionApplication(app.id, "ANALYZED")
    await transitionApplication(app.id, "SCORED")
    await transitionApplication(app.id, "SHORTLISTED")
    await transitionApplication(app.id, "CV_TAILORED")
    await transitionApplication(app.id, "APPLICATION_PREPARED")
    await prisma.application.update({ where: { id: app.id }, data: { validationPassed: true } })
    await transitionApplication(app.id, "AWAITING_APPROVAL")

    await expect(transitionApplication(app.id, "APPLIED")).rejects.toThrow(IllegalTransitionError)

    await prisma.application.update({ where: { id: app.id }, data: { approvalStatus: "approved" } })
    await transitionApplication(app.id, "APPLIED")
    const final = await prisma.application.findUniqueOrThrow({ where: { id: app.id } })
    expect(final.status).toBe("APPLIED")
  })

  it("permanently blocks any further transition once in a terminal state", async () => {
    const app = await setupApplication()
    await transitionApplication(app.id, "REJECTED")
    await expect(transitionApplication(app.id, "ANALYZED")).rejects.toThrow(IllegalTransitionError)
  })

  it("records a status history event for every transition", async () => {
    const app = await setupApplication()
    await transitionApplication(app.id, "ANALYZED")
    const events = await prisma.applicationStatusEvent.findMany({ where: { applicationId: app.id } })
    // one for creation (DISCOVERED) + one for ANALYZED
    expect(events.length).toBe(2)
  })
})
