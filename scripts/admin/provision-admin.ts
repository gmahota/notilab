/**
 * scripts/admin/provision-admin.ts — Creates or repairs one admin account.
 *
 *   pnpm admin:provision --email you@example.com --role SUPER_ADMIN --confirm-production-write
 *
 * Why this exists: the login route reads admin accounts from the database, and
 * nothing in prisma/seed.ts ever creates one with a password hash. Without this
 * script a correct deployment has no way in at all.
 *
 * THIS SCRIPT WRITES TO THE DATABASE IN DATABASE_URL, AND LOCAL AND PRODUCTION
 * SHARE ONE NEON INSTANCE. There is no such thing as running it "just locally".
 * Hence the mandatory --confirm-production-write flag: this is the one action in
 * the admin-auth work that cannot be undone by editing a file.
 *
 * The password is never accepted as a command-line argument. Argv lands in shell
 * history and is visible to anything that can read the process table, and a
 * password that leaks the moment it is set is not a fix for a leaked password.
 * Pass it in ADMIN_PASSWORD, or leave that unset and the script reads one line
 * from stdin. It is never printed, logged, or echoed back.
 */

import { PrismaClient, UserRole } from "@prisma/client"
import { createInterface } from "node:readline"
import { hashAdminPassword, BCRYPT_COST, MIN_ADMIN_PASSWORD_LENGTH } from "../../lib/admin-password"

const CONFIRM_FLAG = "--confirm-production-write"

/**
 * Roles this script will provision: every UserRole except USER.
 *
 * Derived from the Prisma enum at runtime rather than imported from
 * lib/admin-auth.ts, which cannot be loaded here — it imports `next/headers`,
 * which has no meaning outside a Next request. The membership rule
 * ("everything except USER") is the same rule ADMIN_ROLE encodes there. If a new
 * role is added to the enum, lib/admin-auth.ts will force an explicit decision
 * at typecheck time; this script would accept it silently, which is why it
 * prints the role back before writing anything.
 */
const PROVISIONABLE_ROLES = Object.values(UserRole).filter((role) => role !== UserRole.USER)

interface Options {
  email: string
  role: UserRole
  confirmed: boolean
  updateExisting: boolean
}

function fail(message: string): never {
  console.error(`\n  ERROR  ${message}\n`)
  process.exit(1)
}

function usage(): string {
  return [
    "",
    "  Usage:",
    `    pnpm admin:provision --email <address> [--role <ROLE>] ${CONFIRM_FLAG} [--update-existing]`,
    "",
    `  Roles:    ${PROVISIONABLE_ROLES.join(", ")}   (default: SUPER_ADMIN)`,
    "  Password: set ADMIN_PASSWORD, or leave it unset to be prompted on stdin.",
    `            Minimum ${MIN_ADMIN_PASSWORD_LENGTH} characters. Never pass it as an argument.`,
    "",
  ].join("\n")
}

