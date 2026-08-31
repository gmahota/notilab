/**
 * lib/agent/canonical.ts — Stable fingerprints for tool payloads.
 *
 * Both idempotency and human confirmation need to answer "is this the same
 * request as before?", and `JSON.stringify` cannot: it preserves insertion
 * order, so `{a:1,b:2}` and `{b:2,a:1}` hash differently. An agent regenerating
 * a call from a language model does not preserve key order, which would make
 * every replay look like a new request.
 */

import { createHash } from "node:crypto"

/** JSON with object keys sorted at every level. */
export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "string") return JSON.stringify(value)
  if (value instanceof Date) return JSON.stringify(value.toISOString())

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]"
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      // Undefined members are dropped rather than serialised, so an explicitly
      // absent optional field and an omitted one fingerprint identically.
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

    return (
      "{" +
      entries.map(([key, entry]) => JSON.stringify(key) + ":" + canonicalStringify(entry)).join(",") +
      "}"
    )
  }

  return JSON.stringify(String(value))
}

/** Short, collision-resistant fingerprint of a payload. */
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value), "utf8").digest("hex").slice(0, 32)
}
