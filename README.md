# PM Job Search & Application Agent

A personal, modular, extensible AI agent that discovers Product Management job
opportunities, scores them against your real profile and career evidence,
tailors your CV and application materials, and manages the application
pipeline through a human-approval checkpoint — built to the spec in the
project brief. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design
doc (component map, data model, scoring algorithms, state machine, security
boundaries) written before implementation began.

## What's actually implemented

Everything in the brief's Phase 1-4 scope is built and working end to end,
verified both by an automated test suite and by driving the running app
through a full discover → score → tailor → approve → apply cycle:

- **Discovery**: real adapters for Greenhouse, Lever, and Ashby's public job-board
  APIs, plus a Manual Import adapter (paste a URL, robots.txt-checked fetch)
  for every source that can't ethically be automated (LinkedIn, Indeed,
  Wellfound, Otta, Google Jobs — see `ARCHITECTURE.md` §4 for why).
- **Normalization, dedup, scoring**: semantic title matching, cross-source
  duplicate detection, and three independent 0-100 scores (Fit, Quality,
  Priority) with full, inspectable component breakdowns.
- **CV tailoring, cover letters, application Q&A**: every generated bullet
  traces back to a real `CareerEvidence` row, is mechanically re-verified
  against that evidence (no invented numbers/dates/employers), and sensitive
  questions (§17) are only ever answered from a predefined answer you set —
  never auto-generated.