function parseArgs(argv: string[]): Options {
  let email = ""
  let role: string = UserRole.SUPER_ADMIN
  let confirmed = false
  let updateExisting = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === "--email") {
      email = argv[++i] ?? ""
    } else if (arg === "--role") {
      role = argv[++i] ?? ""
    } else if (arg === CONFIRM_FLAG) {
      confirmed = true
    } else if (arg === "--update-existing") {
      updateExisting = true
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage())
      process.exit(0)
    } else if (arg === "--password" || arg.startsWith("--password=")) {
      // Refused rather than ignored, so nobody assumes it worked.
      fail("--password is not accepted. Use the ADMIN_PASSWORD env var or stdin.")
    } else {
      fail(`Unknown argument: ${arg}${usage()}`)
    }
  }

  // Normalised exactly as app/api/admin/auth/route.ts normalises the submitted
  // address. The email column is @unique and case-sensitive, so provisioning
  // "Admin@x.com" while the route looks up "admin@x.com" creates an account
  // that can never log in.
  email = email.trim().toLowerCase()

  if (!email) fail(`--email is required.${usage()}`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Not a valid email address: ${email}`)

  if (!(PROVISIONABLE_ROLES as string[]).includes(role)) {
    fail(`Role must be one of: ${PROVISIONABLE_ROLES.join(", ")}`)
  }

  return { email, role: role as UserRole, confirmed, updateExisting }
}

/** Reads one line from stdin. Not hidden — see the warning printed alongside. */
async function promptForPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    console.log("  ADMIN_PASSWORD is not set. Type the password and press Enter.")
    console.log("  It WILL be visible as you type; prefer ADMIN_PASSWORD in a non-shared shell.")
    return await new Promise<string>((resolve) => {
      rl.question("  Password: ", (answer) => resolve(answer))
    })
  } finally {
    rl.close()
  }
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD
  const password = fromEnv !== undefined ? fromEnv : await promptForPassword()

  // Length only. The value is never included in any message.
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    fail(
      `Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters (got ${password.length}). ` +
        "There is no account lockout on the login route by design, so length is what makes " +
        "online guessing impractical.",
    )
  }

  if (password.trim().length !== password.length) {
    fail("Password has leading or trailing whitespace, which is almost always an accident.")
  }

  return password
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  console.log("")
  console.log("  ============================================================")
  console.log("   NotiLab admin provisioning")
  console.log("")
  console.log("   THIS WRITES TO THE SHARED PRODUCTION NEON DATABASE.")
  console.log("   Local and production point at the same instance. There is no")
  console.log("   separate local copy, and this write cannot be rolled back by")
  console.log("   reverting a commit.")
  console.log("  ============================================================")
  console.log("")
  console.log(`   Email: ${options.email}`)
  console.log(`   Role:  ${options.role}`)
  console.log(`   bcrypt cost: ${BCRYPT_COST}`)
  console.log("")

  if (!options.confirmed) {
    fail(`Refusing to write without ${CONFIRM_FLAG}.${usage()}`)
  }

  if (!process.env.DATABASE_URL?.trim()) {
    fail("DATABASE_URL is not set. Load your environment before running this.")
  }

  if (!process.env.JWT_SECRET?.trim()) {
    // Not fatal: the account is still worth creating. But a login against it
    // returns 503 until the secret exists, and that is worth knowing now rather
    // than discovering at the login form.
    console.warn(
      "  WARNING  JWT_SECRET is not set in this environment. Provisioning will still\n" +
        "           work, but logging in returns 503 until JWT_SECRET (>= 32 chars) is\n" +
        "           set wherever the app runs, e.g. the Vercel project settings.\n",
    )
  }

  const password = await readPassword()
  const prisma = new PrismaClient()

  try {
    const existing = await prisma.user.findUnique({
      where: { email: options.email },
      select: { id: true, role: true, isActive: true, password: true },
    })

    if (existing && !options.updateExisting) {
      fail(
        `An account already exists for ${options.email} (role ${existing.role}, ` +
          `password ${existing.password ? "set" : "not set"}). ` +
          "Pass --update-existing to overwrite its password and role. " +
          "Read that twice: it can promote an ordinary reader account to an admin one.",
      )
    }

    const hashed = await hashAdminPassword(password)

    if (existing) {
      await prisma.user.update({
        where: { email: options.email },
        data: { password: hashed, role: options.role, isActive: true },
      })
      console.log(`  Updated ${options.email} -> role ${options.role}, active, password replaced.`)
    } else {
      await prisma.user.create({
        data: { email: options.email, role: options.role, isActive: true, password: hashed },
      })
      console.log(`  Created ${options.email} -> role ${options.role}, active.`)
    }

    // Deliberately reported, because the interim mitigation for the flat RBAC
    // across the admin routes is operational: with exactly one SUPER_ADMIN, the
    // fact that a REDATOR token currently reaches every admin surface has no
    // account to exploit.
    const superAdmins = await prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN, isActive: true },
    })
    console.log(`  Active SUPER_ADMIN accounts now: ${superAdmins}`)

    if (superAdmins > 1) {
      console.warn(
        "  WARNING  More than one active SUPER_ADMIN. Every admin route currently\n" +
          "           accepts any admin role, so each one is a full-reach credential.\n",
      )
    }

    console.log("")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  // Never print the error object wholesale: a Prisma error can echo the query
  // parameters back, and one of those parameters is the password hash.
  console.error(
    `\n  ERROR  Provisioning failed: ${error instanceof Error ? error.name : "unknown error"}\n`,
  )
  process.exit(1)
})
