/**
 * lib/story-service.ts
 *
 * Server-side reads for NOW V2. The single place that decides where a Story
 * comes from:
 *
 *   1. the `Story` tables, when they hold anything;
 *   2. otherwise `News` + `ArticleAI`, adapted into the same read model.
 *
 * Path 2 exists because clustering (spec § 19/§ 20) is not built yet — nothing
 * writes `News.storyId` automatically. Without the adapter, `/now` would be
 * empty until an entire ingestion pipeline was rewritten; with it, the V2
 * experience ships on the data we already hold and gets *better*, not
 * different, when clustering lands.
 *
 * What the adapter does NOT do is invent the fields it has no data for. A
 * News-derived story has one source, no location, no key facts, no context and
 * no "what's next" — those come back null/empty and the UI omits the section.
 * Filling them with plausible text would be the one failure mode this product
 * cannot afford.
 *
 * Removing the fallback: once clustering populates `Story` for every published
 * article, `newsFallbackFeed`/`newsFallbackBrief` and `resolveSource` can go,
 * and the two `fromStory*` functions become the whole file.
 */

import type { Prisma } from "@prisma/client"

import { prisma } from "./prisma"
import { rankStories, type RankableStory } from "./story-ranking"
import { storyTablesPresent } from "./story-tables"
import type {
  FeedLane,
  NowFeedPage,
  NowStory,
  StoryBrief,
  StoryKeyFactView,
  StoryMediaKind,
  StoryMediaView,
  StorySourceKind,
  StorySourceView,
  StoryStatusView,
} from "./story-view"

/** Hard ceiling on the candidate pool we rank per request. */
const MAX_CANDIDATES = 120

/** Cards per page. */
export const NOW_PAGE_SIZE = 10

/** A story counts as breaking only inside this window (spec § 32). */
const BREAKING_WINDOW_HOURS = 6

/** How long the "do the Story tables exist?" probe is trusted. */
const SOURCE_PROBE_TTL_MS = 60_000

/** ~1 min of tolerance, so a same-transaction `updatedAt` is not an "update". */
const UPDATE_EPSILON_MS = 60_000

// ---------------------------------------------------------------------------
// Which backing store to use
// ---------------------------------------------------------------------------

type Backing = "story" | "news"

let probeCache: { value: Backing; at: number } | null = null

/**
 * Decides where this request reads from.
 *
 * Falls back to `News` both when the tables are absent (migration not applied)
 * and when they are present but empty (migration applied, backfill/clustering
 * not run) — otherwise applying the migration would blank the feed.
 *
 * Cached briefly so one page of cards does not re-probe on every call, but not
 * for the process lifetime: a deploy should not be needed for the switch-over
 * to take effect.
 */
async function resolveSource(): Promise<Backing> {
  const cached = probeCache
  if (cached && Date.now() - cached.at < SOURCE_PROBE_TTL_MS) return cached.value

  let value: Backing = "news"

  if (await storyTablesPresent()) {
    const count = await prisma.story.count()
    if (count > 0) value = "story"
  }

  probeCache = { value, at: Date.now() }
  return value
}

