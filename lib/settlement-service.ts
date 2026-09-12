import 'server-only';
import { Prisma } from '@prisma/client';
import { ApiError } from './api';
import { dbSchema } from './database-schema';
import { expenseInclude } from './expense-service';
import { serializeExpense } from './expenses';
import { isSampleRecord } from './sample-data';
import { SettlementBatch } from './settlement-batch';

// Caller holds the household advisory lock. Every allocation commits in one transaction.
export async function settleBatch(tx: Prisma.TransactionClient, ledgerId: string, input: SettlementBatch) {
  const ids = input.entries.map(e => e.expenseId).sort();
  await tx.$queryRaw(Prisma.sql`select id from ${dbSchema}.expenses where user_id=${ledgerId}::uuid and id in (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) order by id for update`);
  const expenses = (await tx.expense.findMany({ where: { userId: ledgerId, id: { in: ids } }, include: expenseInclude })).map(serializeExpense);
  if (expenses.length !== ids.length) throw new ApiError(404, '対象の支出が見つかりません。');
  const old = await tx.settlement.findMany({ where: { userId: ledgerId, id: { in: input.entries.map(e => e.id) } } });
  if (old.length) {
    if (old.length !== input.entries.length || input.entries.some(entry => {
      const row = old.find(s => s.id === entry.id);
      return !row || row.cancelledAt || row.expenseId !== entry.expenseId || row.amount !== entry.amount || row.date.toISOString().slice(0,10) !== input.date || row.memo !== input.memo || row.fromPartyId !== input.fromPartyId || row.toPartyId !== input.toPartyId;
    })) throw new ApiError(409, '保存済みの精算と内容が異なります。精算状況を更新してください。');
    return { created: false, count: old.length };
  }
  for (const entry of input.entries) {
    const expense = expenses.find(e => e.id === entry.expenseId)!;
    if (isSampleRecord(expense)) throw new ApiError(422, 'サンプルの支出は実際の精算に含められません。');
    if (expense.version !== entry.expenseVersion || expense.reimbursementStatus !== 'required' || expense.reimbursementFromPartyId !== input.fromPartyId || expense.reimbursementToPartyId !== input.toPartyId || entry.amount !== expense.reimbursementAmount - expense.settledAmount) {
      throw new ApiError(409, '支出・相手・未精算額が変更されています。一覧を更新して選び直してください。');
    }
  }
  const values = input.entries.map(e => Prisma.sql`(${e.id}::uuid,${ledgerId}::uuid,${e.expenseId}::uuid,${e.amount},${new Date(input.date+'T00:00:00Z')}::date,${input.fromPartyId}::uuid,${input.toPartyId}::uuid,${input.memo})`);
  await tx.$executeRaw(Prisma.sql`insert into ${dbSchema}.settlements(id,user_id,expense_id,amount,date,from_party_id,to_party_id,memo) values ${Prisma.join(values)}`);
  await tx.expense.updateMany({ where: { userId: ledgerId, id: { in: ids } }, data: { version: { increment: 1 }, updatedAt: new Date() } });
  return { created: true, count: input.entries.length };
}
