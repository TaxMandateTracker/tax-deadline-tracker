import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Use dynamic import to avoid Vercel build issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client")

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any
}

export const prisma = globalForPrisma.prisma || (() => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
})()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}