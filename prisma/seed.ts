/**
 * Seed script — brief §50 "seed data / example candidate profile / example
 * career evidence / example job records". Run with `npm run db:seed`.
 *
 * The candidate profile below is illustrative (edit anything via
 * Settings once the app is running), but is deliberately built to be
 * scoreable against the mock job fixtures in src/lib/sources/mock.ts —
 * strong on AI/data product management, remote-friendly from Nigeria/UK,
 * no US security clearance / citizenship, no clinical-regulatory
 * experience — so the end-to-end test (brief §53) exercises every scoring
 * path meaningfully rather than against arbitrary placeholder data.
 */
import "dotenv/config"
import { prisma } from "../src/lib/db/client"
import { encryptJson } from "../src/lib/security/crypto"

async function main() {
  console.log("Seeding candidate profile...")

  const profile = await prisma.candidateProfile.upsert({
    where: { email: process.env.AUTH_USER_EMAIL ?? "ayoolatoecyn@gmail.com" },
    update: {},
    create: {
      email: process.env.AUTH_USER_EMAIL ?? "ayoolatoecyn@gmail.com",
      fullName: "Tosin Ayoola",
      phone: "+234 800 000 0000",
      location: "Lagos, Nigeria",
      portfolioUrl: "https://tosinayoola.example.com",
      githubUrl: "https://github.com/tosinayoola",
      linkedinUrl: "https://linkedin.com/in/tosinayoola",

      workAuthorizationEnc: encryptJson({
        country: "Nigeria",
        status: "citizen",
        sponsorshipNeeded: true,
        details: "Nigerian citizen. No US/UK/Canada work authorization on file; would require sponsorship for onsite roles in those countries. No active security clearance.",
      }),
      preferredCountriesJson: JSON.stringify(["Nigeria", "United Kingdom", "Canada", "Remote"]),
      preferredCitiesJson: JSON.stringify(["Lagos", "London", "Toronto"]),
      workModePreference: "remote",
      willingToRelocate: false,

      yearsExperience: 8,
      currentRole: "Senior Product Manager",
      currentCompany: "Zenith Data Systems",
      previousRolesJson: JSON.stringify(["Senior Product Manager, Zenith Data Systems", "Product Manager, Riverside Fintech", "Associate Product Manager, Marketplace Labs"]),
      industriesJson: JSON.stringify(["fintech", "e-commerce", "AI infrastructure", "developer tools"]),
      productAreasJson: JSON.stringify(["AI/ML platforms", "recommendation systems", "payments", "developer platforms", "growth"]),

      technicalSkillsJson: JSON.stringify(["SQL", "Python", "API design", "AWS", "REST", "Snowflake"]),
      pmSkillsJson: JSON.stringify(["Roadmapping", "A/B testing", "experimentation", "Agile", "Scrum", "OKRs", "JTBD", "stakeholder management", "go-to-market"]),
      dataSkillsJson: JSON.stringify(["SQL", "Amplitude", "Looker", "experimentation design", "cohort analysis"]),
      aiMlExperienceJson: JSON.stringify(["LLM-powered features", "GenAI product design", "ML model evaluation for product", "prompt design for production features"]),
      leadershipJson: JSON.stringify(["Managed 2 associate PMs", "Led cross-functional pod of 8 engineers/designers", "Mentored 3 junior PMs"]),

      educationJson: JSON.stringify([{ institution: "University of Lagos", credential: "B.Sc.", field: "Computer Science", graduationYear: 2015 }]),
      certificationsJson: JSON.stringify([{ name: "Certified Scrum Product Owner (CSPO)", issuer: "Scrum Alliance", year: 2019 }]),

      preferredCompEnc: encryptJson({ min: 90000, max: 130000, currency: "USD", period: "year" }),
      noticePeriodDays: 30,
      availability: "Available with 30 days notice",

      targetSeniorityJson: JSON.stringify(["mid", "senior"]),
      targetCompanySizeJson: JSON.stringify(["51-200", "201-1000"]),
      targetIndustriesJson: JSON.stringify(["fintech", "AI infrastructure", "developer tools", "e-commerce"]),
      companiesPrioritizeJson: JSON.stringify(["Savanna Cloud Labs"]),
      companiesExcludeJson: JSON.stringify([]),

      masterCvRaw:
        "Tosin Ayoola — Senior Product Manager. 8 years building AI-powered and data-driven products across fintech and e-commerce. " +
        "Currently leading the GenAI features workstream at Zenith Data Systems.",
      onboardingComplete: true,
    },
  })

  console.log("Seeding career evidence...")
  const evidenceRows: {
    company: string
    roleTitle: string
    startDate: string
    endDate?: string
    evidenceType: string
    title: string
    description: string
    metrics: { label: string; value: string; unit?: string }[]
    tags: string[]
  }[] = [
    {
      company: "Zenith Data Systems",
      roleTitle: "Senior Product Manager",
      startDate: "2022-03-01",
      evidenceType: "ai",
      title: "Shipped GenAI-powered underwriting assistant",
      description:
        "Led discovery and delivery of an LLM-powered assistant that helps loan officers draft underwriting summaries, " +
        "from problem framing through GA launch, partnering with a team of 6 engineers and 2 data scientists.",
      metrics: [
        { label: "Manual review time reduced", value: "38", unit: "%" },
        { label: "Adoption within 90 days", value: "72", unit: "%" },
      ],
      tags: ["ai", "genai", "fintech", "delivery", "leadership", "product manager"],
    },
    {
      company: "Zenith Data Systems",
      roleTitle: "Senior Product Manager",
      startDate: "2022-03-01",
      evidenceType: "experimentation",
      title: "Built experimentation program for risk-scoring model rollout",
      description:
        "Designed and ran a staged A/B rollout of a new ML-based risk-scoring model, defining guardrail metrics with " +
        "the data science team and rolling back one variant that regressed approval fairness metrics.",
      metrics: [{ label: "Experiments run", value: "14" }, { label: "False-positive rate improvement", value: "9", unit: "%" }],
      tags: ["experimentation", "data", "ai", "analytics", "delivery"],
    },
    {
      company: "Zenith Data Systems",
      roleTitle: "Senior Product Manager",
      startDate: "2022-03-01",
      evidenceType: "leadership",
      title: "Grew and led a pod of 8 cross-functional contributors",
      description:
        "Built out a product pod (engineers, a designer, and 2 associate PMs) from 3 to 8 people over 18 months, " +
        "including hiring input, onboarding, and mentoring 3 junior PMs who were later promoted.",
      metrics: [{ label: "Team size", value: "8" }, { label: "PMs mentored who were promoted", value: "3" }],
      tags: ["leadership", "management", "mentoring", "stakeholder management"],
    },
    {
      company: "Zenith Data Systems",
      roleTitle: "Senior Product Manager",
      startDate: "2022-03-01",
      evidenceType: "executive_comm",
      title: "Presented quarterly product strategy to executive team and board",
      description:
        "Owned the quarterly product strategy readout to the executive team, translating roadmap tradeoffs and " +
        "experiment results into a board-level narrative on AI investment ROI.",
      metrics: [],
      tags: ["executive_comm", "strategy", "leadership"],
    },
    {
      company: "Riverside Fintech",
      roleTitle: "Product Manager",
      startDate: "2019-01-01",
      endDate: "2022-02-01",
      evidenceType: "delivery",
      title: "Launched real-time payments reconciliation product",
      description:
        "Owned end-to-end delivery of a real-time payments reconciliation feature for SMB customers, from customer " +
        "discovery interviews through GA, coordinating with engineering, compliance, and customer success.",
      metrics: [{ label: "Customer support tickets reduced", value: "45", unit: "%" }, { label: "New SMB accounts in first quarter", value: "1,200" }],
      tags: ["fintech", "delivery", "customer_research", "payments"],
    },
    {
      company: "Riverside Fintech",
      roleTitle: "Product Manager",
      startDate: "2019-01-01",
      endDate: "2022-02-01",
      evidenceType: "roadmap",
      title: "Built and defended 12-month product roadmap for payments platform",
      description:
        "Created the first structured roadmap for the payments platform team using RICE prioritization, presented " +
        "quarterly to leadership, and re-sequenced twice in response to regulatory changes.",
      metrics: [],
      tags: ["roadmap", "strategy", "fintech"],
    },
    {
      company: "Riverside Fintech",
      roleTitle: "Product Manager",
      startDate: "2019-01-01",
      endDate: "2022-02-01",
      evidenceType: "failure_recovery",
      title: "Recovered a mis-scoped fraud-detection feature after a rocky beta",
      description:
        "A fraud-detection feature launched to beta with a 22% false-positive rate that frustrated merchants; led the " +
        "post-mortem, reset scope with the data team around a simpler rules-based v1, and relaunched successfully.",
      metrics: [{ label: "False-positive rate after relaunch", value: "6", unit: "%" }],
      tags: ["failure_recovery", "delivery", "fintech", "data"],
    },
    {
      company: "Riverside Fintech",
      roleTitle: "Product Manager",
      startDate: "2019-01-01",
      endDate: "2022-02-01",
      evidenceType: "gtm",
      title: "Led go-to-market for SMB lending product launch",
      description:
        "Partnered with marketing and sales to plan and execute the go-to-market for a new SMB lending product, " +
        "including pricing input, sales enablement materials, and a phased regional rollout.",
      metrics: [{ label: "Regions launched in first 6 months", value: "4" }],
      tags: ["gtm", "strategy", "fintech"],
    },
    {
      company: "Marketplace Labs",
      roleTitle: "Associate Product Manager",
      startDate: "2016-06-01",
      endDate: "2018-12-01",
      evidenceType: "discovery",
      title: "Ran customer discovery program for seller-side marketplace tools",
      description:
        "Conducted 40+ customer interviews with marketplace sellers to identify friction in the listing flow, " +
        "synthesizing findings into a prioritized backlog that shaped the following two quarters of delivery.",
      metrics: [{ label: "Customer interviews conducted", value: "40" }],
      tags: ["discovery", "customer_research", "e-commerce"],
    },
    {
      company: "Marketplace Labs",
      roleTitle: "Associate Product Manager",
      startDate: "2016-06-01",
      endDate: "2018-12-01",
      evidenceType: "analytics",
      title: "Built seller funnel analytics dashboard adopted org-wide",
      description:
        "Partnered with a data analyst to define and build a seller activation funnel dashboard in Looker, which " +
        "became the team's standard weekly metrics review artifact.",
      metrics: [{ label: "Weekly active dashboard users", value: "25" }],
      tags: ["analytics", "data", "e-commerce"],
    },
    {
      company: "Marketplace Labs",
      roleTitle: "Associate Product Manager",
      startDate: "2016-06-01",
      endDate: "2018-12-01",
      evidenceType: "achievement",
      title: "Redesigned seller onboarding flow, cutting drop-off",
      description:
        "Led a redesign of the seller onboarding flow in partnership with design, simplifying an 11-step flow to 5 " +
        "steps and instrumenting each step for the first time.",
      metrics: [{ label: "Onboarding completion rate improvement", value: "31", unit: "%" }],
      tags: ["delivery", "e-commerce", "product manager"],
    },
    {
      company: undefined as unknown as string,
      roleTitle: undefined as unknown as string,
      startDate: "2019-09-01",
      evidenceType: "certification",
      title: "Certified Scrum Product Owner (CSPO)",
      description: "Completed CSPO certification through Scrum Alliance.",
      metrics: [],
      tags: ["certification", "agile"],
    },
    {
      company: undefined as unknown as string,
      roleTitle: undefined as unknown as string,
      startDate: "2023-05-01",
      evidenceType: "publication",
      title: "Wrote internal playbook on evaluating LLM features for production",
      description:
        "Authored an internal playbook used by three product teams at Zenith Data Systems for evaluating when an " +
        "LLM-based approach is justified over a simpler heuristic, including a lightweight eval framework.",
      metrics: [],
      tags: ["ai", "genai", "publication", "technical"],
    },
  ]

  for (const e of evidenceRows) {
    await prisma.careerEvidence.create({
      data: {
        profileId: profile.id,
        company: e.company ?? null,
        roleTitle: e.roleTitle ?? null,
        startDate: new Date(e.startDate),
        endDate: e.endDate ? new Date(e.endDate) : null,
        evidenceType: e.evidenceType,
        title: e.title,
        description: e.description,
        metricsJson: JSON.stringify(e.metrics),
        tagsJson: JSON.stringify(e.tags),
      },
    })
  }

  console.log("Seeding CV variants...")
  const variants: { key: string; label: string; summary: string }[] = [
    { key: "master", label: "Master CV", summary: "Full career history — the source of truth every tailored CV is generated from." },
    { key: "general_pm", label: "General Product Manager", summary: "Balanced emphasis across delivery, discovery, and leadership." },
    { key: "senior_pm", label: "Senior Product Leadership", summary: "Emphasizes team leadership, strategy, and executive communication." },
    { key: "ai_pm", label: "AI / GenAI Product Manager", summary: "Leads with AI/ML/GenAI shipped features and evaluation frameworks." },
    { key: "data_pm", label: "Data Product Manager", summary: "Leads with analytics, experimentation, and data-platform work." },
    { key: "technical_pm", label: "Technical Product Manager", summary: "Leads with API/platform experience and technical fluency." },
    { key: "product_strategy", label: "Product Strategy", summary: "Leads with roadmap, GTM, and strategic-narrative evidence." },
  ]
  for (const v of variants) {
    await prisma.cvVariant.upsert({
      where: { profileId_key: { profileId: profile.id, key: v.key } },
      update: {},
      create: {
        profileId: profile.id,
        key: v.key,
        label: v.label,
        summaryTemplate: v.summary,
        contentJson: JSON.stringify({ note: "Tailored CVs are generated dynamically per job from the evidence database — this row is a display/reference entry." }),
        isMaster: v.key === "master",
      },
    })
  }

  console.log("Seeding predefined answers for sensitive questions...")
  const predefinedAnswers: { category: string; question: string; answer: string }[] = [
    {
      category: "work_authorization",
      question: "Are you legally authorized to work in the country where this job is located?",
      answer:
        "I am a Nigerian citizen. I am authorized to work remotely from Nigeria. For onsite roles in the US, UK, or Canada I would require work authorization/visa sponsorship.",
    },
    {
      category: "sponsorship",
      question: "Will you now or in the future require sponsorship for employment visa status?",
      answer: "Yes, for onsite roles outside Nigeria I would require visa sponsorship. Remote roles do not require sponsorship.",
    },
    {
      category: "salary_expectation",
      question: "What is your salary expectation?",
      answer: "My target range is $90,000–$130,000 USD per year, depending on the full compensation package and role scope.",
    },
    {
      category: "relocation",
      question: "Are you willing to relocate for this position?",
      answer: "I'm not currently seeking relocation and am focused on remote roles, but I'm open to discussing exceptional opportunities.",
    },
  ]
  for (const a of predefinedAnswers) {
    const existing = await prisma.predefinedAnswer.findFirst({ where: { category: a.category, question: a.question } })
    if (!existing) {
      await prisma.predefinedAnswer.create({ data: a })
    }
  }

  console.log("Seeding example watched boards (disabled by default — enable in Settings > Sources)...")
  const exampleBoards: { source: string; token: string; label: string }[] = [
    { source: "greenhouse", token: "example-co", label: "Example Co (edit or remove — replace with a real board token)" },
    { source: "lever", token: "example-co", label: "Example Co (edit or remove — replace with a real org slug)" },
  ]
  for (const b of exampleBoards) {
    await prisma.watchedBoard.upsert({
      where: { source_token: { source: b.source, token: b.token } },
      update: {},
      create: { ...b, enabled: false },
    })
  }

  console.log("Seeding settings...")
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      locationsJson: JSON.stringify(["Lagos", "London", "Toronto", "Remote"]),
      countriesJson: JSON.stringify(["Nigeria", "United Kingdom", "Canada"]),
      remotePreference: "remote",
      industriesJson: JSON.stringify(["fintech", "AI infrastructure", "developer tools", "e-commerce"]),
      targetSenioritiesJson: JSON.stringify(["mid", "senior"]),
    },
  })

  console.log("Seed complete.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
