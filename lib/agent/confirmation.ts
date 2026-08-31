/**
 * lib/agent/confirmation.ts — The seam for "a human has to say yes first".
 *
 * Nothing in the current tool set requires confirmation: every tool acts on one
 * article at a time and every effect is reversible through another tool. The
 * machinery exists now because the operations that will need it — a bulk
 * publish, a taxonomy-wide recategorisation — are exactly the ones that are
 * painful to retrofit a gate onto later, once agents are already calling them.
 *
 * How it works when a policy does fire:
 *
 *   1. The tool's `confirmation` policy inspects the validated input and says
 *      it needs a human.
 *   2. The runner answers CONFIRMATION_REQUIRED with a `confirmationToken`
 *      derived from (agent, tool, input).
 *   3. The agent shows the summary to its operator and, on approval, repeats
 *      the identical call with `confirmationToken` in the body.
 *
 * The token is a fingerprint of the payload, not a random nonce. That is the
 * important property: approving "publish these 25 articles" cannot be replayed
 * to authorise "publish these 400", because a different payload produces a
 * different token. It is an integrity check on the approved action, not a
 * secret — it deliberately proves nothing about *who* approved, which is why a
 * real approval queue is listed as the next step in docs/agent-api.md.
 */

import { createHmac } from "node:crypto"
import { canonicalStringify } from "./canonical"

export interface ConfirmationDecision {
  required: boolean
  /** Short machine-ish reason, e.g. "bulk_publish". */
  reason?: string
  /** Plain language, shown to the human. */
  summary?: string
}

/** A tool's rule for when a human must approve. Pure — no I/O, no database. */
export type ConfirmationPolicy<TInput> = (input: TInput) => ConfirmationDecision

export const NO_CONFIRMATION: ConfirmationDecision = { required: false }

/**
 * The key the token is signed with. Falls back to a constant when unset: the
 * token's job is payload integrity, and with no policy currently firing there
 * is nothing to forge. Set NOTILAB_AGENT_CONFIRMATION_SECRET before enabling a
 * policy that guards something expensive.
 */
function signingKey(): string {
  return process.env.NOTILAB_AGENT_CONFIRMATION_SECRET?.trim() || "notilab-agent-confirmation"
}

export function confirmationTokenFor(agentId: string, tool: string, input: unknown): string {
  return createHmac("sha256", signingKey())
    .update(canonicalStringify({ agentId, tool, input }), "utf8")
    .digest("hex")
    .slice(0, 40)
}

/**
 * Constant-time-ish equality on two hex tokens. Both sides are our own
 * fixed-length hex, so a plain length check plus an accumulating compare is
 * enough; there is no secret to extract byte by byte.
 */
export function confirmationTokenMatches(expected: string, presented: string): boolean {
  if (expected.length !== presented.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ presented.charCodeAt(i)
  }
  return diff === 0
}
