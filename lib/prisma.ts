import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient | undefined;

export function getPrisma() {
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma ??= new PrismaClient();
    return globalForPrisma.prisma;
  }

  prismaClient ??= new PrismaClient();
  return prismaClient;
}