- **Application pipeline**: explicit state machine, pre-submission validator,
  human approval screen (Approve/Reject/Edit/Skip/Blacklist), and a real
  Playwright browser-automation agent for Greenhouse/Lever/Ashby forms
  (off by default — see [Browser automation](#browser-automation) below).
- **Company intelligence, interview prep, follow-ups, analytics, learning
  suggestions, notifications, audit trail** — all working, all in the
  dashboard.

Read `ARCHITECTURE.md` §15 for the short, explicit list of what's
intentionally **not** built (LinkedIn/Indeed scraping, CAPTCHA bypass, live
Slack/Telegram delivery) and why.

## Quick start

Requires Node.js 20.9+ and a PostgreSQL database (required — see
`ARCHITECTURE.md` §5; serverless hosts like Vercel have no writable/
persistent filesystem, so this can't default to a local SQLite file). Zero
accounts/Docker needed for local dev though — `npm run db:local-postgres`
runs a real Postgres binary for you.

```bash
npm install
cp .env.example .env

# In a second terminal, leave this running:
npm run db:local-postgres

npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. First visit creates your password (brief §51
step 1) using the `AUTH_USER_EMAIL` from `.env`, then walks you through the
onboarding profile wizard — or, since `npm run db:seed` already created an
example profile + career evidence + settings, you can skip straight to the
dashboard and edit everything from Settings / Career Evidence instead.

Prefer Docker, or already have a Postgres instance (Neon, Vercel Postgres,
Supabase, your own)? Skip `db:local-postgres` and point `DATABASE_URL` in
`.env` at it instead — that's also what you'll set as an environment
variable in your Vercel project for a real deployment.

### Seeing real jobs

Add company board tokens on **Settings → Job sources**:

- **Greenhouse**: the token in `boards.greenhouse.io/<token>`
- **Lever**: the org slug in `jobs.lever.co/<org>`
- **Ashby**: the org name in `jobs.ashbyhq.com/<org>`
- **Workable**: the account slug in `apply.workable.com/<account>`
- **SmartRecruiters**: the company identifier in `jobs.smartrecruiters.com/<company>` (only works for companies with the public postings feed enabled)

Then click **Run search now**. For boards without a public search API —
LinkedIn, Indeed, Jobberman, Wellfound, Otta, Google Jobs, or literally any
other company career page — use **Manual Import** instead (paste the job URL;
works for a single page you found yourself, including a login-walled listing
your browser can already load).

### Trying it without any real company boards configured

Set `MOCK_SOURCE_ENABLED=true` in `.env` and click **Run search now** — this
feeds the 11-posting fixture set from `src/lib/sources/mock.ts` through the
real pipeline (the same fixtures the automated end-to-end test uses). Turn it
back off before using the app for a real job search.

## AI provider (optional)

The app works fully offline with deterministic templates (`AI_PROVIDER=null`,
the default). For higher-quality CV/cover-letter/answer prose, set:

```bash
AI_PROVIDER="openai"        # or "anthropic"
OPENAI_API_KEY="sk-..."     # or ANTHROPIC_API_KEY
```

Nothing is hardcoded to one provider — see `src/lib/ai/provider.ts`.

## Human approval modes

Default is **REVIEW**: the agent prepares everything (CV, cover letter,
answers) and waits for you to click Approve before anything is submitted.
Change this on **Settings → Human approval mode**:

- `MANUAL` — prepares materials, never submits anything automatically.
- `REVIEW` — fills/prepares, waits for your approval (default).
- `AUTO` — submits automatically, but *only* for applications that pass all
  of: fit ≥ your configured threshold, quality ≥ your configured threshold,
  the source is automatable, no unresolved sensitive question, and the
  company isn't excluded.

## Browser automation

`src/lib/automation/` contains a real Playwright agent (semantic
label-based field filling with selector fallbacks, CAPTCHA/login-wall
detection, resumable per-application state, screenshot-on-pause) for
Greenhouse/Lever/Ashby application forms. It's disabled by default
(`AUTOMATION_ENABLED=false`) because it needs Playwright's Chromium binary
installed (`npx playwright install chromium`) and a live target application
page — the automated test suite exercises its logic (detectors, state
persistence, field-filling strategy) with fakes rather than a real browser,
which is why this code is real but not run end-to-end in CI. To try it for
real: install the browser, set `AUTOMATION_ENABLED=true`, prepare and approve
an application, then click "Run browser automation" on the application page.

## Scheduling

```bash
npm run search:run
```

runs one search cycle (and surfaces due follow-up reminders) and is meant to
be invoked by an external scheduler — OS cron, Windows Task Scheduler, or a
Docker cron sidecar — rather than an in-process timer (see the comment at the
top of `scripts/runSearchOnce.ts` for why). Example crontab entry:

```
0 7 * * *  cd /path/to/pm-job-agent && npm run search:run >> /var/log/pm-job-agent.log 2>&1
```

## Testing

```bash
npm run typecheck
npm run lint
npm test
```

`npm test` runs the full suite (84 tests, `src/tests/*.test.ts`) against a
dedicated, fully ephemeral Postgres instance that spins up and tears down
automatically for the test run (`src/tests/globalSetup.ts`, via the same
`embedded-postgres` package as `db:local-postgres` — no separate database
needed to run tests), covering deduplication, the 24h/initial search
window logic, fit/quality/priority scoring (including the "missing a
preferred qualification never zeroes the score" and "missing a required
qualification is flagged, not auto-rejected" rules), CV tailoring + evidence
traceability, the anti-hallucination verifier, the sensitive-question
gating, the application state machine, duplicate-application prevention,
application validation, authentication, and CAPTCHA/login-wall/layout-change
detection — plus a single comprehensive **`src/tests/e2e.simulate.test.ts`**
that runs the 11-posting fixture set (duplicates, mixed seniority/industry/
location, missing salary, conflicting requirements, a poor-fit role, an
exceptional-fit role, a missing-qualification role, and a work-authorization
blocker) through the entire real pipeline and asserts every stage behaves
correctly — this is the brief §53 acceptance test.

## Deploying to Vercel

1. Provision a Postgres database (Vercel Postgres, Neon, and Supabase all
   have generous free tiers) and copy its connection string.
2. In the Vercel project's Settings → Environment Variables, set at minimum:
   `DATABASE_URL`, `AUTH_USER_EMAIL`, `NEXTAUTH_SECRET` (a long random
   string), `ENCRYPTION_KEY` (`openssl rand -hex 32`). Everything else in
   `.env.example` is optional.
3. Deploy. `npm run build` (`prisma generate && next build`) runs
   automatically — every page that touches the database is marked
   `dynamic = "force-dynamic"`, so the build itself never needs DB access,
   only the running app does.
4. Run `npx prisma migrate deploy` once against the production
   `DATABASE_URL` (locally, or as a one-off Vercel deployment step) to
   create the schema, then visit the deployed URL to set your password and
   complete onboarding.
5. Browser automation (`AUTOMATION_ENABLED`) won't work on Vercel — Chromium
   isn't installed and serverless functions have execution time limits
   unsuited to a real browser session. Leave it `false` there; run it from a
   normal server/container instead if you want it.

## Docker

```bash
docker compose up --build
```

Runs the app plus a Postgres container together — nothing else required.

## Project structure

```
prisma/schema.prisma       Database schema (PostgreSQL)
prisma/seed.ts              Example candidate profile + career evidence + settings
scripts/localPostgres.ts    Zero-install local Postgres for dev (npm run db:local-postgres)
src/lib/sources/            Job source adapters + registry
src/lib/normalize/          Title taxonomy, requirement extraction, normalizer
src/lib/dedup/               Cross-source duplicate detection
src/lib/scoring/             Fit / Quality / Priority scoring engines
src/lib/ai/                  Provider-agnostic AI abstraction (OpenAI/Anthropic/null)
src/lib/cv/                  CV tailoring, ATS analysis, evidence-verified bullets
src/lib/coverletter/         Cover letter generation
src/lib/questions/           Application question engine + sensitive-question gating
src/lib/tracker/             Application state machine, approval decisions
src/lib/validation/          Pre-submission validator
src/lib/automation/          Playwright browser-automation agent
src/lib/companyIntel/        Company intelligence gathering
src/lib/interviewPrep/       Interview prep package generation
src/lib/followup/            Follow-up reminder engine
src/lib/learning/            Advisory-only outcome analytics/suggestions
src/lib/notifications/       Notification service + channels
src/lib/search/              Search orchestration (Discover → Analyze → Score)
src/lib/pipeline/            Full per-job Prepare pipeline
src/app/(app)/               Authenticated dashboard pages
src/app/_actions/            Server Actions wiring the UI to the lib layer
src/tests/                   Vitest suite, including the end-to-end simulation
scripts/                     Standalone CLI entry points (scheduler, seed helpers)
```

## Security notes

- Work authorization details and compensation expectations are encrypted at
  rest (AES-256-GCM) — see `src/lib/security/crypto.ts`. Set a real
  `ENCRYPTION_KEY` (`openssl rand -hex 32`) before storing real data.
- The dashboard is behind a single-user password login (`src/proxy.ts` +
  `src/lib/auth/`) — set `AUTH_USER_EMAIL` and create a password on first
  visit, or via `npm run auth:set-password -- "your-password"`.
- Full audit trail on **Agent Logs** for every discovery, score, generation,
  approval, and submission (brief §32).

## License

Personal-use project generated for the repository owner; no license file is
included.
