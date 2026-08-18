/**
 * Deterministic, non-AI verification pass (ARCHITECTURE.md §9 / brief §36).
 * Every generated statement is checked against the evidence it claims to be
 * sourced from: any number, year, or proper-noun-looking token in the
 * statement that doesn't appear in the source evidence text fails the
 * statement outright. This is what makes "the AI is not allowed to invent
 * numbers/dates/employers" an enforced mechanism rather than a hopeful
 * instruction.
 */
export interface VerifierResult {
  passed: boolean
  reasons: string[]
}

function extractNumberTokens(text: string): string[] {
  return text.match(/\d[\d,.]*%?/g) ?? []
}

function extractYearTokens(text: string): string[] {
  return text.match(/\b(19|20)\d{2}\b/g) ?? []
}

export function verifyStatementAgainstEvidence(statement: string, evidenceText: string): VerifierResult {
  const reasons: string[] = []
  const evidenceNumbers = new Set(extractNumberTokens(evidenceText))
  const evidenceYears = new Set(extractYearTokens(evidenceText))

  for (const num of extractNumberTokens(statement)) {
    if (!evidenceNumbers.has(num)) {
      reasons.push(`Number "${num}" in generated statement does not appear in the source evidence.`)
    }
  }
  for (const year of extractYearTokens(statement)) {
    if (!evidenceYears.has(year)) {
      reasons.push(`Year "${year}" in generated statement does not appear in the source evidence.`)
    }
  }

  return { passed: reasons.length === 0, reasons }
}