/** Test/ops helper: drops the cached probe so the next read re-decides. */
export function resetStorySourceProbe(): void {
  probeCache = null
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function toStatusView(status: string): StoryStatusView {
  switch (status) {
    case "CONFIRMED":
      return "confirmed"
    case "UPDATED":
      return "updated"
    case "CLOSED":
      return "closed"
    default:
      return "developing"
  }
}

function toSourceKind(type: string): StorySourceKind {
  switch (type) {
    case "OFFICIAL":
      return "official"
    case "DOCUMENT":
      return "document"
    case "SOCIAL":
      return "social"
    default:
      return "news"
  }
}

function toMediaKind(type: string | null): StoryMediaKind {
  if (type === "video" || type === "map" || type === "chart") return type
  return "image"
}

function toMedia(
  url: string | null,
  type: string | null,
  credit: string | null,
): StoryMediaView | null {
  if (!url) return null
  return { url, type: toMediaKind(type), credit }
}

/**
 * Spec § 32 — deliberately narrow. Recency alone is not breaking; the item has
 * to have been flagged urgent *and* be fresh.
 */
function isBreaking(flagged: boolean, publishedAt: Date): boolean {
  if (!flagged) return false
  const hoursAgo = (Date.now() - publishedAt.getTime()) / 3_600_000
  return hoursAgo <= BREAKING_WINDOW_HOURS
}

/**
 * Whether we may claim a status at all (spec § 17/§ 18).
 *
 * A single-source story that has never been revised has not been assessed
 * against anything, so "DEVELOPING" on it would be a signal we invented. Only
 * corroborated or genuinely revised stories carry a status badge.
 */
function statusOrNull(
  status: StoryStatusView,
  sourceCount: number,
  wasUpdated: boolean,
): StoryStatusView | null {
  if (sourceCount >= 2 || wasUpdated) return status
  return null
}

// ---------------------------------------------------------------------------
// Story tables -> read model
// ---------------------------------------------------------------------------

const storyCardSelect = {
  id: true,
  slug: true,
  headline: true,
  summary: true,
  whyItMatters: true,
  location: true,
  status: true,
  importanceScore: true,
  publishedAt: true,
  updatedAt: true,
  heroImageUrl: true,
  heroMediaType: true,
  heroCredit: true,
  categoryId: true,
  topics: true,
  category: { select: { name: true, slug: true, color: true } },
  entities: { select: { normalized: true } },
  sources: { select: { publisher: true }, orderBy: { publishedAt: "asc" }, take: 3 },
  _count: { select: { sources: true } },
} satisfies Prisma.StorySelect

type StoryCardRow = Prisma.StoryGetPayload<{ select: typeof storyCardSelect }>

function fromStoryRow(row: StoryCardRow): NowStory {
  const wasUpdated = row.updatedAt.getTime() - row.publishedAt.getTime() > UPDATE_EPSILON_MS
  const sourceCount = row._count.sources
  const status = toStatusView(String(row.status))

  return {
    id: row.id,
    slug: row.slug,
    headline: row.headline,
    whatHappened: row.summary,
    whyItMatters: row.whyItMatters,
    topic: {
      name: row.category?.name ?? "",
      slug: row.category?.slug ?? "",
      color: row.category?.color ?? "#007BFF",
    },
    location: row.location,
    status: statusOrNull(status, sourceCount, wasUpdated),
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    wasUpdated,
    media: toMedia(row.heroImageUrl, row.heroMediaType, row.heroCredit),
    sourceCount,
    sourceNames: row.sources.map((s) => s.publisher),
    // The Story pipeline has no per-story "urgent" flag yet; importance is the
    // only signal available, and the bar is set high on purpose.
    breaking: isBreaking(row.importanceScore >= 90, row.publishedAt),
    importanceScore: row.importanceScore,
  }
}

// ---------------------------------------------------------------------------
// News + ArticleAI -> read model (transitional)
// ---------------------------------------------------------------------------

const newsCardSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  content: true,
  imageUrl: true,
  sourceUrl: true,
  sourceName: true,
  publishedAt: true,
  priority: true,
  importanceScore: true,
  tags: true,
  categoryId: true,
  category: { select: { name: true, slug: true, color: true } },
  articleAI: { select: { summary: true, tldr: true, whyItMatters: true, importanceScore: true } },
  source: { select: { priority: true } },
} satisfies Prisma.NewsSelect

type NewsCardRow = Prisma.NewsGetPayload<{ select: typeof newsCardSelect }>

