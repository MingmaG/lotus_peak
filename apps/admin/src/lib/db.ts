import 'server-only';
import { PrismaClient } from '@prisma/client';

/**
 * One Prisma client.
 *
 * Kept on `globalThis` in development because Next's fast refresh re-evaluates
 * modules on every save, and a new client per evaluation exhausts Postgres's
 * connection limit within a morning's work — the error it gives ("too many
 * clients already") names the database rather than the hot reload that caused
 * it, which is why this pattern is worth the global.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
