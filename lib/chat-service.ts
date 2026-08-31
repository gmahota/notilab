/**
 * lib/chat-service.ts
 *
 * Retrieval and grounding for NotiBot.
 *
 * The assistant answers **only** from articles we hold. It never writes from
 * the model's own knowledge, because the previous implementation did exactly
 * that from a lookup table: asked about football it asserted "Benfica venceu
 * 3-1 na Champions, classificação garantida", asked about tech it asserted a
 * "aumento de 40% em ataques", and asked about AI law it asserted "multas até
 * 7% do faturamento global" — match results, statistics and legal provisions
 * presented as fact, none of them sourced.
 *
 * Shape of the pipeline:
 *   retrieveContext → buildGroundedPrompt → callAI → parseGroundedAnswer
 *
 * When retrieval finds nothing, the route answers "no coverage" without
 * calling the model at all: with no articles there is nothing to ground an
 * answer in, and a model call could only invent one.
 */

import { prisma } from "./prisma"
import { storyTablesPresent } from "./story-tables"

/** Articles handed to the model as the only permitted source of facts. */
export interface ContextArticle {
  id: string
  title: string
  sourceName: string
  publishedAt: Date
  summary: string
  tldr: string | null
}

export type RetrievalMode =
  /** Articles matched on the question's keywords. */
  | "matched"
  /** Roundup request, served from articles inside the recency window. */
  | "recent"
  /**
   * Roundup request, but nothing is recent — served from the newest articles we
   * hold, whatever their age. Their dates go into the prompt so the answer can
   * say so rather than passing them off as today's.
   */
  | "stale"
  /** Nothing to ground an answer in. */
  | "none"

export interface RetrievalResult {
  mode: RetrievalMode
  articles: ContextArticle[]
}

export interface GroundedAnswer {
  answered: boolean
  answer: string
  usedArticleIds: string[]
  suggestions: string[]
}

/** How many articles to put in front of the model. */
const CONTEXT_LIMIT = 8

/** Characters of body text per article — keeps the prompt inside budget. */
const SNIPPET_CHARS = 320

/** A "recent" roundup only looks this far back, so "today" means today. */
const RECENT_WINDOW_HOURS = 48

/**
 * Words carrying no retrieval signal, in the two languages the product uses.
 * Kept deliberately short: over-filtering strips terms like "porto" or "sul"
 * that matter here.
 */
const STOPWORDS = new Set([
  // pt
  "que", "qual", "quais", "quem", "como", "onde", "quando", "porque", "porquê",
  "sobre", "para", "pelo", "pela", "com", "sem", "dos", "das", "nos", "nas",
  "uma", "uns", "umas", "este", "esta", "isso", "aquilo", "mais", "menos",
  "muito", "pouco", "todos", "todas", "hoje", "ontem", "amanhã", "agora",
  "são", "foi", "foram", "ser", "está", "estao", "estão", "tem", "têm",
  "temos", "havia", "aconteceu", "passou", "novo", "nova", "novos", "novas",
  "notícias", "noticias", "notícia", "noticia", "diz", "dizem", "sabe",
  "podes", "pode", "quero", "queria", "fala", "falar", "conta", "explica",
  "explicar", "resumir", "resumo", "última", "últimas", "ultima", "ultimas",
  // en
  "the", "what", "which", "who", "how", "where", "when", "why", "about",
  "for", "with", "without", "and", "but", "this", "that", "these", "those",
  "more", "less", "all", "today", "yesterday", "tomorrow", "now", "news",
  "tell", "explain", "summarise", "summarize", "summary", "latest", "give",
])

/** Does the question ask for a general roundup rather than a specific topic? */
function isRoundupIntent(message: string): boolean {
  return /resum|destaque|principa|novidade|panorama|hoje|today|highlight|what happened|catch me up|round-?up/i.test(
    message,
  )
}

/**
 * Pulls retrieval terms out of the question. Plain keyword extraction, no
 * embeddings — the corpus is small and the topics are proper nouns
 * ("Real Madrid", "Moçambique"), which substring matching handles well.
 */
export function extractKeywords(message: string): string[] {
  const tokens = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))

  return [...new Set(tokens)].slice(0, 6)
}

