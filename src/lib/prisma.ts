import { PrismaClient } from "@prisma/client";

// Next.js gelistirme modunda hot-reload sirasinda birden fazla PrismaClient
// olusmasini engellemek icin global'e tek bir ornek kaydediyoruz.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
