/**
 * lib/story-ranking.ts
 *
 * NOW V2 feed ordering (spec § 33/§ 34).
 *
 *   feedScore = importance×0.40 + recency×0.25 + interest×0.25 + diversity×0.10
 *
 * All four dimensions are 0–100, so `feedScore` is too. The weights are the
 * spec's starting point, explicitly to be recalibrated once there is real
 * behavioural data — they are not tuned.
 *
 * Why this is separate from `lib/ranking.ts`: that engine ranks *articles* and
 * feeds `News.rankingScore`, with dimensions this feed does not have (source
 * trust per article, trending-tag overlap). This one ranks *stories*, where the
 * source-count and entity information live on the Story instead. The shared
 * conventions — 0–100 dimensions, 24 h recency half-life, neutral 50 affinity
 * for anonymous visitors — are deliberately kept identical.
 *
 * Diversity is the one dimension that is not a property of the story on its
 * own: it measures how much variety the story adds *given what has already
 * been placed in the feed*. That makes ordering a greedy selection rather than
 * a sort, which is also what enforces § 34 ("no five Trump cards in a row").
 */

/** Weights from spec § 33. Sum must be 1.0. */
export const STORY_FEED_WEIGHTS = {
  importance: 0.4,
  recency: 0.25,
  interest: 0.25,
  diversity: 0.1,
} as const

/** Recency half-life in hours — matches `lib/ranking.ts`. */
const HALF_LIFE_HOURS = 24
const DECAY_LAMBDA = Math.LN2 / HALF_LIFE_HOURS

/**
 * How far back the diversity penalty looks. Repetition hurts most when it is
 * adjacent, so only the recent window of the emerging feed is considered.
 */
const DIVERSITY_WINDOW = 5

/** Penalty applied per prior appearance of the same category inside the window. */
const CATEGORY_PENALTY = 28

/** Penalty per prior appearance of a shared entity inside the window. */
const ENTITY_PENALTY = 34

/** Everything the ranker needs about one story. */
export interface RankableStory {
  id: string
  /** 0–100. */
  importanceScore: number
  publishedAt: Date
  /** Used for the § 34 category cap. */
  categoryId: string
  /**
   * Normalised entity keys (lowercased names). Empty is fine — the category
   * cap still applies, the entity cap simply has nothing to act on.
   */
  entityKeys: string[]
}

export interface RankOptions {
  /**
   * The viewer's preferred category ids. Omit (or pass empty) for anonymous
   * visitors: interest then scores a neutral 50 for every story, so nobody is
   * boosted or penalised.
   */
  userCategoryIds?: string[]
  /**
   * `world` ignores stated interests entirely (spec § 6: "principais
   * acontecimentos independentemente das preferências"), so interest is held
   * neutral for every story and importance decides.
   */
  ignoreInterest?: boolean
  /** Injectable for deterministic tests. Defaults to `Date.now()`. */
  now?: number
}

export interface RankedStory<T extends RankableStory> {
  story: T
  feedScore: number
}

/** 100 → just published, 50 → 24 h old, ~25 → 48 h old. */
export function recencyScore(publishedAt: Date, now: number): number {
  const hoursAgo = Math.max(0, (now - publishedAt.getTime()) / 3_600_000)
  return 100 * Math.exp(-DECAY_LAMBDA * hoursAgo)
}

/**
 * 50 when we know nothing about the viewer, 100 for a preferred category,
 * 20 otherwise — the same scale `lib/ranking.ts` uses for user affinity.
 */
export function interestScore(categoryId: string, userCategoryIds?: string[]): number {
  if (!userCategoryIds || userCategoryIds.length === 0) return 50
  return userCategoryIds.includes(categoryId) ? 100 : 20
}

/**
 * How much variety this story adds. 100 when nothing like it is nearby; drops
 * for each repeated category or shared entity in the trailing window.
 */
export function diversityScore(story: RankableStory, placed: RankableStory[]): number {
  if (placed.length === 0) return 100

  const window = placed.slice(-DIVERSITY_WINDOW)
  let penalty = 0

  for (const prior of window) {
    if (prior.categoryId === story.categoryId) penalty += CATEGORY_PENALTY
  }

  if (story.entityKeys.length > 0) {
    const keys = new Set(story.entityKeys)
    for (const prior of window) {
      if (prior.entityKeys.some((k) => keys.has(k))) penalty += ENTITY_PENALTY
    }
  }

  return Math.max(0, 100 - penalty)
}

/**
 * Orders stories for the NOW feed.
 *
 * Greedy rather than a plain sort, because `diversityScore` depends on what has
 * already been placed: at each step the best remaining story *in context* wins.
 * With N stories this is O(N²); N here is one page of the feed (tens), so that
 * is cheaper than the database round-trip that produced them.
 */
export function rankStories<T extends RankableStory>(
  stories: T[],
  options: RankOptions = {},
): RankedStory<T>[] {
  const now = options.now ?? Date.now()
  const w = STORY_FEED_WEIGHTS

  const remaining = [...stories]
  const placed: T[] = []
  const result: RankedStory<T>[] = []

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestScore = -1

    for (let i = 0; i < remaining.length; i++) {
      const story = remaining[i]
      const score =
        Math.min(100, Math.max(0, story.importanceScore)) * w.importance +
        recencyScore(story.publishedAt, now) * w.recency +
        (options.ignoreInterest ? 50 : interestScore(story.categoryId, options.userCategoryIds)) *
          w.interest +
        diversityScore(story, placed) * w.diversity

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1)
    placed.push(chosen)
    result.push({ story: chosen, feedScore: bestScore })
  }

  return result
}
