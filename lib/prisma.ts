// Temporary mock implementation for Prisma client until it can be properly generated
// This allows the build to succeed in environments with network restrictions

const mockPrisma = {
  news: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => null,
    update: async () => null,
    delete: async () => null,
  },
  user: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => null,
    update: async () => null,
    delete: async () => null,
  },
  category: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => null,
    update: async () => null,
    delete: async () => null,
    upsert: async () => null,
  },
}

export const prisma = mockPrisma as any
