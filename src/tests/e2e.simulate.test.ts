import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { prisma } from "@/lib/db/client"
import { toJson, fromJsonArray } from "@/lib/utils/json"
import { encryptJson } from "@/lib/security/crypto"
import { runSearch } from "@/lib/search/runSearch"
import { prepareApplication } from "@/lib/pipeline/prepareApplication"
import { recordApprovalDecision, markApplicationApplied } from "@/lib/tracker/approval"

/**
 * End-to-end simulated test (brief §53). Exercises the full pipeline —
 * Discover -> Normalize -> Dedup -> Score -> Rank -> Tailor -> Validate ->
 * Prepare -> Request approval -> Track -> record every action — against the
 * 11-posting mock fixture set (src/lib/sources/mock.ts), which was built
 * specifically to cover every scenario the brief calls for:
 *
 *   - multiple duplicate postings across sources
 *   - different seniority levels (mid/senior/group/principal)
 *   - different industries (fintech, healthtech, defense, energy, e-commerce, AI infra)
 *   - different locations (remote worldwide, UK, Canada, US, Germany, Africa)
 *   - missing salary information
 *   - internally conflicting requirements
 *   - a poor-fit job (wrong function entirely)
 *   - an exceptional-fit job
 *   - a job requiring a qualification the candidate doesn't have
 *   - a job requiring work authorization the candidate doesn't have
 */
