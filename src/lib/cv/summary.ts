import { z } from "zod"
import type { CareerEvidence } from "@prisma/client"
import { getAiProvider } from "@/lib/ai/provider"
import { verifyStatementAgainstEvidence } from "./verifier"
import { fromJsonArray } from "@/lib/utils/json"
import type { ScoringProfile } from "@/lib/scoring/types"

const SummarySchema = z.object({ summary: z.string() })

export async function generateSummary(
  profile: ScoringProfile,
  topEvidence: CareerEvidence[],
  jobTitle: string,
  variantLabel: string
): Promise<string> {
  const evidenceText = topEvidence.map((e) => `- ${e.title}: ${e.description}`).join("\n")
  const topTags = Array.from(
    new Set(topEvidence.flatMap((e) => fromJsonArray<string>(e.tagsJson)))
  ).slice(0, 4)

  const template = () =>
    `${profile.currentRole ?? "Product Manager"} with ${profile.yearsExperience ?? "several"}+ years of experience in ` +
    `${variantLabel.toLowerCase()}${topTags.length ? `, specializing in ${topTags.join(", ")}` : ""}. ` +
    `${topEvidence[0] ? `Known for ${topEvidence[0].title.toLowerCase()}.` : ""}`.trim()

  const provider = await getAiProvider()
  if (provider.id === "null") return template()

  try {
    const result = await provider.complete({
      system:
        "Write a 2-3 sentence professional summary for a product management resume, tailored toward the target job " +
        "title given. Use ONLY the candidate facts and evidence provided — never invent years of experience, an " +
        "employer, a metric, or a skill not listed. Do not mention the target company by name.",
      prompt:
        `Target job title: ${jobTitle}\nCV variant focus: ${variantLabel}\n` +
        `Candidate current role: ${profile.currentRole ?? "unknown"}\nYears of experience: ${profile.yearsExperience ?? "unknown"}\n` +
        `Top relevant evidence:\n${evidenceText}`,
      schema: SummarySchema,
      temperature: 0.4,
    })
    const combinedEvidence = `${profile.currentRole} ${profile.yearsExperience} ${evidenceText}`
    const verification = verifyStatementAgainstEvidence(result.summary, combinedEvidence)
    return verification.passed ? result.summary : template()
  } catch {
    return template()
  }
}