function toContextArticle(row: {
  id: string
  title: string
  sourceName: string
  publishedAt: Date
  summary: string | null
  articleAI: { tldr: string | null } | null
}): ContextArticle {
  return {
    id: row.id,
    title: row.title,
    sourceName: row.sourceName,
    publishedAt: row.publishedAt,
    summary: (row.summary ?? "").slice(0, SNIPPET_CHARS),
    tldr: row.articleAI?.tldr ?? null,
  }
}

const CONTEXT_SELECT = {
  id: true,
  title: true,
  sourceName: true,
  publishedAt: true,
  summary: true,
  articleAI: { select: { tldr: true } },
} as const

/**
 * Finds the articles that could ground an answer to `message`.
 *
 * Falls back to a recent roundup only when the question actually asked for one.
 * An unmatched specific question returns `none` rather than unrelated articles,
 * so the model is never handed material that invites it to improvise.
 */
export async function retrieveContext(message: string): Promise<RetrievalResult> {
  const keywords = extractKeywords(message)

  if (keywords.length > 0) {
    const matched = await prisma.news.findMany({
      where: {
        status: "PUBLISHED",
        OR: keywords.flatMap((k) => [
          { title: { contains: k, mode: "insensitive" as const } },
          { summary: { contains: k, mode: "insensitive" as const } },
          { tags: { has: k } },
        ]),
      },
      orderBy: [{ rankingScore: "desc" }, { publishedAt: "desc" }],
      take: CONTEXT_LIMIT,
      select: CONTEXT_SELECT,
    })

    if (matched.length > 0) {
      return { mode: "matched", articles: matched.map(toContextArticle) }
    }
  }

  if (isRoundupIntent(message)) {
    const since = new Date(Date.now() - RECENT_WINDOW_HOURS * 3_600_000)
    const recent = await prisma.news.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: since } },
      orderBy: [{ rankingScore: "desc" }, { publishedAt: "desc" }],
      take: CONTEXT_LIMIT,
      select: CONTEXT_SELECT,
    })

    if (recent.length > 0) {
      return { mode: "recent", articles: recent.map(toContextArticle) }
    }

    // Nothing inside the window. Rather than claim no coverage, hand over the
    // newest articles we do hold — every one carries its date into the prompt,
    // so the answer can say how stale they are instead of implying they are
    // today's. This is the normal state whenever ingestion has been paused.
    const latest = await prisma.news.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: CONTEXT_LIMIT,
      select: CONTEXT_SELECT,
    })

    if (latest.length > 0) {
      return { mode: "stale", articles: latest.map(toContextArticle) }
    }
  }

  return { mode: "none", articles: [] }
}

/**
 * Context for a question asked *about a specific story* (spec § 23).
 *
 * The generic path guesses which articles are relevant from the question's
 * keywords. Here we already know: the user is looking at one story, so its own
 * sources are the context and nothing else is. That removes the failure mode
 * where "who benefits?" retrieves an unrelated article sharing a word, and it
 * means the user never has to explain which story they mean.
 *
 * Returns `none` when the story has no article whose text we hold — better a
 * plain "I cannot answer from what we have" than an answer grounded in
 * something else.
 */
export async function retrieveStoryContext(storyKey: string): Promise<RetrievalResult> {
  // Articles attached to the Story, when the Story tables are in play. Before
  // the story_model migration they are not, and the News lookup below is the
  // pre-clustering shape of the same thing.
  let articleIds: string[] = []
  if (await storyTablesPresent()) {
    const story = await prisma.story.findFirst({
      where: { OR: [{ slug: storyKey }, { id: storyKey }] },
      select: { sources: { select: { newsId: true } } },
    })
    if (story) {
      articleIds = story.sources.map((s) => s.newsId).filter((id): id is string => Boolean(id))
    }
  }

  const articles = await prisma.news.findMany({
    where:
      articleIds.length > 0
        ? { status: "PUBLISHED", id: { in: articleIds } }
        : // No Story row, or none of its sources is an article we hold: a
          // News-derived story's key is the article's own slug or id.
          { status: "PUBLISHED", OR: [{ slug: storyKey }, { id: storyKey }] },
    orderBy: { publishedAt: "asc" },
    take: CONTEXT_LIMIT,
    select: CONTEXT_SELECT,
  })

  if (articles.length === 0) return { mode: "none", articles: [] }
  return { mode: "matched", articles: articles.map(toContextArticle) }
}

