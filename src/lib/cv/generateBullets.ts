import { z } from "zod"
import type { CareerEvidence } from "@prisma/client"
import { getAiProvider } from "@/lib/ai/provider"
import { verifyStatementAgainstEvidence } from "./verifier"
import { fromJsonArray } from "@/lib/utils/json"

export interface GeneratedBullet {
  text: string
  sourceEvidenceIds: string[]
  primaryEvidenceId: string
  confidence: "verified" | "inferred"
  verifierPassed: boolean
}

const BulletSchema = z.object({ statement: z.string() })

function evidenceText(e: CareerEvidence): string {
  const metrics = fromJsonArray<{ label: string; value: string; unit?: string }>(e.metricsJson)
  const metricsText = metrics.map((m) => `${m.label}: ${m.value}${m.unit ?? ""}`).join("; ")
  return [e.title, e.description, metricsText].filter(Boolean).join(". ")
}

function templatedBullet(e: CareerEvidence): string {
  const metrics = fromJsonArray<{ label: string; value: string; unit?: string }>(e.metricsJson)
  const metricSuffix = metrics.length ? ` (${metrics.map((m) => `${m.label}: ${m.value}${m.unit ?? ""}`).join(", ")})` : ""
  const description = e.description.length > 200 ? e.description.slice(0, 197) + "..." : e.description
  return `${description}${metricSuffix}`
}

/**
 * Produces one resume bullet from a single evidence row. With an AI provider
 * configured, asks it to phrase the bullet more crisply — but the result is
 * mechanically re-verified against the evidence text (verifier.ts) and
 * discarded in favor of the safe, always-truthful template on any failure.
 * With no provider, uses the template directly (100% traceable, since it's
 * just the user's own recorded text).
 */
export async function generateBullet(evidence: CareerEvidence): Promise<GeneratedBullet> {
  const srcText = evidenceText(evidence)
  const provider = await getAiProvider()

  if (provider.id === "null") {
    return {
      text: templatedBullet(evidence),
      sourceEvidenceIds: [evidence.id],
      primaryEvidenceId: evidence.id,
      confidence: "verified",
      verifierPassed: true,
    }
  }

  try {
    const result = await provider.complete({
      system:
        "You rewrite a single piece of career evidence into one crisp, resume-style bullet point (max ~220 characters). " +
        "Use ONLY facts, numbers, dates, and names present in the evidence text. Never invent or estimate a number, " +
        "date, employer, or technology that isn't explicitly there. Start with a strong action verb.",
      prompt: `Evidence:\n${srcText}`,
      schema: BulletSchema,
      temperature: 0.4,
    })
    const verification = verifyStatementAgainstEvidence(result.statement, srcText)
    if (!verification.passed) {
      return {
        text: templatedBullet(evidence),
        sourceEvidenceIds: [evidence.id],
        primaryEvidenceId: evidence.id,
        confidence: "verified",
        verifierPassed: false, // recorded for audit — see CvBulletSource.verifierPassed
      }
    }
    return {
      text: result.statement,
      sourceEvidenceIds: [evidence.id],
      primaryEvidenceId: evidence.id,
      confidence: "verified",
      verifierPassed: true,
    }
  } catch {
    return {
      text: templatedBullet(evidence),
      sourceEvidenceIds: [evidence.id],
      primaryEvidenceId: evidence.id,
      confidence: "verified",
      verifierPassed: true,
    }
  }
}
