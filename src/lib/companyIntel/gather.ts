import { prisma } from "@/lib/db/client"
import { toJson } from "@/lib/utils/json"
import { getAiProvider } from "@/lib/ai/provider"
import { isFetchAllowed } from "@/lib/sources/robots"
import { audit } from "@/lib/audit/logger"
import { CompanyIntelSchema, type CompanyIntel, type CompanyIntelResult } from "./types"

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

async function fetchCompanyWebsiteText(website: string): Promise<{ text: string; note: string }> {
  const robots = await isFetchAllowed(website)
  if (!robots.allowed) return { text: "", note: `Skipped fetching ${website}: ${robots.reason}` }
  try {
    const res = await fetch(website, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PMJobAgent/1.0; +personal-use)" } })
    if (!res.ok) return { text: "", note: `Fetching ${website} returned status ${res.status}.` }
    const html = await res.text()
    return { text: stripHtml(html).slice(0, 8000), note: `Fetched ${website} homepage text.` }
  } catch (err) {
    return { text: "", note: `Failed to fetch ${website}: ${(err as Error).message}` }
  }
}

function emptyIntel(note: string): CompanyIntel {
  return CompanyIntelSchema.parse({ hiringTrendsNote: note })
}

/**
 * Company Intelligence Agent (brief §21). Grounded only in: (a) the
 * company's own public website text (fetched with a robots.txt check), and
 * (b) the job description already on file. Never invents funding rounds,
 * named executives, or competitor lists it wasn't given source text for.
 */
export async function gatherCompanyIntelligence(companyId: string): Promise<CompanyIntelResult> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { jobs: { take: 3 } } })

  let sourceText = ""
  let sourceNote = "No company website on file — add one on the Companies page to enable intelligence gathering."
  if (company.website) {
    const fetched = await fetchCompanyWebsiteText(company.website)
    sourceText = fetched.text
    sourceNote = fetched.note
  }
  const jobContext = company.jobs.map((j) => `${j.title}: ${j.description.slice(0, 1500)}`).join("\n\n")

  const provider = await getAiProvider()
  let intel: CompanyIntel

  if (provider.id === "null" || (!sourceText && !jobContext)) {
    intel = emptyIntel(sourceText || jobContext ? "AI provider not configured — set AI_PROVIDER to enable narrative synthesis." : "No source text available.")
  } else {
    try {
      intel = await provider.complete({
        system:
          "Summarize what this company does, based ONLY on the provided website text and job description excerpts. " +
          'If information for a field isn\'t present in the source text, use "UNKNOWN" (for string fields) or an empty ' +
          "array — never invent funding amounts, executive names, or competitors you weren't given source text for.",
        prompt: `Company: ${company.name}\n\nWebsite text:\n${sourceText || "(none)"}\n\nJob description excerpts:\n${jobContext || "(none)"}`,
        schema: CompanyIntelSchema,
        temperature: 0.2,
      })
    } catch {
      intel = emptyIntel("AI extraction failed — showing raw source text only.")
    }
  }

  const reputationScore = estimateReputationScore(company.jobs.length, Boolean(company.website), intel)

  const networkingRecommendation =
    `Public job-board APIs don't expose a named recruiter or hiring manager for ${company.name}. Recommended: search ` +
    `LinkedIn for "${company.name} Head of Product" or "${company.name} Talent Acquisition" and consider a warm intro ` +
    `before applying, rather than a cold message — the agent will never contact anyone on your behalf.`

  await prisma.company.update({
    where: { id: companyId },
    data: { intelJson: toJson(intel), intelUpdatedAt: new Date(), reputationScore },
  })

  await audit("company.intel_gathered", "Company", companyId, { sourceNote, hasWebsite: Boolean(company.website) })

  return { intel, networkingRecommendation, sourceNote, reputationScore }
}

function estimateReputationScore(openRoleCount: number, hasWebsite: boolean, intel: CompanyIntel): number {
  let score = 50
  if (hasWebsite) score += 10
  if (intel.productOverview !== "UNKNOWN") score += 10
  if (intel.fundingStatus !== "UNKNOWN") score += 10
  if (openRoleCount > 1) score += 10 // actively hiring across multiple roles is a weak positive signal
  if (intel.challenges.length > 0) score -= 10
  return Math.max(0, Math.min(100, score))
}
