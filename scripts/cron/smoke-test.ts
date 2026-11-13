/**
 * scripts/cron/smoke-test.ts — `pnpm cron:smoke`
 *
 * Asks a deployment one question: could its scheduled jobs run at all?
 *
 * Written after the feed sat frozen for seven days in November 2026. The cause
 * was `CRON_SECRET` missing from the Vercel production environment, which makes
 * every route under `app/api/cron/*` refuse at the door — `sync-news` and
 * `publish-scheduled` with a 500, the rest with a 401. Nothing in the pipeline
 * was broken, no check covered it, and nobody found out until a human noticed
 * the site had stopped moving. A cron that returns 500 once a day wakes no one.
 *
 * Three questions, in widening circles:
 *
 *   1. Registration — does every path in vercel.json have a route on disk, and
 *      is every route either registered or a known, deliberate exception?
 *      Local: no network, no deployment needed.
 *   2. Configuration — does each route refuse an unauthenticated request? A 500
 *      means CRON_SECRET is unset, a 404 means the route never deployed, and a
 *      200 means the job runs for anyone who asks.
 *
 *      Read the 401s with care. `sync-news` and `publish-scheduled` separate
 *      the two failures and answer 500 when the secret is missing; the other
 *      four collapse both into 401 (`!process.env.CRON_SECRET || header !==
 *      expected`), so they answer 401 whether the secret is set or absent. The
 *      suite therefore detects a missing secret through those two routes alone.
 *      Making all seven answer alike would make every line here mean one thing.
 *   3. Freshness — is the newest article recent enough that the jobs are not
 *      merely configured but actually firing? Needs DATABASE_URL, and is
 *      skipped without it, because the first two are worth asking alone.
 *
 * Nothing here authenticates, so nothing here can trigger a job: every route
 * checks the header before doing any work. These requests are as side-effect
 * free as a 404.
 *
 *   pnpm cron:smoke                            # the production deployment
 *   pnpm cron:smoke http://localhost:3000      # a deployment of your choosing
 *   pnpm cron:smoke --max-age-hours 72         # a laxer freshness window
 *   pnpm cron:smoke --registration-only        # question 1 alone, no network
 *
 * Exits non-zero on any failure, so CI fails loudly. The scheduled run lives in
 * .github/workflows/cron-health.yml.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

// ── Inputs ───────────────────────────────────────────────────────────────────

/** Flags take a value, so a bare positional is the first argument that is neither. */
function parseArgs(argv: string[]): {
  url?: string
  maxAgeHours?: string
  registrationOnly: boolean
} {
  const parsed: { url?: string; maxAgeHours?: string; registrationOnly: boolean } = {
    registrationOnly: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--max-age-hours") {
      parsed.maxAgeHours = argv[i + 1]
      i += 1
    } else if (arg === "--registration-only") {
      parsed.registrationOnly = true
    } else if (!arg.startsWith("--") && parsed.url === undefined) {
      parsed.url = arg
    }
  }

  return parsed
}

const args = parseArgs(process.argv.slice(2))

/**
 * An unset GitHub Actions input arrives as an empty string, not as undefined,
 * and `?? ` would happily take it — leaving the base URL as "" and every probe
 * pointing at nothing.
 */
function firstSet(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== "")
}

const baseUrl = (
  firstSet(
    args.url,
    process.env.CRON_BASE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    "https://notilab.vercel.app",
  ) as string
).replace(/\/+$/, "")

/**
 * Two missed daily runs. One is a delay, not a fault — Vercel schedules with
 * ±59 min precision on Hobby and a run can slip past midnight — so a narrower
 * window would cry wolf on a healthy deployment.
 */
const maxAgeHours = Number(args.maxAgeHours ?? process.env.CRON_MAX_AGE_HOURS ?? 48)

/**
 * The only route that may be absent from vercel.json. `publish-scheduled` puts
 * stories on the public site with no human in the loop; docs/memory/decisions.md
 * records that enabling it is an operator's decision, so finding it scheduled is
 * a finding, not a pass.
 */
const DELIBERATELY_UNREGISTERED = ["publish-scheduled"]

// ── Reporting ────────────────────────────────────────────────────────────────

let failures = 0
let checksRun = 0

