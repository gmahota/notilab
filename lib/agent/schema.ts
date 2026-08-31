/**
 * lib/agent/schema.ts — Input schemas for agent tools.
 *
 * Why not zod: AGENTS.md § Dependency Policy says prefer what is installed, and
 * nothing in this repository pulls zod today. This module is deliberately small
 * and does two jobs at once that a validator alone would not:
 *
 *   1. validates and coerces an untrusted JSON body into a typed value;
 *   2. emits JSON Schema, which is what `/api/agent/capabilities`, the OpenAPI
 *      document and any function-calling integration need to describe a tool.
 *
 * Keeping both on one declaration is the point — a schema that validates one
 * shape while advertising another is how an agent ends up confidently sending
 * requests that always fail.
 *
 * Unknown keys are rejected, not stripped. An agent that invents
 * `{ "status": "PUBLISHED" }` on update_article must be told no, loudly, rather
 * than have the field silently dropped and believe the publish happened.
 */

export type JsonSchema = Record<string, unknown>

export interface FieldError {
  /** Field name, or "<root>" for whole-body problems. */
  field: string
  message: string
}

/**
 * A single input field. `parse` writes into `errors` and returns undefined on
 * failure; the caller discards the whole result when `errors` is non-empty, so
 * the unsound-looking cast at the end of `parseInput` never escapes.
 */
export interface FieldSpec<T> {
  readonly required: boolean
  readonly description: string
  readonly jsonSchema: JsonSchema
  parse(raw: unknown, field: string, errors: FieldError[]): T
}

export type FieldMap = Record<string, FieldSpec<unknown>>

/** The typed value a field map produces once validated. */
export type Infer<S extends FieldMap> = {
  [K in keyof S]: S[K] extends FieldSpec<infer T> ? T : never
}

// ── Field constructors ──────────────────────────────────────────────────────

interface StringOptions {
  description: string
  minLength?: number
  maxLength?: number
  /** Trims before length checks. On by default. */
  trim?: boolean
}

function fail<T>(errors: FieldError[], field: string, message: string): T {
  errors.push({ field, message })
  return undefined as T
}

function string(options: StringOptions): FieldSpec<string> {
  const { minLength = 1, maxLength = 20_000, trim = true } = options
  return {
    required: true,
    description: options.description,
    jsonSchema: {
      type: "string",
      description: options.description,
      minLength,
      maxLength,
    },
    parse(raw, field, errors) {
      if (typeof raw !== "string") return fail(errors, field, "must be a string")
      const value = trim ? raw.trim() : raw
      if (value.length < minLength) {
        return fail(errors, field, "must be at least " + minLength + " character(s)")
      }
      if (value.length > maxLength) {
        return fail(errors, field, "must be at most " + maxLength + " characters")
      }
      return value
    },
  }
}

interface NumberOptions {
  description: string
  min?: number
  max?: number
  integer?: boolean
}

function number(options: NumberOptions): FieldSpec<number> {
  const { min, max, integer = false } = options
  return {
    required: true,
    description: options.description,
    jsonSchema: {
      type: integer ? "integer" : "number",
      description: options.description,
      ...(min !== undefined ? { minimum: min } : {}),
      ...(max !== undefined ? { maximum: max } : {}),
    },
    parse(raw, field, errors) {
      if (typeof raw !== "number" || Number.isNaN(raw)) {
        return fail(errors, field, "must be a number")
      }
      if (integer && !Number.isInteger(raw)) return fail(errors, field, "must be an integer")
      if (min !== undefined && raw < min) return fail(errors, field, "must be >= " + min)
      if (max !== undefined && raw > max) return fail(errors, field, "must be <= " + max)
      return raw
    },
  }
}

function boolean(description: string): FieldSpec<boolean> {
  return {
    required: true,
    description,
    jsonSchema: { type: "boolean", description },
    parse(raw, field, errors) {
      if (typeof raw !== "boolean") return fail(errors, field, "must be a boolean")
      return raw
    },
  }
}

function enumOf<const V extends readonly string[]>(
  values: V,
  description: string,
): FieldSpec<V[number]> {
  return {
    required: true,
    description,
    jsonSchema: { type: "string", description, enum: [...values] },
    parse(raw, field, errors) {
      if (typeof raw !== "string") return fail(errors, field, "must be a string")
      if (!values.includes(raw)) {
        return fail(errors, field, "must be one of: " + values.join(", "))
      }
      return raw as V[number]
    },
  }
}

interface StringArrayOptions {
  description: string
  maxItems?: number
  itemMaxLength?: number
}

