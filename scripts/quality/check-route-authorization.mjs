#!/usr/bin/env node
/**
 * Route authorization manifest check.
 *
 * WHY THIS EXISTS
 * ---------------
 * Broken access control (OWASP A01) is the *absence* of a check, and absence
 * has no syntactic signature. No SAST tool — CodeQL included — can flag
 * `app/api/user/route.ts` for trusting a client-supplied `userId`, because
 * nothing in the source says that endpoint was ever meant to be authenticated.
 * The missing information is intent, and intent has to be written down.
 *
 * So this script does not try to detect vulnerabilities. It enforces a much
 * smaller, decidable property: every route handler has a *recorded*
 * authorization posture. A route is acceptable when it either
 *
 *   (a) reaches an authorization helper and can actually reject (401/403), or
 *   (b) is listed in the manifest as intentionally public, with a reason.
 *
 * A new route that is neither is a hard failure. That turns "someone forgot the
 * check" — previously invisible to CI — into a diff against a CODEOWNERS-owned
 * file that a human has to consciously approve.
 *
 * WHY IT CANNOT BE SATISFIED BY A NO-OP
 * -------------------------------------
 * The obvious way to defeat a check like this is to declare the offending route
 * public and move on. Five rules close that door:
 *
 *   1. SENSITIVE_PREFIXES (the user/admin/growth/cron/ai trees) may never
 *      appear in `publicRoutes` at all. For exactly the routes where an IDOR
 *      would matter, "declare it public" is not an available answer.
 *   2. The only exception is session lifecycle (login/logout), which must carry
 *      `sessionLifecycle: true` AND match SESSION_LIFECYCLE_ROUTES — a list
 *      hardcoded here, never supplied by the manifest.
 *   3. Reaching a helper is not enough: the file must also be able to *reject*
 *      (a 401/403, directly or via an authorizing wrapper). A dangling
 *      `await checkAdminAuth()` whose result is discarded does not pass.
 *   4. Stale and redundant entries fail. An entry naming a file that no longer
 *      exists fails; an entry for a route that *is* authorized fails and must
 *      be deleted. The manifest cannot rot into a blanket allowlist.
 *   5. `knownViolations` is a ratchet, not an allowlist: `maxKnownViolations`
 *      caps its length, so it can only shrink. Growing it is a deliberate,
 *      reviewed baseline change.
 *
 * This is deliberately a dependency-free Node script — per AGENTS.md
 * § Dependency Policy, adding a CI tool needs its own discussion first.
 *
 * Usage:  node scripts/quality/check-route-authorization.mjs
 * Exit:   0 = every route accounted for, 1 = at least one violation.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, relative, sep } from "node:path"

const ROOT = process.cwd()
const API_DIR = join(ROOT, "app", "api")
const MANIFEST_PATH = join(ROOT, "scripts", "quality", "authorization-manifest.json")

/**
 * Identifiers that constitute "this handler consulted an authorization
 * decision". Includes authorizing *wrappers*: `runTool` performs
 * authenticateAgent + assertPermissions inside lib/agent/runner.ts, so the
 * route that delegates to it is authorized even though it names no helper of
 * its own. Omitting wrappers is how a naive grep produces false negatives —
 * the original "26 of 38 routes have no auth" count included at least two
 * routes that are in fact authenticated.
 */
const AUTH_SIGNALS = [
  "checkAdminAuth",
  "authenticateAgent",
  "assertPermissions",
  "runTool",
  "verifyTelegramWebhook",
  "CRON_SECRET",
]

/**
 * Guards that own the rejection themselves, so the route file is not required
 * to contain a 401/403 of its own:
 *   - `runTool` runs the whole authenticate → authorize → audit pipeline.
 *   - `authenticateAgent` / `assertPermissions` are *throw-based*; the status
 *     code is produced downstream by lib/agent/envelope.ts. Requiring a literal
 *     401 in the route file would flag app/api/agent/openapi/route.ts, which is
 *     correctly guarded.
 */
const REJECTING_WRAPPERS = ["runTool", "authenticateAgent", "assertPermissions"]

/**
 * Route trees where an unauthenticated handler is a security defect by default:
 * they read or mutate per-user data, privileged data, or scheduled jobs.
 * Routes under these prefixes may never be declared public.
 */
const SENSITIVE_PREFIXES = [
  "app/api/user/",
  "app/api/admin/",
  "app/api/growth/",
  "app/api/cron/",
  "app/api/ai/",
]

/** The only routes allowed to sit under a sensitive prefix and still be public. */
const SESSION_LIFECYCLE_ROUTES = [
  "app/api/admin/auth/route.ts",
  "app/api/admin/logout/route.ts",
]

const MIN_REASON_LENGTH = 20

const errors = []

function fail(msg) {
  errors.push(msg)
}

/** Recursively collect every app/api route handler, as repo-relative POSIX paths. */
function findRoutes(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...findRoutes(full))
    else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(relative(ROOT, full).split(sep).join("/"))
    }
  }
  return out
}

