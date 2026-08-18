/**
 * Every "enum-like" field in the schema is modeled as a plain string column
 * (see prisma/schema.prisma header note on SQLite/Postgres portability).
 * This file is the single source of truth for the allowed values, validated
 * at the application boundary with zod rather than the database.
 */
import { z } from "zod"

export const jobTitleFamilies = [
  "product_manager",
  "senior_product_manager",
  "product_lead",
  "senior_product_lead",
  "principal_product_manager",
  "group_product_manager",
  "product_owner",
  "technical_product_manager",
  "data_product_manager",
  "ai_product_manager",
  "platform_product_manager",
  "digital_product_manager",
  "product_strategy",
  "other_related",
] as const
export const JobTitleFamily = z.enum(jobTitleFamilies)
export type JobTitleFamily = z.infer<typeof JobTitleFamily>

export const seniorityLevels = [
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
  "group",
  "unknown",
] as const
export const Seniority = z.enum(seniorityLevels)
export type Seniority = z.infer<typeof Seniority>

export const remoteStatuses = ["remote", "hybrid", "onsite", "unknown"] as const
export const RemoteStatus = z.enum(remoteStatuses)
export type RemoteStatus = z.infer<typeof RemoteStatus>

export const employmentTypes = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "unknown",
] as const
export const EmploymentType = z.enum(employmentTypes)
export type EmploymentType = z.infer<typeof EmploymentType>

export const confidenceLevels = ["known", "unknown"] as const
export const Confidence = z.enum(confidenceLevels)
export type Confidence = z.infer<typeof Confidence>

export const evidenceTypes = [
  "job",
  "responsibility",
  "achievement",
  "metric",
  "leadership",
  "technical",
  "ai",
  "data",
  "analytics",
  "discovery",
  "delivery",
  "experimentation",
  "customer_research",
  "roadmap",
  "gtm",
  "executive_comm",
  "failure_recovery",
  "certification",
  "award",
  "publication",
  "education",
  "project",
] as const
export const EvidenceType = z.enum(evidenceTypes)
export type EvidenceType = z.infer<typeof EvidenceType>

export const fitBands = ["exceptional", "strong", "good", "possible", "do_not_apply"] as const
export const FitBand = z.enum(fitBands)
export type FitBand = z.infer<typeof FitBand>

export const applicationStatuses = [
  "DISCOVERED",
  "ANALYZED",
  "SCORED",
  "SHORTLISTED",
  "CV_TAILORED",
  "APPLICATION_PREPARED",
  "AWAITING_APPROVAL",
  "APPLIED",
  "ASSESSMENT",
  "RECRUITER_SCREEN",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "GHOSTED",
] as const
export const ApplicationStatus = z.enum(applicationStatuses)
export type ApplicationStatus = z.infer<typeof ApplicationStatus>

export const approvalModes = ["MANUAL", "REVIEW", "AUTO"] as const
export const ApprovalMode = z.enum(approvalModes)
export type ApprovalMode = z.infer<typeof ApprovalMode>

export const approvalDecisions = [
  "approve",
  "reject",
  "edit",
  "skip",
  "blacklist_company",
  "blacklist_role",
] as const
export const ApprovalDecisionKind = z.enum(approvalDecisions)
export type ApprovalDecisionKind = z.infer<typeof ApprovalDecisionKind>

// Sensitive/legally-consequential question categories (brief §17). Never
// auto-answered without a PredefinedAnswer on file or explicit approval.
export const sensitiveCategories = [
  "disability",
  "medical",
  "race_ethnicity",
  "gender_identity",
  "veteran_status",
  "criminal_history",
  "immigration_status",
  "work_authorization",
  "sponsorship",
  "salary_expectation",
  "relocation",
  "security_clearance",
] as const
export const SensitiveCategory = z.enum(sensitiveCategories)
export type SensitiveCategory = z.infer<typeof SensitiveCategory>

export const sourceIds = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "smartrecruiters",
  "manual-import",
  "mock",
  "linkedin",
  "indeed",
  "jobberman",
  "wellfound",
  "otta",
  "google-jobs",
] as const
export const SourceId = z.enum(sourceIds)
export type SourceId = z.infer<typeof SourceId>

// Sources whose ToS/anti-bot posture (or, for Jobberman, simple absence of
// any public search API) means we never automate discovery or submission
// there — see ARCHITECTURE.md §4 and §15.
export const nonAutomatableSources: readonly string[] = [
  "linkedin",
  "indeed",
  "jobberman",
  "wellfound",
  "otta",
  "google-jobs",
]

export const cvVariantKeys = [
  "master",
  "general_pm",
  "senior_pm",
  "ai_pm",
  "data_pm",
  "technical_pm",
  "product_strategy",
] as const
export const CvVariantKey = z.enum(cvVariantKeys)
export type CvVariantKey = z.infer<typeof CvVariantKey>

export const notificationTypes = [
  "new_exceptional_match",
  "application_ready_for_approval",
  "application_submitted",
  "recruiter_response",
  "interview_invitation",
  "assessment_invitation",
  "follow_up_reminder",
  "agent_failure",
  "captcha_encountered",
  "authentication_required",
  "human_intervention_required",
] as const
export const NotificationType = z.enum(notificationTypes)
export type NotificationType = z.infer<typeof NotificationType>

export const workModePreferences = ["remote", "hybrid", "onsite", "any"] as const
export const WorkModePreference = z.enum(workModePreferences)
export type WorkModePreference = z.infer<typeof WorkModePreference>