describe("End-to-end simulated run (brief §53)", () => {
  beforeEach(async () => {
    process.env.MOCK_SOURCE_ENABLED = "true"

    const profile = await prisma.candidateProfile.create({
      data: {
        email: "e2e-candidate@example.com",
        fullName: "E2E Test Candidate",
        location: "Lagos, Nigeria",
        yearsExperience: 8,
        currentRole: "Senior Product Manager",
        workModePreference: "remote",
        willingToRelocate: false,
        workAuthorizationEnc: encryptJson({ country: "Nigeria", status: "citizen", sponsorshipNeeded: true }),
        preferredCompEnc: encryptJson({ min: 90000, max: 130000, currency: "USD", period: "year" }),
        preferredCountriesJson: toJson(["Nigeria", "United Kingdom", "Canada"]),
        preferredCitiesJson: toJson(["Lagos", "London"]),
        targetSeniorityJson: toJson(["mid", "senior"]),
        industriesJson: toJson(["fintech", "AI infrastructure", "e-commerce"]),
        targetIndustriesJson: toJson(["fintech", "AI infrastructure"]),
        pmSkillsJson: toJson(["Roadmapping", "A/B testing", "experimentation", "Agile", "stakeholder management"]),
        technicalSkillsJson: toJson(["SQL", "Python", "API design"]),
        dataSkillsJson: toJson(["SQL", "Amplitude"]),
        aiMlExperienceJson: toJson(["LLM-powered features", "GenAI product design"]),
        leadershipJson: toJson(["Managed 2 associate PMs"]),
        onboardingComplete: true,
      },
    })

    await prisma.careerEvidence.create({
      data: {
        profileId: profile.id,
        company: "Zenith Data Systems",
        roleTitle: "Senior Product Manager",
        startDate: new Date("2022-03-01"),
        evidenceType: "ai",
        title: "Shipped GenAI-powered underwriting assistant",
        description: "Led discovery and delivery of an LLM-powered assistant for loan officers, from framing through GA launch.",
        metricsJson: toJson([{ label: "Manual review time reduced", value: "38", unit: "%" }]),
        tagsJson: toJson(["ai", "genai", "fintech", "delivery"]),
      },
    })
    await prisma.careerEvidence.create({
      data: {
        profileId: profile.id,
        company: "Riverside Fintech",
        roleTitle: "Product Manager",
        startDate: new Date("2019-01-01"),
        endDate: new Date("2022-02-01"),
        evidenceType: "delivery",
        title: "Launched real-time payments reconciliation product",
        description: "Owned end-to-end delivery of a real-time payments reconciliation feature for SMB customers.",
        metricsJson: toJson([{ label: "Customer support tickets reduced", value: "45", unit: "%" }]),
        tagsJson: toJson(["fintech", "delivery", "payments"]),
      },
    })

    await prisma.predefinedAnswer.createMany({
      data: [
        {
          category: "work_authorization",
          question: "Are you legally authorized to work in the country where this job is located?",
          answer: "I am a Nigerian citizen, authorized to work remotely from Nigeria. Onsite roles elsewhere would require sponsorship.",
        },
        { category: "salary_expectation", question: "What is your salary expectation?", answer: "$90,000-$130,000 USD per year." },
      ],
    })
  })

  afterEach(() => {
    delete process.env.MOCK_SOURCE_ENABLED
  })

  it("discovers, normalizes, deduplicates, scores, ranks, tailors, validates, prepares, requests approval, and tracks — recording every action", async () => {
    // --- Discover -------------------------------------------------------
    const result = await runSearch()

    expect(result.jobsFound).toBe(11)
    expect(result.jobsNew).toBe(7)
    expect(result.jobsDuplicate).toBe(2)
    expect(result.jobsDiscarded).toBe(2)

    const searchRun = await prisma.searchRun.findUniqueOrThrow({ where: { id: result.searchRunId } })
    expect(searchRun.status).toBe("success")

    // --- Normalize / relevance filter: the non-PM "Engineering Manager" role never becomes a Job row ---
    const engineeringManagerJob = await prisma.job.findFirst({ where: { title: { contains: "Engineering Manager" } } })
    expect(engineeringManagerJob).toBeNull()
    const discarded = fromJsonArray<{ title: string; reason: string }>(searchRun.discardedJson)
    expect(discarded.some((d) => d.title.includes("Engineering Manager"))).toBe(true)
    expect(discarded.some((d) => d.reason.includes("outside the current search window"))).toBe(true) // the intentionally-old Cartwheel posting

    // --- Dedup: exactly one Job row per duplicate pair, with 2 source records each ---
    const northwindJobs = await prisma.job.findMany({ where: { companyName: "Northwind Financial" } })
    expect(northwindJobs.length).toBe(1)
    const northwindSources = await prisma.jobSourceRecord.findMany({ where: { jobId: northwindJobs[0].id } })
    expect(northwindSources.length).toBe(2)
    expect(new Set(northwindSources.map((s) => s.source))).toEqual(new Set(["greenhouse", "manual-import"]))

    const savannaJobs = await prisma.job.findMany({ where: { companyName: "Savanna Cloud Labs" } })
    expect(savannaJobs.length).toBe(1)
    expect((await prisma.jobSourceRecord.findMany({ where: { jobId: savannaJobs[0].id } })).length).toBe(2)

    // --- Missing salary is marked unknown, never invented ---
    const latchkeyJob = await prisma.job.findFirstOrThrow({ where: { companyName: "Latchkey Systems" } })
    expect(latchkeyJob.compConfidence).toBe("unknown")
    expect(latchkeyJob.salaryMin).toBeNull()

    // --- Score / rank: exceptional-fit job scores highest, poor-fit-equivalent (work auth blocker) scores lowest ---
    const allScored = await prisma.jobScore.findMany({ include: { job: true } })
    expect(allScored.length).toBe(7) // every "new" job gets scored

    const northwindScore = allScored.find((s) => s.job.companyName === "Northwind Financial")!
    const ironcladScore = allScored.find((s) => s.job.companyName === "Ironclad Federal Systems")!
    const meridianScore = allScored.find((s) => s.job.companyName === "Meridian Health")!
    const voltgridScore = allScored.find((s) => s.job.companyName === "Voltgrid Energy")!

    const maxFit = Math.max(...allScored.map((s) => s.fitScore))
    expect(northwindScore.fitScore).toBe(maxFit) // exceptional-fit job ranks highest
    expect(northwindScore.fitScore).toBeGreaterThanOrEqual(80)

    // work-authorization blocker (US citizenship + active clearance) — do-not-apply band, concern surfaced
    expect(ironcladScore.fitBand).toBe("do_not_apply")
    const ironcladConcerns = fromJsonArray<string>(ironcladScore.concernsJson)
    expect(ironcladConcerns.some((c) => /citizen|clearance/i.test(c))).toBe(true)

    // missing required qualification (clinical/regulatory) surfaced as a concern, not an auto-reject
    const meridianConcerns = fromJsonArray<string>(meridianScore.concernsJson)
    expect(meridianConcerns.some((c) => /required qualification/i.test(c))).toBe(true)
    expect(meridianScore.fitScore).toBeGreaterThan(0)

    // internally conflicting experience range flagged as a concern
    const voltgridConcerns = fromJsonArray<string>(voltgridScore.concernsJson)
    expect(voltgridConcerns.some((c) => /conflicting/i.test(c))).toBe(true)

    const priorityOrder = [...allScored].sort((a, b) => b.priorityScore - a.priorityScore)
    expect(priorityOrder[0].job.companyName).toBe("Northwind Financial") // 95%-fit-equivalent posted recently outranks the rest

    // --- Tailor / Validate / Prepare / Approval checkpoint / Track for the exceptional-fit job ---
    const profile = await prisma.candidateProfile.findFirstOrThrow()
    const prepared = await prepareApplication({ jobId: northwindJobs[0].id, profileId: profile.id })
    expect(prepared.skipped).toBe(false)
    expect(prepared.validation!.passed).toBe(true)
    expect(prepared.application.status).toBe("AWAITING_APPROVAL")
    expect(prepared.application.tailoredCvId).not.toBeNull()

    const tailoredCv = await prisma.tailoredCV.findUniqueOrThrow({ where: { id: prepared.application.tailoredCvId! } })
    expect(tailoredCv.baseVariantKey).toBe("ai_pm") // correct variant auto-selected for an AI PM role
    const bullets = await prisma.cvBulletSource.findMany({ where: { tailoredCvId: tailoredCv.id } })
    expect(bullets.every((b) => b.primaryEvidenceId)).toBe(true) // every bullet traces to real evidence

    // Sensitive questions used the predefined answers, never auto-generated
    const answers = await prisma.applicationAnswer.findMany({ where: { applicationId: prepared.application.id } })
    const salaryAnswer = answers.find((a) => a.question.includes("salary expectation"))
    expect(salaryAnswer?.wasUserProvided).toBe(true)

    // Request approval -> Track
    await recordApprovalDecision(prepared.application.id, "approve")
    let application = await prisma.application.findUniqueOrThrow({ where: { id: prepared.application.id } })
    expect(application.approvalStatus).toBe("approved")

    await markApplicationApplied(prepared.application.id, "manual")
    application = await prisma.application.findUniqueOrThrow({ where: { id: prepared.application.id } })
    expect(application.status).toBe("APPLIED")

    const followUps = await prisma.followUp.findMany({ where: { applicationId: prepared.application.id } })
    expect(followUps.length).toBe(1)

    // --- Duplicate-application prevention: preparing the same job again does not create a second application ---
    const secondPrepare = await prepareApplication({ jobId: northwindJobs[0].id, profileId: profile.id })
    expect(secondPrepare.skipped).toBe(true)
    const applicationCount = await prisma.application.count({ where: { jobId: northwindJobs[0].id, profileId: profile.id } })
    expect(applicationCount).toBe(1)

    // --- Every action was recorded (brief §53 final requirement) ---
    const auditActions = new Set((await prisma.auditLog.findMany()).map((a) => a.action))
    for (const expected of [
      "search.started",
      "search.completed",
      "job.scored",
      "cv.tailored",
      "application.created",
      "application.validated",
      "application.prepared",
      "application.approval_decision",
      "application.submitted",
    ]) {
      expect(auditActions.has(expected)).toBe(true)
    }
  }, 30_000)
})