/** Strip comments so a helper named only in prose does not count as a call. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function analyseRoute(routePath) {
  const code = stripComments(readFileSync(join(ROOT, routePath), "utf8"))
  const signals = AUTH_SIGNALS.filter((s) => new RegExp(`\\b${s}\\b`).test(code))
  const canReject = /\b(401|403)\b/.test(code)
  const viaWrapper = signals.some((s) => REJECTING_WRAPPERS.includes(s))
  return {
    signals,
    canReject,
    // Rule 3: consulting a helper without any ability to reject is a no-op.
    authorized: signals.length > 0 && (canReject || viaWrapper),
  }
}

function isSensitive(routePath) {
  return SENSITIVE_PREFIXES.some((p) => routePath.startsWith(p))
}

// ─── Load manifest ───────────────────────────────────────────────────────────
if (!existsSync(MANIFEST_PATH)) {
  console.error(`::error::Missing authorization manifest at ${relative(ROOT, MANIFEST_PATH)}`)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
} catch (err) {
  console.error(`::error::Could not parse the authorization manifest: ${err.message}`)
  process.exit(1)
}

const publicRoutes = manifest.publicRoutes ?? []
const knownViolations = manifest.knownViolations ?? []
const maxKnownViolations = manifest.maxKnownViolations

if (typeof maxKnownViolations !== "number") {
  fail(
    "Manifest must declare a numeric `maxKnownViolations` — it is the ratchet that stops the baseline loosening.",
  )
}

const publicByPath = new Map(publicRoutes.map((e) => [e.route, e]))
const violationByPath = new Map(knownViolations.map((e) => [e.route, e]))

// ─── Rule 5: the ratchet ─────────────────────────────────────────────────────
if (typeof maxKnownViolations === "number" && knownViolations.length > maxKnownViolations) {
  fail(
    `knownViolations has ${knownViolations.length} entries but maxKnownViolations is ${maxKnownViolations}. ` +
      "This list may only shrink. Fix the route, or record a reviewed baseline change in " +
      "docs/memory/decisions.md and lower the cap deliberately.",
  )
}

// ─── Entry-level validation (rules 1, 2, 4) ──────────────────────────────────
for (const [label, entries] of [
  ["publicRoutes", publicRoutes],
  ["knownViolations", knownViolations],
]) {
  const seen = new Set()

  for (const entry of entries) {
    const p = entry.route

    if (typeof p !== "string" || p.length === 0) {
      fail(`${label}: an entry has no \`route\`.`)
      continue
    }
    if (seen.has(p)) fail(`${label}: duplicate entry for ${p}.`)
    seen.add(p)

    if (publicByPath.has(p) && violationByPath.has(p)) {
      fail(`${p} is in BOTH publicRoutes and knownViolations — it cannot be both intentional and a defect.`)
    }

    // Rule 4a: stale entry.
    if (!existsSync(join(ROOT, p))) {
      fail(`${label}: ${p} does not exist. Remove the stale entry.`)
      continue
    }

    if (typeof entry.reason !== "string" || entry.reason.trim().length < MIN_REASON_LENGTH) {
      fail(
        `${label}: ${p} needs a \`reason\` of at least ${MIN_REASON_LENGTH} characters explaining the posture.`,
      )
    }

    // Rule 4b: redundant entry — the route is actually authorized now.
    if (analyseRoute(p).authorized) {
      fail(
        `${label}: ${p} reaches an authorization helper and can reject, so it no longer belongs in this list. ` +
          "Remove the entry.",
      )
    }

    // Rule 1 + 2: sensitive prefixes cannot be waved through.
    if (label === "publicRoutes" && isSensitive(p)) {
      if (!(entry.sessionLifecycle === true && SESSION_LIFECYCLE_ROUTES.includes(p))) {
        fail(
          `publicRoutes: ${p} sits under a sensitive prefix and may not be declared public. ` +
            "Add an authorization check instead.",
        )
      }
    }

    if (label === "knownViolations" && typeof entry.trackedIn !== "string") {
      fail(`knownViolations: ${p} must record where the fix is tracked (\`trackedIn\`, e.g. a ROADMAP row).`)
    }
  }
}

// ─── Route-level validation ──────────────────────────────────────────────────
const routes = findRoutes(API_DIR).sort()
const undeclared = []
let authorizedCount = 0

for (const routePath of routes) {
  const { authorized, signals, canReject } = analyseRoute(routePath)

  if (authorized) {
    authorizedCount += 1
    continue
  }

  // Rule 3, reported explicitly: a helper is present but nothing can reject.
  if (signals.length > 0 && !canReject) {
    fail(
      `${routePath} references ${signals.join(", ")} but contains no 401/403 rejection. ` +
        "An authorization call whose result is never enforced is a no-op.",
    )
    continue
  }

  if (publicByPath.has(routePath) || violationByPath.has(routePath)) continue

  undeclared.push(routePath)
}

for (const routePath of undeclared) {
  fail(
    `${routePath} has no authorization check and is not declared in the manifest. ` +
      (isSensitive(routePath)
        ? "It sits under a sensitive prefix, so it must gain a check — it cannot be declared public."
        : "Either add a check, or add it to publicRoutes with a reason."),
  )
}

// ─── Report ──────────────────────────────────────────────────────────────────
console.log("=== Route authorization manifest check ===")
console.log(`  Routes scanned:   ${routes.length}`)
console.log(`  Authorized:       ${authorizedCount}`)
console.log(`  Declared public:  ${publicRoutes.length}`)
console.log(`  Known violations: ${knownViolations.length} (cap ${maxKnownViolations})`)

if (errors.length > 0) {
  console.log("")
  for (const e of errors) console.error(`::error::${e}`)
  console.error(`\n${errors.length} authorization manifest violation(s).`)
  process.exit(1)
}

console.log("\nEvery route handler has a recorded authorization posture.")
