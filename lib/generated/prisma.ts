// Committed compatibility barrel for the generated Prisma client (Prisma 7).
//
// It absorbs two Prisma 7 breaking changes so call sites read the same as they
// did under v5:
//
//  1. Generator output layout — v7's `prisma-client` generator emits its entry
//     at the `client` subpath instead of a folder index. This file re-exports
//     it, and module resolution prefers this `prisma.ts` file over the
//     same-named generated `prisma/` directory across tsc, tsx, webpack, jest.
//
//  2. Mandatory driver adapter — v7 requires an adapter in the PrismaClient
//     constructor. The `PrismaClient` exported here subclasses the generated
//     one and defaults the pg adapter (from DATABASE_URL), so a plain
//     `new PrismaClient()` keeps working. Callers may still pass their own
//     adapter, which takes precedence.
import type { Prisma } from "./prisma/client"
import { PrismaClient as GeneratedPrismaClient } from "./prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

export * from "./prisma/client"

type ClientOptions = Omit<Prisma.PrismaClientOptions, "adapter"> & {
  adapter?: Prisma.PrismaClientOptions["adapter"]
}

// An explicit named export takes precedence over the `export *` above, so this
// adapter-defaulting subclass is what every consumer receives as `PrismaClient`.
export class PrismaClient extends GeneratedPrismaClient {
  constructor(options: ClientOptions = {}) {
    super({
      ...options,
      adapter:
        options.adapter ??
        new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    } as Prisma.PrismaClientOptions)
  }
}
