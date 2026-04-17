import { EnrichmentPrompt } from "./prompt"

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

async function callOpenAI(prompt: EnrichmentPrompt): Promise<string> {
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
      max_tokens: 600,
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

async function callGroq(prompt: EnrichmentPrompt): Promise<string> {
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
      max_tokens: 600,
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

/**
 * Calls the configured AI provider.
 * Tries OpenAI first, falls back to Groq if OPENAI_API_KEY is missing.
 * Throws if neither key is available.
 */
export async function callAI(prompt: EnrichmentPrompt): Promise<string> {
  if (process.env.OPENAI_API_KEY) {
    return callOpenAI(prompt)
  }
  if (process.env.GROQ_API_KEY) {
    return callGroq(prompt)
  }
  throw new Error("No AI provider configured. Set OPENAI_API_KEY or GROQ_API_KEY.")
}
