/**
 * lib/agent/idempotency.ts — Repeating a call must not repeat its effect.
 *
 * An agent retries. Its HTTP client times out and retries; the model re-reads a
 * plan and calls the same tool again; a workflow step reruns. Most tools here
 * are naturally idempotent (publishing a published article is a no-op), but
 * `create_article` is not, and neither is anything that appends a record.
 *
 * The contract: send `Idempotency-Key: <opaque string>` on a mutating call.
 *   - first call     → executes, stores the response under that key
 *   - repeat call    → returns the stored response, `meta.idempotentReplay: true`
 *   - repeat, different payload → IDEMPOTENCY_PAYLOAD_MISMATCH
 *   - repeat while the first is still running → IDEMPOTENCY_IN_PROGRESS
 *
 * Storage reuses `AdminAction` rather than adding a table, same reasoning as
 * audit.ts. One honest consequence: `AdminAction` has no unique index on
 * `resourceId`, so two genuinely simultaneous first-calls can both pass the
 * lookup and both execute. The window is milliseconds wide and needs the same
 * key on two concurrent requests to hit. Closing it properly means a dedicated
 * model with `@@unique` — a schema change, deliberately not made here; it is
 * written up in docs/agent-api.md § Limitations.
 */

import { prisma } from "@/lib/prisma"
import { createHash } from "node:crypto"
import { AgentError } from "./errors"
import { AUDIT_RESOURCE } from "./audit"
import { fingerprint } from "./canonical"

/** Keys are namespaced by agent so two agents cannot collide on "retry-1". */
function recordKey(agentId: string, tool: string, idempotencyKey: string): string {
  return createHash("sha256")
    .update(`${agentId}:${tool}:${idempotencyKey}`, "utf8")
    .digest("hex")
    .slice(0, 48)
}

interface StoredDetails {
  status?: string
  payloadHash?: string
  response?: unknown
}

export type IdempotencyOutcome =
  | { kind: "replay"; data: unknown }
  | { kind: "proceed"; recordId: string; storageKey: string }
  /** Storage is unavailable — the call runs, unprotected, and says so. */
  | { kind: "unavailable" }

/**
 * Claims an idempotency key before the tool runs.
 *
 * Throws AgentError for the two conflict cases. A database failure is not one
 * of them: losing idempotency protection is worse than losing the request, but
 * only slightly, and refusing every write because the bookkeeping table is
 * unhappy would be a worse outage. The caller reports the degradation.
 */
export async function claimIdempotencyKey(
  agentId: string,
  tool: string,
  idempotencyKey: string,
  input: unknown,
): Promise<IdempotencyOutcome> {
  const storageKey = recordKey(agentId, tool, idempotencyKey)
  const payloadHash = fingerprint(input)

  let existing: { id: string; details: unknown } | null = null
  try {
    existing = await prisma.adminAction.findFirst({
      where: { resource: AUDIT_RESOURCE.AGENT_IDEMPOTENCY, resourceId: storageKey },
      orderBy: { createdAt: "desc" },
      select: { id: true, details: true },
    })
  } catch (err) {
    console.error("[agent/idempotency] lookup failed — proceeding without protection", err)
    return { kind: "unavailable" }
  }

  if (existing) {
    const details = (existing.details ?? {}) as StoredDetails

    if (details.payloadHash && details.payloadHash !== payloadHash) {
      throw new AgentError(
        "IDEMPOTENCY_PAYLOAD_MISMATCH",
        "This Idempotency-Key was already used with a different payload. Use a new key.",
      )
    }

    if (details.status === "completed") {
      return { kind: "replay", data: details.response ?? null }
    }

    throw new AgentError(
      "IDEMPOTENCY_IN_PROGRESS",
      "A call with this Idempotency-Key is still in progress. Retry shortly.",
    )
  }

  try {
    const created = await prisma.adminAction.create({
      data: {
        userId: `agent:${agentId}`,
        action: "AGENT_IDEMPOTENCY_CLAIM",
        resource: AUDIT_RESOURCE.AGENT_IDEMPOTENCY,
        resourceId: storageKey,
        details: { status: "in_progress", payloadHash, tool },
      },
      select: { id: true },
    })
    return { kind: "proceed", recordId: created.id, storageKey }
  } catch (err) {
    console.error("[agent/idempotency] claim failed — proceeding without protection", err)
    return { kind: "unavailable" }
  }
}

/** Stores the response so a later repeat of the same key replays it. */
export async function completeIdempotencyKey(
  recordId: string,
  payloadHash: string,
  data: unknown,
): Promise<void> {
  try {
    await prisma.adminAction.update({
      where: { id: recordId },
      data: { details: { status: "completed", payloadHash, response: data ?? null } as object },
    })
  } catch (err) {
    console.error("[agent/idempotency] could not store response for replay", err)
  }
}

/**
 * Releases a claim after a failed execution, so the agent can retry with the
 * same key. Without this, one transient database error would permanently burn
 * that key and every retry would answer IDEMPOTENCY_IN_PROGRESS.
 */
export async function releaseIdempotencyKey(recordId: string): Promise<void> {
  try {
    await prisma.adminAction.delete({ where: { id: recordId } })
  } catch (err) {
    console.error("[agent/idempotency] could not release a failed claim", err)
  }
}

export { fingerprint as payloadFingerprint }
