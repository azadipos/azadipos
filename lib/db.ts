import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy initialization - only create PrismaClient when first accessed
let prismaInstance: PrismaClient | undefined

export const prisma = new Proxy({} as PrismaClient, {
  get: (target, prop) => {
    if (!prismaInstance) {
      prismaInstance = globalForPrisma.prisma ?? new PrismaClient()
      if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = prismaInstance
      }
    }
    return (prismaInstance as any)[prop]
  }
})
