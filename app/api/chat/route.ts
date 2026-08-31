import { type NextRequest, NextResponse } from "next/server"

import { callAI, hasAIProvider } from "@/lib/ai-processing/call-ai"
import {
  buildGroundedPrompt,
  parseGroundedAnswer,
  retrieveContext,
  retrieveStoryContext,
  type ContextArticle,
} from "@/lib/chat-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/chat — NotiBot.
 *
 * Answers only from articles we hold. See lib/chat-service.ts for why: this
 * replaced a keyword lookup table that asserted match results, financial
 * figures and legal provisions that no source backed, behind a randomised
 * 1–3s delay that made the canned text look computed.
 *
 * Body: { message: string, history?: Array<{ type, content }>, storyId?: string }
 * Returns: { message, suggestions, sources[], grounded }
 *
 * `storyId` pins retrieval to one story's own sources (spec § 23), so the user
 * does not have to say which story they mean, and adds the § 24 instruction to
 * keep fact, context, analysis and unknown apart.
 */

/** Token budget: enough for a ~120-word answer plus citations and follow-ups. */
const MAX_TOKENS = 700

interface ChatBody {
  message?: unknown
  history?: unknown
  storyId?: unknown
}

function toSources(articles: ContextArticle[], ids: string[]) {
  const byId = new Map(articles.map((a) => [a.id, a]))
  return ids
    .map((id) => byId.get(id))
    .filter((a): a is ContextArticle => Boolean(a))
    .map((a) => ({ id: a.id, title: a.title, sourceName: a.sourceName }))
}

/** Real headlines, used as follow-up prompts when we cannot compose an answer. */
function headlineSuggestions(articles: ContextArticle[]): string[] {
  return articles.slice(0, 3).map((a) => a.title.slice(0, 70))
}

/**
 * Degraded answer for when the model is unavailable — no key, exhausted quota,
 * provider outage. The retrieved headlines are real data, so listing them is
 * factual and still useful; returning 502 would throw away information we
 * already have, and inventing prose would be worse.
 *
 * Dates are included because the corpus can lag: "the latest we have is from
 * 14 July" is a materially different answer from "here's today's news".
 */
function degradedResponse(articles: ContextArticle[], reason: string) {
  const list = articles
    .slice(0, 5)
    .map((a) => `• ${a.title} — ${a.sourceName}, ${a.publishedAt.toISOString().slice(0, 10)}`)
    .join("\n")

  return NextResponse.json({
    message: `${reason}\n\nEncontrei estes artigos relacionados:\n\n${list}`,
    suggestions: headlineSuggestions(articles),
    sources: articles.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      sourceName: a.sourceName,
    })),
    grounded: true,
    composed: false,
  })
}

export async function POST(request: NextRequest) {
  let body: ChatBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const history = Array.isArray(body.history)
    ? (body.history as Array<Record<string, unknown>>)
        .filter((m) => typeof m.content === "string")
        .map((m) => ({ type: String(m.type ?? "user"), content: String(m.content) }))
    : []

  const storyId =
    typeof body.storyId === "string" && body.storyId.trim() ? body.storyId.trim() : null

  try {
    const { mode, articles } = storyId
      ? await retrieveStoryContext(storyId)
      : await retrieveContext(message)

    // Nothing to ground an answer in. Answer honestly and skip the model —
    // with no articles it could only invent one.
    if (mode === "none") {
      return NextResponse.json({
        message: storyId
          ? "I do not hold the text of this story's sources, so I cannot answer from them. I only answer from the articles we have, rather than risk inventing one."
          : "Não encontrei nada na nossa cobertura sobre isso. Só respondo a partir dos artigos que temos em base, por isso prefiro dizer que não sei do que arriscar uma resposta errada.",
        suggestions: storyId ? [] : ["Resumir as notícias de hoje"],
        sources: [],
        grounded: false,
      })
    }

    if (!hasAIProvider()) {
      return degradedResponse(
        articles,
        "Ainda não tenho um modelo de IA configurado, por isso não consigo compor uma resposta.",
      )
    }

    const prompt = buildGroundedPrompt(message, articles, history, {
      storyScoped: Boolean(storyId),
    })

    let raw: string
    try {
      raw = await callAI(prompt, MAX_TOKENS)
    } catch (err) {
      // Quota, rate limit or outage. Degrade to the headlines rather than 502 —
      // this is a routine production condition, not an exceptional one.
      console.error("[api/chat] provider unavailable:", err)
      return degradedResponse(
        articles,
        "O serviço de IA está indisponível neste momento, por isso não consigo compor uma resposta.",
      )
    }

    const parsed = parseGroundedAnswer(
      raw,
      articles.map((a) => a.id),
    )

    if (!parsed) {
      console.error("[api/chat] unparseable model output:", raw.slice(0, 300))
      return NextResponse.json({
        message:
          "Não consegui processar a resposta do modelo desta vez. Tenta reformular a pergunta.",
        suggestions: headlineSuggestions(articles),
        sources: [],
        grounded: false,
      })
    }

    return NextResponse.json({
      message: parsed.answer,
      suggestions: parsed.suggestions.length > 0 ? parsed.suggestions : headlineSuggestions(articles),
      // An unanswered question cites nothing, even if the model listed ids.
      sources: parsed.answered ? toSources(articles, parsed.usedArticleIds) : [],
      grounded: parsed.answered,
      retrieval: mode,
    })
  } catch (error) {
    console.error("[api/chat]", error)
    return NextResponse.json(
      { error: "Failed to answer right now. Please try again." },
      { status: 502 },
    )
  }
}
