import { requireUser } from '@/lib/auth/server';
import { withUserDb } from '@/lib/prisma';
import { ApiError, apiError, assertSameOrigin, json, readJson } from '@/lib/api';
import { PAGE_SIZE, createExpenseSchema, expenseDateForStorage, monthRange, querySchema, serializeExpense } from '@/lib/expenses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await withUserDb(user.id, async tx => {
      const where = { userId: user.id, date: monthRange(query.month) };
      const filtered = { ...where, ...(query.category ? { categoryId: query.category } : {}) };
      const expenses = await tx.expense.findMany({ where: filtered, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }], take: PAGE_SIZE, skip: (query.page - 1) * PAGE_SIZE });
      const categories = await tx.category.findMany({ orderBy: { sortOrder: 'asc' } });
      const totals = await tx.expense.aggregate({ where, _sum: { amount: true }, _count: true });
      const groups = await tx.expense.groupBy({ by: ['categoryId'], where, _sum: { amount: true }, _count: true });
      const filteredCount = query.category ? await tx.expense.count({ where: filtered }) : totals._count;
      return { expenses: expenses.map(serializeExpense), categories, total: totals._sum.amount ?? 0,
        count: totals._count, filteredCount,
        breakdown: groups.map(g => ({ categoryId: g.categoryId, amount: g._sum.amount ?? 0, count: g._count })) };
    }));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = createExpenseSchema.parse(await readJson(request));
    const storedDate = expenseDateForStorage(input.date);
    const result = await withUserDb(user.id, async tx => {
      // The client retains this UUID across retries, preventing ambiguous network failures from duplicating a record.
      // Prisma createMany also names default metadata columns, which this role must not insert.
      const inserted = await tx.$executeRaw`
        insert into famfi.expenses (id, user_id, amount, date, date_precision, category_id, description, memo)
        values (${input.id}::uuid, ${user.id}::uuid, ${input.amount}, ${storedDate.date}::date, ${storedDate.datePrecision},
                ${input.categoryId}, ${input.description}, ${input.memo})
        on conflict (id) do nothing`;
      const expense = await tx.expense.findUnique({ where: { id: input.id } });
      if (!expense) throw new ApiError(409, '保存内容が競合しました。一覧を更新してください。');
      const row = serializeExpense(expense);
      if (!inserted && (row.amount !== input.amount || row.date !== input.date || row.categoryId !== input.categoryId || row.description !== input.description || row.memo !== input.memo)) {
        throw new ApiError(409, 'この記録はすでに保存されています。一覧を更新してください。');
      }
      return { row, created: inserted > 0 };
    });
    return json(result.row, result.created ? 201 : 200);
  } catch (error) { return apiError(error); }
}