/** One named assertion. `detail` prints on both outcomes, so a pass is legible too. */
function check(name: string, passed: boolean, detail: string): void {
  checksRun += 1
  if (passed) {
    console.log(`  PASS  ${name} — ${detail}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${name} — ${detail}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

// ── 1. Registration ──────────────────────────────────────────────────────────

type VercelConfig = { crons?: Array<{ path: string; schedule: string }> }

/** The cron directory names on disk, which are also the route segments. */
function routesOnDisk(): string[] {
  const dir = resolve(process.cwd(), "app/api/cron")
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

/** Returns every route path to probe, registered or not. */
function registrationChecks(): string[] {
  section("Registration (vercel.json against the routes on disk)")

  const configPath = resolve(process.cwd(), "vercel.json")
  const config: VercelConfig = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, "utf8")) as VercelConfig)
    : {}
  const registered = (config.crons ?? []).map((entry) => entry.path)
  const onDisk = routesOnDisk()

  check(
    "vercel.json declares at least one cron",
    registered.length > 0,
    registered.length > 0
      ? `${registered.length} registered`
      : "none — a deployment without vercel.json runs no crons at all",
  )

  for (const path of registered) {
    const segment = path.replace("/api/cron/", "")
    const found = onDisk.includes(segment)
    check(
      `${path} has a route`,
      found,
      found ? `app/api/cron/${segment}/route.ts` : "no such directory — the schedule hits a 404",
    )
  }

  for (const segment of onDisk) {
    const path = `/api/cron/${segment}`
    const isRegistered = registered.includes(path)
    const shouldBe = !DELIBERATELY_UNREGISTERED.includes(segment)
    check(
      `${path} registration matches intent`,
      isRegistered === shouldBe,
      shouldBe
        ? isRegistered
          ? "scheduled, as it should be"
          : "on disk but never scheduled — it will never run"
        : isRegistered
          ? "scheduled, but this is the unattended-publish route — see docs/memory/decisions.md"
          : "deliberately unscheduled",
    )
  }

  // Unregistered routes are probed too: they stay reachable from the open web,
  // so their auth gate has to hold like any other.
  return onDisk.map((segment) => `/api/cron/${segment}`)
}

// ── 2. Configuration ─────────────────────────────────────────────────────────

/** What an unauthenticated status code tells the operator to go and do. */
function diagnose(status: number, body: string): string {
  if (status === 401) return "401 — refused (see the note above: this alone does not prove the secret is set)"
  if (status === 500 && body.includes("CRON_SECRET")) {
    return "500 — CRON_SECRET is not set in this environment; set it and redeploy"
  }
  if (status === 404) return "404 — not in this deployment; redeploy from a commit that has it"
  if (status === 200) return "200 — THE JOB RAN UNAUTHENTICATED; this route is open to anyone"
  return `${status} — unexpected; body: ${body}`
}

async function configurationChecks(paths: string[]): Promise<void> {
  section(`Configuration (unauthenticated requests to ${baseUrl})`)

  for (const path of paths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { "user-agent": "notilab-cron-smoke-test" },
      })
      const body = (await response.text()).slice(0, 200)
      check(path, response.status === 401, diagnose(response.status, body))
    } catch (error) {
      check(path, false, `request failed — ${error instanceof Error ? error.message : error}`)
    }
  }
}

// ── 3. Freshness ─────────────────────────────────────────────────────────────

async function freshnessCheck(): Promise<void> {
  section("Freshness (is anything actually arriving?)")

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP  no DATABASE_URL — configuration was still checked above")
    return
  }

  const { PrismaClient } = await import("../../lib/generated/prisma")
  const prisma = new PrismaClient()

  try {
    const newest = await prisma.news.aggregate({ _max: { createdAt: true } })
    const createdAt = newest._max.createdAt

    if (!createdAt) {
      check("the feed has articles", false, "the news table is empty")
      return
    }

    const ageHours = (Date.now() - createdAt.getTime()) / 3_600_000
    check(
      "the newest article is recent",
      ageHours <= maxAgeHours,
      `${ageHours.toFixed(1)}h old, limit ${maxAgeHours}h — newest is ${createdAt.toISOString()}`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`NotiLab cron smoke test against ${baseUrl}`)
  console.log("Mode: read-only — nothing here authenticates, so no job can be triggered.")

  const paths = registrationChecks()

  // On a pull request the deployment under test is production, whose health has
  // nothing to do with the branch being reviewed. Only the local half of the
  // suite judges the change, so only that half gates it.
  if (args.registrationOnly) {
    console.log("\n  SKIP  --registration-only — no deployment was probed")
  } else {
    await configurationChecks(paths)
    await freshnessCheck()
  }

  console.log(
    failures === 0
      ? `\nAll ${checksRun} checks passed.`
      : `\n${failures} of ${checksRun} check(s) failed.`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("\nSmoke test could not complete:", error instanceof Error ? error.message : error)
  process.exit(1)
})
