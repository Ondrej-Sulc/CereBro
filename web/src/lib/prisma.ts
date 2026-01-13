import { PrismaClient, WarStatus } from '@prisma/client';

export { WarStatus };

declare global {
  // allow global `var` declarations
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;