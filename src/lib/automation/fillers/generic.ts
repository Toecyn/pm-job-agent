import { fillByLabelOrFallback, uploadByLabelOrFallback } from "./common"
import type { FillContext, FillOutcome } from "./types"

/**
 * Greenhouse, Lever, and Ashby application forms share a very similar
 * semantic shape (name/email/phone/resume upload/free-text questions), so a
 * single label-driven filler covers all three today. Each is still exposed
 * as its own named export (greenhouse.ts/lever.ts/ashby.ts) so a future
 * platform-specific quirk (e.g. a multi-step wizard) can diverge without
 * touching the others — see ARCHITECTURE.md §4.
 */
export async function fillGenericAtsForm(ctx: FillContext): Promise<FillOutcome> {
  const filled: string[] = []
  const unfilled: string[] = []
  const { page } = ctx

  const attempts: [string, () => Promise<{ filled: boolean }>][] = [
    ["full_name", () => fillByLabelOrFallback(page, [/^name$/i, "full name"], ctx.fullName, ['input[name*="name" i]'])],
    ["first_name", () => fillByLabelOrFallback(page, ["first name"], ctx.firstName, ['input[name*="first" i]'])],
    ["last_name", () => fillByLabelOrFallback(page, ["last name"], ctx.lastName, ['input[name*="last" i]'])],
    ["email", () => fillByLabelOrFallback(page, ["email"], ctx.email, ['input[type="email"]', 'input[name*="email" i]'])],
    ["phone", () => (ctx.phone ? fillByLabelOrFallback(page, ["phone"], ctx.phone, ['input[type="tel"]', 'input[name*="phone" i]']) : Promise.resolve({ filled: false }))],
    ["linkedin", () => (ctx.linkedinUrl ? fillByLabelOrFallback(page, [/linkedin/i], ctx.linkedinUrl, ['input[name*="linkedin" i]']) : Promise.resolve({ filled: false }))],
    ["portfolio", () => (ctx.portfolioUrl ? fillByLabelOrFallback(page, [/portfolio|website/i], ctx.portfolioUrl, ['input[name*="website" i]']) : Promise.resolve({ filled: false }))],
    ["location", () => (ctx.location ? fillByLabelOrFallback(page, [/location|current location|city/i], ctx.location, []) : Promise.resolve({ filled: false }))],
  ]

  for (const [field, attempt] of attempts) {
    const result = await attempt()
    if (result.filled) filled.push(field)
    else unfilled.push(field)
  }

  const resumeResult = await uploadByLabelOrFallback(page, [/resume|cv/i], ctx.cvFilePath)
  if (resumeResult.filled) filled.push("resume_upload")
  else unfilled.push("resume_upload")

  if (ctx.coverLetterText) {
    const clTextarea = await fillByLabelOrFallback(page, [/cover letter/i], ctx.coverLetterText, ['textarea[name*="cover" i]'])
    if (clTextarea.filled) filled.push("cover_letter")
    else unfilled.push("cover_letter")
  }

  for (const { question, answer } of ctx.answers) {
    const result = await fillByLabelOrFallback(page, [question, new RegExp(question.slice(0, 30), "i")], answer)
    if (result.filled) filled.push(`question:${question}`)
    else unfilled.push(`question:${question}`)
  }

  return { filledFields: filled, unfilledFields: unfilled }
}
