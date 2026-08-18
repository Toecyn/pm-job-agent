# Architecture — PM Job Search & Application Agent

## 0. What this document is

This is the architecture and implementation plan for a modular, extensible personal
Product Management job-search agent, written **before** the bulk of the implementation,
per the development method in the project brief. It stays in the repo as the source of
truth for how the pieces fit together.

## 1. Design principles

1. **Modular over monolithic.** Every capability (source adapter, scorer, tailoring
   engine, automation agent) is an independent module behind a narrow interface. Nothing
   reaches into another module's internals.
2. **Evidence-based, never fabricated.** CVs, cover letters and answers are assembled
   only from statements that trace back to a row in the Career Evidence database. See
   [§9 Anti-hallucination](#9-anti-hallucination--evidence-traceability).
3. **Human-in-the-loop by default.** No application is ever submitted without a human
   approval step unless the user explicitly turns on `AUTO` mode for rules-qualified,
   low-risk applications (§8).
4. **Legal/ethical scraping only.** Adapters either use a documented public API (Greenhouse,
   Lever, Ashby, SmartRecruiters, Workable job boards all publish public JSON endpoints
   for their customers' postings), or degrade to a "manual import" mode that fetches a
   single page the user explicitly pointed at, or ask the user to paste a job. We do not
   build LinkedIn/Indeed login-wall scraping or CAPTCHA bypassing — see
   [§4 Source adapters](#4-job-source-adapters).
5. **Everything is auditable.** Every discovery, score, generated document and state
   change is written to an append-only `AuditLog`.
6. **Config over code.** Job titles, thresholds, weights, locations, and automation
   rules live in the `Settings`/`CandidateProfile` tables and are editable from the
   dashboard, not hardcoded.

## 2. Phased delivery (per brief §44)

| Phase | Scope | Status in this build |
|---|---|---|
| 1 | Candidate profile, master CV, career evidence DB, job search, normalization, dedup, scoring, dashboard, search history | **Built** |
| 2 | CV tailoring, cover letters, application question engine, application tracking | **Built** |
| 3 | Playwright automation, human approval workflow, submission | **Built** (Greenhouse/Lever/Ashby form-fill; approval checkpoint; manual-apply hand-off for closed platforms) |
| 4 | Company intelligence, interview prep, analytics, learning system, notifications | **Built** (rule-based learning + pluggable notification channels; company intel uses AI-provider abstraction over public info only) |

## 3. High-level component map

```
                                   +---------------------+
                                   |     Scheduler        |
                                   | (search-window calc) |
                                   +----------+-----------+
                                              |
                                              v
+--------------+     +-----------------+     +------------------+
| Source        | -->| Job Normalizer  | --> | Dedup Engine     |
| Adapters      |    | (title/seniority|     | (fingerprint +   |
| (Greenhouse,  |    |  taxonomy)      |     |  fuzzy match)    |
| Lever, Ashby, |    +-----------------+     +--------+---------+
| ManualImport, |                                     |
| Mock/demo)    |                                     v
+--------------+                            +-------------------+
                                             | Job Analyzer      |
                                             | (JD -> structured |
                                             |  requirements)    |
                                             +--------+----------+
                                                      v
        +-----------------------------+     +-------------------+
        | Candidate Profile Service    |<--->| Fit Scoring Engine|
        | Career Evidence Store        |     | Quality Scoring   |
        +-----------------------------+     | Priority Scoring   |
                                             +--------+----------+
                                                      v
                                          (score >= review threshold)
                                                      v
+-------------+   +-------------+   +----------------------+   +--------------------+
| CV Tailoring| ->| Cover Letter| ->| Application Question | ->| Application         |
| Agent       |   | Agent       |   | Agent                |   | Validator           |
+-------------+   +-------------+   +----------------------+   +---------+----------+
                                                                          v
                                                              +-----------------------+
                                                              | Human Approval Service|
                                                              | (MANUAL/REVIEW/AUTO)  |
                                                              +-----------+-----------+
                                                                          v
                                                              +-----------------------+
                                                              | Browser Automation    |
                                                              | Agent (Playwright)    |
                                                              +-----------+-----------+
                                                                          v
                                                              +-----------------------+
                                                              | Application Tracker   |
                                                              | (state machine)       |
                                                              +-----------------------+

Cross-cutting: Notification Service, Audit Logger, Analytics Engine, Learning System,
Company Intelligence Agent, Interview Preparation Agent.
```

## 4. Job source adapters

Each adapter implements the `JobSourceAdapter` interface (`src/lib/sources/types.ts`):

```ts
interface JobSourceAdapter {
  id: string                 // "greenhouse", "lever", "ashby", "manual-import", "mock"
  displayName: string
  automatable: boolean       // can we submit applications programmatically here?
  legalBasis: string         // one-line note on why this adapter is allowed
  search(params: SourceSearchParams): Promise<RawJobPosting[]>
}
```

| Adapter | Mechanism | Status |
|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs` — public documented API | **Implemented, real** |
| Lever | `api.lever.co/v0/postings/{org}?mode=json` — public documented API | **Implemented, real** |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{org}` — public documented API | **Implemented, real** |
| Manual Import | User pastes a job URL; adapter fetches that single page (respecting `robots.txt`) and an AI extraction step structures it | **Implemented, real** |
| Mock/demo | Deterministic fixture generator used for seeding and the end-to-end test | **Implemented, real** |
| LinkedIn / Indeed / Wellfound / Otta / Google Jobs | Require authenticated sessions, are explicitly disallowed by ToS from automated scraping, and are behind anti-bot systems | **Not automated.** The adapter interface has stub entries that return `NotAutomatable` and point the user at the search URL to paste results via Manual Import instead. This is a deliberate, permanent decision, not a TODO. |

Adding a new adapter = implementing the interface and registering it in
`src/lib/sources/registry.ts`. No other code changes needed.

## 5. Data model

See `prisma/schema.prisma` for the full, authoritative schema. Summary of major entities:

- `CandidateProfile` — the single persistent profile (§4 of brief).
- `CareerEvidence` — atomic, tagged achievements (§5). Every CV bullet and question
  answer stores a foreign key back to the `CareerEvidence` row(s) it was built from.
- `Job` — normalized job postings (§6), with a `JobSourceRecord` per source that
  discovered it (supports cross-source dedup, §18).
- `SearchRun` — one row per search execution (§2, §41): timestamps, window used,
  sources queried, counts, errors.
- `JobScore` — fit score, quality score, priority score + component breakdowns (§7-9).
- `TailoredCV` — generated CV variant for a job, with an evidence-traceable
  `CvBulletSource[]` join table (§36).
- `CoverLetter`, `ApplicationAnswer` — generated materials (§13-14).
- `Application` — the state-machine entity (§19), one per (profile, job).
- `ApprovalDecision` — human approve/reject/edit/skip/blacklist actions (§16).
- `CompanyIntel`, `InterviewPrepPackage` — Phase 4 artifacts.
- `AuditLog` — append-only.
- `Settings` — all configurable thresholds/weights/titles/locations (§43).

**Database engine note:** the brief's preferred stack is PostgreSQL, and this build
uses it exclusively — not SQLite. An earlier revision of this project defaulted to a
local SQLite file for the "runnable locally" requirement (§51), but SQLite fundamentally
cannot work on serverless hosts like Vercel: their filesystem is read-only outside
`/tmp`, `/tmp` itself is ephemeral and not shared across function instances, and
concurrent invocations wouldn't share state at all. The database connects via
`@prisma/adapter-pg` (`src/lib/db/client.ts`), configured entirely through
`DATABASE_URL`. The schema still intentionally avoids Postgres-only modeling features
(native enum types, array columns) — not for portability to another provider, but
because a `String` + zod-validated-at-the-application-layer approach (see
`src/lib/types`) keeps the allowed values self-documenting in one place rather than
split between the schema and application code.

"Runnable locally" (§51) is still zero-account, zero-Docker via `npm run
db:local-postgres` (a real Postgres binary via the `embedded-postgres` devDependency —
see `scripts/localPostgres.ts`), or `docker compose up postgres` if you prefer Docker,
or point `DATABASE_URL` at any hosted Postgres (Neon, Vercel Postgres, Supabase, ...) —
the same variable Vercel needs set in its project environment variables for a real
deployment.

## 6. Job posted-date handling (brief §48)

`RawJobPosting` carries three distinct timestamps where available:
`postedAt` (source's original posting date), `updatedAt` (last-modified), and
`discoveredAt` (when *this* run found it). The normalizer never invents `postedAt`: if a
source doesn't expose it, it's stored as `null` with `postedDateConfidence: "unknown"`,
and the job is treated as **not** provably within the search window (it's kept but
flagged, never silently treated as new).

## 7. Search window logic (brief §2)

`src/lib/scheduler/window.ts::computeSearchWindow`:

```
lastSuccessfulRun = latest SearchRun where status = 'success'
if lastSuccessfulRun exists:
    windowStart = lastSuccessfulRun.completedAt - overlapMinutes   // default 45 min
else:
    windowStart = now - initialWindowDays                          // default 7 days
windowEnd = now
```

The window is passed to every adapter; adapters that can filter server-side do so,
others filter client-side after fetch. A `SearchRun` is `success` if every adapter
returned cleanly, `partial` if some but not all failed, `failed` only if the run found
zero jobs and every adapter errored. The *next* run's window anchors off the latest
`success` **or** `partial` run's `completedAt` — never `startedAt` (would drift under
slow runs) and never a `failed` run (that would silently skip a whole window). One
flaky adapter therefore never permanently widens every subsequent search (§12).

## 8. Scoring engines (brief §7-9)

Three independent, config-weighted engines in `src/lib/scoring/`:

- `fitScore.ts` — experience/seniority/skill/industry/AI-data/leadership/qualification/
  location/authorization/compensation/remote/trajectory/evidence-strength components,
  each 0-100, combined via configurable weights (`Settings.fitWeights`). Required vs.
  preferred vs. nice-to-have qualifications are scored with different weight bands and
  a missing *preferred* item only lightly penalizes; a missing *required* item caps the
  score band rather than zeroing it out (a human can still choose to apply).
- `qualityScore.ts` — company reputation/product maturity/ownership/growth/comp/
  stability/scope/career-value components.
- `priorityScore.ts` — combines fit, quality, career value, estimated application
  probability, compensation attractiveness, and strategic relevance into the ranking
  score used on the dashboard (brief §9, §40).

All raw component scores are persisted (not just the final number) so the "why this
role matches" / "potential concerns" explanations (§42) are generated from real
component data, not invented post-hoc.

## 9. Anti-hallucination & evidence traceability (brief §35-36)

- `CvTailoringAgent` and `AnswerAgent` only ever select and lightly rephrase text that
  already exists in `CareerEvidence`. The AI provider's system prompt hard-constrains it
  to that evidence set, phrased as: "cite the evidence id for every claim, never invent
  numbers/dates/titles/employers."
- Output is structured JSON: `{ statement, sourceEvidenceIds[], confidence }[]`. A
  post-generation **verifier pass** (deterministic, non-AI) checks every number/date/
  employer/title token in the generated statement appears in the cited evidence; any
  statement that fails is dropped and logged, never shown to the user as-is.
- Employment dates, titles, employers are pulled verbatim from `CareerEvidence`/profile
  records — the AI is never allowed to author these fields.
- Anything the system cannot verify is rendered as `UNKNOWN` and flagged for the human,
  never guessed (§35).

## 10. Application state machine (brief §19)

```
DISCOVERED -> ANALYZED -> SCORED -> SHORTLISTED -> CV_TAILORED -> APPLICATION_PREPARED
  -> AWAITING_APPROVAL -> APPLIED -> ASSESSMENT -> RECRUITER_SCREEN -> INTERVIEW
  -> FINAL_INTERVIEW -> OFFER
                                   \-> REJECTED / WITHDRAWN / GHOSTED  (from any stage)
```

Defined as an explicit transition table in `src/lib/tracker/stateMachine.ts` with a
guard function per edge (e.g. `APPLICATION_PREPARED -> AWAITING_APPROVAL` requires
validator to have passed). Illegal transitions throw and are logged, never silently
coerced.

## 11. Human approval modes (brief §16)

`Settings.approvalMode ∈ { MANUAL, REVIEW, AUTO }`, default `REVIEW`. `AUTO` only ever
auto-submits an application that passes **all** of: fit ≥ `autoApplyMinFit`, quality ≥
`autoApplyMinQuality`, source is `automatable`, no sensitive-question flags raised, and
company not on the exclude list. Everything else always stops at
`AWAITING_APPROVAL`. Sensitive questions (§17) are never answered by AI without a
predefined user-supplied answer on file, in any mode.

## 12. Reliability (brief §33)

- Each adapter call is isolated with try/catch + timeout; one adapter's failure is
  logged to `SearchRun.errors` and does not abort the run.
- Application automation persists an `ApplicationRunState` snapshot (current step,
  filled fields, screenshot ref) after every step, so a crash mid-application resumes
  from the last completed step rather than restarting (avoiding duplicate submits).
- CAPTCHA / login-wall detection (heuristic: known selectors, HTTP 999/403, or
  page-title match) immediately pauses the run, snapshots state, and raises a
  `HUMAN_INTERVENTION_REQUIRED` notification instead of attempting to solve it.

## 13. Security (brief §32)

- No secrets in source. `.env` (git-ignored) holds `DATABASE_URL`, `AI_PROVIDER`,
  `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`.
- Dashboard auth via NextAuth credentials (single-user) — see `src/lib/auth`.
- Sensitive candidate fields (work authorization details, compensation) are encrypted
  at rest with AES-256-GCM using `ENCRYPTION_KEY` (`src/lib/security/crypto.ts`).
- Full audit trail per §32, queryable on the **Agent Logs** dashboard page.

## 14. AI provider abstraction (brief §31)

`src/lib/ai/provider.ts` defines `AiProvider { complete(prompt, schema) }`; concrete
`OpenAiProvider` and `AnthropicProvider` implement it; `getAiProvider()` reads
`AI_PROVIDER` env var. All call sites request structured JSON via a Zod schema, never
free text, so evidence-verification (§9) is mechanical. If no API key is configured,
a `NullProvider` falls back to deterministic template-based generation so the app still
runs end-to-end offline (used in the automated e2e test, §53).

## 15. What is intentionally NOT built

- No automated LinkedIn/Indeed/Wellfound/Otta scraping or login automation — ToS +
  anti-bot restrictions (brief §3, §49 explicitly require this restraint).
- No CAPTCHA bypass of any kind.
- No auto-submission outside the guarded `AUTO` rules.
- No real Slack/Telegram delivery in this build — the `NotificationChannel` interface
  and a working `DashboardChannel` + `ConsoleChannel` are implemented; Slack/Telegram/
  Email are stub channels that log "would send" so wiring in real credentials later is a
  config change, not a rewrite.
