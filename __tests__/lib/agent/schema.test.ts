/**
 * The validator is the Agent API's outermost defence. Everything downstream —
 * the field whitelist that keeps `status` unwritable, the publish gate, the
 * audit diff — assumes the input reaching it has already been shaped. These
 * cases pin the behaviours that assumption rests on, in particular the one that
 * is easy to relax by accident: an unknown key is an error, never a silently
 * dropped field.
 */

import { f, parseInput, toJsonSchema } from "@/lib/agent/schema"

describe("parseInput", () => {
  const schema = {
    id: f.string({ description: "Article id.", maxLength: 50 }),
    title: f.optional(f.string({ description: "Headline.", minLength: 3, maxLength: 10 })),
    count: f.optional(f.number({ description: "Count.", min: 1, max: 5, integer: true })),
    status: f.optional(f.enum(["DRAFT", "PUBLISHED"] as const, "State.")),
    tags: f.optional(f.stringArray({ description: "Tags.", maxItems: 3 })),
    when: f.optional(f.datetime("Moment.")),
    flag: f.optional(f.boolean("A flag.")),
  }

  it("accepts a valid body and returns typed values", () => {
    const result = parseInput(schema, {
      id: "abc",
      title: "Hello",
      count: 3,
      status: "DRAFT",
      tags: ["a", "b"],
      when: "2026-09-01T08:00:00Z",
      flag: true,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.id).toBe("abc")
    expect(result.value.when).toBeInstanceOf(Date)
    expect(result.value.when?.toISOString()).toBe("2026-09-01T08:00:00.000Z")
    expect(result.value.tags).toEqual(["a", "b"])
  })

  it("rejects an unknown field rather than dropping it", () => {
    // The case that matters: an agent trying to set a field no tool exposes
    // must be told no. Silently ignoring it would let the agent believe it had
    // published something.
    const result = parseInput(schema, { id: "abc", status: "PUBLISHED", trending: true })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContainEqual({
      field: "trending",
      message: "unknown field — not accepted by this tool",
    })
  })

  it("reports every missing required field", () => {
    const result = parseInput(schema, {})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual([{ field: "id", message: "is required" }])
  })

  it("treats an omitted optional field as undefined, not as an error", () => {
    const result = parseInput(schema, { id: "abc" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.title).toBeUndefined()
  })

  it("treats an explicit null the same as an omitted optional", () => {
    const result = parseInput(schema, { id: "abc", title: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.title).toBeUndefined()
  })

  it("enforces string length bounds", () => {
    const short = parseInput(schema, { id: "abc", title: "hi" })
    expect(short.ok).toBe(false)

    const long = parseInput(schema, { id: "abc", title: "aaaaaaaaaaaaaaaaa" })
    expect(long.ok).toBe(false)
  })

  it("enforces numeric bounds and integrality", () => {
    expect(parseInput(schema, { id: "a", count: 0 }).ok).toBe(false)
    expect(parseInput(schema, { id: "a", count: 9 }).ok).toBe(false)
    expect(parseInput(schema, { id: "a", count: 2.5 }).ok).toBe(false)
    expect(parseInput(schema, { id: "a", count: 2 }).ok).toBe(true)
  })

  it("rejects a value outside an enum", () => {
    const result = parseInput(schema, { id: "a", status: "ARCHIVED" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0].message).toContain("must be one of")
  })

  it("rejects a natural-language date instead of guessing at it", () => {
    // `new Date("tomorrow at 8")` does not fail — it returns 2001-07-31. An
    // agent turning "amanhã às 08h" into a date is the expected case, so a
    // rejected call it can correct beats a schedule landing in 2001.
    for (const value of ["tomorrow at 8", "amanhã às 08h", "8", "01/09/2026", "next monday"]) {
      const result = parseInput(schema, { id: "a", when: value })
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.errors[0].field).toBe("when")
    }
  })

  it("rejects a well-shaped date that is not a real instant", () => {
    expect(parseInput(schema, { id: "a", when: "2026-02-30T10:00:00Z" }).ok).toBe(false)
  })

  it("accepts the ISO forms an agent realistically produces", () => {
    for (const value of [
      "2026-09-01",
      "2026-09-01T08:00",
      "2026-09-01T08:00:00Z",
      "2026-09-01T08:00:00.000Z",
      "2026-09-01T08:00:00+01:00",
    ]) {
      expect(parseInput(schema, { id: "a", when: value }).ok).toBe(true)
    }
  })

  it("rejects a non-object body", () => {
    expect(parseInput(schema, "publish everything").ok).toBe(false)
    expect(parseInput(schema, [1, 2, 3]).ok).toBe(false)
  })

  it("treats an absent body as an empty object", () => {
    const empty = { probe: f.optional(f.string({ description: "x" })) }
    expect(parseInput(empty, undefined).ok).toBe(true)
  })

  it("caps array size and drops blank entries", () => {
    expect(parseInput(schema, { id: "a", tags: ["a", "b", "c", "d"] }).ok).toBe(false)

    const trimmed = parseInput(schema, { id: "a", tags: ["a", "  ", " b "] })
    expect(trimmed.ok).toBe(true)
    if (!trimmed.ok) return
    expect(trimmed.value.tags).toEqual(["a", "b"])
  })

  it("rejects a wrongly typed value rather than coercing it", () => {
    // "5" must not become 5. An agent sending the wrong type has a bug worth
    // surfacing, and coercion hides it.
    expect(parseInput(schema, { id: "a", count: "5" }).ok).toBe(false)
    expect(parseInput(schema, { id: "a", flag: "true" }).ok).toBe(false)
    expect(parseInput(schema, { id: 42 }).ok).toBe(false)
  })
})

describe("toJsonSchema", () => {
  it("advertises exactly what the validator enforces", () => {
    const json = toJsonSchema({
      id: f.string({ description: "Article id.", maxLength: 50 }),
      status: f.optional(f.enum(["DRAFT", "PUBLISHED"] as const, "State.")),
    })

    expect(json.type).toBe("object")
    expect(json.required).toEqual(["id"])
    // The whole point of generating rather than hand-writing: an agent reading
    // this cannot be told a field is allowed that the validator will reject.
    expect(json.additionalProperties).toBe(false)

    const properties = json.properties as Record<string, Record<string, unknown>>
    expect(properties.status.enum).toEqual(["DRAFT", "PUBLISHED"])
  })
})
