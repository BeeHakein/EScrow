import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

// Per-test-file SQLite database: a throwaway temp file with the COMMITTED migrations applied
// (so the gate exercises the real migration, not an ad-hoc schema). Fully offline and isolated —
// each test file gets its own file, so parallel test files never contend. Keeps the project's
// "testing is the gate, deterministic and offline" rule intact while proving the Prisma adapters.

const PRISMA_BIN = join(process.cwd(), 'node_modules', '.bin', 'prisma');

export interface TestDb {
  readonly prisma: PrismaClient;
  readonly cleanup: () => Promise<void>;
}

export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), 'newera-prisma-'));
  const url = `file:${join(dir, 'test.db')}`;
  // Apply committed migrations to the fresh file (reads prisma/schema.prisma + prisma/migrations).
  execFileSync(PRISMA_BIN, ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
  const prisma = new PrismaClient({ datasourceUrl: url });
  const cleanup = async (): Promise<void> => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  };
  return { prisma, cleanup };
}

// Truncate all tables between tests so each case starts from a known-empty DB. Children before
// parents (FK order), though the cascade deletes would also cover it.
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.clause.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.clauseRisk.deleteMany();
  await prisma.riskReport.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.partySignature.deleteMany();
  await prisma.escrow.deleteMany();
  await prisma.party.deleteMany();
}
