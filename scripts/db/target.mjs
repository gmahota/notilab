#!/usr/bin/env node
/**
 * scripts/db/target.mjs — Which database is DATABASE_URL pointing at, and may
 * this command write to it?
 *
 *   pnpm db:target                      # just tell me
 *   node scripts/db/target.mjs --guard  # refuse unless the target is safe
 *
 * Why this exists: on this project local and production have historically
 * shared one Neon database, so `db push`, `db:reset` and the seed are
 * production writes with no undo. The runbook
 * (docs/runbooks/database-migrations.md) says to check the host before running
 * them; a check that depends on somebody remembering to run it is not a check,
 * so the three destructive `db:*` scripts now run this first.
 *
 * It fails CLOSED. If it cannot prove the target is not production — because
 * PRODUCTION_DATABASE_HOST is not configured — it refuses, exactly as
 * lib/admin-auth.ts refuses to sign a token without a real JWT_SECRET. The
 * alternative is a guard that waves through the one case it exists to catch.
 *
 * The production hostname is deliberately NOT hardcoded here. This repository
 * is public, and naming the production endpoint in it tells anyone reading
 * exactly which host to point a stolen credential at. It comes from the
 * environment instead, where the credential already lives.
 */

try {
  process.loadEnvFile(".env")
} catch {
  // No .env (CI, or a shell that exports DATABASE_URL directly) — read the
  // real environment and carry on.
}

/** Honoured in argv for a direct call, and in the environment because pnpm
 * cannot forward a flag reliably through a chained script. */
const CONFIRM_FLAG = "--confirm-production-write"
const CONFIRM_ENV = "CONFIRM_PRODUCTION_WRITE"

const guarding = process.argv.includes("--guard")
const confirmed =
  process.argv.includes(CONFIRM_FLAG) ||
  ["1", "yes", "true"].includes((process.env[CONFIRM_ENV] ?? "").trim().toLowerCase())

const raw = process.env.DATABASE_URL?.trim()

if (!raw) {
  console.error("DATABASE_URL is not set. Nothing to check, and nothing would connect.")
  process.exit(guarding ? 1 : 0)
}

let url
try {
  url = new URL(raw)
} catch {
  console.error("DATABASE_URL is set but is not a parseable URL.")
  process.exit(guarding ? 1 : 0)
}

const host = url.hostname
const database = url.pathname.replace(/^\//, "") || "(default)"
const pooled = host.includes("-pooler")

/**
 * Hosts that are production, as a comma-separated list. Compared on the
 * hostname only — the pooled and unpooled endpoints of one Neon branch are
 * different hostnames, so list both, or list the shared stem they have in
 * common and rely on the prefix match below.
 */
const configured = (process.env.PRODUCTION_DATABASE_HOST ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0)

/**
 * A prefix match, not equality: Neon gives one branch two hostnames that differ
 * only by `-pooler`, and `ep-xxxx` is the stem of both. Equality would let the
 * pooled endpoint of production through a list that named the unpooled one.
 */
const isProduction = configured.some(
  (entry) => host.toLowerCase() === entry || host.toLowerCase().startsWith(entry),
)

const verdict = configured.length === 0 ? "unknown" : isProduction ? "production" : "not production"

console.log(`database : ${database}`)
console.log(`host     : ${host}${pooled ? "  (pooled)" : "  (direct)"}`)
console.log(`target   : ${verdict}`)

if (!guarding) {
  if (verdict === "unknown") {
    console.log(
      `\nSet PRODUCTION_DATABASE_HOST in .env to let the db:* guards tell these apart.`,
    )
  }
  process.exit(0)
}

if (verdict === "not production") process.exit(0)

if (confirmed) {
  console.error(
    `\nProceeding against ${verdict === "unknown" ? "an unidentified database" : "PRODUCTION"} because the write was confirmed.`,
  )
  process.exit(0)
}

console.error(
  verdict === "unknown"
    ? `
REFUSING: cannot tell whether this is production.

PRODUCTION_DATABASE_HOST is not set, so this script has nothing to compare the
host above against, and on this project a local database and the production one
have historically been the same database. Set it in .env (see .env.example), or
confirm the write explicitly:

  CONFIRM_PRODUCTION_WRITE=1 pnpm <the command you just ran>
`
    : `
REFUSING: DATABASE_URL points at PRODUCTION.

This command writes, and there is no undo. Point .env at your Neon dev branch
(docs/runbooks/database-migrations.md), or, if writing to production really is
the intent:

  CONFIRM_PRODUCTION_WRITE=1 pnpm <the command you just ran>
`,
)
process.exit(1)
