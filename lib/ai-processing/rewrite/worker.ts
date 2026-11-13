/**
 * The rewrite worker — Phase 3 of docs/manager/strategy/ingestion-editorial-gate.md.
 *
 * Reads collected articles, writes NotiLab's own version into the `*Rewritten`
 * columns, and stops there. **Shadow mode: nothing reads what this writes.**
 * Articles still publish exactly as they do today, which is the point — the
 * rewrite can be inspected and its quality signed off (Phase 3b) before
 * anything depends on it.
 *
 * Its own module and its own cron rather than a phase inside `runAiBatch`,
 * because the pipeline is one synchronous run with no per-article persistence:
 * putting a per-article model call in it would make ingestion duration
 * proportional to model latency, make a provider outage an ingestion failure,
 * and give a mid-run crash no resume point.
 *
 * **Convergent on a re-run.** The selector takes articles with no
 * `rewrittenAt` and attempts below the cap, so a run cut short — Neon dropping
 * mid-batch is a known failure here — resumes exactly where it stopped and
 * never re-bills a finished article. Each article is saved as it completes,
 * not batched at the end.
 */

import { prisma } from "@/lib/prisma"
import { callAI } from "../call-ai"
import { buildRewritePrompt } from "./prompt"
import { parseRewrite } from "./parse"
import { saveRewrite, recordRewriteFailure, MAX_REWRITE_ATTEMPTS } from "./save"
import type { RewriteStub, RewriteBatchResult } from "./types"

/**
 * Four, and the arithmetic is uncomfortable enough to write down.
 *
 * A rewrite is one model call over a full article body — call it 10–15s. Four
 * fits inside the 60s Vercel ceiling with margin; six does not, and a run that
 * dies at the ceiling wastes the calls it already paid for. But Phase 0
 * measured intake at 15.3 articles per active day, so at four a day the queue
 * grows by eleven. **This does not keep up, by roughly four to one.**
 *
 * That gap is real and is not solved here. Closing it means a plan that allows
 * more than one run a day, several triggers, or throttling ingestion to the
 * rate the newsroom can actually process — which the strategy's R3 already
 * names as the only mitigation that bounds the queue rather than reordering it.
 * Shadow mode is the right time to discover this, not after the gate is up.
 */
const DEFAULT_BATCH_SIZE = 4

/** Below this there is not enough source material to ground an honest rewrite. */
const MIN_SOURCE_CHARS = 400

interface PrismaWithAI {
  articleAI: {
    findMany: (args: Record<string, unknown>) => Promise<RewriteStub[]>
  }
}

export async function runRewriteBatch(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<RewriteBatchResult> {
  const result: RewriteBatchResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  const db = prisma as unknown as PrismaWithAI

  const stubs = await db.articleAI.findMany({
    where: {
      rewrittenAt: null,
      rewriteAttempts: { lt: MAX_REWRITE_ATTEMPTS },
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      articleId: true,
      rewriteAttempts: true,
      article: {
        select: {
          id: true,
          title: true,
          content: true,
          summary: true,
          sourceName: true,
          sourceUrl: true,
        },
      },
    },
  })

  result.total = stubs.length

  for (const stub of stubs) {
    const { article } = stub
    const source = article.content ?? article.summary ?? ""

    // Not an attempt: no counter is spent on an article we never asked about.
    // It stays selectable, which matters because ingestion sometimes stores a
    // stub body that a later pass fills in.
    if (source.length < MIN_SOURCE_CHARS) {
      result.skipped++
      result.errors.push({
        articleId: stub.articleId,
        reason: `source too short (${source.length} chars)`,
      })
      continue
    }

    try {
      const prompt = buildRewritePrompt(
        article.title,
        article.content,
        article.summary,
        article.sourceName,
      )
      const raw = await callAI(prompt)
      const outcome = parseRewrite(raw)

      if (outcome.kind === "ok") {
        await saveRewrite(stub.id, outcome.result)
        result.succeeded++
        continue
      }

      // The model judged the source too thin. Re-running cannot change that,
      // so the counter goes straight to the cap and the article surfaces for a
      // human instead of burning two more calls on the same answer.
      if (outcome.kind === "insufficient") {
        await recordRewriteFailure(
          stub.id,
          stub.rewriteAttempts,
          "model judged the source insufficient to ground an article",
          { exhaust: true },
        )
        result.failed++
        result.errors.push({ articleId: stub.articleId, reason: "insufficient source" })
        continue
      }

      await recordRewriteFailure(stub.id, stub.rewriteAttempts, outcome.reason)
      result.failed++
      result.errors.push({ articleId: stub.articleId, reason: outcome.reason })
    } catch (err) {
      // Provider error, timeout, dropped connection. No fallback: the article
      // keeps its source text and no rewrite, which is honest. Writing a
      // heuristic body here and stamping it as ours is the one thing this
      // module must never do.
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[rewrite] ${stub.articleId} failed: ${reason.slice(0, 200)}`)

      try {
        await recordRewriteFailure(stub.id, stub.rewriteAttempts, reason)
      } catch (saveErr) {
        // The database is the thing that just failed; losing the counter means
        // the article is retried next run, which is the safe direction.
        console.error(
          `[rewrite] could not record failure for ${stub.articleId}:`,
          saveErr instanceof Error ? saveErr.message : saveErr,
        )
      }

      result.failed++
      result.errors.push({ articleId: stub.articleId, reason: reason.slice(0, 200) })
    }
  }

  return result
}