/**
 * Extra instruction for story-scoped questions (spec § 24).
 *
 * The four categories have to stay apart because they carry different
 * warranties: a FACT is in the sources, ANALYSIS is the model's reading of them,
 * and blending the two is how a plausible interpretation gets read as reporting.
 * UNKNOWN matters most — it is the honest answer to most "what happens next?"
 * questions, and the one a model will otherwise talk its way out of.
 */
const STORY_SCOPE_ADDENDUM = `
This question is about one specific story, and the articles below are that story's own sources.

Separate what you know from what you infer. When a sentence is not a plain fact from the sources, mark it:
- FACT: — stated in the sources.
- CONTEXT: — related background you are confident in, not drawn from these sources.
- ANALYSIS: — your reading of what the facts imply.
- UNKNOWN: — the sources do not settle this.
Never present CONTEXT or ANALYSIS as if it were FACT, and prefer UNKNOWN to a confident guess.`

const SYSTEM_PROMPT = `You are NotiLab's news assistant. You answer strictly from the numbered articles given to you.

Absolute rules:
- Use only facts written in those articles. Never add a score, statistic, figure, date, name or event that is not there.
- Never state a match result, a financial number or a legal provision unless it appears in an article.
- If the articles do not answer the question, set "answered" to false and say plainly that our coverage does not include it. Do not answer from your own knowledge, and do not guess.
- The conversation history is context for what the user means. It is never a source of facts.
- Every article carries its publication date. If the user asks about today or "the latest" and the newest article is materially older, say how old the coverage actually is instead of presenting it as current.
- Reply in the same language the user wrote in.
- Keep the answer under 120 words.

Respond with JSON only, no prose around it:
{"answered": boolean, "answer": string, "usedArticleIds": string[], "suggestions": string[]}

"usedArticleIds": ids of the articles you actually drew on — [] when answered is false.
"suggestions": up to 3 short follow-up questions the supplied articles could genuinely answer.`

/**
 * Builds the grounded prompt. Article ids are given to the model so it can cite
 * them; the caller validates the returned ids against what was actually sent.
 */
export function buildGroundedPrompt(
  message: string,
  articles: ContextArticle[],
  history: Array<{ type: string; content: string }> = [],
  options: { storyScoped?: boolean } = {},
): { system: string; user: string } {
  const rendered = articles
    .map((a, i) => {
      const body = a.tldr || a.summary || "(no summary stored)"
      const date = a.publishedAt.toISOString().slice(0, 10)
      return `[${i + 1}] id=${a.id}\nTitle: ${a.title}\nSource: ${a.sourceName} (${date})\nSummary: ${body}`
    })
    .join("\n\n")

  // Only the last few turns — enough to resolve "and him?" without letting an
  // long history crowd out the articles.
  const recentHistory = history
    .slice(-4)
    .map((m) => `${m.type === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 200)}`)
    .join("\n")

  const historyBlock = recentHistory
    ? `Conversation so far (context only, not a source of facts):\n${recentHistory}\n\n`
    : ""

  return {
    system: options.storyScoped ? `${SYSTEM_PROMPT}\n${STORY_SCOPE_ADDENDUM}` : SYSTEM_PROMPT,
    user: `${historyBlock}Question: ${message}\n\nArticles you may use:\n\n${rendered}`,
  }
}

/**
 * Parses the model's JSON. Ids the model did not receive are dropped, so a
 * hallucinated citation cannot reach the UI as a real source.
 */
export function parseGroundedAnswer(
  raw: string,
  allowedIds: string[],
): GroundedAnswer | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== "object" || parsed === null) return null
  const obj = parsed as Record<string, unknown>

  const answer = typeof obj.answer === "string" ? obj.answer.trim() : ""
  if (!answer) return null

  const allowed = new Set(allowedIds)

  return {
    answered: obj.answered !== false,
    answer,
    usedArticleIds: Array.isArray(obj.usedArticleIds)
      ? obj.usedArticleIds.filter((id): id is string => typeof id === "string" && allowed.has(id))
      : [],
    suggestions: Array.isArray(obj.suggestions)
      ? obj.suggestions
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 3)
      : [],
  }
}
