import { z } from "zod"
import type { RawJobPosting } from "@/lib/types/job"
import type { JobSourceAdapter, SourceSearchResult } from "./types"
import { isFetchAllowed } from "./robots"
import { getAiProvider } from "@/lib/ai/provider"

/**
 * For sources we do not (and will not) automate — LinkedIn, Indeed,
 * Wellfound, Otta, Google Jobs, or literally any company career page — the
 * user pastes a single job URL they found themselves. We fetch *only* that
 * URL (after a robots.txt check), extract structured fields, and hand back
 * a normal RawJobPosting that flows through the same pipeline as every other
 * source. This satisfies brief §3's "prepare everything needed for me to
 * complete the application manually" without ever automating a disallowed
 * site.
 */

const ExtractedFieldsSchema = z.object({
  title: z.string(),
  companyName: z.string(),
  location: z.string().optional(),
  isRemote: z.boolean().optional(),
  description: z.string(),
})

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function metaContent(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i")
  return html.match(re)?.[1]
}

function heuristicExtract(html: string, url: string): z.infer<typeof ExtractedFieldsSchema> {
  const ogTitle = metaContent(html, "og:title")
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
  const siteName = metaContent(html, "og:site_name")
  const bodyText = stripHtml(html).slice(0, 20000)
  return {
    title: (ogTitle ?? titleTag ?? "Unknown title (please edit)").trim(),
    companyName: (siteName ?? new URL(url).hostname.replace(/^www\./, "")).trim(),
    description: bodyText,
  }
}

export async function importJobFromUrl(url: string): Promise<{ posting?: RawJobPosting; error?: string }> {
  const robots = await isFetchAllowed(url)
  if (!robots.allowed) {
    return { error: `Not fetched: ${robots.reason} Open the link yourself and use "Paste job text" instead.` }
  }

  let html: string
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PMJobAgent/1.0; +personal-use)" },
    })
    if (!res.ok) return { error: `Fetch failed with status ${res.status}.` }
    html = await res.text()
  } catch (err) {
    return { error: `Fetch failed: ${(err as Error).message}` }
  }

  return { posting: await extractPosting(html, url) }
}

/** Also used for "paste job text" when a page can't be fetched at all (e.g. LinkedIn login wall). */
export async function importJobFromPastedText(
  text: string,
  url: string,
  hints: { title?: string; companyName?: string } = {}
): Promise<RawJobPosting> {
  const posting = await extractPosting(`<title>${hints.title ?? ""}</title><body>${text}</body>`, url, text)
  return { ...posting, title: hints.title ?? posting.title, companyName: hints.companyName ?? posting.companyName }
}

async function extractPosting(html: string, url: string, plainTextOverride?: string): Promise<RawJobPosting> {
  const provider = await getAiProvider()
  let fields: z.infer<typeof ExtractedFieldsSchema>
  if (provider.id === "null") {
    fields = heuristicExtract(html, url)
    if (plainTextOverride) fields.description = plainTextOverride
  } else {
    try {
      fields = await provider.complete({
        system:
          "You extract structured fields from a raw job-posting web page. Only use text present in the page — never invent a company name, title, or location.",
        prompt: `URL: ${url}\n\nPage content (HTML or plain text):\n${stripHtml(html).slice(0, 12000)}`,
        schema: ExtractedFieldsSchema,
        temperature: 0,
      })
    } catch {
      fields = heuristicExtract(html, url)
    }
  }

  return {
    source: "manual-import",
    sourceJobId: url,
    title: fields.title,
    companyName: fields.companyName,
    location: fields.location,
    remoteStatus: fields.isRemote ? "remote" : "unknown",
    countries: [],
    employmentType: "unknown",
    applicationUrl: url,
    originalUrl: url,
    postedAtConfidence: "unknown", // we cannot verify a third-party page's real posting date
    description: fields.description,
    rawPayload: { url },
  }
}

/** Registered as a no-op scheduled adapter — manual import is user-triggered, not polled. */
export const manualImportAdapter: JobSourceAdapter = {
  id: "manual-import",
  displayName: "Manual Import (paste a job URL)",
  automatable: false,
  legalBasis:
    "Fetches only a single URL the user explicitly provided, after checking robots.txt — never crawls or searches a site on its own.",
  async search(): Promise<SourceSearchResult> {
    return { postings: [], warnings: [] }
  },
}
