import type { JobTitleFamily, Seniority } from "@/lib/types/enums"

/**
 * Semantic job-title matching (brief §37): "Senior PM", "Sr Product Manager",
 * "Product Lead" and "Senior Product Manager" should all resolve to the same
 * family, but "Product Marketing Manager" / "Production Manager" / "Product
 * Designer" must NOT be treated as product-management roles just because
 * they contain the word "product". This is intentionally a transparent,
 * rule-based matcher (not an AI call) so title classification is fast,
 * free, and fully deterministic/testable.
 */

// Titles containing these are near-universally NOT product management roles,
// even though they share a word with one — checked before any inclusion rule.
const EXCLUSION_PATTERNS: RegExp[] = [
  /product\s+market/i, // Product Marketing Manager
  /product\s+design/i, // Product Designer
  /production\s+manager/i,
  /product(ion)?\s+engineer/i,
  /product\s+analyst\b(?!.*manager)/i, // "Product Analyst" alone (no PM responsibility signal)
  /product\s+support/i,
  /product\s+content/i,
  /product\s+photograph/i,
]

interface FamilyRule {
  family: JobTitleFamily
  patterns: RegExp[]
}

const FAMILY_RULES: FamilyRule[] = [
  { family: "ai_product_manager", patterns: [/\b(ai|genai|gen-ai|ml|machine learning)\b.*product\s*(manager|lead|owner)/i, /product\s*(manager|lead).*\b(ai|genai|gen-ai)\b/i] },
  { family: "data_product_manager", patterns: [/\bdata\b.*product\s*(manager|lead|owner)/i, /product\s*(manager|lead).*\bdata\b/i] },
  { family: "technical_product_manager", patterns: [/\btechnical\b.*product\s*(manager|lead)/i, /\btpm\b/i] },
  { family: "platform_product_manager", patterns: [/\bplatform\b.*product\s*(manager|lead)/i] },
  { family: "digital_product_manager", patterns: [/\bdigital\b.*product\s*(manager|lead)/i] },
  { family: "product_strategy", patterns: [/product\s*strategy/i, /head of product strategy/i] },
  { family: "group_product_manager", patterns: [/\bgroup product manager\b/i, /\bgpm\b/i] },
  { family: "principal_product_manager", patterns: [/\bprincipal product\b/i] },
  { family: "product_owner", patterns: [/\bproduct owner\b/i] },
  { family: "senior_product_lead", patterns: [/\bsenior product lead\b/i, /\bsr\.?\s*product lead\b/i] },
  { family: "product_lead", patterns: [/\bproduct lead\b/i, /\blead product manager\b/i] },
  { family: "senior_product_manager", patterns: [/\bsenior product manager\b/i, /\bsr\.?\s*product manager\b/i, /\bsenior pm\b/i] },
  { family: "product_manager", patterns: [/\bproduct manager\b/i, /\bpm\b/i] },
]

export interface TitleClassification {
  isRelevant: boolean
  family: JobTitleFamily
  seniority: Seniority
  matchedRule?: string
}

export function classifyTitle(rawTitle: string, titleSynonyms: Record<string, string> = {}): TitleClassification {
  const title = rawTitle.trim()
  const lower = title.toLowerCase()

  if (EXCLUSION_PATTERNS.some((p) => p.test(title))) {
    return { isRelevant: false, family: "other_related", seniority: "unknown" }
  }

  // Direct synonym dictionary hit (user-editable via Settings) takes priority.
  const synonymKey = Object.keys(titleSynonyms).find((k) => lower.includes(k))
  let family: JobTitleFamily | undefined = synonymKey
    ? (titleSynonyms[synonymKey] as JobTitleFamily)
    : undefined

  if (!family) {
    for (const rule of FAMILY_RULES) {
      if (rule.patterns.some((p) => p.test(title))) {
        family = rule.family
        break
      }
    }
  }

  const isRelevant = Boolean(family)
  const seniority = detectSeniority(title)

  // A synonym/rule hit for a bare "product manager" combined with a detected
  // senior+ signal should upgrade the family, mirroring how a human reads
  // "Sr Product Manager, Growth" as senior_product_manager even though the
  // synonym dictionary only had to match "product manager".
  if (family === "product_manager" && (seniority === "senior" || seniority === "lead")) {
    family = "senior_product_manager"
  }

  return { isRelevant, family: family ?? "other_related", seniority, matchedRule: synonymKey }
}

function detectSeniority(title: string): Seniority {
  const t = title.toLowerCase()
  if (/\bgroup\b/.test(t)) return "group"
  if (/\bprincipal\b/.test(t)) return "principal"
  if (/\blead\b/.test(t)) return "lead"
  if (/\bsenior\b|\bsr\.?\b/.test(t)) return "senior"
  if (/\bjunior\b|\bjr\.?\b|\bassociate\b|\bapm\b/.test(t)) return "junior"
  return "mid"
}

/** Does this classification fall within the seniorities the user is targeting? */
export function matchesTargetSeniority(seniority: Seniority, targets: string[]): boolean {
  if (!targets.length) return true
  if (seniority === "unknown") return true // don't silently exclude — let fit scoring flag it instead
  // "senior" target should also welcome lead/principal/group as adjacent-or-above.
  const rank: Record<Seniority, number> = { junior: 0, mid: 1, senior: 2, lead: 3, principal: 4, group: 4, unknown: 1 }
  const minTargetRank = Math.min(...targets.map((t) => rank[t as Seniority] ?? 1))
  return rank[seniority] >= minTargetRank
}
