const MAX_CONTENT_CHARS = 3000

const SYSTEM_PROMPT = `You are a neutral news analyst. Analyze the article provided and return ONLY a valid JSON object — no markdown, no explanation, no extra text.

Rules:
- Base your analysis ONLY on the article content. Do not add outside knowledge or assumptions.
- Be concise and clear. Avoid political bias.
- Do not hallucinate facts not present in the article.
- Use plain, accessible English.`

const USER_PROMPT_TEMPLATE = (title: string, body: string) => `Article title: ${title}

Article content:
${body}

Return a JSON object with exactly these fields:
{
  "summary": "2–3 sentence summary of the article",
  "tldr": "one short paragraph: the single most important takeaway",
  "whyItMatters": "1–2 sentences on practical relevance to the average reader",
  "explainLikeIm10": "simple explanation as if talking to a 10-year-old, no jargon",
  "sentiment": "positive" | "neutral" | "negative",
  "importanceScore": <integer 0–100, higher = more broadly impactful>,
  "readTime": <estimated reading time in minutes as an integer>
}`

export interface EnrichmentPrompt {
  system: string
  user: string
}

export function buildEnrichmentPrompt(
  title: string,
  content: string | null,
  fallbackSummary: string | null,
): EnrichmentPrompt {
  const raw = content ?? fallbackSummary ?? title
  const body = raw.slice(0, MAX_CONTENT_CHARS)

  return {
    system: SYSTEM_PROMPT,
    user: USER_PROMPT_TEMPLATE(title, body),
  }
}
