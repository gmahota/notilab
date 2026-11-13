#!/usr/bin/env node
/**
 * Hardcoded-secret check.
 *
 * WHY THIS REPLACES THE INLINE GREP
 * ---------------------------------
 * security.yml's `security-headers` job carried this pattern:
 *
 *   password\s*=\s*['"][^'"]{8,}|api_key\s*=\s*['"][^'"]{10,}|secret\s*=\s*['"][^'"]{8,}
 *
 * Run over app/ lib/ components/ it returns **zero matches** on a tree that
 * contains three admin accounts sharing the published bcrypt test-vector hash
 * for the string "password", plus a JWT signing key that falls back to the
 * literal "your-secret-key". Two independent reasons:
 *
 *   1. It requires `password =`. The vulnerable code writes `password:` — an
 *      object property. One character of syntax defeated the whole check.
 *   2. It requires the literal to sit immediately after the operator. The JWT
 *      fallback is `process.env.JWT_SECRET || "your-secret-key"`, so what
 *      follows `SECRET =` is `p`, not a quote.
 *
 * A check that cannot fail is worse than no check: it reported green and was
 * documented as coverage. This script is the corrected version — dependency
 * free per AGENTS.md § Dependency Policy, and runnable locally so it can be
 * proven against known-bad input instead of trusted.
 *
 * Usage:  node scripts/quality/check-hardcoded-secrets.mjs
 * Exit:   0 = no undeclared findings, 1 = at least one.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, relative, sep } from "node:path"

const ROOT = process.cwd()
const SCAN_DIRS = ["app", "lib", "components", "scripts"]
const ALLOWLIST_PATH = join(ROOT, "scripts", "quality", "secret-allowlist.json")
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".jsx"]

const RULES = [
  {
    id: "secret-literal",
    // Covers BOTH `password = "..."` and `password: "..."` — the object-property
    // form is the one the original pattern missed.
    //
    // The leading [A-Za-z0-9_]* is not decoration. An anchoring \b does not
    // match inside `LEGACY_API_KEY`, because `_` is a word character, so a
    // prefixed identifier would sail past — verified by test, not assumed.
    pattern:
      /([A-Za-z0-9_]*(?:password|passwd|pwd|secret|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|client[_-]?secret|private[_-]?key))\s*[:=]\s*(['"`])([^'"`\n]{8,})\2/gi,
    describe: (m) => `${m[1]} assigned a hardcoded literal`,
  },
  {
    id: "env-fallback",
    // `process.env.JWT_SECRET || "your-secret-key"` — a literal standing in for
    // a secret whenever the variable is unset, which in practice means prod.
    pattern: /process\.env\.([A-Z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD)[A-Z0-9_]*)\s*(?:\|\||\?\?)\s*(['"`])([^'"`\n]{6,})\2/g,
    describe: (m) => `process.env.${m[1]} falls back to a hardcoded literal`,
  },
  {
    id: "bcrypt-hash",
    // A bcrypt digest checked into source is a credential, whatever it hashes.
    pattern: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g,
    describe: () => "bcrypt hash literal committed to source",
  },
  {
    id: "private-key-block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    describe: () => "private key block committed to source",
  },
]

/**
 * There is deliberately no "benign value" ignore list. The original check
 * filtered out anything containing "placeholder", and a filter like that is
 * precisely how `"your-secret-key"` — a placeholder that is also the live
 * production signing key whenever JWT_SECRET is unset — would slip through
 * again. Exemptions go in the allowlist, where each one is named, justified and
 * counted, rather than into a regex nobody re-reads.
 */
const findings = []

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full)
  }
  return out
}

/** Strip comments so an example in a docblock is not reported as a credential. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/.*$/gm, "$1")
}

for (const dir of SCAN_DIRS) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) continue

  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split(sep).join("/")
    // The checkers themselves describe these patterns in prose.
    if (rel.startsWith("scripts/quality/")) continue

    const raw = readFileSync(file, "utf8")
    const code = stripComments(raw)

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0
      let m
      while ((m = rule.pattern.exec(code)) !== null) {

        // Every match is reported; exemptions are declared in the allowlist below.
        const line = code.slice(0, m.index).split("\n").length
        findings.push({ file: rel, line, rule: rule.id, description: rule.describe(m) })
      }
    }
  }
}

// ─── Allowlist ───────────────────────────────────────────────────────────────
let allowlist = { entries: [], maxEntries: 0 }
if (existsSync(ALLOWLIST_PATH)) {
  try {
    allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"))
  } catch (err) {
    console.error(`::error::Could not parse ${relative(ROOT, ALLOWLIST_PATH)}: ${err.message}`)
    process.exit(1)
  }
}

const entries = allowlist.entries ?? []
const maxEntries = allowlist.maxEntries

const errors = []
const key = (f) => `${f.file}::${f.rule}`
const allowedKeys = new Set(entries.map((e) => `${e.file}::${e.rule}`))

if (typeof maxEntries !== "number") {
  errors.push("Allowlist must declare a numeric `maxEntries` — it is the ratchet that keeps the baseline shrinking.")
} else if (entries.length > maxEntries) {
  errors.push(
    `Secret allowlist has ${entries.length} entries but maxEntries is ${maxEntries}. ` +
      "This list may only shrink; adding to it is a reviewed baseline change.",
  )
}

for (const e of entries) {
  if (typeof e.reason !== "string" || e.reason.trim().length < 20) {
    errors.push(`Allowlist entry ${e.file} (${e.rule}) needs a reason of at least 20 characters.`)
  }
  if (typeof e.trackedIn !== "string") {
    errors.push(`Allowlist entry ${e.file} (${e.rule}) must record where the fix is tracked (\`trackedIn\`).`)
  }
  // A stale allowlist entry hides the fact that the check no longer covers it.
  if (!findings.some((f) => key(f) === `${e.file}::${e.rule}`)) {
    errors.push(
      `Allowlist entry ${e.file} (${e.rule}) no longer matches anything. ` +
        "Remove it — a stale exemption silently widens the next real finding.",
    )
  }
}

const undeclared = findings.filter((f) => !allowedKeys.has(key(f)))

console.log("=== Hardcoded secret check ===")
console.log(`  Findings:            ${findings.length}`)
console.log(`  Matched allowlist:   ${findings.length - undeclared.length} via ${entries.length} entr${entries.length === 1 ? "y" : "ies"} (cap ${maxEntries})`)
console.log(`  Undeclared:          ${undeclared.length}`)

for (const f of undeclared) {
  errors.push(`${f.file}:${f.line} — ${f.description} [${f.rule}]`)
}

if (errors.length > 0) {
  console.log("")
  for (const e of errors) console.error(`::error::${e}`)
  console.error(`\n${errors.length} hardcoded-secret finding(s).`)
  process.exit(1)
}

console.log("\nNo undeclared hardcoded secrets.")
