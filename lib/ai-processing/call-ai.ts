import { EnrichmentPrompt } from "./prompt"

/**
 * Token budget for article enrichment — enough for a summary, TL;DR and the
 * short explainer fields. Callers that generate longer output (e.g. a full
 * draft) pass their own budget instead of raising this, which would inflate
 * every enrichment call.
 */
const DEFAULT_MAX_TOKENS = 600

interface OpenAIMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface OpenAIResponse {
  choices: Array<{
    message: { content: string | null }
    finish_reason: string
  }>
}

async function callOpenAI(prompt: EnrichmentPrompt, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not set")

  const messages: OpenAIMessage[] = [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ]

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 200)}`)
  }

  const data: OpenAIResponse = await response.json()
  const content = data.choices[0]?.message?.content
  if (!content) throw new Error("OpenAI returned empty content")
  return content
}

async function callGroq(prompt: EnrichmentPrompt, maxTokens: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY not set")

  const messages: OpenAIMessage[] = [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ]

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Groq error ${response.status}: ${text.slice(0, 200)}`)
  }

  const data: OpenAIResponse = await response.json()
  const content = data.choices[0]?.message?.content
  if (!content) throw new Error("Groq returned empty content")
  return content
}

/** True when at least one provider key is present. */
export function hasAIProvider(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY)
}

/**
 * Calls the configured AI provider, preferring OpenAI and falling back to Groq.
 *
 * The fallback triggers on a *failed* OpenAI call, not just a missing key.
 * Previously it only checked for the key's presence, so an exhausted quota
 * (429) or a provider outage took the whole feature down even with a working
 * Groq key configured — which is exactly what happened in development.
 *
 * Throws if no provider is configured, or if every configured one fails.
 */
export async function callAI(
  prompt: EnrichmentPrompt,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): Promise<string> {
  const errors: string[] = []

  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt, maxTokens)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(message)
      // Only worth falling through if there is somewhere to fall through to.
      if (!process.env.GROQ_API_KEY) throw err
      console.warn(`[callAI] OpenAI failed, trying Groq: ${message.slice(0, 200)}`)
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroq(prompt, maxTokens)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
      throw new Error(`All AI providers failed: ${errors.join(" | ").slice(0, 400)}`)
    }
  }

  throw new Error("No AI provider configured. Set OPENAI_API_KEY or GROQ_API_KEY.")
}
