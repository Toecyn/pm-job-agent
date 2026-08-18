import { nonAutomatableSources } from "@/lib/types/enums"
import { greenhouseAdapter } from "./greenhouse"
import { leverAdapter } from "./lever"
import { ashbyAdapter } from "./ashby"
import { workableAdapter } from "./workable"
import { smartRecruitersAdapter } from "./smartrecruiters"
import { manualImportAdapter } from "./manualImport"
import { mockAdapter } from "./mock"
import type { JobSourceAdapter } from "./types"

/**
 * The single place a new adapter gets wired in (ARCHITECTURE.md §4). Search
 * orchestration (src/lib/search) iterates `pollableAdapters` and never
 * imports a concrete adapter module directly.
 */
export const adapterRegistry: Record<string, JobSourceAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
  workable: workableAdapter,
  smartrecruiters: smartRecruitersAdapter,
  "manual-import": manualImportAdapter,
  mock: mockAdapter,
}

/** Adapters a scheduled search run should actually poll (manual-import is user-triggered only). */
export const pollableAdapters: JobSourceAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workableAdapter,
  smartRecruitersAdapter,
  mockAdapter,
]

/**
 * Sources we deliberately never automate (brief §3) — surfaced in the
 * Settings > Sources UI purely so the user understands *why*, with a link to
 * use Manual Import instead. Not real adapters; not registered above.
 */
export const explainedNonAutomatableSources = nonAutomatableSources.map((id) => ({
  id,
  reason:
    "Requires an authenticated session and/or is protected by anti-bot systems; automating discovery or " +
    "submission would violate its Terms of Service. Use Manual Import to paste a job you found there yourself.",
}))
