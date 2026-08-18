import type { z } from "zod"

/**
 * Provider abstraction (brief §31): nothing else in the app should import an
 * openai/anthropic SDK directly. Every call site asks for structured JSON
 * validated against a zod schema, never free text — this is what makes the
 * evidence-verification pass in the CV/answer engines mechanical rather than
 * trust-based (ARCHITECTURE.md §9).
 */
export interface AiCompletionRequest<T> {
  system: string
  prompt: string
  schema: z.ZodType<T>
  /** Lower temperature for extraction/scoring tasks, higher for prose. */
  temperature?: number
}

export interface AiProvider {
  id: "openai" | "anthropic" | "null"
  complete<T>(req: AiCompletionRequest<T>): Promise<T>
}

let cached: AiProvider | undefined
let cachedId: string | undefined

/**
 * Resolves the configured provider. Falls back to the deterministic
 * NullProvider whenever a provider is requested but its API key is missing,
 * so the app always keeps working (used by the offline end-to-end test).
 */
export async function getAiProvider(providerId?: string, model?: string): Promise<AiProvider> {
  const id = providerId ?? process.env.AI_PROVIDER ?? "null"
  if (cached && cachedId === id) return cached

  if (id === "openai" && process.env.OPENAI_API_KEY) {
    const { OpenAiProvider } = await import("./openaiProvider")
    cached = new OpenAiProvider(model ?? process.env.AI_MODEL ?? "gpt-4o-mini")
    cachedId = id
    return cached
  }
  if (id === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const { AnthropicProvider } = await import("./anthropicProvider")
    cached = new AnthropicProvider(model ?? process.env.AI_MODEL ?? "claude-sonnet-5")
    cachedId = id
    return cached
  }
  const { NullProvider } = await import("./nullProvider")
  cached = new NullProvider()
  cachedId = "null"
  return cached
}