/** Card-length "what happened", preferring the shortest real text we hold. */
function newsWhatHappened(row: NewsCardRow): string {
  const candidate = row.articleAI?.tldr ?? row.articleAI?.summary ?? row.summary ?? ""
  if (candidate.trim().length > 0) return candidate.trim()

  // No summary of any kind — open the body rather than show an empty card,
  // cut at a sentence boundary where there is one.
  const body = row.content.trim().replace(/\s+/g, " ")
  if (body.length <= 200) return body
  const cut = body.slice(0, 200)
  const lastStop = cut.lastIndexOf(". ")
  return lastStop > 80 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`
}

function fromNewsRow(row: NewsCardRow): NowStory {
  const importance = row.articleAI?.importanceScore ?? row.importanceScore ?? 0

  return {
    id: row.id,
    slug: row.slug ?? row.id,
    headline: row.title,
    whatHappened: newsWhatHappened(row),
    whyItMatters: row.articleAI?.whyItMatters ?? null,
    topic: {
      name: row.category?.name ?? "",
      slug: row.category?.slug ?? "",
      color: row.category?.color ?? "#007BFF",
    },
    // `News` has no location column. Omitted rather than guessed from the body.
    location: null,
    // One source, and no way to tell whether it was ever revised: `News`
    // `updatedAt` is bumped by the ranking cron, so unlike `Story.updatedAt` it
    // does not mean an editorial update. No status claim either way.
    status: null,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.publishedAt.toISOString(),
    wasUpdated: false,
    media: toMedia(row.imageUrl, "image", null),
    sourceCount: 1,
    sourceNames: [row.sourceName],
    breaking: isBreaking(String(row.priority) === "URGENT", row.publishedAt),
    importanceScore: importance,
  }
}

function newsAsSingleSource(row: NewsCardRow): StorySourceView {
  return {
    id: row.id,
    publisher: row.sourceName,
    url: row.sourceUrl,
    headline: row.title,
    publishedAt: row.publishedAt.toISOString(),
    sourceType: "news",
    reliabilityScore: row.source?.priority ?? null,
  }
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export interface NowFeedOptions {
  lane: FeedLane
  limit?: number
  offset?: number
  /** Optional viewer, for the interest dimension of the ranking. */
  userId?: string
}

async function preferredCategoryIds(userId: string | undefined): Promise<string[]> {
  if (!userId) return []
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { categories: true },
  })
  return prefs?.categories ?? []
}

/**
 * Ranks a candidate pool and returns one page of it.
 *
 * The whole pool is ranked and *then* sliced, rather than ranking each page
 * independently, because the diversity dimension depends on what came before:
 * re-ranking a fresh window per page would let page 2 repeat what page 1 just
 * spread out. The pool is bounded by `MAX_CANDIDATES`, so a deep enough scroll
 * eventually runs out — `hasMore` reports that instead of looping.
 */
function rankedPage(
  candidates: Array<{ story: NowStory; rankable: RankableStory }>,
  lane: FeedLane,
  userCategoryIds: string[],
  offset: number,
  limit: number,
): NowFeedPage {
  const byId = new Map(candidates.map((c) => [c.rankable.id, c.story]))
  const ranked = rankStories(
    candidates.map((c) => c.rankable),
    {
      userCategoryIds,
      // "World" is explicitly not personalised (spec § 6).
      ignoreInterest: lane === "world",
    },
  )

  const ordered = ranked
    .map((r) => byId.get(r.story.id))
    .filter((s): s is NowStory => Boolean(s))

  return {
    stories: ordered.slice(offset, offset + limit),
    offset,
    hasMore: ordered.length > offset + limit,
  }
}

async function storyFeed(
  lane: FeedLane,
  limit: number,
  offset: number,
  userCategoryIds: string[],
): Promise<NowFeedPage> {
  const rows = await prisma.story.findMany({
    where: { status: { not: "CLOSED" } },
    orderBy: { publishedAt: "desc" },
    take: Math.min(MAX_CANDIDATES, offset + limit * 3),
    select: storyCardSelect,
  })

  const candidates = rows.map((row) => ({
    story: fromStoryRow(row),
    rankable: {
      id: row.id,
      importanceScore: row.importanceScore,
      publishedAt: row.publishedAt,
      categoryId: row.categoryId,
      // Entities when extraction has run; topics otherwise. A backfilled story
      // has no entities yet, and falling back to topics keeps the § 34 spread
      // working instead of silently degrading to category-only.
      entityKeys:
        row.entities.length > 0
          ? row.entities.map((e) => e.normalized)
          : (row.topics ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
    } satisfies RankableStory,
  }))

  return rankedPage(candidates, lane, userCategoryIds, offset, limit)
}

async function newsFallbackFeed(
  lane: FeedLane,
  limit: number,
  offset: number,
  userCategoryIds: string[],
): Promise<NowFeedPage> {
  const rows = await prisma.news.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: Math.min(MAX_CANDIDATES, offset + limit * 3),
    select: newsCardSelect,
  })

  const candidates = rows.map((row) => ({
    story: fromNewsRow(row),
    rankable: {
      id: row.id,
      importanceScore: row.articleAI?.importanceScore ?? row.importanceScore ?? 0,
      publishedAt: row.publishedAt,
      categoryId: row.categoryId,
      // No entity extraction on `News`; tags are the closest real signal, and
      // enough to stop five cards about the same tag stacking up.
      entityKeys: (row.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
    } satisfies RankableStory,
  }))

  return rankedPage(candidates, lane, userCategoryIds, offset, limit)
}

/**
 * One page of the NOW feed.
 *
 * `following` returns nothing on purpose: following requires user accounts and
 * a subscription model that do not exist yet (spec § 6 allows the lane to stay
 * inactive). It is served empty rather than silently aliased to "for you", so
 * the UI can say what is actually going on.
 */
export async function getNowFeed(options: NowFeedOptions): Promise<NowFeedPage> {
  const limit = Math.min(20, Math.max(1, options.limit ?? NOW_PAGE_SIZE))
  const offset = Math.max(0, options.offset ?? 0)

  if (options.lane === "following") {
    return { stories: [], offset, hasMore: false }
  }

  const [backing, userCategoryIds] = await Promise.all([
    resolveSource(),
    preferredCategoryIds(options.userId),
  ])

  return backing === "story"
    ? storyFeed(options.lane, limit, offset, userCategoryIds)
    : newsFallbackFeed(options.lane, limit, offset, userCategoryIds)
}

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

async function storyBrief(slug: string): Promise<StoryBrief | null> {
  const row = await prisma.story.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: {
      ...storyCardSelect,
      narrative: true,
      context: true,
      whatsNext: true,
      keyFacts: {
        select: { value: true, label: true, context: true },
        orderBy: { position: "asc" },
      },
      sources: {
        select: {
          id: true,
          publisher: true,
          url: true,
          headline: true,
          publishedAt: true,
          sourceType: true,
          reliabilityScore: true,
        },
        orderBy: { publishedAt: "asc" },
      },
    },
  })

  if (!row) return null

  // `storyCardSelect` caps `sources` at 3 for the card; the Brief re-selects
  // them in full, so hand `fromStoryRow` a row shaped the way it expects.
  const card = fromStoryRow({
    ...row,
    sources: row.sources.slice(0, 3).map((s) => ({ publisher: s.publisher })),
  })

  const keyFacts: StoryKeyFactView[] = row.keyFacts.map((f) => ({
    value: f.value,
    label: f.label,
    context: f.context,
  }))

  return {
    ...card,
    narrative: row.narrative,
    keyFacts,
    context: row.context,
    whatsNext: row.whatsNext,
    topics: row.topics ?? [],
    sources: row.sources.map((s) => ({
      id: s.id,
      publisher: s.publisher,
      url: s.url,
      headline: s.headline,
      publishedAt: s.publishedAt.toISOString(),
      sourceType: toSourceKind(String(s.sourceType)),
      reliabilityScore: s.reliabilityScore,
    })),
  }
}

async function newsFallbackBrief(slug: string): Promise<StoryBrief | null> {
  const row = await prisma.news.findFirst({
    where: { status: "PUBLISHED", OR: [{ slug }, { id: slug }] },
    select: newsCardSelect,
  })

  if (!row) return null

  return {
    ...fromNewsRow(row),
    narrative: row.content?.trim() || null,
    // No extraction pipeline yet — empty, so the Brief omits these sections
    // rather than showing invented numbers or a guessed "what's next".
    keyFacts: [],
    context: null,
    whatsNext: null,
    topics: row.tags ?? [],
    sources: [newsAsSingleSource(row)],
  }
}

/**
 * One Story by slug (or id), for `/story/[slug]` and the contextual NotiBot.
 * Returns null when it does not exist, so the caller renders a 404 instead of
 * inventing content.
 */
export async function getStoryBrief(slug: string): Promise<StoryBrief | null> {
  const backing = await resolveSource()
  const brief = backing === "story" ? await storyBrief(slug) : await newsFallbackBrief(slug)
  if (brief) return brief

  // After a partial backfill, a story the user has a link to may still exist
  // only as a News row. Try the other store once before giving up, so old
  // share links keep resolving.
  return backing === "story" ? newsFallbackBrief(slug) : null
}

/** Slugs of the newest stories, for sitemap/prerender callers. */
export async function getRecentStorySlugs(limit = 20): Promise<string[]> {
  const backing = await resolveSource()

  if (backing === "story") {
    const rows = await prisma.story.findMany({
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { slug: true },
    })
    return rows.map((r) => r.slug)
  }

  const rows = await prisma.news.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: { slug: true, id: true },
  })
  return rows.map((r) => r.slug ?? r.id)
}

/**
 * Cards for a specific set of slugs, in the order given.
 *
 * Used by `/saved`, where the set comes from the visitor's own device rather
 * than from ranking — so the feed ranker is deliberately not involved. Slugs
 * that no longer resolve are dropped silently: a story can be unpublished after
 * it was saved, and a missing card is better than an error page.
 */
export async function getStoriesBySlugs(slugs: string[]): Promise<NowStory[]> {
  const wanted = slugs.map((s) => s.trim()).filter(Boolean).slice(0, 50)
  if (wanted.length === 0) return []

  const backing = await resolveSource()

  if (backing === "story") {
    const rows = await prisma.story.findMany({
      where: { OR: [{ slug: { in: wanted } }, { id: { in: wanted } }] },
      select: storyCardSelect,
    })
    const byKey = new Map<string, NowStory>()
    for (const row of rows) {
      const story = fromStoryRow(row)
      byKey.set(row.slug, story)
      byKey.set(row.id, story)
    }
    return wanted.map((key) => byKey.get(key)).filter((s): s is NowStory => Boolean(s))
  }

  const rows = await prisma.news.findMany({
    where: { status: "PUBLISHED", OR: [{ slug: { in: wanted } }, { id: { in: wanted } }] },
    select: newsCardSelect,
  })
  const byKey = new Map<string, NowStory>()
  for (const row of rows) {
    const story = fromNewsRow(row)
    if (row.slug) byKey.set(row.slug, story)
    byKey.set(row.id, story)
  }
  return wanted.map((key) => byKey.get(key)).filter((s): s is NowStory => Boolean(s))
}
