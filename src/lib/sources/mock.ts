import type { RawJobPosting } from "@/lib/types/job"
import type { JobSourceAdapter, SourceSearchResult } from "./types"

/**
 * Deterministic fixture generator. Used by `npm run db:seed` and by the
 * end-to-end simulated test (brief §53) — never called from a real search
 * run unless MOCK_SOURCE_ENABLED=true, so it can never contaminate a
 * production job list.
 *
 * The 10 postings below are deliberately constructed to exercise every
 * scenario the brief's final acceptance test calls for: duplicates across
 * sources, mixed seniority/industry/location, missing salary, internally
 * conflicting requirements, a poor-fit role, an exceptional-fit role, a role
 * requiring a qualification the seed candidate doesn't have, and a role
 * requiring work authorization the seed candidate doesn't have.
 */
export function generateMockPostings(now: Date = new Date()): RawJobPosting[] {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600_000).toISOString()

  const postings: RawJobPosting[] = [
    // 1 — Exceptional fit: AI Product Manager, remote-friendly, mid/senior, fintech+AI, matches seed profile closely.
    {
      source: "greenhouse",
      sourceJobId: "mock-1001",
      title: "Senior AI Product Manager",
      companyName: "Northwind Financial",
      location: "Remote (Worldwide)",
      remoteStatus: "remote",
      countries: [],
      employmentType: "full_time",
      department: "Product",
      applicationUrl: "https://boards.greenhouse.io/northwind/jobs/1001",
      originalUrl: "https://boards.greenhouse.io/northwind/jobs/1001",
      postedAt: hoursAgo(6),
      postedAtConfidence: "known",
      salaryMin: 150000,
      salaryMax: 190000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      description:
        "Northwind Financial is looking for a Senior AI Product Manager to own our GenAI-powered underwriting assistant. " +
        "Required: 5+ years of product management experience, direct experience shipping AI/ML-powered features, " +
        "experience with experimentation and A/B testing, strong analytical/SQL skills, experience leading cross-functional " +
        "teams of engineers/designers/data scientists. Preferred: experience in fintech or financial services, experience " +
        "with LLM-based products, familiarity with regulated environments. Remote-friendly worldwide; no work authorization " +
        "restrictions — we hire via EOR globally.",
    },
    // 2 — Duplicate of #1, discovered via a second source (manual-import from the company's own careers page).
    {
      source: "manual-import",
      sourceJobId: "https://northwindfinancial.com/careers/senior-ai-product-manager",
      title: "Sr. AI Product Manager",
      companyName: "Northwind Financial",
      location: "Remote - Worldwide",
      remoteStatus: "remote",
      countries: [],
      employmentType: "full_time",
      applicationUrl: "https://northwindfinancial.com/careers/senior-ai-product-manager",
      originalUrl: "https://northwindfinancial.com/careers/senior-ai-product-manager",
      postedAtConfidence: "unknown",
      description:
        "Northwind Financial — Sr. AI Product Manager. Own our GenAI-powered underwriting assistant end to end. " +
        "5+ years PM experience required, direct AI/ML product shipping experience required, experimentation/A-B testing, " +
        "SQL, cross-functional leadership. Fintech experience preferred. Fully remote, worldwide, EOR-supported.",
    },
    // 3 — Good/strong fit: Data Product Manager, hybrid, e-commerce, mid-senior.
    {
      source: "lever",
      sourceJobId: "mock-2002",
      title: "Data Product Manager",
      companyName: "Cartwheel Commerce",
      location: "London, UK (Hybrid)",
      remoteStatus: "hybrid",
      countries: ["United Kingdom"],
      employmentType: "full_time",
      department: "Product",
      applicationUrl: "https://jobs.lever.co/cartwheel/2002/apply",
      originalUrl: "https://jobs.lever.co/cartwheel/2002",
      postedAt: hoursAgo(18),
      postedAtConfidence: "known",
      salaryCurrency: "GBP",
      description:
        "Cartwheel Commerce seeks a Data Product Manager for our recommendations & personalization platform. " +
        "Required: 4+ years product management, strong experience with data/analytics products, SQL, experimentation. " +
        "Preferred: experience in e-commerce or marketplace businesses, experience with recommendation systems. " +
        "Hybrid — 2 days/week in our London office. Right to work in the UK required; we do not sponsor visas for this role.",
    },
    // 4 — Possible fit: Product Owner (title variant) at a healthtech company, onsite, requires a qualification the
    //     seed candidate does not have (clinical/regulatory domain experience).
    {
      source: "ashby",
      sourceJobId: "mock-3003",
      title: "Product Owner - Clinical Systems",
      companyName: "Meridian Health",
      location: "Toronto, ON (Onsite)",
      remoteStatus: "onsite",
      countries: ["Canada"],
      employmentType: "full_time",
      department: "Product",
      applicationUrl: "https://jobs.ashbyhq.com/meridian/3003/apply",
      originalUrl: "https://jobs.ashbyhq.com/meridian/3003",
      postedAt: hoursAgo(10),
      postedAtConfidence: "known",
      salaryMin: 110000,
      salaryMax: 130000,
      salaryCurrency: "CAD",
      salaryPeriod: "year",
      description:
        "Meridian Health is hiring a Product Owner for our Clinical Systems team. Required: 3+ years product ownership " +
        "experience, direct experience with FDA 510(k) regulatory submissions for Class II medical devices, experience " +
        "working with clinicians on EHR-integrated workflows. Preferred: clinical background or health-system operations " +
        "experience. Onsite in Toronto 5 days/week. Must be legally authorized to work in Canada.",
    },
    // 5 — Poor fit: Mobile Platform Engineering Manager — wrong function entirely (engineering, not product), should
    //     score very low on pmSkillMatch despite loosely product-adjacent title matching.
    {
      source: "greenhouse",
      sourceJobId: "mock-4004",
      title: "Engineering Manager, Mobile Platform",
      companyName: "Rivet Studios",
      location: "San Francisco, CA (Onsite)",
      remoteStatus: "onsite",
      countries: ["United States"],
      employmentType: "full_time",
      department: "Engineering",
      applicationUrl: "https://boards.greenhouse.io/rivet/jobs/4004",
      originalUrl: "https://boards.greenhouse.io/rivet/jobs/4004",
      postedAt: hoursAgo(4),
      postedAtConfidence: "known",
      description:
        "Rivet Studios is hiring an Engineering Manager for our Mobile Platform team. Required: 8+ years of software " +
        "engineering experience with at least 3 years managing iOS/Android engineers, deep expertise in Swift/Kotlin, " +
        "CI/CD pipeline ownership, on-call incident management. This is a hands-on technical leadership role, not a " +
        "product management role. Onsite in San Francisco 5 days/week. US work authorization required.",
    },
    // 6 — Good fit but missing salary info, senior, AI/data adjacent, developer tools industry.
    {
      source: "lever",
      sourceJobId: "mock-5005",
      title: "Senior Product Manager, Developer Platform",
      companyName: "Latchkey Systems",
      location: "Remote (US)",
      remoteStatus: "remote",
      countries: ["United States"],
      employmentType: "full_time",
      department: "Product",
      applicationUrl: "https://jobs.lever.co/latchkey/5005/apply",
      originalUrl: "https://jobs.lever.co/latchkey/5005",
      postedAt: hoursAgo(20),
      postedAtConfidence: "known",
      // Deliberately no salary fields — brief §39 "if salary is unavailable, mark it unknown, never invent."
      description:
        "Latchkey Systems is looking for a Senior Product Manager to lead our developer platform (APIs, SDKs, docs). " +
        "Required: 5+ years product management, experience with API/platform products, strong technical fluency, " +
        "experience partnering with engineering on technical roadmaps. Preferred: prior experience as a software " +
        "engineer, experience with usage-based pricing. Remote within the US only.",
    },
    // 7 — Group Product Manager, principal-adjacent seniority, requires work authorization the seed candidate lacks
    //     (active security clearance, US-citizens-only).
    {
      source: "ashby",
      sourceJobId: "mock-6006",
      title: "Group Product Manager, Defense Analytics",
      companyName: "Ironclad Federal Systems",
      location: "Arlington, VA (Onsite)",
      remoteStatus: "onsite",
      countries: ["United States"],
      employmentType: "full_time",
      department: "Product",
      applicationUrl: "https://jobs.ashbyhq.com/ironclad/6006/apply",
      originalUrl: "https://jobs.ashbyhq.com/ironclad/6006",
      postedAt: hoursAgo(30),
      postedAtConfidence: "known",
      salaryMin: 180000,
      salaryMax: 220000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      description:
        "Ironclad Federal Systems seeks a Group Product Manager to lead our Defense Analytics product line. " +
        "Required: US citizenship, active TS/SCI security clearance, 8+ years product leadership experience managing " +
        "managers, experience with government contracting (FedRAMP, ITAR). Onsite in Arlington, VA. No exceptions on " +
        "clearance requirement.",
    },
    // 8 — Conflicting requirements: same posting asks for both "0-2 years" (associate-level framing) and
    //     "minimum 10 years leading product orgs" — the analyzer/scorer should surface this as a concern rather
    //     than silently picking one.
    {
      source: "manual-import",
      sourceJobId: "https://voltgrid.example.com/careers/product-manager-7007",
      title: "Product Manager",
      companyName: "Voltgrid Energy",
      location: "Berlin, Germany (Hybrid)",
      remoteStatus: "hybrid",
      countries: ["Germany"],
      employmentType: "full_time",
      applicationUrl: "https://voltgrid.example.com/careers/product-manager-7007",
      originalUrl: "https://voltgrid.example.com/careers/product-manager-7007",
      postedAtConfidence: "unknown",
      description:
        "Voltgrid Energy — Product Manager, Grid Analytics. This is an entry-level associate product manager position " +
        "suitable for candidates with 0-2 years of experience looking to break into product. However, the successful " +
        "candidate must also have a minimum of 10 years of experience leading product organizations of 50+ people at " +
        "public companies. Required: energy sector domain expertise. Hybrid, Berlin office 3 days/week. EU right to " +
        "work required.",
    },
    // 9 — Strong fit, Technical Product Manager, remote, AI/platform, Nigeria-friendly (matches seed location).
    {
      source: "greenhouse",
      sourceJobId: "mock-8008",
      title: "Technical Product Manager - AI Platform",
      companyName: "Savanna Cloud Labs",
      location: "Remote (Africa, Europe)",
      remoteStatus: "remote",
      countries: ["Nigeria", "United Kingdom", "Remote"],
      employmentType: "full_time",
      department: "Product",
      applicationUrl: "https://boards.greenhouse.io/savanna/jobs/8008",
      originalUrl: "https://boards.greenhouse.io/savanna/jobs/8008",
      postedAt: hoursAgo(2),
      postedAtConfidence: "known",
      salaryMin: 70000,
      salaryMax: 95000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      description:
        "Savanna Cloud Labs is hiring a Technical Product Manager for our AI/ML platform team, building infrastructure " +
        "for teams shipping GenAI features across Africa and Europe. Required: 4+ years product management, technical " +
        "background (CS degree or engineering experience), experience with ML/AI platform products, experience working " +
        "with distributed remote teams. Preferred: experience in emerging markets, Python fluency. Fully remote, open to " +
        "candidates based in Nigeria, Kenya, South Africa, or the UK.",
    },
    // 10 — Duplicate of #9 posted slightly later on Google-Jobs-style aggregation (manual-import), title varies.
    {
      source: "manual-import",
      sourceJobId: "https://savannacloud.example.com/jobs/tpm-ai-platform",
      title: "Technical Product Manager – AI Platform Team",
      companyName: "Savanna Cloud Labs",
      location: "Remote - Africa/Europe",
      remoteStatus: "remote",
      countries: ["Nigeria", "United Kingdom"],
      employmentType: "full_time",
      applicationUrl: "https://savannacloud.example.com/jobs/tpm-ai-platform",
      originalUrl: "https://savannacloud.example.com/jobs/tpm-ai-platform",
      postedAtConfidence: "unknown",
      description:
        "Savanna Cloud Labs — Technical Product Manager, AI Platform team. Building the ML/AI platform infrastructure " +
        "used across our GenAI product lines. 4+ years PM experience, technical background required, experience with " +
        "distributed remote teams. Remote, open to Nigeria/Kenya/South Africa/UK candidates.",
    },
    // 11 — Outside the search window on purpose (posted 9 days ago) to exercise the 24h-window / initial-window logic.
    {
      source: "lever",
      sourceJobId: "mock-9009",
      title: "Principal Product Manager, Payments",
      companyName: "Cartwheel Commerce",
      location: "Remote (UK)",
      remoteStatus: "remote",
      countries: ["United Kingdom"],
      employmentType: "full_time",
      applicationUrl: "https://jobs.lever.co/cartwheel/9009/apply",
      originalUrl: "https://jobs.lever.co/cartwheel/9009",
      postedAt: daysAgo(9),
      postedAtConfidence: "known",
      salaryCurrency: "GBP",
      description:
        "Cartwheel Commerce — Principal Product Manager, Payments. This posting is intentionally outside the default " +
        "24-hour discovery window used in the automated test to verify old postings are correctly excluded from a " +
        "'since last run' search while still being includable under the initial 7-day window on a first-ever run.",
    },
  ]

  return postings
}

export const mockAdapter: JobSourceAdapter = {
  id: "mock",
  displayName: "Mock/Demo Source",
  automatable: false,
  legalBasis: "Synthetic fixture data only — never queries a real website. Used for seeding and the e2e test.",
  async search(): Promise<SourceSearchResult> {
    if (process.env.MOCK_SOURCE_ENABLED !== "true") {
      return { postings: [], warnings: [] }
    }
    return { postings: generateMockPostings(), warnings: [] }
  },
}
