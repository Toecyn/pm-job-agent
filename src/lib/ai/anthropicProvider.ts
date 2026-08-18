import type { AiCompletionRequest, AiProvider } from "./provider"

/**
 * Minimal REST client for Anthropic's Messages API — same rationale as
 * openaiProvider.ts (no SDK dependency, trivially auditable).
 */
export class AnthropicProvider implements AiProvider {
  id = "anthropic" as const
  constructor(private model: string) {}

  async complete<T>(req: AiCompletionRequest<T>): Promise<T> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set")

    let lastError = ""
    for (let attempt = 0; attempt < 2; attempt++) {
      const userPrompt =
        attempt === 0
          ? req.prompt
          : `${req.prompt}\n\nYour previous response failed validation: ${lastError}\nReturn valid JSON only, no prose, no markdown fences.`
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          temperature: req.temperature ?? 0.3,
          system: `${req.system}\n\nRespond with a single JSON object only — no prose, no markdown code fences.`,
          messages: [{ role: "user", content: userPrompt }],
        }),
      })
      if (!res.ok) {
        throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
      }
      const data = (await res.json()) as { content: { type: string; text?: string }[] }
      const text = data.content.find((c) => c.type === "text")?.text ?? "{}"
      const jsonText = extractJsonBlock(text)
      try {
        const parsed = JSON.parse(jsonText)
        return req.schema.parse(parsed)
      } catch (err) {
        lastError = (err as Error).message
      }
    }
    throw new Error(`Anthropic response failed schema validation after retry: ${lastError}`)
  }
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text
}
