import type { AiCompletionRequest, AiProvider } from "./provider"

/**
 * Minimal REST client for OpenAI's Chat Completions API — deliberately not
 * using the `openai` SDK so this abstraction has zero heavy dependencies and
 * is trivial to audit. Requests JSON-object mode and validates the result
 * against the caller's zod schema, retrying once with the validation error
 * fed back to the model before giving up.
 */
export class OpenAiProvider implements AiProvider {
  id = "openai" as const
  constructor(private model: string) {}

  async complete<T>(req: AiCompletionRequest<T>): Promise<T> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set")

    let lastError = ""
    for (let attempt = 0; attempt < 2; attempt++) {
      const userPrompt = attempt === 0 ? req.prompt : `${req.prompt}\n\nYour previous response failed validation: ${lastError}\nReturn valid JSON only.`
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: req.temperature ?? 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${req.system}\n\nRespond with a single JSON object only, no prose.` },
            { role: "user", content: userPrompt },
          ],
        }),
      })
      if (!res.ok) {
        throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`)
      }
      const data = (await res.json()) as { choices: { message: { content: string } }[] }
      const raw = data.choices[0]?.message?.content ?? "{}"
      try {
        const parsed = JSON.parse(raw)
        return req.schema.parse(parsed)
      } catch (err) {
        lastError = (err as Error).message
      }
    }
    throw new Error(`OpenAI response failed schema validation after retry: ${lastError}`)
  }
}
