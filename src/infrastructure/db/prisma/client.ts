import { PrismaClient } from '@prisma/client';

// App-wide singleton. Repos take a PrismaClient via their constructor (inject-the-dependency,
// same as the Claude/extractor adapters) so tests can pass their own client pointed at a temp
// sqlite DB; this default is what production wiring injects. The globalThis guard avoids
// exhausting connections across hot-reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
