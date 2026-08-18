import type { RawJobPosting, SourceSearchParams } from "@/lib/types/job"

export interface SourceSearchResult {
  postings: RawJobPosting[]
  /** Non-fatal problems encountered (rate limits, one board unreachable, etc). */
  warnings: string[]
}

/**
 * The contract every job source plugs into (ARCHITECTURE.md §4). Adding a
 * new source = implement this + register it in registry.ts. Nothing else in
 * the codebase should ever import a concrete adapter directly.
 */
export interface JobSourceAdapter {
  id: string
  displayName: string
  /** Can we (legally/technically) submit an application here programmatically? */
  automatable: boolean
  /** One-line justification, shown in the UI so the "why" is never hidden. */
  legalBasis: string
  search(params: SourceSearchParams): Promise<SourceSearchResult>
}
