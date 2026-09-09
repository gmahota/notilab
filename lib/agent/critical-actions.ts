/**
 * lib/agent/critical-actions.ts — Which tools are dangerous enough to need a
 * second call, in one place.
 *
 * Before this module the risk classification lived nowhere: `mutating` split
 * reads from writes, and nothing distinguished "fix a typo in a summary" from
 * "put this story on the front page". Those are not the same act, and an
 * operator reviewing an agent integration needs the difference to be legible
 * without reading fifteen tool declarations.
 *
 * So the tiers are declared here, once, and everything else derives from them:
 * the confirmation policy the four critical tools attach, the `risk` column in
 * `/api/agent/capabilities`, the MCP tool descriptors, and the table in
 * `docs/mcp.md`. There is deliberately no per-transport copy — a rule that is
 * stricter over HTTP than over MCP is a rule an agent can shop around.
 *
 * Kept free of any import from `registry.ts` on purpose: the tools import this
 * module, so a dependency the other way would be a cycle. The check that these
 * names still exist in the registry lives in
 * `__tests__/lib/agent/critical-actions.test.ts` instead.
 */

import type { AgentIdentity } from "./auth"
import type { ConfirmationDecision } from "./confirmation"

/**
 *   read     — cannot change anything. No confirmation, no audit row, no
 *              idempotency key.
 *   write    — changes one article's content or moves it through the early part
 *              of the workflow. Audited and idempotent; every effect is
 *              reachable back through another tool.
 *   critical — changes what the public sees, or ends an article's life. Audited,
 *              idempotent, *and* confirmed.
 */
export type ToolRisk = "read" | "write" | "critical"

/**
 * The four acts an agent must not perform on a single unattended call.
 *
 * What they have in common is not that they are irreversible — `unpublish` and
 * `approve` are both walk-backable — but that their blast radius is outside
 * NotiLab. `publish` and `unpublish` change what a reader sees right now;
 * `approve` is the gate that makes publishing possible at all, so an agent that
 * holds both can self-approve, and this is where that path is slowed down;
 * `archive` is terminal, and `business-rules.md` says only an operator can undo
 * it.
 *
 * `reject_article` is terminal too and is deliberately *not* here: it removes a
 * story that was never public, which is a newsroom decision with no external
 * effect. Adding it would train agents to treat the confirmation step as noise.
 */
export const CRITICAL_ACTION_TOOLS = [
  "approve_article",
  "publish_article",
  "unpublish_article",
  "archive_article",
] as const

export type CriticalActionTool = (typeof CRITICAL_ACTION_TOOLS)[number]

const CRITICAL_SET = new Set<string>(CRITICAL_ACTION_TOOLS)

export function isCriticalActionTool(name: string): name is CriticalActionTool {
  return CRITICAL_SET.has(name)
}

/** The tier of one tool, from its name and whether it writes. */
export function toolRisk(tool: { name: string; mutating: boolean }): ToolRisk {
  if (!tool.mutating) return "read"
  return CRITICAL_SET.has(tool.name) ? "critical" : "write"
}

/**
 * Everything a confirmation policy is allowed to know about its caller.
 *
 * Only the identity, and only so a policy can honour a client that an operator
 * has deliberately exempted — see `AgentIdentity.skipCriticalConfirmation`. A
 * policy gets no database, no request and no transport: it must stay a pure
 * function of (input, who is asking), because the token is derived from the
 * input and a policy that consulted anything else would make the token
 * unreproducible on the confirming call.
 */
export interface ConfirmationContext {
  agent: AgentIdentity
}

/**
 * The policy the four critical tools share.
 *
 * Returns `required: true` unless the calling credential carries an explicit
 * exemption. The pipeline then answers CONFIRMATION_REQUIRED with a token
 * derived from (agent, tool, input), and the identical call carrying that token
 * proceeds — see lib/agent/confirmation.ts for what the token does and does not
 * prove.
 *
 * Be clear about the guarantee, because it is easy to overstate: the token is an
 * integrity check on the approved payload, not proof that a human approved it.
 * An autonomous client can read the token out of the error and repeat the call
 * by itself. What the gate buys is that the act becomes *visible* — two audit
 * rows, an explicit summary the MCP client shows its user, and a refusal that a
 * client's confirmation UI can hook. Turning it into real human approval needs
 * the approval queue tracked in docs/agent-api.md; this is the seam for it.
 */
export function criticalActionConfirmation(
  summary: string,
): (input: unknown, ctx?: ConfirmationContext) => ConfirmationDecision {
  return (_input, ctx) => {
    if (ctx?.agent.skipCriticalConfirmation) return { required: false }
    return { required: true, reason: "critical_action", summary }
  }
}
