/**
 * lib/agent/types.ts — What a "tool" is in NotiLab.
 *
 * The brief asked for tools rather than endpoints, and this is where that
 * distinction is made real. A tool is a declared object, not a route: it names
 * itself, describes itself in language a model can act on, states the exact
 * inputs it accepts, the shape it returns, and the permissions it costs. The
 * HTTP layer is transport over this registry; so is the OpenAPI document, so is
 * the capabilities listing, and so is any future MCP or function-calling
 * adapter. None of them can drift from the others, because there is one
 * declaration.
 *
 * The rule that follows from that: there is no tool whose input is an
 * instruction. Every tool is a fixed verb over fixed fields.
 */

import type { AgentIdentity } from "./auth"
import type { ConfirmationDecision } from "./confirmation"
import type { FieldChange } from "./audit"
import type { FieldMap, Infer, JsonSchema } from "./schema"
import type { AgentPermission } from "./permissions"

/** Everything a handler is allowed to know about its caller. */
export interface ToolContext {
  agent: AgentIdentity
  requestId: string
  /** Fixed at the start of the request so every timestamp in one call agrees. */
  now: Date
}

export interface ToolResult<T> {
  data: T
  /**
   * What to write to the audit trail. Omitted by read-only tools — reads are
   * not audited, deliberately: an audit table that logs every search stops
   * being readable, and the interesting question is always what changed.
   */
  audit?: {
    /** The entity acted on. "-" if the tool created nothing and targeted nothing. */
    resourceId: string
    /** Overrides the tool's declared audit action, for tools with branches. */
    action?: string
    changes?: Record<string, FieldChange>
  }
}

export interface ToolDefinition<S extends FieldMap, TOut> {
  /** snake_case, stable. This is the name agents learn. */
  name: string
  /** Short human label for documentation. */
  title: string
  /**
   * Written for a language model deciding whether to call it. States what the
   * tool does and, where it matters, what it refuses to do — a model that knows
   * publish_article requires an approved article will approve first instead of
   * retrying a call that can never succeed.
   */
  description: string
  permissions: readonly AgentPermission[]
  /** Writes state. Drives audit, idempotency support and the HTTP verb in OpenAPI. */
  mutating: boolean
  input: S
  /** Descriptive, not enforced — this is our own output. */
  output: JsonSchema
  /** Default audit action/resource; a handler may override the action. */
  audit?: { action: string; resource: string }

  /**
   * Declared as a method, not a function-typed property, so the registry can
   * hold tools with different input types (method parameters are bivariant).
   */
  confirmation?(input: Infer<S>): ConfirmationDecision

  handler(input: Infer<S>, ctx: ToolContext): Promise<ToolResult<TOut>>
}

/** Identity function that preserves inference on the input field map. */
export function defineTool<S extends FieldMap, TOut>(
  definition: ToolDefinition<S, TOut>,
): ToolDefinition<S, TOut> {
  return definition
}

/** Type-erased tool, as stored in the registry. */
export type AnyToolDefinition = ToolDefinition<FieldMap, unknown>
