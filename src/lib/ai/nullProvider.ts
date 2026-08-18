import type { AiCompletionRequest, AiProvider } from "./provider"

/**
 * The offline default. It does NOT attempt to hallucinate structured content
 * for an arbitrary schema — that would defeat the anti-hallucination design
 * (ARCHITECTURE.md §9). Instead every AI-assisted module (CV tailoring,
 * cover letters, question answers, requirement extraction, company intel)
 * checks `provider.id === "null"` and runs its own deterministic,
 * template/rule-based path — see e.g. src/lib/cv/tailor.ts. This class
 * exists so `getAiProvider()` always returns *something* usable and callers
 * that forget the branch fail loudly instead of silently returning junk.
 */
export class NullProvider implements AiProvider {
  id = "null" as const

  async complete<T>(req: AiCompletionRequest<T>): Promise<T> {
    throw new Error(
      `NullProvider cannot fulfill "${req.prompt.slice(0, 60)}..." — the caller must implement a ` +
        `deterministic fallback for provider.id === "null" instead of calling complete().`
    )
  }
}
