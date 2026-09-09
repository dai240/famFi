import { requireUser } from '@/lib/auth/server';
import { withUserDb, withLedgerDb } from '@/lib/prisma';
import { apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { PAGE_SIZE, createExpenseSchema, monthRange, querySchema, serializeExpense } from '@/lib/expenses';
import { expenseInclude, expenseWhere, readMasters, insertExpense } from '@/lib/expense-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id, async (tx, scope) => {
      const where = { userId: scope.ledgerId, date: monthRange(query.month) };
      const filtered = await expenseWhere(tx, scope.ledgerId, query);
      const expenses = await tx.expense.findMany({ where: filtered, include: expenseInclude, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }], take: PAGE_SIZE, skip: (query.page - 1) * PAGE_SIZE });
      const masters = await readMasters(tx);
      const totals = await tx.expense.aggregate({ where, _sum: { amount: true }, _count: true });
      const groups = await tx.expense.groupBy({ by: ['categoryId'], where, _sum: { amount: true }, _count: true });
      const filteredTotals = await tx.expense.aggregate({ where: filtered, _sum: { amount: true }, _count: true });
      const direct = await tx.expense.groupBy({ by: ['paidByPartyId'], where: { ...where, paymentTreatment: 'direct' }, _sum: { amount: true } });
      const breakdown = new Map<string, { categoryId: string; amount: number; count: number }>();
      for (const group of groups) {
        const categoryId = masters.categories.find(c => c.id === group.categoryId)?.parentId ?? group.categoryId;
        const item = breakdown.get(categoryId) ?? { categoryId, amount: 0, count: 0 };
        item.amount += group._sum.amount ?? 0; item.count += group._count; breakdown.set(categoryId, item);
      }
      return { expenses: expenses.map(serializeExpense), ...masters, total: totals._sum.amount ?? 0,
        count: totals._count, filteredCount: filteredTotals._count, filteredTotal: filteredTotals._sum.amount ?? 0,
        breakdown: [...breakdown.values()], directContributions: direct.filter(g => g.paidByPartyId).map(g => ({ partyId: g.paidByPartyId!, amount: g._sum.amount ?? 0 })) };
    }));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id, ...input } = createExpenseSchema.parse(await readJson(request));
    const result = await withLedgerDb(user.id, (tx, scope) => insertExpense(tx, scope.ledgerId, id, input));
    return json(result.row, result.created ? 201 : 200);
  } catch (error) { return apiError(error); }
}
