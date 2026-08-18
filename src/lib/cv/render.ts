import type { CvContent } from "./types"

/**
 * Renders the structured CV to a plain-text, ATS-friendly document (brief
 * §10): no tables, no icons, no columns/graphics that confuse resume
 * parsers. Section headers are plain uppercase lines; nothing here depends
 * on visual layout to convey meaning.
 */
export function renderCvText(cv: CvContent): string {
  const lines: string[] = []
  lines.push(cv.fullName)
  const contactLine = [cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedinUrl, cv.contact.portfolioUrl, cv.contact.githubUrl]
    .filter(Boolean)
    .join(" | ")
  lines.push(contactLine)
  lines.push("")

  lines.push("PROFESSIONAL SUMMARY")
  lines.push(cv.summary)
  lines.push("")

  if (cv.coreCompetencies.length) {
    lines.push("CORE COMPETENCIES")
    lines.push(cv.coreCompetencies.join(" | "))
    lines.push("")
  }

  const allSkills = [...cv.skills.pm, ...cv.skills.technical, ...cv.skills.data, ...cv.skills.ai, ...cv.skills.leadership]
  if (allSkills.length) {
    lines.push("SKILLS")
    lines.push(allSkills.join(", "))
    lines.push("")
  }

  if (cv.experience.length) {
    lines.push("EXPERIENCE")
    for (const exp of cv.experience) {
      lines.push(`${exp.roleTitle} — ${exp.company}`)
      const dateRange = `${exp.startDate ?? "Unknown"} – ${exp.endDate ?? "Present"}`
      lines.push(dateRange)
      for (const bullet of exp.bullets) {
        lines.push(`• ${bullet.text}`)
      }
      lines.push("")
    }
  }

  if (cv.education.length) {
    lines.push("EDUCATION")
    for (const ed of cv.education) {
      lines.push(`${ed.credential}${ed.field ? `, ${ed.field}` : ""} — ${ed.institution}${ed.graduationYear ? ` (${ed.graduationYear})` : ""}`)
    }
    lines.push("")
  }

  if (cv.certifications.length) {
    lines.push("CERTIFICATIONS")
    for (const cert of cv.certifications) {
      lines.push(`${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ""}${cert.year ? ` (${cert.year})` : ""}`)
    }
  }

  return lines.join("\n").trim()
}
