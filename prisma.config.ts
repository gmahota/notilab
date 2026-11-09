import { spawnSync } from "node:child_process"
import { defineConfig } from "prisma/config"

// Prisma 7 no longer auto-loads .env for the CLI, and the package.json#prisma
// key it used to read is gone. Node's native env-file loader keeps
// `prisma migrate|db seed` self-contained without pulling in dotenv. Absent in
// CI, where DATABASE_URL is injected as a real env var — ignore then.
try {
  process.loadEnvFile(".env")
} catch {
  // .env may be absent (e.g. CI) — DATABASE_URL then comes from the environment.
}

// ───────────────────────────────────────────────────────────────────────────
// Destructive-command gate
//
// The `db:*` scripts in package.json run scripts/db/target.mjs first, but that
// only protects the commands somebody runs through pnpm. The two that actually
// worry us — `prisma migrate dev`, which offers to reset the database the
// moment it meets drift, and `prisma migrate reset`, which resets by design —
// are typed out as `pnpm exec prisma …` and never touch those scripts.
//
// This file is the one thing every invocation of the Prisma CLI loads,
// whatever the shape of the command line, so the gate belongs here. It runs
// the same guard as the scripts do, by spawning it rather than importing it:
// the guard is a .mjs run by bare `node` from package.json and cannot be
// imported from TypeScript without module-resolution contortions, and one
// process spawn on the few destructive commands is cheaper than two copies of
// the host-matching rule that would eventually disagree.
//
// Non-destructive commands pay nothing — `generate` in particular, which runs
// on postinstall and in CI with no DATABASE_URL at all, never reaches the
// spawn.
// ───────────────────────────────────────────────────────────────────────────

/** The first two words of the command, flags and paths ignored. */
const subcommand = process.argv
  .slice(2)
  .filter((token) => !token.startsWith("-"))
  .slice(0, 2)
  .join(" ")

/**
 * Commands that can lose data. `migrate deploy` is deliberately NOT here: it
 * only applies committed migrations forward, it is the documented way to reach
 * production, and blocking it would break the runbook it is part of. It does
 * get the target printed, because running it against the wrong database is
 * still a mistake worth seeing before it happens.
 */
const DESTRUCTIVE = new Set(["migrate dev", "migrate reset", "db push", "db execute"])

if (DESTRUCTIVE.has(subcommand) || subcommand === "migrate deploy") {
  const guarding = DESTRUCTIVE.has(subcommand)
  const result = spawnSync(
    process.execPath,
    ["scripts/db/target.mjs", ...(guarding ? ["--guard"] : [])],
    { stdio: "inherit" },
  )

  // A guard that cannot run is not a guard. If spawning it failed at all, stop
  // the destructive command rather than assume the target was safe.
  if (guarding && result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Replaces the removed package.json#prisma.seed key. Auto-seeding on
    // migrate is gone in v7 — run `pnpm db:seed` explicitly.
    seed: "tsx --env-file-if-exists=.env prisma/seed.ts",
  },
  // Only declare the datasource when the URL is present. `prisma generate` does
  // not need a connection and must not fail when DATABASE_URL is unset (the CI
  // build does exactly that); the commands that connect require it in the env.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
