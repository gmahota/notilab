/**
 * The human-confirmation seam. No tool uses it yet, which is exactly why it is
 * worth pinning now: the property it must have — approving one action cannot
 * authorise a different one — is easy to lose the day someone wires the first
 * bulk operation to it.
 *
 * Also covers the canonical fingerprint both confirmation and idempotency rest
 * on. `JSON.stringify` preserves insertion order, so without canonicalisation a
 * model regenerating the same call in a different key order would look like a
 * new request every time.
 */

import { canonicalStringify, fingerprint } from "@/lib/agent/canonical"
import { confirmationTokenFor, confirmationTokenMatches } from "@/lib/agent/confirmation"

describe("canonicalStringify", () => {
  it("is insensitive to key order", () => {
    expect(canonicalStringify({ a: 1, b: 2 })).toBe(canonicalStringify({ b: 2, a: 1 }))
  })

  it("is insensitive to key order at depth", () => {
    expect(canonicalStringify({ outer: { x: 1, y: [{ p: 1, q: 2 }] } })).toBe(
      canonicalStringify({ outer: { y: [{ q: 2, p: 1 }], x: 1 } }),
    )
  })

  it("treats an explicitly undefined field as an omitted one", () => {
    // The validator fills optional fields with undefined, so a payload that
    // named a field and one that omitted it must fingerprint the same.
    expect(canonicalStringify({ a: 1, b: undefined })).toBe(canonicalStringify({ a: 1 }))
  })

  it("keeps array order, which is meaningful", () => {
    expect(canonicalStringify([1, 2])).not.toBe(canonicalStringify([2, 1]))
  })

  it("distinguishes different values", () => {
    expect(fingerprint({ ids: ["a"] })).not.toBe(fingerprint({ ids: ["a", "b"] }))
  })
})

describe("confirmationTokenFor", () => {
  const input = { ids: ["a", "b", "c"] }

  it("is stable for the same agent, tool and payload", () => {
    expect(confirmationTokenFor("abacus", "publish_many", input)).toBe(
      confirmationTokenFor("abacus", "publish_many", { ids: ["a", "b", "c"] }),
    )
  })

  it("changes when the payload changes", () => {
    // The property that matters: approving "publish these 3" cannot be replayed
    // to authorise "publish these 400".
    expect(confirmationTokenFor("abacus", "publish_many", input)).not.toBe(
      confirmationTokenFor("abacus", "publish_many", { ids: ["a", "b", "c", "d"] }),
    )
  })

  it("changes when the tool or the agent changes", () => {
    const base = confirmationTokenFor("abacus", "publish_many", input)
    expect(confirmationTokenFor("abacus", "archive_many", input)).not.toBe(base)
    expect(confirmationTokenFor("other-agent", "publish_many", input)).not.toBe(base)
  })
})

describe("confirmationTokenMatches", () => {
  it("accepts an exact match and rejects anything else", () => {
    const token = confirmationTokenFor("abacus", "publish_many", { ids: ["a"] })

    expect(confirmationTokenMatches(token, token)).toBe(true)
    expect(confirmationTokenMatches(token, token.slice(0, -1) + "0")).toBe(false)
    expect(confirmationTokenMatches(token, "")).toBe(false)
    expect(confirmationTokenMatches(token, token + "extra")).toBe(false)
  })
})
