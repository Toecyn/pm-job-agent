-- CreateTable
CREATE TABLE "candidate_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "portfolioUrl" TEXT,
    "githubUrl" TEXT,
    "linkedinUrl" TEXT,
    "workAuthorizationEnc" TEXT,
    "preferredCountriesJson" TEXT NOT NULL DEFAULT '[]',
    "preferredCitiesJson" TEXT NOT NULL DEFAULT '[]',
    "workModePreference" TEXT NOT NULL DEFAULT 'any',
    "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
    "yearsExperience" REAL,
    "currentRole" TEXT,
    "currentCompany" TEXT,
    "previousRolesJson" TEXT NOT NULL DEFAULT '[]',
    "industriesJson" TEXT NOT NULL DEFAULT '[]',
    "productAreasJson" TEXT NOT NULL DEFAULT '[]',
    "technicalSkillsJson" TEXT NOT NULL DEFAULT '[]',
    "pmSkillsJson" TEXT NOT NULL DEFAULT '[]',
    "dataSkillsJson" TEXT NOT NULL DEFAULT '[]',
    "aiMlExperienceJson" TEXT NOT NULL DEFAULT '[]',
    "leadershipJson" TEXT NOT NULL DEFAULT '[]',
    "educationJson" TEXT NOT NULL DEFAULT '[]',
    "certificationsJson" TEXT NOT NULL DEFAULT '[]',
    "preferredCompEnc" TEXT,
    "noticePeriodDays" INTEGER,
    "availability" TEXT,
    "targetSeniorityJson" TEXT NOT NULL DEFAULT '[]',
    "targetCompanySizeJson" TEXT NOT NULL DEFAULT '[]',
    "targetIndustriesJson" TEXT NOT NULL DEFAULT '[]',
    "companiesPrioritizeJson" TEXT NOT NULL DEFAULT '[]',
    "companiesExcludeJson" TEXT NOT NULL DEFAULT '[]',
    "masterCvRaw" TEXT,
    "masterCvFileName" TEXT,
    "masterCvParsedJson" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "career_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "company" TEXT,
    "roleTitle" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL DEFAULT '[]',
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "career_evidence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cv_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summaryTemplate" TEXT,
    "contentJson" TEXT NOT NULL,
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cv_variants_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "sizeHint" TEXT,
    "fundingStatus" TEXT,
    "description" TEXT,
    "intelJson" TEXT,
    "intelUpdatedAt" DATETIME,
    "reputationScore" INTEGER,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "prioritized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "titleFamily" TEXT NOT NULL,
    "seniority" TEXT NOT NULL DEFAULT 'unknown',
    "companyId" TEXT,
    "companyName" TEXT NOT NULL,
    "location" TEXT,
    "remoteStatus" TEXT NOT NULL DEFAULT 'unknown',
    "countriesJson" TEXT NOT NULL DEFAULT '[]',
    "salaryMin" REAL,
    "salaryMax" REAL,
    "salaryCurrency" TEXT,
    "salaryPeriod" TEXT,
    "compConfidence" TEXT NOT NULL DEFAULT 'unknown',
    "employmentType" TEXT NOT NULL DEFAULT 'unknown',
    "department" TEXT,
    "hiringManager" TEXT,
    "recruiter" TEXT,
    "applicationUrl" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "datePosted" DATETIME,
    "datePostedConfidence" TEXT NOT NULL DEFAULT 'unknown',
    "dateUpdated" DATETIME,
    "dateDiscovered" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateClosing" DATETIME,
    "description" TEXT NOT NULL,
    "requiredQualificationsJson" TEXT NOT NULL DEFAULT '[]',
    "preferredQualificationsJson" TEXT NOT NULL DEFAULT '[]',
    "responsibilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "requiredSkillsJson" TEXT NOT NULL DEFAULT '[]',
    "preferredSkillsJson" TEXT NOT NULL DEFAULT '[]',
    "industryExperienceJson" TEXT NOT NULL DEFAULT '[]',
    "educationRequirements" TEXT,
    "yearsExperienceMin" REAL,
    "yearsExperienceMax" REAL,
    "techRequirementsJson" TEXT NOT NULL DEFAULT '[]',
    "methodologiesJson" TEXT NOT NULL DEFAULT '[]',
    "leadershipRequirements" TEXT,
    "domainRequirementsJson" TEXT NOT NULL DEFAULT '[]',
    "workAuthRequirements" TEXT,
    "travelRequirements" TEXT,
    "keywordsJson" TEXT NOT NULL DEFAULT '[]',
    "atsKeywordsJson" TEXT NOT NULL DEFAULT '[]',
    "rawJson" TEXT,
    "dedupFingerprint" TEXT NOT NULL,
    "isDuplicateOfId" TEXT,
    "discardedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jobs_isDuplicateOfId_fkey" FOREIGN KEY ("isDuplicateOfId") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_source_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" TEXT,
    CONSTRAINT "job_source_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "watched_boards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "search_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "sourcesQueriedJson" TEXT NOT NULL DEFAULT '[]',
    "queriesJson" TEXT NOT NULL DEFAULT '[]',
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "jobsNew" INTEGER NOT NULL DEFAULT 0,
    "jobsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "jobsDiscarded" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" TEXT NOT NULL DEFAULT '[]',
    "discardedJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "job_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "fitBreakdownJson" TEXT NOT NULL,
    "fitBand" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "qualityBreakdownJson" TEXT NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "priorityBreakdownJson" TEXT NOT NULL,
    "reasonsJson" TEXT NOT NULL DEFAULT '[]',
    "concernsJson" TEXT NOT NULL DEFAULT '[]',
    "scoredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_scores_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tailored_cvs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "baseVariantKey" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "renderedText" TEXT NOT NULL,
    "atsScore" INTEGER,
    "atsBreakdownJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tailored_cvs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tailored_cvs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cv_bullet_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tailoredCvId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "bulletText" TEXT NOT NULL,
    "sourceEvidenceIdsJson" TEXT NOT NULL,
    "primaryEvidenceId" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'verified',
    "verifierPassed" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "cv_bullet_sources_tailoredCvId_fkey" FOREIGN KEY ("tailoredCvId") REFERENCES "tailored_cvs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cv_bullet_sources_primaryEvidenceId_fkey" FOREIGN KEY ("primaryEvidenceId") REFERENCES "career_evidence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cover_letters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "wasNeeded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cover_letters_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cover_letters_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "tailoredCvId" TEXT,
    "coverLetterId" TEXT,
    "validationJson" TEXT,
    "validationPassed" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT,
    "approvalMode" TEXT,
    "automationStateJson" TEXT,
    "submittedAt" DATETIME,
    "appliedVia" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applications_tailoredCvId_fkey" FOREIGN KEY ("tailoredCvId") REFERENCES "tailored_cvs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "applications_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "cover_letters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "application_status_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_status_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "application_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "wasUserProvided" BOOLEAN NOT NULL DEFAULT false,
    "charLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_answers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "application_answer_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    CONSTRAINT "application_answer_sources_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "application_answers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "application_answer_sources_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "career_evidence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_decisions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "suggestedMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "follow_ups_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interview_prep_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interview_prep_packages_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metaJson" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "predefined_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "jobTitlesJson" TEXT NOT NULL DEFAULT '[]',
    "titleSynonymsJson" TEXT NOT NULL DEFAULT '{}',
    "targetSenioritiesJson" TEXT NOT NULL DEFAULT '["mid","senior"]',
    "minFitScore" INTEGER NOT NULL DEFAULT 60,
    "minQualityScore" INTEGER NOT NULL DEFAULT 0,
    "fitThresholdsJson" TEXT NOT NULL DEFAULT '{"exceptional":90,"strong":80,"good":70,"possible":60}',
    "fitWeightsJson" TEXT NOT NULL DEFAULT '{}',
    "qualityWeightsJson" TEXT NOT NULL DEFAULT '{}',
    "priorityWeightsJson" TEXT NOT NULL DEFAULT '{}',
    "locationsJson" TEXT NOT NULL DEFAULT '[]',
    "countriesJson" TEXT NOT NULL DEFAULT '[]',
    "remotePreference" TEXT NOT NULL DEFAULT 'any',
    "industriesJson" TEXT NOT NULL DEFAULT '[]',
    "approvalMode" TEXT NOT NULL DEFAULT 'REVIEW',
    "autoApplyMinFit" INTEGER NOT NULL DEFAULT 90,
    "autoApplyMinQuality" INTEGER NOT NULL DEFAULT 80,
    "initialWindowDays" INTEGER NOT NULL DEFAULT 7,
    "overlapMinutes" INTEGER NOT NULL DEFAULT 45,
    "searchFrequencyCron" TEXT NOT NULL DEFAULT '0 7 * * *',
    "notificationPrefsJson" TEXT NOT NULL DEFAULT '{"channels":["dashboard"]}',
    "aiProvider" TEXT NOT NULL DEFAULT 'null',
    "aiModel" TEXT NOT NULL DEFAULT '',
    "coverLetterPreference" TEXT NOT NULL DEFAULT 'if_required',
    "followUpDelayDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profiles_email_key" ON "candidate_profiles"("email");

-- CreateIndex
CREATE INDEX "career_evidence_profileId_idx" ON "career_evidence"("profileId");

-- CreateIndex
CREATE INDEX "career_evidence_evidenceType_idx" ON "career_evidence"("evidenceType");

-- CreateIndex
CREATE UNIQUE INDEX "cv_variants_profileId_key_key" ON "cv_variants"("profileId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "jobs_titleFamily_idx" ON "jobs"("titleFamily");

-- CreateIndex
CREATE INDEX "jobs_source_idx" ON "jobs"("source");

-- CreateIndex
CREATE INDEX "jobs_datePosted_idx" ON "jobs"("datePosted");

-- CreateIndex
CREATE INDEX "jobs_dedupFingerprint_idx" ON "jobs"("dedupFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "job_source_records_source_sourceJobId_key" ON "job_source_records"("source", "sourceJobId");

-- CreateIndex
CREATE UNIQUE INDEX "watched_boards_source_token_key" ON "watched_boards"("source", "token");

-- CreateIndex
CREATE UNIQUE INDEX "job_scores_jobId_key" ON "job_scores"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_jobId_profileId_key" ON "applications"("jobId", "profileId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
