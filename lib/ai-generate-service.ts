/**
 * lib/ai-generate-service.ts
 *
 * Assisted draft generation for the admin AI generator.
 *
 * This replaced a hardcoded fabrication. The previous implementation invented a
 * complete medical-AI article including a quote attributed to a named doctor,
 * clinical accuracy figures and an EU funding amount — none of it real, all of
 * it presented to an editor as AI output. `AGENTS.md` § AI-Content Correctness
 * treats that as the product's central risk, not a placeholder detail.
 *
 * The design rule that makes generation safe: **the model never writes from its
 * own knowledge.** It only rewrites source material we already ingested and
 * hold in the database, and every draft carries the article ids it was built
 * from. If we hold nothing on the topic, generation fails loudly instead of
 * inventing something plausible.
 *
 * Consequences worth knowing:
 *   - No sources → `NO_SOURCES`, never a draft.
 *   - The result is always a draft for review. This module does not write to
 *     `News`; publishing stays a human decision through the editorial workflow.
 *   - Invented engagement/SEO scores were dropped rather than reimplemented.
 *     The previous version returned `Math.random()` as an "AI analysis" score.
 */

import { prisma } from "./prisma"
import { callAI } from "./ai-processing/call-ai"

/** How many stored articles are offered to the model as source material. */
const MAX_SOURCES = 6

/** Characters of each source article passed to the model. */
const SOURCE_CHARS = 1_200

/** Token budget — a draft needs far more room than field enrichment. */
const DRAFT_MAX_TOKENS = 2_000

const LENGTH_TARGETS: Record<string, string> = {
  curto: "250-350 words",
  medio: "450-600 words",
  longo: "700-900 words",
}

export interface GenerateDraftInput {
  topic: string
  categorySlug?: string
  tone?: string
  length?: string
  /** Editorial register, e.g. "informativo" | "analise". */
  style?: string
  /** Reader profile the draft should be pitched at. */
  audience?: string
}

export interface DraftSource {
  id: string
  title: string
  sourceName: string
  sourceUrl: string
  publishedAt: Date
}

export interface GeneratedDraft {
  title: string
  summary: string
  content: string
  keywords: string[]
  sentiment: "positive" | "neutral" | "negative"
  /** Provenance — the stored articles this draft was written from. */
  sources: DraftSource[]
}

export type GenerateDraftResult =
  | { success: true; data: GeneratedDraft }
  | { success: false; error: string; code: "INVALID_INPUT" | "NO_SOURCES" | "AI_UNAVAILABLE" | "BAD_OUTPUT" }

/**
 * Finds stored articles that could serve as source material for a topic.
 * Exported so an admin surface can show what would be used before generating.
 */
export async function findSourcesForTopic(
  topic: string,
  categorySlug?: string,
): Promise<DraftSource[]> {
  const term = topic.trim()
  if (!term) return []

  const where: Record<string, unknown> = {
    status: "PUBLISHED",
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { summary: { contains: term, mode: "insensitive" } },
      { tags: { has: term.toLowerCase() } },
    ],
  }
  if (categorySlug && categorySlug !== "all") {
    where.category = { slug: categorySlug }
  }

  const rows = await prisma.news.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: MAX_SOURCES,
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      sourceName: true,
      sourceUrl: true,
      publishedAt: true,
    },
  })

  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    title: r.title,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    publishedAt: r.publishedAt,
  }))
}

/**
 * Generates a draft grounded in stored articles. Never invents source material.
 */
export async function generateDraftFromSources(
  input: GenerateDraftInput,
): Promise<GenerateDraftResult> {
  const topic = input.topic?.trim() ?? ""
  if (topic.length < 3) {
    return { success: false, error: "Topic must be at least 3 characters.", code: "INVALID_INPUT" }
  }

  const where: Record<string, unknown> = {
    status: "PUBLISHED",
    OR: [
      { title: { contains: topic, mode: "insensitive" } },
      { summary: { contains: topic, mode: "insensitive" } },
      { tags: { has: topic.toLowerCase() } },
    ],
  }
  if (input.categorySlug && input.categorySlug !== "all") {
    where.category = { slug: input.categorySlug }
  }

  const articles = await prisma.news.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: MAX_SOURCES,
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      sourceName: true,
      sourceUrl: true,
      publishedAt: true,
    },
  })

  if (articles.length === 0) {
    return {
      success: false,
      error: `No stored articles match "${topic}". Generation needs source material — ingest coverage on this topic first.`,
      code: "NO_SOURCES",
    }
  }

  const sources: DraftSource[] = articles.map((a: (typeof articles)[number]) => ({
    id: a.id,
    title: a.title,
    sourceName: a.sourceName,
    sourceUrl: a.sourceUrl,
    publishedAt: a.publishedAt,
  }))

  const sourceBlock = articles
    .map((a: (typeof articles)[number], i: number) => {
      const body = (a.content ?? a.summary ?? "").slice(0, SOURCE_CHARS)
      return [
        `[SOURCE ${i + 1}]`,
        `Title: ${a.title}`,
        `Outlet: ${a.sourceName}`,
        `Published: ${a.publishedAt.toISOString().slice(0, 10)}`,
        `Body: ${body}`,
      ].join("\n")
    })
    .join("\n\n")

  const lengthTarget = LENGTH_TARGETS[input.length ?? "medio"] ?? LENGTH_TARGETS.medio

  const system = [
    "You are an editorial assistant preparing a DRAFT for human review at a news outlet.",
    "",
    "Absolute constraints — violating any of these makes the output unusable:",
    "1. Use ONLY facts stated in the provided sources. Add nothing from your own knowledge.",
    "2. Never invent quotes. Only reproduce a quote if it appears verbatim in a source, and attribute it to the same speaker the source names.",
    "3. Never invent statistics, figures, dates, funding amounts, names or institutions.",
    "4. If the sources do not support a claim, leave it out rather than hedging it into the text.",
    "5. Do not describe the sources as your own reporting.",
    "",
    "Respond with a single JSON object with exactly these keys:",
    '{"title": string, "summary": string, "content": string, "keywords": string[], "sentiment": "positive"|"neutral"|"negative"}',
    "`content` is plain prose separated by blank lines. No markdown headings.",
  ].join("\n")

  const user = [
    `Topic: ${topic}`,
    `Tone: ${input.tone ?? "neutral"}`,
    `Style: ${input.style ?? "informativo"}`,
    `Audience: ${input.audience ?? "geral"}`,
    `Target length: ${lengthTarget}`,
    "",
    `Write the draft strictly from the ${articles.length} source(s) below.`,
    "",
    sourceBlock,
  ].join("\n")

  let raw: string
  try {
    raw = await callAI({ system, user }, DRAFT_MAX_TOKENS)
  } catch (error) {
    console.error("[ai-generate] provider call failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "AI provider unavailable.",
      code: "AI_UNAVAILABLE",
    }
  }

  const draft = parseDraft(raw)
  if (!draft) {
    return { success: false, error: "The model returned unusable output.", code: "BAD_OUTPUT" }
  }

  return { success: true, data: { ...draft, sources } }
}

function parseDraft(raw: string): Omit<GeneratedDraft, "sources"> | null {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : ""
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : ""
  const content = typeof parsed.content === "string" ? parsed.content.trim() : ""
  if (!title || !content) return null

  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).slice(0, 8)
    : []

  const sentiment =
    parsed.sentiment === "positive" || parsed.sentiment === "negative" ? parsed.sentiment : "neutral"

  return { title, summary: summary || title, content, keywords, sentiment }
}
