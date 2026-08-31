/**
 * lib/agent/permissions.ts — The capability catalogue for external agents.
 *
 * A permission is the unit an operator grants, and the unit a tool demands.
 * Deliberately finer-grained than the tool list so one credential can be
 * "read + fix SEO" without also being able to publish — the SEO agent and the
 * editorial agent in the roadmap are the same code with different grants.
 *
 * These strings appear in environment variables and in the capabilities
 * document an agent reads at startup. Renaming one silently downgrades a
 * deployed agent to fewer permissions than intended, so treat them as frozen.
 *
 * Note on what is NOT here, on purpose: there is no permission that would let
 * an external agent manage users, grant roles, edit global settings, read or
 * rotate secrets, delete audit rows, or run arbitrary queries. Those are not
 * gated capabilities — they have no tool at all, which is a stronger guarantee
 * than a permission an operator could mistakenly grant.
 */

export const AGENT_PERMISSIONS = [
  /** Read articles and their media/SEO-relevant fields. */
  "article.read",
  /** Create a new article. Always lands in DRAFT — see lib/editorial/article-service.ts. */
  "article.create",
  /** Edit editorial fields of an existing article. */
  "article.update",
  /** Move an article through review: submit for review, approve, reject. */
  "article.review",
  /** Make an APPROVED article publicly visible. */
  "article.publish",
  /** Withdraw a PUBLISHED article from the public site. */
  "article.unpublish",
  /** Schedule or cancel a future publication. */
  "article.schedule",
  /** Archive an article. NotiLab's stand-in for delete — nothing is destroyed. */
  "article.archive",
  /** Set or clear an article's lead image. */
  "media.update",
  /** Edit the fields that drive search-engine presentation. */
  "seo.update",
  /** Read the category taxonomy. */
  "taxonomy.read",
] as const

export type AgentPermission = (typeof AGENT_PERMISSIONS)[number]

const PERMISSION_SET = new Set<string>(AGENT_PERMISSIONS)

export function isAgentPermission(value: string): value is AgentPermission {
  return PERMISSION_SET.has(value)
}

/** Human-readable catalogue, surfaced by GET /api/agent/capabilities. */
export const PERMISSION_DESCRIPTIONS: Record<AgentPermission, string> = {
  "article.read": "Read articles, including drafts and their full body.",
  "article.create": "Create a new article. It is always created as a DRAFT.",
  "article.update": "Update editorial fields (title, summary, content, category, tags, priority).",
  "article.review": "Move an article through the editorial review workflow.",
  "article.publish": "Publish an article that has already been approved.",
  "article.unpublish": "Withdraw a published article from the public site.",
  "article.schedule": "Schedule a future publication, or cancel a pending one.",
  "article.archive": "Archive an article so it stops appearing anywhere.",
  "media.update": "Set or clear the lead image of an article.",
  "seo.update": "Update the fields that drive search-engine presentation.",
  "taxonomy.read": "List the available categories.",
}

/**
 * What an agent gets when the environment names a key but no permission list.
 * Read-only on purpose: a misconfigured credential should be able to look, and
 * nothing else. Widening this default would turn a forgotten env var into
 * write access to the newsroom.
 */
export const DEFAULT_PERMISSIONS: readonly AgentPermission[] = ["article.read", "taxonomy.read"]

/**
 * Named bundles, so an operator can write `NOTILAB_AGENT_PERMISSIONS=editorial`
 * instead of listing eleven strings and getting one wrong. These are the three
 * agent shapes the brief called for.
 */
export const PERMISSION_PRESETS: Record<string, readonly AgentPermission[]> = {
  /** Look, never touch. */
  readonly: ["article.read", "taxonomy.read"],
  /** Full newsroom operation, including the publish gate. */
  editorial: [
    "article.read",
    "article.create",
    "article.update",
    "article.review",
    "article.publish",
    "article.unpublish",
    "article.schedule",
    "article.archive",
    "media.update",
    "seo.update",
    "taxonomy.read",
  ],
  /** Improves how stories present in search; cannot change what they say. */
  seo: ["article.read", "seo.update", "media.update", "taxonomy.read"],
}

/**
 * Resolves a comma-separated grant string into permissions. Accepts preset
 * names and individual permissions, mixed.
 *
 * Unknown entries are returned separately rather than ignored: a typo in
 * `NOTILAB_AGENT_PERMISSIONS` must be visible in the server log, not silently
 * reduce the agent's abilities and look like a bug in the agent.
 */
export function resolvePermissions(raw: string): {
  permissions: AgentPermission[]
  unknown: string[]
} {
  const granted = new Set<AgentPermission>()
  const unknown: string[] = []

  for (const token of raw.split(",")) {
    const entry = token.trim()
    if (entry.length === 0) continue

    const preset = PERMISSION_PRESETS[entry.toLowerCase()]
    if (preset) {
      for (const permission of preset) granted.add(permission)
      continue
    }

    if (isAgentPermission(entry)) {
      granted.add(entry)
      continue
    }

    unknown.push(entry)
  }

  return { permissions: [...granted], unknown }
}
