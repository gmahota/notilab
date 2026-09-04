/**
 * lib/mcp/tools.ts — The registry, projected into MCP's tool descriptor shape.
 *
 * There are no MCP schemas in this file, and that is the whole point. Names,
 * descriptions, permissions and input schemas all come from
 * `lib/agent/registry.ts` through the same `toJsonSchema()` that produces the
 * Agent API's capabilities document and its OpenAPI spec. Adding a tool to the
 * registry exposes it over MCP; removing one removes it. There is no second
 * list to keep in step, so there is nothing to drift.
 *
 * The one thing MCP asks for that the registry does not carry is *annotations*
 * — behavioural hints a client uses to decide whether to warn a human before a
 * call. Those are declared below, per tool, with a deliberately conservative
 * default for any tool that has not been classified yet.
 */

import { TOOLS } from "@/lib/agent/registry"
import { toJsonSchema, type JsonSchema } from "@/lib/agent/schema"
import type { AgentPermission } from "@/lib/agent/permissions"

/**
 * MCP tool annotations. Hints, not enforcement — the spec is explicit that a
 * client must treat them as untrusted unless the server is trusted. NotiLab's
 * real guarantees live in the registry's permissions and in
 * lib/editorial/article-service.ts; these only shape how a client presents a
 * call to its user.
 */
export interface McpToolAnnotations {
  title: string
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  /** Every tool acts on NotiLab's own database, never on the open internet. */
  openWorldHint: false
}

export interface McpToolDescriptor {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: McpToolAnnotations
}

/**
 * Behaviour of each mutating tool, in MCP's vocabulary.
 *
 *   destructive — the effect cannot be undone through this API. True only for
 *     the two terminal transitions; `business-rules.md` makes REJECTED and
 *     ARCHIVED one-way, so an agent cannot walk them back.
 *   idempotent  — repeating the call with the same arguments adds no further
 *     effect. True for every tool that either no-ops on an unchanged value
 *     (the update tools answer NO_FIELDS_TO_UPDATE) or on an already-reached
 *     state (the lifecycle tools). False for create_article, which is the one
 *     tool that genuinely produces a new row per call.
 *
 * Read-only tools are not listed: `readOnlyHint` alone describes them, and the
 * other two hints are defined by the spec as meaningful only when it is false.
 */
const MUTATING_BEHAVIOUR: Record<string, { destructive: boolean; idempotent: boolean }> = {
  create_article: { destructive: false, idempotent: false },
  update_article: { destructive: false, idempotent: true },
  update_article_seo: { destructive: false, idempotent: true },
  set_article_image: { destructive: false, idempotent: true },
  submit_article_for_review: { destructive: false, idempotent: true },
  approve_article: { destructive: false, idempotent: true },
  reject_article: { destructive: true, idempotent: true },
  publish_article: { destructive: false, idempotent: true },
  unpublish_article: { destructive: false, idempotent: true },
  schedule_article: { destructive: false, idempotent: true },
  unschedule_article: { destructive: false, idempotent: true },
  archive_article: { destructive: true, idempotent: true },
}

/**
 * What an unclassified mutating tool gets. Assume the worst: a tool someone
 * adds to the registry without thinking about MCP is presented as destructive
 * and non-idempotent, so a client warns about it. `__tests__/lib/mcp/server.test.ts`
 * fails when this default is reached, so it is a safety net rather than a
 * resting place.
 */
const CONSERVATIVE_DEFAULT = { destructive: true, idempotent: false } as const

/** Tool names that have no behaviour entry. Exported for the drift test. */
export function unclassifiedMutatingTools(): string[] {
  return TOOLS.filter((tool) => tool.mutating && !MUTATING_BEHAVIOUR[tool.name]).map(
    (tool) => tool.name,
  )
}

function describe(tool: (typeof TOOLS)[number]): McpToolDescriptor {
  const behaviour = tool.mutating
    ? (MUTATING_BEHAVIOUR[tool.name] ?? CONSERVATIVE_DEFAULT)
    : { destructive: false, idempotent: true }

  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: toJsonSchema(tool.input),
    annotations: {
      title: tool.title,
      readOnlyHint: !tool.mutating,
      destructiveHint: behaviour.destructive,
      idempotentHint: behaviour.idempotent,
      openWorldHint: false,
    },
  }
}

/**
 * The catalogue, narrowed to what this credential may actually call.
 *
 * Narrowing is not cosmetic. A model shown a tool it is not permitted to use
 * will call it, be refused, and try again — so an MCP credential granted
 * `readonly` is told about three tools and not about the other twelve.
 */
export function listMcpTools(granted: readonly AgentPermission[]): McpToolDescriptor[] {
  const held = new Set<string>(granted)
  return TOOLS.filter((tool) => tool.permissions.every((permission) => held.has(permission))).map(
    describe,
  )
}
