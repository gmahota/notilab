# Runbook — Applying a database migration to production

Roadmap **#40a**. This is the procedure Phase 1 of mission M1 was blocked on:
the session tables cannot be added until there is a rehearsed way to get a
migration into the production database.

Read this before touching `prisma/schema.prisma`.

## Why this needs a runbook at all

Two facts about this project make migration delivery a manual operation:

1. **CI never applies migrations.** `pnpm exec prisma migrate deploy` is wired
   into three workflow jobs — `.github/workflows/ci-cd.yml:148` (preview),
   `.github/workflows/ci-cd.yml:190` (production) and
   `.github/workflows/release.yml:176` — but all three live in deploy jobs that
   need `secrets.VERCEL_TOKEN`, which this repository does not have. The jobs
   do not run, so the command never executes. A merged migration reaches
   production only because a human ran it.
2. **Local and production share one Neon database.** `DATABASE_URL` in a
   developer's `.env` points at the same `neondb` the deployed site uses. Any
   `prisma db push`, `db:reset` or seed run locally is a production change.

Neither is a thing to fix in passing: wiring `VERCEL_TOKEN` changes who can
deploy, and splitting the databases changes what local development runs
against. Until they are fixed, migrations are applied by hand, from this
document.

## State verified on 2026-11-09

Both checks are read-only and safe to repeat at any time.

```bash
pnpm exec prisma migrate status
```

> `2 migrations found in prisma/migrations` … `Database schema is up to date!`

```bash
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code
```

> `-- This is an empty migration.` (exit code 0)

Together these say something load-bearing: the production database's
`_prisma_migrations` history matches the two migration folders in the
repository, **and** its live schema matches `schema.prisma` exactly. Despite the
`db push` habit, there is no drift and no baselining problem. A new additive
migration generated from a schema change will apply cleanly with
`migrate deploy`.

Re-run both before any migration work. If `migrate status` reports a pending or
failed migration, or the diff is no longer empty, **stop** — reconciling drift
is a different job from applying a migration, and doing both at once is how a
table gets dropped.

## Prerequisite — a Neon branch for local `migrate dev`

`prisma migrate dev` creates and drops a shadow database and rewrites schema
objects. Pointed at the shared `DATABASE_URL` it would do that to production.
It must only ever run against a Neon branch.

In the Neon console, on the `notilab` project:

1. **Branches → Create branch**, from `main`, named `dev-<yourname>`. A Neon
   branch is copy-on-write: it starts as a snapshot of production data and
   costs nothing until it diverges.
2. Copy its **pooled** and **unpooled** connection strings.
3. In your `.env`, point `DATABASE_URL` at the branch, not at `main`.
4. Confirm you are not on production before running anything that writes:

```bash
node -e "try{process.loadEnvFile('.env')}catch{}; console.log(new URL(process.env.DATABASE_URL).hostname)"
```

The production endpoint is `ep-raspy-tree-anhfgdar-pooler.c-6.us-east-1.aws.neon.tech`.
If that is the host, you are on production — stop.

Delete the branch when the work merges. A stale branch keeps diverging from
`main` and is worse than no branch at all, because it looks current.

## Procedure — additive migration

An **additive** migration creates tables, adds nullable columns, or adds
indexes. It never drops, renames, or narrows a type. Anything else is not this
runbook; it needs its own plan, because the deployed application and the new
schema have to coexist during the window between the migration and the deploy.

### 1. Author it against the branch

```bash
pnpm exec prisma migrate dev --name <short_snake_case_name>
```

Review the generated SQL before it is committed. Prisma is good at this and
occasionally generates a `DROP` you did not intend; the file in
`prisma/migrations/<timestamp>_<name>/migration.sql` is the thing that will run
against production, so read it as such.

### 2. Rehearse forward and back on the branch

```bash
pnpm exec prisma migrate deploy        # forward, as production will run it
pnpm exec prisma migrate status        # expect: up to date
pnpm build                             # the app still builds against the new client
pnpm test
```

Then prove the rollback. For an additive migration the rollback is the
inverse DDL, written by hand and kept in the PR description — not a Prisma
command, because `prisma migrate` has no `down`:

```sql
-- rollback for <timestamp>_<name>
DROP TABLE IF EXISTS "<new_table>";
```

Apply it to the branch, confirm the application still boots on the old shape,
then re-apply the migration. A rollback nobody has run is not a rollback.

### 3. Merge, then apply to production

The migration is applied **after** the PR merges and **before** the deploy that
needs it — in that order, because an additive migration is invisible to the
running application, while a deploy expecting a missing table is an outage.

```bash
# From a trusted machine, with .env pointing at production (verify the host first).
pnpm exec prisma migrate status        # expect: 1 pending migration, the one you just merged
pnpm exec prisma migrate deploy
pnpm exec prisma migrate status        # expect: up to date
```

Use the **unpooled** Neon host for `migrate deploy`. The pooler terminates the
advisory lock Prisma takes for the duration, which can leave a migration
recorded as started and not finished — the one state that does need manual
repair.

### 4. Record it

Add a line to `docs/manager/daily-reports/` saying which migration was applied,
when, and by whom. The `_prisma_migrations` table already knows; the point of
the note is that a human reading the roadmap can see it without a database
connection.

## Never

- `prisma db push` against `DATABASE_URL` when it points at production. It
  applies schema changes with no migration record, which is exactly the drift
  these checks exist to detect. Historically it is how this project's schema was
  changed; the checks above now pass, and the habit is what would break them.
- `prisma migrate dev` against production. It will offer to reset the database.
- `pnpm db:reset`. It is `db push --force-reset` plus a seed — a full data loss
  against whatever `DATABASE_URL` names.
- Applying a migration that the deploy for it has not been merged behind.
