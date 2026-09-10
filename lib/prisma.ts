import 'server-only';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ApiError } from '@/lib/api';
import { databaseOptions } from '@/lib/database-config';
import { databaseEnvironment } from '@/lib/database-environment';
import generatedEnvironment from '@/lib/generated/prisma/environment.json';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient | undefined;

export function getPrisma() {
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new ApiError(503, 'データベースを準備中です。');
  const { schema } = databaseEnvironment();
  const create = () => {
    if (generatedEnvironment.schema !== schema) throw new Error('Database schema and generated client differ');
    return new PrismaClient({ adapter: new PrismaPg(databaseOptions(connection), { schema }) });
  };
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma ??= create();
    return globalForPrisma.prisma;
  }

  prismaClient ??= create();
  return prismaClient;
}

export type LedgerContext = { ledgerId: string; partyId: string; userId: string };

export async function withUserDb<T>(userId: string, action: (tx: Prisma.TransactionClient, context: LedgerContext) => Promise<T>) {
  return getPrisma().$transaction(async tx => {
    await tx.$queryRaw`select set_config('app.user_id', ${userId}, true)`;
    const membership = await tx.membership.findUnique({ where: { userId } });
    if (!membership?.active) throw new ApiError(403, 'famFiの利用許可がありません。');
    const member = await tx.householdMember.findUnique({ where: { userId } });
    if (!member) throw new ApiError(403, '家計簿への参加設定がありません。');
    return action(tx, { ledgerId: member.ledgerId, partyId: member.partyId, userId });
  }, { maxWait: 5000, timeout: 10000 });
}

export function withLedgerDb<T>(userId: string, action: (tx: Prisma.TransactionClient, context: LedgerContext) => Promise<T>) {
  return withUserDb(userId, async (tx, context) => {
    // Both household members use the same lock, before any row locks.
    await tx.$queryRaw`select pg_advisory_xact_lock(hashtextextended(${databaseEnvironment().schema + '-ledger:' + context.ledgerId}, 0))::text`;
    return action(tx, context);
  });
}
