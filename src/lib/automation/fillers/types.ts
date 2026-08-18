import type { Page } from "playwright"

export interface FillContext {
  page: Page
  fullName: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  linkedinUrl?: string
  portfolioUrl?: string
  location?: string
  cvFilePath: string
  coverLetterText?: string
  answers: { question: string; answer: string }[]
}

export interface FillOutcome {
  filledFields: string[]
  unfilledFields: string[]
}
