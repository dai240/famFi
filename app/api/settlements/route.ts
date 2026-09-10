import { dbSchema } from "@/lib/database-schema";
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { createSettlementSchema, PAGE_SIZE, serializeExpense } from '@/lib/expenses';
import { expenseInclude, lockedExpense, readMasters } from '@/lib/expense-service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), view: z.enum(['open','all']).default('open') }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await withUserDb(user.id, async (tx, scope) => {
      const base = Prisma.sql`from ${dbSchema}.expenses e where e.user_id=${scope.ledgerId}::uuid and e.reimbursement_status='required'`;
      const balance = Prisma.sql`e.reimbursement_amount - coalesce((select sum(s.amount) from ${dbSchema}.settlements s where s.user_id=e.user_id and s.expense_id=e.id and s.cancelled_at is null),0)`;
      const filter = query.view === 'open' ? Prisma.sql`and ${balance} > 0` : Prisma.empty;
      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`select e.id ${base} ${filter} order by e.date desc,e.id limit ${PAGE_SIZE} offset ${(query.page-1)*PAGE_SIZE}`);
      const counts = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`select count(*)::int as count ${base} ${filter}`);
      const groups = await tx.$queryRaw<{ fromPartyId: string; toPartyId: string; amount: bigint }[]>(Prisma.sql`select e.reimbursement_from_party_id as "fromPartyId",e.reimbursement_to_party_id as "toPartyId",sum(${balance})::bigint as amount ${base} and ${balance}>0 group by e.reimbursement_from_party_id,e.reimbursement_to_party_id`);
      const rows = await tx.expense.findMany({ where: { id: { in: ids.map(i => i.id) } }, include: expenseInclude, orderBy: [{ date: 'desc' }, { id: 'asc' }] });
      return { ...(await readMasters(tx)), expenses: rows.map(serializeExpense), count: counts[0].count, groups: groups.map(g => ({ ...g, amount: Number(g.amount) })), unknownCount: await tx.expense.count({ where: { reimbursementStatus: 'unknown' } }) };
    });
    return json(result);
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requireUser(); const input = createSettlementSchema.parse(await readJson(request));
    const result = await withLedgerDb(user.id, async (tx, scope) => {
      const expense = await lockedExpense(tx, scope.ledgerId, input.expenseId);
      const old = await tx.settlement.findUnique({ where: { id: input.id } });
      if (old) {
        if (old.expenseId !== input.expenseId || old.amount !== input.amount || old.date.toISOString().slice(0,10) !== input.date || old.memo !== input.memo || old.cancelledAt) throw new ApiError(409, 'この精算記録はすでに保存または取消されています。');
        return expense;
      }
      if (expense.version !== input.expenseVersion) throw new ApiError(409, '支出が変更されています。開き直してください。');
      if (expense.reimbursementStatus !== 'required' || input.amount > expense.reimbursementAmount-expense.settledAmount) throw new ApiError(409, '未精算額を超えています。精算状況を更新してください。');
      await tx.$executeRaw`insert into ${dbSchema}.settlements(id,user_id,expense_id,amount,date,from_party_id,to_party_id,memo) values (${input.id}::uuid,${scope.ledgerId}::uuid,${input.expenseId}::uuid,${input.amount},${new Date(input.date+'T00:00:00Z')}::date,${expense.reimbursementFromPartyId}::uuid,${expense.reimbursementToPartyId}::uuid,${input.memo})`;
      await tx.expense.update({ where: { id: input.expenseId }, data: { version: { increment: 1 }, updatedAt: new Date() } });
      return serializeExpense(await tx.expense.findUniqueOrThrow({ where: { id: input.expenseId }, include: expenseInclude }));
    });
    return json(result, 201);
  } catch (error) { return apiError(error); }
}
