/**
 * lib/agent/registry.ts — The complete catalogue of what an external agent can do.
 *
 * This list *is* the API surface. There is no dynamic registration, no plugin
 * loading, no route that executes something not on it. Adding a capability
 * means adding a line here in a reviewed commit — which is the property that
 * makes "what can the agent do?" a question with a checkable answer.
 *
 * `getTool` is the only lookup, and it resolves nothing outside this array. A
 * tool name arriving from an agent is data, never a path or an identifier that
 * reaches the database.
 */

import type { AnyToolDefinition } from "./types"
import { toJsonSchema } from "./schema"
import { getArticleTool, searchArticlesTool } from "./tools/articles-read"
import {
  createArticleTool,
  setArticleImageTool,
  updateArticleSeoTool,
  updateArticleTool,
} from "./tools/articles-write"
import {
  approveArticleTool,
  archiveArticleTool,
  publishArticleTool,
  rejectArticleTool,
  scheduleArticleTool,
  submitArticleForReviewTool,
  unpublishArticleTool,
  unscheduleArticleTool,
} from "./tools/articles-lifecycle"
import { listCategoriesTool } from "./tools/taxonomy"

export const TOOLS: readonly AnyToolDefinition[] = [
  // Read
  searchArticlesTool,
  getArticleTool,
  listCategoriesTool,
  // Write
  createArticleTool,
  updateArticleTool,
  updateArticleSeoTool,
  setArticleImageTool,
  // Lifecycle
  submitArticleForReviewTool,
  approveArticleTool,
  rejectArticleTool,
  publishArticleTool,
  unpublishArticleTool,
  scheduleArticleTool,
  unscheduleArticleTool,
  archiveArticleTool,
] as readonly AnyToolDefinition[]

const BY_NAME = new Map<string, AnyToolDefinition>(TOOLS.map((tool) => [tool.name, tool]))

// Two tools sharing a name would make dispatch depend on array order. Caught at
// module load rather than at the first surprising request.
if (BY_NAME.size !== TOOLS.length) {
  throw new Error("[agent/registry] duplicate tool name in TOOLS")
}

export function getTool(name: string): AnyToolDefinition | null {
  return BY_NAME.get(name) ?? null
}

export function listToolNames(): string[] {
  return TOOLS.map((tool) => tool.name)
}

/** One tool as an agent sees it. */
export interface ToolDescriptor {
  name: string
  title: string
  description: string
  permissions: string[]
  mutating: boolean
  /** Mutating tools honour the Idempotency-Key header. */
  supportsIdempotencyKey: boolean
  endpoint: string
  method: "POST"
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}

export function describeTool(tool: AnyToolDefinition): ToolDescriptor {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    permissions: [...tool.permissions],
    mutating: tool.mutating,
    supportsIdempotencyKey: tool.mutating,
    endpoint: `/api/agent/tools/${tool.name}`,
    method: "POST",
    inputSchema: toJsonSchema(tool.input),
    outputSchema: tool.output,
  }
}

/**
 * The catalogue, optionally narrowed to what one agent may actually call.
 * Narrowing matters for a function-calling integration: an agent shown a tool
 * it is not permitted to use will call it, fail, and try again.
 */
export function describeTools(granted?: readonly string[]): ToolDescriptor[] {
  const held = granted ? new Set(granted) : null

  return TOOLS.filter(
    (tool) => !held || tool.permissions.every((permission) => held.has(permission)),
  ).map(describeTool)
}
