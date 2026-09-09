import 'server-only';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ApiError } from '@/lib/api';
import { databaseOptions } from '@/lib/database-config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient | undefined;

export function getPrisma() {
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new ApiError(503, 'データベースを準備中です。');
  const create = () => new PrismaClient({ adapter: new PrismaPg(databaseOptions(connection), { schema: 'famfi' }) });
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma ??= create();
    return globalForPrisma.prisma;
  }

  prismaClient ??= create();
  return prismaClient;
}

export async function withUserDb<T>(userId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return getPrisma().$transaction(async tx => {
    await tx.$queryRaw`select set_config('app.user_id', ${userId}, true)`;
    const membership = await tx.membership.findUnique({ where: { userId } });
    if (!membership?.active) throw new ApiError(403, 'famFiの利用許可がありません。');
    return action(tx);
  }, { maxWait: 5000, timeout: 10000 });
}

export function withLedgerDb<T>(userId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return withUserDb(userId, async tx => {
    // One owner's short mutations are serialized across instances, before any row locks.
    await tx.$queryRaw`select pg_advisory_xact_lock(hashtextextended(${'famfi-ledger:' + userId}, 0))::text`;
    return action(tx);
  });
}
