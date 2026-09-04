/**
 * scripts/admin/provision-staff.ts — creates or repairs one staff account.
 *
 * Run explicitly, never automatically. It is deliberately NOT wired into
 * prisma/seed.ts, `postinstall`, or any other lifecycle hook: seeding runs
 * unattended, and an unattended script that can set an administrator password
 * is the defect this replaces (ROADMAP #39), not a fix for it.
 *
 *   NOTILAB_ADMIN_EMAIL=you@example.com \
 *   NOTILAB_ADMIN_PASSWORD='<a long random password>' \
 *   pnpm admin:provision --apply
 *
 * Credentials come from the environment at run time. Nothing is committed and
 * nothing is written to disk. The password and its hash are never printed.
 *
 * WHY THE CONFIRMATION FLAG EXISTS: this repository's local .env points at the
 * same Neon database as production. There is no such thing as a harmless local
 * run here, so the script prints its plan and stops unless --apply is passed.
 * Related hazard, ROADMAP #37: `pnpm setup` still runs `prisma db push` and
 * `db seed` against whatever DATABASE_URL points at. This script does neither —
 * it writes at most one row.
 */

import bcrypt from "bcryptjs"
import { prisma } from "../../lib/prisma"
import { STAFF_ROLES, isStaffRole } from "../../lib/admin-auth"
import { normalizeEmail } from "../../lib/admin/staff-auth"

/**
 * 10 is bcryptjs's default and a deliberate ceiling: bcryptjs is pure
 * JavaScript, so a higher cost is paid in full on every login request inside a
 * serverless function, not just here.
 */
const BCRYPT_COST = 10

/** Long enough that it was not chosen by a human at a keyboard. */
const MIN_PASSWORD_LENGTH = 12

/**
 * Passwords that must never exist on this system again. `password` is the
 * string behind the published hash the three hardcoded accounts shared;
 * `admin123` is what ADMIN_GUIDE.md advertised.
 */
const FORBIDDEN_PASSWORDS = new Set(["password", "admin123", "changeme", "notilab"])

const KNOWN_FLAGS = ["--apply", "--force-password", "--force-role"]

const args = new Set(process.argv.slice(2))
const APPLY = args.has("--apply")
const FORCE_PASSWORD = args.has("--force-password")
const FORCE_ROLE = args.has("--force-role")
const UNKNOWN_FLAGS = [...args].filter((flag) => !KNOWN_FLAGS.includes(flag))

/** Thrown to unwind to the single exit point; never surfaced to the operator. */
class ProvisioningRefused extends Error {}

function fail(message: string): never {
  console.error(`\n  REFUSED  ${message}\n`)
  process.exitCode = 1
  throw new ProvisioningRefused()
}

/** The database this run would write to, with the credentials stripped out. */
function describeTarget(): string {
  const url = process.env.DATABASE_URL
  if (!url || !url.trim()) {
    fail("DATABASE_URL is not set. There is no database to provision against.")
  }
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return "<unparseable DATABASE_URL>"
  }
}

