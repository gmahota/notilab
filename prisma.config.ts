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
