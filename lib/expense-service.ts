import 'server-only';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from './api';
import { ExpenseFields, querySchema, serializeExpense } from './expenses';
import { Masters, orderedCategories } from './ledger';

export const expenseInclude = { settlements: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] } };
export async function readMasters(tx: Prisma.TransactionClient): Promise<Masters> {
  const categories = await tx.category.findMany();
  const parties = await tx.party.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  const paymentSources = await tx.paymentSource.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  return {
    categories: orderedCategories(categories.map(({ userId: _owner, ...c }) => c)),
    parties: parties.map(({ userId: _owner, ...p }) => ({ ...p, kind: p.kind as 'person' | 'shared' })),
    paymentSources: paymentSources.map(({ userId: _owner, ...p }) => ({ ...p, method: p.method as Masters['paymentSources'][number]['method'] })),
  };
}
export async function validateExpenseReferences(tx: Prisma.TransactionClient, input: ExpenseFields, existing?: ExpenseFields) {
  const masters = await readMasters(tx);
  const category = masters.categories.find(c => c.id === input.categoryId);
  const parent = masters.categories.find(c => c.id === category?.parentId);
  if (!category || ((category.archived || parent?.archived) && input.categoryId !== existing?.categoryId)) throw new ApiError(400, '使用できるカテゴリを選んでください。');
  for (const field of ['usedByPartyId', 'beneficiaryPartyId', 'paidByPartyId', 'reimbursementFromPartyId', 'reimbursementToPartyId'] as const) {
    const id = input[field];
    if (!id) continue;
    const party = masters.parties.find(p => p.id === id);
    if (!party || (party.archived && id !== existing?.[field]) || (field === 'usedByPartyId' && party.kind !== 'person')) throw new ApiError(400, '人物・共用資金の選択を確認してください。');
  }
  if (input.paymentSourceId) {
    const source = masters.paymentSources.find(s => s.id === input.paymentSourceId);
    if (!source || (source.archived && source.id !== existing?.paymentSourceId)) throw new ApiError(400, '使用できる支払元を選んでください。');
  }
}
export function sameExpense(input: ExpenseFields, row: ExpenseFields) {
  return (Object.keys(input) as (keyof ExpenseFields)[]).every(key => input[key] === row[key]);
}
export async function expenseWhere(tx: Prisma.TransactionClient, userId: string, query: Partial<z.infer<typeof querySchema>>) {
  const where: Prisma.ExpenseWhereInput = { userId };
  if (query.month) {
    const start = new Date(`${query.month}-01T00:00:00Z`); const end = new Date(start); end.setUTCMonth(end.getUTCMonth()+1);
    where.date = { gte: start, lt: end };
  }
  if (query.category) {
    const children = await tx.category.findMany({ where: { parentId: query.category }, select: { id: true } });
    where.categoryId = { in: [query.category, ...children.map(c => c.id)] };
  }
  if (query.person) where.OR = [{ usedByPartyId: query.person }, { beneficiaryPartyId: query.person }, { paidByPartyId: query.person }, { reimbursementFromPartyId: query.person }, { reimbursementToPartyId: query.person }];
  if (query.paymentSource) where.paymentSourceId = query.paymentSource;
  if (query.search) where.AND = [{ OR: [{ description: { contains: query.search, mode: 'insensitive' } }, { memo: { contains: query.search, mode: 'insensitive' } }] }];
  if (query.settlement === 'unknown' || query.settlement === 'not_required') where.reimbursementStatus = query.settlement;
  else if (query.settlement) {
    const balance = Prisma.sql`coalesce((select sum(s.amount) from famfi.settlements s where s.user_id=e.user_id and s.expense_id=e.id and s.cancelled_at is null),0)`;
    const condition = query.settlement === 'settled' ? Prisma.sql`${balance} = e.reimbursement_amount`
      : query.settlement === 'partial' ? Prisma.sql`${balance} > 0 and ${balance} < e.reimbursement_amount` : Prisma.sql`${balance} = 0`;
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`select e.id from famfi.expenses e where e.user_id=${userId}::uuid and e.reimbursement_status='required' and ${condition}`);
    where.id = { in: ids.map(row => row.id) };
  }
  return where;
}
export async function lockedExpense(tx: Prisma.TransactionClient, userId: string, id: string) {
  const locks = await tx.$queryRaw<{ id: string }[]>`select id from famfi.expenses where user_id=${userId}::uuid and id=${id}::uuid for update`;
  if (!locks.length) throw new ApiError(404, '支出が見つかりません。');
  return serializeExpense(await tx.expense.findUniqueOrThrow({ where: { id }, include: expenseInclude }));
}