function stringArray(options: StringArrayOptions): FieldSpec<string[]> {
  const { maxItems = 25, itemMaxLength = 120 } = options
  return {
    required: true,
    description: options.description,
    jsonSchema: {
      type: "array",
      description: options.description,
      maxItems,
      items: { type: "string", maxLength: itemMaxLength },
    },
    parse(raw, field, errors) {
      if (!Array.isArray(raw)) return fail(errors, field, "must be an array of strings")
      if (raw.length > maxItems) {
        return fail(errors, field, "must have at most " + maxItems + " items")
      }
      const out: string[] = []
      for (const item of raw) {
        if (typeof item !== "string") return fail(errors, field, "must contain only strings")
        const trimmed = item.trim()
        if (trimmed.length === 0) continue
        if (trimmed.length > itemMaxLength) {
          return fail(errors, field, "each item must be at most " + itemMaxLength + " characters")
        }
        out.push(trimmed)
      }
      return out
    },
  }
}

/**
 * Strictly ISO-8601. `YYYY-MM-DD`, optionally with a time and an offset.
 *
 * The shape check is not decoration — `new Date` is far too permissive to be a
 * validator. `new Date("tomorrow at 8")` does not fail; it returns
 * 2001-07-31T22:00:00Z, because V8 falls back to a legacy parser that finds an
 * "8" and invents the rest. An agent turning "amanhã às 08h" into a date is the
 * expected case here, and a schedule silently landing in 2001 is worse than a
 * rejected call the agent can correct.
 */
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Checks the parts arithmetically rather than through `Date`, which rolls an
 * impossible date over instead of rejecting it: `new Date("2026-02-30")` is
 * 2 March. An article scheduled for a day that does not exist should be a
 * refused call, not a publication two days later than intended.
 *
 * Done on the parts because a round-trip comparison against `Date` breaks on
 * offsets — "2026-09-01T00:30+02:00" is 31 August in UTC, and correctly so.
 */
function isRealTimestamp(match: RegExpMatchArray): boolean {
  const [, year, month, day, hour, minute, second] = match
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)

  if (m < 1 || m > 12) return false

  const maxDay = m === 2 && isLeapYear(y) ? 29 : DAYS_IN_MONTH[m - 1]
  if (d < 1 || d > maxDay) return false

  if (hour !== undefined && Number(hour) > 23) return false
  if (minute !== undefined && Number(minute) > 59) return false
  // 60 allowed for a leap second, which `Date` normalises away harmlessly.
  if (second !== undefined && Number(second) > 60) return false

  return true
}

function datetime(description: string): FieldSpec<Date> {
  const full = description + " ISO-8601, e.g. 2026-09-01T08:00:00Z. No offset means UTC."
  return {
    required: true,
    description: full,
    jsonSchema: { type: "string", format: "date-time", description: full },
    parse(raw, field, errors) {
      if (typeof raw !== "string") return fail(errors, field, "must be an ISO-8601 date string")

      const value = raw.trim()
      const match = ISO_8601.exec(value)
      if (!match) {
        return fail(
          errors,
          field,
          "must be ISO-8601, e.g. 2026-09-01T08:00:00Z — natural-language dates are not accepted",
        )
      }
      if (!isRealTimestamp(match)) {
        return fail(errors, field, "is not a real date")
      }

      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return fail(errors, field, "is not a real date")
      return parsed
    },
  }
}

/** Makes a field optional. The parsed type widens to include undefined. */
function optional<T>(inner: FieldSpec<T>): FieldSpec<T | undefined> {
  return {
    required: false,
    description: inner.description,
    jsonSchema: inner.jsonSchema,
    parse(raw, field, errors) {
      if (raw === undefined || raw === null) return undefined
      return inner.parse(raw, field, errors)
    },
  }
}

export const f = {
  string,
  number,
  boolean,
  enum: enumOf,
  stringArray,
  datetime,
  optional,
}

// ── Whole-body validation ───────────────────────────────────────────────────

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] }

export function parseInput<S extends FieldMap>(schema: S, raw: unknown): ParseResult<Infer<S>> {
  const errors: FieldError[] = []

  const source = raw === undefined || raw === null ? {} : raw
  if (typeof source !== "object" || Array.isArray(source)) {
    return { ok: false, errors: [{ field: "<root>", message: "body must be a JSON object" }] }
  }

  const body = source as Record<string, unknown>

  // Rejected before parsing: an unexpected key usually means the agent believes
  // it can set something it cannot, and answering "unknown field" teaches it
  // faster than a silently ignored write would.
  for (const key of Object.keys(body)) {
    if (!(key in schema)) {
      errors.push({ field: key, message: "unknown field — not accepted by this tool" })
    }
  }

  const out: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(schema)) {
    const present = body[key] !== undefined && body[key] !== null
    if (!present) {
      if (spec.required) {
        errors.push({ field: key, message: "is required" })
        continue
      }
      out[key] = undefined
      continue
    }
    out[key] = spec.parse(body[key], key, errors)
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: out as Infer<S> }
}

/** JSON Schema for a field map — what agents read to learn a tool's inputs. */
export function toJsonSchema(schema: FieldMap): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []

  for (const [key, spec] of Object.entries(schema)) {
    properties[key] = spec.jsonSchema
    if (spec.required) required.push(key)
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  }
}