function readConfig() {
  if (UNKNOWN_FLAGS.length > 0) {
    fail(`Unknown flag(s): ${UNKNOWN_FLAGS.join(", ")}. Known flags: ${KNOWN_FLAGS.join(", ")}`)
  }

  const rawEmail = process.env.NOTILAB_ADMIN_EMAIL?.trim() ?? ""
  const password = process.env.NOTILAB_ADMIN_PASSWORD ?? ""
  const name = process.env.NOTILAB_ADMIN_NAME?.trim() || ""
  const role = process.env.NOTILAB_ADMIN_ROLE?.trim() || "SUPER_ADMIN"

  if (!rawEmail) {
    fail("NOTILAB_ADMIN_EMAIL is not set.")
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
    fail(`NOTILAB_ADMIN_EMAIL does not look like an email address: ${rawEmail}`)
  }
  if (!password) {
    fail("NOTILAB_ADMIN_PASSWORD is not set.")
  }
  if (password.trim().length !== password.length) {
    fail(
      "NOTILAB_ADMIN_PASSWORD has leading or trailing whitespace. Remove it — a " +
        "shell that ate it later would lock the account out.",
    )
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`NOTILAB_ADMIN_PASSWORD is shorter than ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (FORBIDDEN_PASSWORDS.has(password.toLowerCase())) {
    fail(
      "NOTILAB_ADMIN_PASSWORD is one of the credentials this system was already " +
        "compromised by. Choose another.",
    )
  }
  if (!isStaffRole(role)) {
    fail(`NOTILAB_ADMIN_ROLE must be one of: ${STAFF_ROLES.join(", ")} (got "${role}")`)
  }

  return { email: normalizeEmail(rawEmail), password, name, role }
}

async function main(): Promise<void> {
  const target = describeTarget()
  const config = readConfig()

  const existing = await prisma.user.findUnique({
    where: { email: config.email },
    select: { id: true, email: true, name: true, role: true, isActive: true, password: true },
  })

  const hasPassword = typeof existing?.password === "string" && existing.password.trim().length > 0

  // ── The plan, printed before anything is written ──────────────────────────
  console.log("")
  console.log("  NotiLab staff provisioning")
  console.log("  ──────────────────────────────────────────────────────────────")
  console.log(`  Database        ${target}`)
  console.log(`  Email           ${config.email}`)
  console.log(`  Role            ${config.role}`)
  console.log(`  Name            ${config.name || "(none — the email is shown instead)"}`)
  console.log("  Password        read from NOTILAB_ADMIN_PASSWORD, never printed")
  console.log(
    `  Existing user   ${
      existing
        ? `yes — role ${existing.role}, password ${hasPassword ? "set" : "not set"}, ${
            existing.isActive ? "active" : "INACTIVE"
          }`
        : "no"
    }`,
  )
  console.log("")

  const changes: string[] = []

  if (!existing) {
    changes.push(
      `CREATE user ${config.email} with role ${config.role}, a new password hash, isActive=true`,
    )
  } else {
    if (hasPassword && !FORCE_PASSWORD) {
      fail(
        `${config.email} already has a password set, and this script will not ` +
          "overwrite one by accident.\n           Re-run with --force-password if " +
          "resetting it is what you intend.",
      )
    }
    changes.push(
      hasPassword
        ? `REPLACE the existing password hash for ${config.email} (--force-password)`
        : `SET a password hash for ${config.email}, which currently has none`,
    )

    if (existing.role !== config.role) {
      if (!FORCE_ROLE) {
        fail(
          `${config.email} currently has role ${existing.role}, not ${config.role}.\n` +
            "           Re-run with --force-role to change it, or set " +
            "NOTILAB_ADMIN_ROLE to the current role.",
        )
      }
      changes.push(`CHANGE role ${existing.role} → ${config.role} (--force-role)`)
    }

    if (!existing.isActive) {
      changes.push("REACTIVATE the account (isActive false → true)")
    }
    if (config.name && config.name !== existing.name) {
      changes.push(`UPDATE name → ${config.name}`)
    }
  }

  console.log("  Planned changes:")
  for (const change of changes) console.log(`    - ${change}`)
  console.log("")

  if (!APPLY) {
    console.log("  DRY RUN — nothing was written. Re-run with --apply to perform the above.")
    console.log(`  Reminder: ${target} may be the production database.`)
    console.log("")
    return
  }

  const passwordHash = await bcrypt.hash(config.password, BCRYPT_COST)

  const user = await prisma.user.upsert({
    where: { email: config.email },
    update: {
      password: passwordHash,
      role: config.role,
      isActive: true,
      ...(config.name ? { name: config.name } : {}),
    },
    create: {
      email: config.email,
      password: passwordHash,
      role: config.role,
      isActive: true,
      ...(config.name ? { name: config.name } : {}),
    },
    select: { id: true, email: true, role: true },
  })

  console.log(`  APPLIED  ${user.email} (${user.role}), id ${user.id}`)
  console.log("  Sign in at /admin/login. JWT_SECRET (>= 32 characters) must be set in the")
  console.log("  environment that serves the request, or the login route answers 503.")
  console.log("")
}

main()
  .catch((error) => {
    if (!(error instanceof ProvisioningRefused)) {
      console.error("\n  FAILED  ", error instanceof Error ? error.message : error, "\n")
      process.exitCode = 1
    }
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
