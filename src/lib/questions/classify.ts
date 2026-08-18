import { SensitiveCategory, type SensitiveCategory as SensitiveCategoryType } from "@/lib/types/enums"

/** Application Question Engine, step 1: classify (brief §14, §17). */
const SENSITIVE_PATTERNS: [SensitiveCategoryType, RegExp][] = [
  ["disability", /\bdisabilit(y|ies)\b|\bdisabled\b/i],
  ["medical", /medical condition|health condition|medical history/i],
  ["race_ethnicity", /\brace\b|ethnicity|ethnic background|racial/i],
  ["gender_identity", /gender identity|\bpronouns?\b|\btransgender\b/i],
  ["veteran_status", /\bveteran\b|military service/i],
  ["criminal_history", /criminal (record|history|background)|felony|misdemeanor|convicted/i],
  ["immigration_status", /immigration status|citizenship status|\bvisa status\b/i],
  ["work_authorization", /authorized to work|work authorization|legally (eligible|permitted) to work|right to work/i],
  ["sponsorship", /require sponsorship|visa sponsorship|sponsor(ship)? (now or in the future)?/i],
  ["salary_expectation", /salary expectation|compensation expectation|desired salary|expected salary|salary range you.?re looking/i],
  ["relocation", /willing(ness)? to relocate|open to relocat/i],
  ["security_clearance", /security clearance|clearance level|\bts\/sci\b/i],
]

export interface QuestionClassification {
  isSensitive: boolean
  category?: SensitiveCategoryType
}

export function classifyQuestion(question: string): QuestionClassification {
  for (const [category, pattern] of SENSITIVE_PATTERNS) {
    if (pattern.test(question)) return { isSensitive: true, category }
  }
  return { isSensitive: false }
}

export const sensitiveCategoryList = SensitiveCategory.options
