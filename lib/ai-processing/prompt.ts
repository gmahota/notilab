const MAX_CONTENT_CHARS = 3000

/**
 * Output language for every AI-generated field.
 *
 * Portuguese is the site's default language, and ingestion deliberately keeps
 * foreign-language sources (see lib/ingestion/providers.ts) because dropping
 * them loses fresh reporting. Translating here is what lets both be true: a
 * Spanish match from Cadena SER or sport.es is fetched, then rendered in
 * Portuguese. The original text is never overwritten — it stays on the News row.
 */
const SYSTEM_PROMPT = `You are a neutral news analyst writing for a Portuguese-language news site.

Rules:
- Return ONLY a valid JSON object — no markdown, no explanation, no extra text.
- Write EVERY text field in European Portuguese (pt-PT), regardless of the language the article is written in. If the article is in Spanish, English, French or any other language, translate it.
- Translate faithfully. Do not soften, embellish or reinterpret the reporting.
- Base your analysis ONLY on the article content. Do not add outside knowledge or assumptions.
- Keep proper nouns, club names, competition names and people's names in their original form (Real Madrid, Champions League, Cadena SER).
- Be concise and clear. Avoid political bias. Do not hallucinate facts not present in the article.`

const USER_PROMPT_TEMPLATE = (title: string, body: string) => `Article title: ${title}

Article content:
${body}

Return a JSON object with exactly these fields, all text in European Portuguese:
{
  "title": "the headline in Portuguese — a faithful translation if the original is not Portuguese, otherwise the original headline cleaned up. Keep it headline-length, do not summarise the article here.",
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
