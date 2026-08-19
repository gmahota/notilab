/**
 * Shared shapes for the /now immersive feed. Mirrors exactly what
 * GET /api/news/feed and GET /api/news/[id] already return — do not add
 * fields here that the backend doesn't send.
 *
 * Deliberate exception: `SpatialAsset` / `spatialAsset` below is typed ahead
 * of the backend as forward-looking scaffolding for the "Entrar na cena"
 * spatial story viewer (phase 5 of the /now redesign). No article in
 * production populates this today — it's tracked separately as "Fase 7" in
 * project docs, which will add real backend support. The type exists now so
 * the frontend contract is ready the moment that field starts arriving.
 */

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT"

export interface FeedCategory {
  name: string
  slug: string
  color: string
}

export interface FeedStats {
  reactions: number
  reads: number
  saves: number
}

/** One item from GET /api/news/feed */
export interface FeedArticle {
  id: string
  title: string
  slug: string
  summary: string
  tldr: string | null
  whyItMatters: string | null
  imageUrl: string
  sourceUrl: string
  sourceName: string
  publishedAt: string
  category: FeedCategory
  tags: string[]
  trending: boolean
  priority: Priority
  sentiment: string
  readTime: number
  /** Only present when the item came from the ranked feed endpoint. */
  rankScore?: number
  stats: FeedStats
  /**
   * Forward-looking scaffolding for the "Entrar na cena" spatial viewer.
   * The backend never populates this yet (see top-of-file note) — always
   * `undefined` in production today.
   */
  spatialAsset?: SpatialAsset
}

export interface SceneHotspot {
  x: number // 0-100, percentage position
  y: number // 0-100, percentage position
  title: string
  text: string
}

export interface SceneCameraPreset {
  rx: number // rotateX degrees
  ry: number // rotateY degrees
  z: number // scale
  label: string
}

export interface SceneTimelineMark {
  at: number // 0-100, position on the timeline slider
  label: string
}

export interface SpatialAsset {
  type: "map" | "photo"
  assetUrl: string | null // future .splat/.ply/gaussian-splat source; null = fallbackImage-only for now
  fallbackImage: string
  sizeLabel: string // human-readable, e.g. "24 MB"
  title: string
  subtitle: string
  hotspots: SceneHotspot[]
  cameraPresets: SceneCameraPreset[]
  timeline?: SceneTimelineMark[] // only present for "map" scenes
}

export interface RelatedStory {
  id: string
  title: string
  slug: string
  imageUrl: string
  publishedAt: string
  category: { slug: string }
}

/** GET /api/news/[id] response */
export interface ArticleDetail extends Omit<FeedArticle, "rankScore"> {
  content: string
  source: { name: string; priority: string } | null
  relatedStories: RelatedStory[]
}
